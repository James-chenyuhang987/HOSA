import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.mjs'
import { createTranslationServer } from './index.mjs'

const SAFE_TOKEN = /^[\x21-\x7e]{24,256}$/u

export async function sharingToken(env, path = resolve('server/.env.share.local')) {
  if (env.HOSA_API_TOKEN) {
    if (!SAFE_TOKEN.test(env.HOSA_API_TOKEN)) throw new Error('现有 HOSA_API_TOKEN 不符合安全格式，请在 server/.env 中修改后再分享。')
    return { token: env.HOSA_API_TOKEN, location: 'server/.env 或 HOSA_API_TOKEN 环境变量' }
  }
  let content
  try { content = await readFile(path, 'utf8') }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const token = randomBytes(32).toString('base64url')
    try { await writeFile(path, `HOSA_API_TOKEN=${token}\n`, { flag: 'wx', mode: 0o600 }) }
    catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError }
    content = await readFile(path, 'utf8')
  }
  const token = parseEnv(content).HOSA_API_TOKEN
  if (!token || !SAFE_TOKEN.test(token)) throw new Error('分享凭证文件不合法，请检查 server/.env.share.local。')
  await chmod(path, 0o600)
  return { token, location: path }
}

export async function sharingConfig(env, token) {
  const config = await loadConfig({ ...env, HOSA_HOST: '127.0.0.1',
    HOSA_PORT: env.HOSA_SHARE_PORT || '8788', HOSA_API_TOKEN: token, HOSA_PUBLIC_MODE: '1' })
  const origin = new URL(env.HOSA_PAGE_ORIGIN || 'https://james-chenyuhang987.github.io')
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash
    || (origin.pathname !== '/' && origin.pathname !== '')) throw new Error('HOSA_PAGE_ORIGIN 需要完整的 HTTPS 网页来源，不包含 /HOSA/ 路径。')
  if (!config.allowedOrigins.includes(origin.origin)) config.allowedOrigins.push(origin.origin)
  return config
}

export function tunnelUrl(log) {
  return log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com(?=[/\s|]|$)/iu)?.[0] || null
}

// This only owns its new listener and child process; the existing local server stays independent.
export async function startSharing(config, { spawnImpl = spawn, log = console.log, startupTimeoutMs = 45_000 } = {}) {
  const server = createTranslationServer(config)
  await new Promise((done, reject) => {
    server.once('error', reject)
    server.listen(config.port, config.host, () => { server.off('error', reject); done() })
  })
  const localUrl = `http://127.0.0.1:${server.address().port}`
  let child
  let timer
  let closed = false
  let resolveClosed
  let resolveReady
  let rejectReady
  let announced = false
  const ended = new Promise((done) => { resolveClosed = done })
  const ready = new Promise((done, reject) => { resolveReady = done; rejectReady = reject })
  // A CLI failure can arrive before the caller attaches its ready handler.
  void ready.catch(() => {})
  const close = async () => {
    if (closed) return ended
    closed = true
    clearTimeout(timer)
    if (!announced) rejectReady(new Error('隧道在准备完成前已关闭。'))
    child?.kill('SIGTERM')
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
    resolveClosed()
    return ended
  }
  try {
    const childEnv = Object.fromEntries(Object.entries(process.env)
      .filter(([name]) => ['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT'].includes(name)))
    child = spawnImpl('cloudflared', ['tunnel', '--url', localUrl], { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv })
  } catch (error) { await close(); throw error }
  let recent = ''
  const inspect = (chunk) => {
    recent = (recent + chunk.toString()).slice(-4096)
    const url = tunnelUrl(recent)
    if (!url || announced || closed) return
    announced = true
    clearTimeout(timer)
    config.allowedOrigins.push(url)
    log(`公网翻译 API：${url}/api`)
    log(`共享页面：${url}/HOSA/`)
    log('这是临时地址，重启隧道后会变化；停止当前进程即可停止分享。')
    resolveReady(url)
  }
  child.stdout?.on('data', inspect)
  child.stderr?.on('data', inspect)
  child.once('error', () => {
    rejectReady(new Error('无法启动 cloudflared，请检查安装与网络。'))
    void close()
  })
  child.once('exit', () => {
    if (!closed) log('隧道已退出，分享后端正在关闭。')
    void close()
  })
  timer = setTimeout(() => {
    rejectReady(new Error('未能取得公网地址，请检查网络或已有的 cloudflared 配置。'))
    void close()
  }, startupTimeoutMs)
  return { server, ready, ended, close, localUrl }
}

async function main() {
  const cli = spawnSync('cloudflared', ['--version'], { stdio: 'ignore' })
  if (cli.error || cli.status !== 0) throw new Error('尚未安装 cloudflared。Mac 请先执行：brew install cloudflared')
  const credential = await sharingToken(process.env)
  const config = await sharingConfig(process.env, credential.token)
  const session = await startSharing(config)
  let stopping = false
  const stop = () => { stopping = true; void session.close() }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    console.log(`分享后端：${session.localUrl}；访问凭证位于 ${credential.location}（不会打印凭证）。`)
    await session.ready
    console.log('前端连接设置填写上面的 /api 地址和访问凭证。仅向允许使用的人提供凭证。')
    await session.ended
  } catch (error) {
    if (!stopping) throw error
  } finally {
    await session.close()
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main() }
  catch (error) { console.error(error.code === 'EADDRINUSE' ? '分享端口已被占用，请修改 HOSA_SHARE_PORT。' : error.message); process.exitCode = 1 }
}
