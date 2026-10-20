// Literal preservation is deliberately separate from semantic translation.
// Keep medication names next to their stated doses so two doses cannot be swapped.
export const drugPattern = '(?:阿莫西林(?:克拉维酸钾|克拉維酸鉀)?|青[霉黴]素|[头頭]孢(?:克肟|呋辛|曲松|拉定)|胰[岛島]素|二甲[双雙]胍|[华華]法林|阿司匹林|布洛芬|[对對]乙[酰醯]氨基酚|氯雷他定|[奥奧]美拉唑|硝酸甘油|地塞米松|[泼潑]尼松|利伐沙班|氯吡格雷)(?:[缓緩][释釋]片|[肠腸]溶片|[胶膠]囊|[颗顆]粒|注射液|片)?'
const units = '(?:mmol\\/L|mg\\/dL|mmHg|kPa|mcg|μg|µg|mg|kg|mL|ml|cm|mm|IU|U|g|L|%|％|℃|°C|毫摩[尔爾]\\/升|毫克|微克|千克|公斤|毫升|厘米|毫米|克|升|片|粒|支|滴|次|天|日|周|星期|个?月|個月|年|小[时時]|分[钟鐘]|秒|[岁歲]|度)'
const arabic = '\\d+(?:[.,]\\d+)*(?:\\s*[-–~～至到/]\\s*\\d+(?:[.,]\\d+)*)*'
const chinese = '[零〇一二三四五六七八九十百千万萬两兩半]+(?:[点點][零〇一二三四五六七八九]+)?'
export const quantityPattern = `${arabic}(?:\\s*${units})?|${chinese}\\s*${units}(?:半)?`
const dateTime = '(?:\\d{4}[-/年]\\d{1,2}[-/月]\\d{1,2}日?|\\d{1,2}月\\d{1,2}[日号號]|\\d{1,2}[:：]\\d{2})'
const anatomicalRegion = '(?:[左右][上下]腹(?:部)?|[左右][侧側](?:腹部|胸部|[肢膝肩髋髖]))'

export function medicalLiteralRegex() {
  return new RegExp(`${dateTime}|${anatomicalRegion}|${drugPattern}\\s*(?:${quantityPattern})|(?:${quantityPattern})\\s*${drugPattern}|${drugPattern}|${quantityPattern}`, 'giu')
}

/** Replace only the unprotected gaps; never feed replacement output back into the rules. */
export function replaceWording(text: string, replacements: ReadonlyArray<readonly [string, string]>) {
  const rules = new Map([...replacements].sort((a, b) => b[0].length - a[0].length))
  const escaped = [...rules.keys()].map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  if (!escaped.length) return text
  const pattern = new RegExp(escaped.join('|'), 'gu')
  const replaceGap = (gap: string) => gap.replace(pattern, (word) => rules.get(word)!)
  let output = ''
  let cursor = 0
  for (const match of text.matchAll(medicalLiteralRegex())) {
    output += replaceGap(text.slice(cursor, match.index)) + match[0]
    cursor = match.index + match[0].length
  }
  return output + replaceGap(text.slice(cursor))
}
