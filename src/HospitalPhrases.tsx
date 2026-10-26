import { useRef, useState } from 'react'
import { hospitalLexicon } from './hospitalLexicon'
import type { DialectId } from './hospitalLexicon'
import type { Direction } from './translationTypes'
import { normalizeForMatch } from './phraseTranslation'

const categories = [
  ['all', '全部'], ['registration', '挂号'], ['directions', '问路'], ['symptoms', '症状'], ['history', '病史'],
  ['examination', '检查'], ['medication', '用药'], ['inpatient', '住院'], ['communication', '沟通'],
] as const
const normalize = (value: string) => normalizeForMatch(value.normalize('NFKC')).toLowerCase().replace(/\s+/gu, '')
const timedExamples = ['我今天没有发烧', '我头痛大约三天了', '我从昨晚开始头晕']

export default function HospitalPhrases({ dialect, direction, onChoose, quick, prominent = false }: {
  dialect: DialectId; direction: Direction; onChoose: (text: string) => void; quick: string[]; prominent?: boolean
}) {
  const [category, setCategory] = useState<string>('registration')
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLDetailsElement>(null)
  const keyword = normalize(query)
  const entries = hospitalLexicon.filter((entry) => keyword
    ? [entry.source, ...(entry.aliases ?? []), entry.variants[dialect]].some((text) => normalize(text).includes(keyword))
    : category === 'all' || entry.category === category)
  const resetSearch = () => { setQuery(''); searchInput.current?.focus() }
  const openScene = (scene: string, search = '') => {
    setCategory(scene); setQuery(search)
    if (!library.current) return
    library.current.open = true
    library.current.querySelector('summary')?.focus({ preventScroll: true })
    library.current.scrollIntoView?.({ block: 'start', behavior: 'auto' })
  }
  return <div className={prominent ? 'phrase-tools prominent' : 'phrase-tools'}>
    {prominent && <div className="scene-shortcuts" role="group" aria-label="快捷医院场景">
      <span>点短句沟通</span>
      {[['registration', '挂号'], ['symptoms', '症状'], ['history', '过敏'], ['medication', '用药']].map(([id, label]) =>
        <button type="button" key={id} aria-label={`打开${label}短句`} onClick={() => openScene(id, id === 'history' ? '过敏' : '')}>{label}</button>)}
    </div>}
    <details ref={library} className="phrase-library" id="hospital-phrases">
    <summary>医院常用短句 <span>搜索或按场景选择，一点即译</span></summary>
    <div className="phrase-search">
      <label htmlFor="phrase-search">查找医院短句</label>
      <div className="phrase-search-field">
        <input ref={searchInput} id="phrase-search" type="search" value={query} maxLength={80}
          placeholder="搜索挂号、空腹、过敏…" autoComplete="off" aria-describedby="phrase-search-help"
          onChange={(event) => setQuery(event.target.value)} />
        {query && <button type="button" onClick={resetSearch}>清除搜索</button>}
      </div>
      <p id="phrase-search-help">可搜索普通话、已收录的同义问法或当前方言。</p>
    </div>
    {!keyword && <div className="examples" aria-label="常用表达示例">
      {quick.map((text) => <button type="button" key={text} onClick={() => onChoose(text)}>{text}</button>)}
    </div>}
    <div className="phrase-categories" role="group" aria-label="医院场景">
      {categories.map(([id, label]) => <button type="button" key={id} aria-pressed={(keyword ? 'all' : category) === id}
        onClick={() => { setCategory(id); setQuery('') }}>{label}<span className="phrase-count" aria-hidden="true">
          {id === 'all' ? hospitalLexicon.length : hospitalLexicon.filter((entry) => entry.category === id).length}
        </span></button>)}
    </div>
    {!keyword && category === 'symptoms' && direction === 'toDialect' && <div className="phrase-time-examples">
      <p>补上时间，更方便说清症状</p>
      <div className="examples" role="group" aria-label="带时间的症状示例">
        {timedExamples.map((text) => <button type="button" key={text} onClick={() => onChoose(text)}>{text}</button>)}
      </div>
    </div>}
    <p className="phrase-search-status" role="status">{keyword ? `搜索结果：${entries.length} 条短句` : `当前场景：${entries.length} 条短句`}</p>
    <div className="phrase-list">
      {entries.map((entry) => {
        const text = direction === 'toDialect' ? entry.source : entry.variants[dialect]
        return <button type="button" key={entry.source} onClick={() => onChoose(text)}>{text}<span aria-hidden="true">↗</span></button>
      })}
    </div>
    {!entries.length && <div className="phrase-search-empty">
      <strong>没有找到相关短句</strong><p>试试更短的关键词，或直接在翻译框输入完整的一句话。</p>
      <button type="button" onClick={resetSearch}>返回场景短句</button>
    </div>}
  </details></div>
}
