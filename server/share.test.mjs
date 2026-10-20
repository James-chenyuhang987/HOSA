import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, readFile, stat, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { sharingConfig, sharingToken, startSharing, tunnelUrl } from './share.mjs'

const token = 'test-share-token-at-least-24-characters'
async function tokenPath(t) {
  const dir = await mkdtemp(resolve(tmpdir(), 'hosa-share-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return resolve(dir, '.env.share.local')
}

test('creates a private credential once, including concurrent startup, without returning it in a URL', async (t) => {
  const path = await tokenPath(t)
  const [first, second] = await Promise.all([sharingToken({}, path), sharingToken({}, path)])
  assert.equal(first.token, second.token)
  assert.ok(first.token.length >= 24)
  assert.equal(first.location, path)
  assert.match(await readFile(path, 'utf8'), /^HOSA_API_TOKEN=[A-Za-z0-9_-]+\n$/u)
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test('uses an existing credential and refuses short or malformed credentials without rotating them', async (t) => {
  const path = await tokenPath(t)
  assert.equal((await sharingToken({ HOSA_API_TOKEN: token }, path)).token, token)
  await assert.rejects(sharingToken({ HOSA_API_TOKEN: 'short' }, path))
  await assert.rejects(stat(path))
  await writeFile(path, 'HOSA_API_TOKEN=short\n')
  await assert.rejects(sharingToken({}, path))
  assert.equal(await readFile(path, 'utf8'), 'HOSA_API_TOKEN=short\n')
})

test('prepares a separate authenticated loopback listener and allows the GitHub Pages origin', async () => {
  const config = await sharingConfig({ HOSA_HOST: '0.0.0.0', HOSA_PORT: '8787' }, token)
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 8788)
  assert.equal(config.token, token)
  assert.ok(config.allowedOrigins.includes('https://james-chenyuhang987.github.io'))
  assert.ok(!config.allowedOrigins.includes('*'))
  await assert.rejects(sharingConfig({}, 'short'))
  await assert.rejects(sharingConfig({ HOSA_PAGE_ORIGIN: 'https://example.test/HOSA/' }, token))
})

test('extracts only a complete Cloudflare HTTPS hostname', () => {
  assert.equal(tunnelUrl('Visit https://one-two-3.trycloudflare.com |'), 'https://one-two-3.trycloudflare.com')
  assert.equal(tunnelUrl('https://one.trycloudflare.com.attacker.test'), null)
  assert.equal(tunnelUrl('http://one.trycloudflare.com'), null)
  assert.equal(tunnelUrl('https://one.trycloudflare.co'), null)
})

class FakeTunnel extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  kill() { this.killed = true; this.emit('exit', 0); return true }
}

test('wires a tunnel to only its authenticated listener, handles split logs and closes both on stop', async (t) => {
  const config = { ...await sharingConfig({}, token), port: 0 }
  const child = new FakeTunnel()
  const logs = []
  let command
  const session = await startSharing(config, { log: (line) => logs.push(line), spawnImpl: (...args) => { command = args; return child } })
  t.after(() => session.close())
  assert.equal(command[0], 'cloudflared')
  assert.deepEqual(command[1], ['tunnel', '--url', session.localUrl])
  child.stderr.write('https://one-two.')
  child.stderr.write('trycloudflare.com\n')
  assert.equal(await session.ready, 'https://one-two.trycloudflare.com')
  assert.ok(config.allowedOrigins.includes('https://one-two.trycloudflare.com'))
  assert.ok(!logs.join('').includes(token))
  const denied = await fetch(`${session.localUrl}/api/translate`)
  assert.equal(denied.status, 401)
  const allowed = await fetch(`${session.localUrl}/api/translate`, { headers: {
    Origin: 'https://james-chenyuhang987.github.io', Authorization: `Bearer ${token}`,
  } })
  assert.equal(allowed.status, 405)
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://james-chenyuhang987.github.io')
  await session.close()
  assert.equal(child.killed, true)
  assert.equal(session.server.address(), null)
})

test('shuts down its listener when the tunnel exits before returning a hostname', async () => {
  const child = new FakeTunnel()
  const session = await startSharing({ ...await sharingConfig({}, token), port: 0 }, { spawnImpl: () => child, log: () => {} })
  const failed = assert.rejects(session.ready)
  child.emit('exit', 1)
  await failed
  await session.ended
  assert.equal(session.server.address(), null)
})

test('stops a stalled tunnel after the startup deadline', async () => {
  const child = new FakeTunnel()
  const session = await startSharing({ ...await sharingConfig({}, token), port: 0 }, {
    spawnImpl: () => child, log: () => {}, startupTimeoutMs: 20,
  })
  await assert.rejects(session.ready, /未能取得公网地址/u)
  await session.ended
  assert.equal(child.killed, true)
  assert.equal(session.server.address(), null)
})
