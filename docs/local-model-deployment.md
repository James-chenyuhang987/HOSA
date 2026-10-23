# 本地模型部署与前后端连接

前后端接入已实现，模型权重由维护者自行部署；这是**可选增强路径**。普通使用直接打开 GitHub Pages 即可使用浏览器内的医院词库，不需要维护者的电脑在线或运行服务器。只有希望补译未覆盖整句、或使用自定义 ASR 时，才需要部署下面的后端；应用不会自动下载模型或改写已有配置。

## 最短路径：Mac + Ollama + Hy-MT2

需要 Node.js ≥ 22.18.0，建议 24 或更新版本。后端使用 Node 原生 TypeScript 类型擦除读取共享医院词库。Ollama 需已安装并启动，默认地址为 `http://127.0.0.1:11434`。

在项目根目录执行：

```bash
npm install
cp server/models.example.json server/models.local.json
cp server/.env.example server/.env
ollama pull hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M
npm run build
npm run server
```

复制配置仅用于第一次设置；已有本地配置时直接编辑，避免覆盖。模型名和量化版本来自 [腾讯官方 GGUF 模型卡](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)。下载后可先用 `ollama run hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M` 预热，再退出交互；首次加载可能比正常翻译慢。

打开 **http://127.0.0.1:8787/HOSA/**，点击“一键开启”。它先通过默认地址 `/api/health` 检测当前方言的可用模型，成功后开启整句翻译；健康检测不发送医疗文字。高级地址、凭证及独立模型推理检测仍在“翻译设置”中。

模型显示“可用”表示服务的模型列表包含配置的模型，不代表实际推理成功或医院表达准确性。输入词库未覆盖的完整句子，例如“我昨天晚上开始头晕，今天又吐了。”，才会调用模型。完整短句命中词库时仍即时返回本地结果。

默认只启用 Hy-MT2，提供普通话与粤语双向模型补全。其他方言仍可使用本地词库，部署对应模型后再启用。

如果 M5 Max 有足够内存并希望提高粤语整句质量，可把示例配置中的 `hy-mt2-7b` 改为 `enabled: true`，并先执行 `ollama pull hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M`。它位于 1.8B 后备路由，加载和响应会更慢；不要同时启用多个大模型，先用医院场景句子逐条核对。

## 接入本地方言 ASR

语音准确率受浏览器 `SpeechRecognition` 影响时，可以额外部署一个 OpenAI Transcription 兼容接口，例如 Qwen3-ASR 或 Fun-ASR 的 HTTP 包装服务。HOSA 后端只代理当前请求，不落盘录音；模型服务的缓存和日志请按其文档配置。

在 `server/.env` 中设置：

```bash
HOSA_ASR_URL=http://127.0.0.1:8003/v1
HOSA_ASR_MODEL=qwen3-asr-1.7b
HOSA_ASR_LABEL=本地方言语音模型
# 如果 ASR 服务开启了鉴权，再设置：
# HOSA_ASR_TOKEN=your-local-asr-token
```

重启 `npm run server`，展开页面的“翻译设置”与“连接设置”并点击“检测连接”。看到“已配置”后打开“优先使用本地语音模型”。点击麦克风开始录音，再次点击会停止并发送到 `/v1/audio/transcriptions`；识别文字会复用同一套医院词库和翻译模型。若浏览器不支持 `MediaRecorder`，页面会自动退回浏览器语音识别。前端采音最多 60 秒、文件最多 10MiB；后端录音大小默认限制为 12 MB，单次 ASR 等待默认 45 秒，可用 `HOSA_MAX_AUDIO_BYTES` 和 `HOSA_ASR_TIMEOUT_MS` 调整。

ASR 服务需要返回 JSON `{ "text": "识别出的文字" }`。HOSA 会固定注入后端配置的 `model`，不接受前端选择任意模型；前端只发送 `file` 字段和后端连接凭证。建议把 ASR 绑定在 `127.0.0.1`，公网分享时同时启用 HOSA API token、明确的 CORS 来源和 HTTPS 隧道。

## 模型怎样融合

融合发生在应用路由层，不修改或合并模型权重。每次只采用一个通过校验的模型结果，避免拼接多个模型的医学事实。

| 方言 | 示例调用顺序 | 模板配置 `profile` |
| --- | --- | --- |
| 粤语 | Hy-MT2 → MiLMMT → 通用模型 | `hy-mt` / `milmmt` / `general` |
| 闽南语 | Taigi Translator → 通用模型 | `taigi` / `general` |
| 上海话、四川话、东北话 | 通用模型 | `general` |

