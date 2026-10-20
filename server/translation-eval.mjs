import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.mjs'
import { translate } from './translator.mjs'

// Synthetic fixtures only. No medical text is read from files, storage or user history.
export const translationCases = [
  { id: 'cantonese-symptom-timeline', dialect: 'cantonese', direction: 'toDialect', text: '我从昨天晚上开始肚子疼，今天早上吐了两次，没有发烧。',
    required: [/肚痛/u, /昨晚|琴晚|昨天晚上/u, /今朝|今天早上/u, /呕/u, /冇发烧|没有发烧/u] },
  { id: 'cantonese-medication-doses', dialect: 'cantonese', direction: 'toDialect', text: '我每天吃阿莫西林250 mg和布洛芬200mg，已经吃了三天。',
    required: [/阿莫西林250 mg/u, /布洛芬200mg/u, /三天/u] },
  { id: 'cantonese-uncertain-allergy', dialect: 'cantonese', direction: 'toDialect', text: '我不确定对这个药是否过敏，上次吃完后起了皮疹。',
    required: [/唔肯定|唔清楚|唔知|不确定/u, /过敏/u, /皮疹|疹/u] },
  { id: 'cantonese-precise-abdominal-region', dialect: 'cantonese', direction: 'toDialect', text: '我从昨天晚上开始右下腹疼痛，没有发烧，但一直想吐。',
    required: [/右下腹/u, /昨晚|琴晚|昨天晚上/u, /冇发烧|没有发烧|没发烧/u, /呕|吐/u] },
  { id: 'cantonese-reverse-traditional', dialect: 'cantonese', direction: 'toMandarin', text: '我左邊肚痛咗三日，冇發燒，今朝嘔咗兩次。',
    required: [/左边/u, /肚子|腹/u, /没有发烧|没发烧/u, /今天早上|今早/u, /吐/u] },
  { id: 'sichuan-laterality', dialect: 'sichuan', direction: 'toDialect', text: '我从昨天晚上开始右下腹疼痛，没有发烧，但一直想吐。',
    required: [/右下腹/u, /昨天晚上|昨晚/u, /没(?:有|得)?发烧/u, /想(?:吐|呕)/u] },
  { id: 'sichuan-reverse-symptoms', dialect: 'sichuan', direction: 'toMandarin', text: '我脑壳昏，肚皮痛，没得发烧。',
    required: [/头晕/u, /肚子|腹/u, /没有发烧|没发烧/u] },
  { id: 'northeast-question-and-not-yet', dialect: 'northeast', direction: 'toDialect', text: '这个药是饭前还是饭后吃？我还没有吃药。',
    required: [/饭前/u, /饭后/u, /[?？]/u, /还没(?:有)?吃药/u] },
  { id: 'shanghai-preparation-question', dialect: 'shanghai', direction: 'toDialect', text: '我今天还没有吃东西，检查前能喝水吗？',
    required: [/今天|今朝|今日/u, /呒没|没有|没/u, /喝水/u, /[?？伐]/u] },
  { id: 'minnan-mixed-polarity', dialect: 'minnan', direction: 'toDialect', text: '我没有发烧，但一直咳嗽。',
    required: [/無發燒|无发烧/u, /嗽|咳/u] },
  { id: 'minnan-reverse-mixed-polarity', dialect: 'minnan', direction: 'toMandarin', text: '我無發燒，但是一直咧嗽。',
    required: [/没有发烧|没发烧/u, /一直|持续/u, /咳嗽/u] },
]

export async function evaluateTranslations(config, run = translate, report = console.log) {
  const counts = { passed: 0, failed: 0, skipped: 0 }
  for (const fixture of translationCases) {
    if (!config.routes[fixture.dialect].some((id) => config.models.some((model) => model.id === id && model.enabled))) {
      counts.skipped++
      report(`跳过 ${fixture.id}：未启用对应模型。`)
      continue
    }
    try {
      const { text } = await run({ text: fixture.text, dialect: fixture.dialect, direction: fixture.direction }, config, new AbortController().signal)
      if (!fixture.required.every((pattern) => pattern.test(text))) {
        counts.failed++
        report(`待检查 ${fixture.id}：未覆盖参考要点。样例译文：${text}`)
      } else {
        counts.passed++
        report(`通过 ${fixture.id}：${text}`)
      }
    } catch (error) {
      counts.failed++
      report(`失败 ${fixture.id}：${error.code || 'MODEL_ERROR'}`)
    }
  }
  report(`样例检查：${counts.passed} 通过，${counts.failed} 失败，${counts.skipped} 跳过。这是有限样例的内容检查，不是方言或医学准确率。`)
  return counts
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const counts = await evaluateTranslations(await loadConfig())
    if (counts.failed || !counts.passed) process.exitCode = 1
  } catch {
    console.error('无法运行内容检查，请确认本地模型配置。')
    process.exitCode = 1
  }
}
