# 用自己的电脑提供翻译 API（可选）

诊途的基础医院词库已经可以直接在 GitHub Pages 运行，不需要把个人电脑当服务器。本页只适用于你明确需要本地模型补译、并愿意让一台受控设备持续在线的场景；普通用户可以跳过。

可以让 GitHub 网页或其他客户端调用你电脑上的模型。翻译仍在你的电脑运行，公网隧道只转发 HTTPS 请求：

```text
访客 / GitHub Pages → HTTPS 隧道 → 电脑上的翻译后端 → Ollama / 其他本地模型服务
```

本项目已增加 `npm run server:share`，启动独立的分享后端与 Cloudflare Quick Tunnel。默认分享后端只监听 `127.0.0.1:8788`，现有本地服务仍使用 8787。分享后端复用相同模型配置，不重新下载或部署模型。

## 先在本机部署模型

按照 [本地模型部署指南](local-model-deployment.md) 部署模型，在本地验证可用后再启动分享。隧道不会帮你安装模型。仅有“后端已连接”而模型“未就绪”时，访客仍不能获得模型翻译。

## 临时分享：适合演示和小规模试用

Mac 安装工具：

```bash
brew install cloudflared
```

安装方式来自 [Cloudflare 官方下载文档](https://developers.cloudflare.com/tunnel/downloads/)。然后在项目目录执行：

```bash
npm run build
npm run server:share
```

终端会显示类似以下地址，实际以命令输出为准：

```text
公网翻译 API：https://随机名称.trycloudflare.com/api
共享页面：https://随机名称.trycloudflare.com/HOSA/
```

这是 [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)：不需要账号或域名，进程停止后链接失效，重新启动地址会变化，不保证长期可用。命令第一次输出地址时，连接可能还需要短暂建立，使用页面的“检测连接”确认。

每次分享需要访问凭证。如果 `server/.env` 或环境变量已有至少 24 字符的 `HOSA_API_TOKEN`，会直接复用；否则首次运行生成随机凭证，保存到 **`server/.env.share.local`**，文件权限为 600。后续复用同一凭证，不在日志、URL 或 GitHub 中公开。

只把地址和凭证提供给允许使用的人。访客展开“翻译设置”与“连接设置”，填写公网 `/api` 地址和凭证，点击“保存并应用”，再打开模型补全并检测连接。凭证只在当前页面内存保存，刷新后需要重新填写。

**按 Ctrl+C 会关闭隧道及本次分享后端。**已有的本地服务器或 Ollama 服务不会被该命令关闭。

## GitHub 网页怎样连接

分享后端默认允许来源 `https://james-chenyuhang987.github.io`，与当前仓库的 Pages 地址对应。Origin 是协议和主机名，不包含 `/HOSA/` 路径。

本轮前端代码还需发布到 GitHub Pages，网页才包含模型连接设置。之后访客可以手动填写临时 API 地址；你的隧道重启后，访客需要换成新地址。

使用固定域名后，也可以在 GitHub Actions 构建环境中设置 `VITE_TRANSLATION_API_URL=https://你的API域名/api`，让网页默认连接该地址。这个变量仅保存地址，访问凭证不写入公开的前端代码、GitHub 仓库或 `VITE_*` 变量。

其他网站需要连接时，在 `server/.env` 配置 `HOSA_ALLOWED_ORIGINS`，保留需要的本地来源，并加入网站的 HTTPS Origin。调整后重启分享进程。

可选分享参数：

```dotenv
HOSA_SHARE_PORT=8788
HOSA_PAGE_ORIGIN=https://james-chenyuhang987.github.io
```

## 别人的程序如何调用

客户端在其自己的环境中设置 API 地址与凭证，然后使用同一个 JSON 接口。下面的 shell 变量应由调用者在本机配置；避免把真实凭证写进共享脚本或提交到仓库。

```bash
curl "$HOSA_REMOTE_API/translate" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $HOSA_REMOTE_TOKEN" \
  -d '{"text":"我昨天晚上开始头晕，今天又吐了。","dialect":"cantonese","direction":"toDialect"}'
```

`HOSA_REMOTE_API` 形如 `https://随机名称.trycloudflare.com/api`。`GET /api/health` 也需要 Bearer 凭证。完整接口见 [翻译 API 说明](translation-api-design.md)。CORS 只约束浏览器访问，程序客户端的访问由凭证与服务端限制控制。

## 固定地址与长期运行

长期使用建议改用有固定域名的 Cloudflare Tunnel。需要 Cloudflare 账号和托管在 Cloudflare 的域名，并在 [官方设置步骤](https://developers.cloudflare.com/tunnel/get-started/)中把服务目标配置为你的本机后端。

固定隧道使用普通后端时，在 `server/.env` 中设置 `HOSA_PUBLIC_MODE=1`、至少 24 字符的 `HOSA_API_TOKEN` 与允许的前端来源，然后运行 `npm run server`，把隧道指向 `http://127.0.0.1:8787`。公开模式即使监听本机，也会拒绝无凭证启动。不要同时把 Ollama 的 11434 端口作为公开服务目标。

当前 `server:share` 是临时演示模式，不会自动修改 DNS、创建账号、设置开机启动或配置固定隧道。

## 运行条件

电脑需要保持开机、联网，模型服务、翻译后端和隧道都要运行。睡眠、关机或网络中断都会影响外部调用。Mac 可以在演示期间用 `caffeinate -i npm run server:share` 防止空闲睡眠；保持电脑开盖并接通电源。

默认后端同时处理最多 2 个翻译请求。隧道连接在后端表现为本机连接，因此当前每 IP 每分钟 30 次的限制通常由隧道访客共同使用，适合小规模演示；大量访客需要进一步实现用户鉴权、全局配额和资源调度。延迟和人数上限还取决于模型大小与电脑硬件。

本机推理不代表请求只经过本机：公网文字会经过 Cloudflare 网络再传入电脑。现有后端不记录原文和译文，模型运行时日志仍由相应服务管理。

本轮验证使用模拟隧道进程检查启动、鉴权、跨域和退出清理，没有对外开放真实隧道，也没有宣称真实模型已部署。