后端按 `routes` 的顺序跳过 `enabled: false` 的模型。服务错误、单模型超时或输出校验失败后尝试下一个；全部失败时，前端保留本地参考和原文。用户取消后停止整条调用链。

Hy-MT2 与 MiLMMT 的官方材料包含粤语，不把它们配置为四川话、上海话或闽南语专用翻译器。[Hy-MT2](https://github.com/Tencent-Hunyuan/Hy-MT2)、[MiLMMT 语言表](https://github.com/xiaomi-research/gemmax)。

Taigi 面向台湾台语，与其他地区闽南语的用词和写法可能不同；反向输出普通话可能使用繁体字。OpenCC 仅转换输入到台湾繁体字形，不进行地区词汇替换，也不把简繁转换当作方言翻译。[Taigi 模型卡与模板](https://huggingface.co/Bohanlu/Taigi-Llama-2-Translator-7B)。

通用模型用于扩大其余方言的覆盖面，具体质量取决于选用的模型。当前没有已验证的四川话、上海话、东北话专用模型质量保证。

## 配置你自己的模型

编辑 `server/models.local.json`，修改后重启 `npm run server`。

- `id`：路由引用的唯一标识。
- `label`：前端显示的结果来源。
- `enabled`：已部署的模型设为 `true`。
- `runtime`：`ollama` 或 `openai`，后者表示兼容接口协议，不代表云服务。
- `profile`：`hy-mt`、`milmmt`、`taigi`、`general`。
- `baseUrl`：Ollama 地址不含 `/api`；兼容接口一般以 `/v1` 结尾。
- `model`：与 `ollama list` 或 `/v1/models` 中实际名称对齐。
- `apiKeyEnv`：可选，只填保存模型服务密钥的后端环境变量名。

若已通过 Ollama 部署通用模型，把 `general` 项的 `model` 改成实际名称，再设置 `enabled: true`。无需一定使用示例里的 `qwen3:4b`，本项目不会自动使用本机其他已安装模型。

### MiLMMT / Taigi：OpenAI 兼容服务

兼容 vLLM、SGLang，以及提供相同接口的 llama.cpp 或 LM Studio。下面是**已配置好对应 GPU 运行环境**时的 vLLM 示例；Mac 的最短路径仍是上面的 Ollama / GGUF。硬件与架构支持按运行时文档确认。

```bash
vllm serve xiaomi-research/MiLMMT-46-4B-v1.0 --host 127.0.0.1 --port 8001 --max-model-len 4096
```

另一个终端运行台语服务：

```bash
vllm serve Bohanlu/Taigi-Llama-2-Translator-7B --host 127.0.0.1 --port 8002 --max-model-len 4096
```

启用配置中对应模型，保留示例的 `/v1` 地址与实际模型名称。这两个适配器调用 `/v1/completions`，使用官方原始翻译模板，不依赖 chat template；Taigi 设置语言结束标记。Hy-MT2 与通用模型调用 `/v1/chat/completions`，需要服务提供正确的 chat template。[vLLM 在线服务文档](https://docs.vllm.ai/en/latest/serving/online_serving/)。

MiLMMT 请选择翻译版，例如 `MiLMMT-46-*-v1.0`，不使用 `*-Pretrain`。Taigi 权重标注 **CC-BY-NC-SA-4.0**，包含非商业限制，不能用代码仓库许可证替代。其他模型也应遵循其模型卡条款。

SGLang / llama.cpp / LM Studio 使用实际开启的兼容地址，例如 `http://127.0.0.1:1234/v1`。`model` 与服务返回的模型 ID 一致，`profile` 与加载的模型匹配。仅支持 chat 的服务不能运行这里依赖 completion 的专用模板。

模型服务要求密钥时，在配置中加 `"apiKeyEnv": "LOCAL_MODEL_API_KEY"`，并在 `server/.env` 设置该变量。密钥只在后端读取，不放进 `VITE_*` 或前端连接凭证。

## 开发模式与前端地址

开发时分别在两个终端运行 `npm run server` 和 `npm run dev`。使用 Vite 输出的地址打开前端，`/api` 自动转发到 `http://127.0.0.1:8787`；`npm run preview` 也配置了同一代理。

构建版由翻译后端同时托管 `/HOSA/` 与 `/api`，本地部署推荐使用这一同源方式。修改前端后重新 `npm run build`；修改后端代码或模型配置后重启后端。

后端更换端口时可直接访问新端口的 `/HOSA/`。Vite 代理仍指向 8787，需要同步修改 `vite.config.ts`，或在页面连接设置填写 `http://127.0.0.1:新端口/api`。也可用 `VITE_TRANSLATION_API_URL` 在构建时指定默认后端地址，这里仅放地址。

GitHub Pages 继续提供离线词库和地图，但不能运行 Node 后端。HTTPS 静态页面直接连接本机 HTTP 服务可能受到浏览器本地网络权限、混合内容与跨域限制，因此不作为默认部署路径。

## 后端设置

`server/.env` 支持：

| 变量 | 默认值 / 用途 |
| --- | --- |
| `HOSA_HOST` | `127.0.0.1`，仅本机访问 |
| `HOSA_PORT` | `8787` |
| `HOSA_MODEL_CONFIG` | 优先读取 `server/models.local.json`，缺失时读取示例 |
| `HOSA_API_TOKEN` | 前端连接凭证；非本机监听时需要 24–256 个可打印字符，不能含空格或换行 |
| `HOSA_ALLOWED_ORIGINS` | 逗号分隔的前端来源，必须是不带路径、查询参数或凭证的 `http/https` Origin；自动允许当前服务端口的本机页面 |
| `HOSA_REQUEST_TIMEOUT_MS` | 总请求 60000 ms，最大 80000 ms |
| `HOSA_PROVIDER_TIMEOUT_MS` | 单模型 25000 ms，受总请求期限约束 |
| `HOSA_MAX_CONCURRENT` | 同时最多 2 个翻译请求 |

每个客户端 IP 每分钟最多 30 个翻译请求，文字最多 240 字。前端连接凭证仅在页面内存使用，刷新即清除。

同一台电脑无需开放外部访问。局域网或远端部署需设置监听地址、连接凭证和明确的前端来源；远端使用 HTTPS。CORS 不能代替凭证。模型服务自身的访问控制与日志由对应运行时管理。

想让 GitHub 网页调用你电脑上的模型，可使用 `npm run server:share` 启动独立的鉴权后端与临时 HTTPS 隧道。步骤和固定域名方案见 [电脑 API 服务器指南](computer-api-server.md)。普通后端通过自建隧道分享时设 `HOSA_PUBLIC_MODE=1`，即使监听本机也会强制检查凭证。

`.env`、本地模型配置、`models/` 与 GGUF 已加入 Git 忽略规则，示例配置仍会随代码分发。

## 数据处理与质量限制

默认关闭模型补全。开启后翻译模型只接收原始文字、方言和方向；录音默认仍由 Web Speech API 处理，可能依赖浏览器识别服务商。只有明确开启本地 ASR 时，临时音频才会发到 `HOSA_ASR_URL`，HOSA 后端不记录或保存医疗原文、模型输出或录音，也不自动收录生成表达。模型运行时可能有独立日志，需要自行配置。

后端保护字面数字、常见单位、中文数量和部分药名，恢复后检查数量变化，另检查基本否定、不确定语气与截断。这些启发式检查无法证明医学语义等价，没有覆盖全部药名、单位或方言语法。模型结果均显示“模型生成 · 待核对”，不编造读音。实际应用前需要母语者及医疗口译人员评估正反向场景。

云 API 客户端、实时音视频示例和已归档翻译网页未必含独立模型权重，因此未直接打包。本轮集成模型服务适配器和路由，可按你的部署替换兼容接口。

## 验证与排错

```bash
curl http://127.0.0.1:8787/api/health
```

返回 `service: "hosa-translation"` 和可用状态，不暴露模型服务地址或密钥。设置后端凭证时需添加对应 Bearer header。

```bash
curl http://127.0.0.1:8787/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"我昨天晚上开始头晕，今天又吐了。","dialect":"cantonese","direction":"toDialect"}'
```

成功返回 `text`、`provider`、`providerId`、`needsReview: true`。`NO_PROVIDER` 表示未启用模型，`MODELS_UNAVAILABLE` 表示调用或检查失败，`TIMEOUT` 表示总请求超时；前端保留本地参考并显示提示。

自动化验证覆盖模板、超时、取消、回退、HTTP 与页面交互，使用明确标记的模拟服务。另已使用本机现有配置的 Qwen3.5 27B 跑通医院场景整句请求；少量调用成功不代表全部方言或医疗语义已经审校。真实麦克风识别、朗读质量及医院场景效果仍需在目标设备上由使用者核对。
