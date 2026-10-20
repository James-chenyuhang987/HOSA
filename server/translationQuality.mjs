// Deterministic checks for a small set of explicit facts, not a medical semantic validator.
// Synonym coverage is finite; a rejected result stays a reference rather than being guessed.
const concepts = {
  fever: '发烧|发热', cough: '咳嗽|咳|嗽', vomiting: '呕吐|呕|吐',
  allergy: '过敏', pregnancy: '怀孕|有身|有咗身孕|有咗BB',
  medication: '吃(?:了|过|着)?药|服药|服用药物|食(?:咗|过|紧)?药',
}
const uncertainty = /不确定|不清楚|不知道|可能|也许|怀疑|唔肯定|唔知|唔清楚|唔(?:系|係)好清楚|毋知|毋确定|不晓得|唔确定/u
const negation = /没有|没|无|未|不曾|不|冇|唔|毋|呒/u
const question = /[?？吗嗎伐]|是否|有没有|有冇|有无|敢有|会不会|是不是|係咪|要不要|使唔使|可唔可以|需唔需要|(?:不|无)[呀啊呢嘛]?[。！!]?$/u
const conceptPattern = new RegExp(Object.entries(concepts).map(([id, terms]) => `(?<${id}>${terms})`).join('|'), 'giu')

function facts(text) {
  const result = new Map()
  for (const clause of text.split(/[,，。；;！？?!\n]|但是|但係|不过|毋过|而且|而是|并且|但/gu)) {
    const matches = [...clause.matchAll(conceptPattern)]
    let previousEnd = 0
    let previousState = 'positive'
    for (const [index, match] of matches.entries()) {
      const id = Object.keys(match.groups).find((key) => match.groups[key] !== undefined)
      const prefix = clause.slice(previousEnd, match.index)
      const suffix = clause.slice(match.index + match[0].length)
      const unclear = uncertainty.test(clause.slice(0, match.index))
      const state = unclear ? 'uncertain' : question.test(clause) ? 'question'
        : negation.test(prefix) || (index === matches.length - 1 && /^(?:都|也)?(?:没有|无|冇|呒没)[了呀啊呢\s]*$/u.test(suffix)) ? 'negative'
          : previousEnd > 0 && /^[和及与同也都、\s]*$/u.test(prefix) ? previousState : 'positive'
      result.set(id, [...(result.get(id) ?? []), state])
      previousEnd = match.index + match[0].length
      previousState = state
    }
  }
  return result
}

const bodyParts = {
  上腹: '上腹', 下腹: '下腹', 腹肚: '腹', 腹部: '腹', 肚子: '腹', 肚皮: '腹', 肚: '腹', 腹: '腹',
  手臂: '手臂', 胳膊: '手臂', 膝盖: '膝', 膝头: '膝', 膝: '膝', 手: '手', 腿: '腿', 脚: '脚', 眼: '眼', 耳: '耳', 胸: '胸',
}
const sidePattern = new RegExp(`([左右])(?:侧|边|面)?(?:的)?(${Object.keys(bodyParts).join('|')})`, 'gu')
const sides = (text) => [...text.matchAll(sidePattern)].map((match) => `${match[1]}${bodyParts[match[2]]}`).sort()

const timeAnchors = {
  '昨天晚上|昨晚|琴晚|昨暝': 'last-night', '今天早上|今日早上|今早|今朝|今仔早起': 'this-morning',
  '昨天|琴日|昨昏|昨日|昨儿': 'yesterday', '今天|今日|今仔日': 'today',
  '明天|听日|明仔载|明日|明儿': 'tomorrow',
}
const timePattern = new RegExp(Object.keys(timeAnchors).map((terms, index) => `(?<time${index}>${terms})`).join('|'), 'gu')
const times = (text, dialect) => [...(dialect === 'shanghai' ? text.replaceAll('今朝', '今日') : text).matchAll(timePattern)].map((match) => {
  const index = Object.values(match.groups).findIndex((value) => value !== undefined)
  return Object.values(timeAnchors)[index]
}).sort()

export function preservesClinicalMeaning(source, output, dialect) {
  if (uncertainty.test(source) && !uncertainty.test(output)) return false
  const explicitNegation = source.replace(new RegExp(uncertainty, 'gu'), '').replace(/不过|毋过|不但/gu, '')
  if (negation.test(explicitNegation) && !negation.test(output)) return false
  const before = facts(source)
  const after = facts(output)
  for (const [id, states] of before) {
    if (JSON.stringify([...states].sort()) !== JSON.stringify([...(after.get(id) ?? [])].sort())) return false
  }
  if (JSON.stringify(sides(source)) !== JSON.stringify(sides(output))) return false
  if (JSON.stringify(times(source, dialect)) !== JSON.stringify(times(output, dialect))) return false
  // Check explicit questions independently from the symptom polarity checks.
  if (/[?？吗嗎伐]|要不要|有没有|有冇|使唔使/u.test(source) && !question.test(output)
    && !/几|幾|乜|什么|啥|哪|[点點](?:样|樣|算|食|做)|怎么|何|偌|好久|多久|多长/u.test(output)) return false
  return true
}
