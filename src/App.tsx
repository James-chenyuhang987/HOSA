import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ModuleId = 'guide' | 'dialect' | 'cardio' | 'remote'
type DialectId = 'sichuan' | 'cantonese' | 'northeastern' | 'shanghai'

type SpeechRecognitionResultEventLike = Event & {
  results: {
    length: number
    [index: number]: {
      length: number
      [index: number]: { transcript: string }
    }
  }
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

type Recommendation = {
  department: string
  reason: string
  preparation: string[]
  urgent?: boolean
}

const symptomExamples = ['胸闷心慌', '发热咳嗽', '头晕头痛', '腹痛恶心']

const departmentRules: Array<{
  keywords: string[]
  recommendation: Recommendation
}> = [
  {
    keywords: ['胸痛', '胸闷', '心慌', '心悸', '血压', '心脏'],
    recommendation: {
      department: '心血管内科',
      reason: '描述中包含胸部不适、心律或血压相关症状。',
      preparation: ['记录症状开始时间与持续时长', '携带既往心电图和用药清单'],
    },
  },
  {
    keywords: ['头痛', '头晕', '手麻', '脚麻', '失眠'],
    recommendation: {
      department: '神经内科',
      reason: '描述中包含头痛、眩晕或感觉异常等神经系统相关症状。',
      preparation: ['记录发作频率和诱因', '携带既往头颅影像资料'],
    },
  },
  {
    keywords: ['腹痛', '胃痛', '恶心', '呕吐', '腹泻', '便秘'],
    recommendation: {
      department: '消化内科',
      reason: '描述中包含腹部或消化道相关症状。',
      preparation: ['记录最近饮食与排便情况', '如需空腹检查，请先向医院确认'],
    },
  },
  {
    keywords: ['发热', '咳嗽', '咳痰', '气喘', '呼吸'],
    recommendation: {
      department: '呼吸与危重症医学科',
      reason: '描述中包含发热、咳嗽或呼吸道相关症状。',
      preparation: ['记录体温变化', '就诊期间建议佩戴口罩'],
    },
  },
  {
    keywords: ['皮疹', '红肿', '瘙痒', '脱皮', '痘'],
    recommendation: {
      department: '皮肤科',
      reason: '描述中包含皮肤外观或感觉异常。',
      preparation: ['拍摄症状发展过程', '就诊前避免自行涂抹新药膏'],
    },
  },
  {
    keywords: ['腰痛', '腿痛', '关节', '扭伤', '骨折', '颈椎'],
    recommendation: {
      department: '骨科',
      reason: '描述中包含骨骼、关节或运动损伤相关症状。',
      preparation: ['说明受伤方式和活动受限情况', '携带既往影像资料'],
    },
  },
]

const urgentKeywords = [
  '剧烈胸痛',
  '呼吸困难',
  '无法呼吸',
  '昏厥',
  '昏迷',
  '意识不清',
  '大出血',
  '偏瘫',
]

const dialectOptions: Array<{
  id: DialectId
  name: string
  description: string
  examples: string[]
  speechLang: string
  replacements: Array<[string, string]>
}> = [
  {
    id: 'sichuan',
    name: '四川话',
    description: '把常见四川方言词换成普通话，方便向医护人员描述情况。',
    examples: ['咋个办嘛？', '这个事情好恼火。', '我晓不得痛了好久。'],
    speechLang: 'zh-CN',
    replacements: [
      ['咋个', '怎么'],
      ['啥子', '什么'],
      ['晓不得', '不知道'],
      ['晓得', '知道'],
      ['恼火', '严重 / 麻烦'],
      ['巴适', '舒服 / 不错'],
    ],
  },
  {
    id: 'cantonese',
    name: '粤语',
    description: '识别常见粤语表达，整理成更容易沟通的普通话说法。',
    examples: ['我唔舒服。', '边度痛？', '痛咗几耐？'],
    speechLang: 'zh-HK',
    replacements: [
      ['唔舒服', '不舒服'],
      ['边度', '哪里'],
      ['几耐', '多久'],
      ['冇', '没有'],
      ['痛咗', '疼了'],
      ['唔', '不'],
    ],
  },
  {
    id: 'northeastern',
    name: '东北话',
    description: '将常见东北方言表达转换为普通话，帮助医患快速理解。',
    examples: ['这可咋整？', '我老鼻子难受了。', '这感觉挺得劲。'],
    speechLang: 'zh-CN',
    replacements: [
      ['咋整', '怎么办'],
      ['嘎哈', '做什么'],
      ['老鼻子', '非常 / 很多'],
      ['得劲', '舒服'],
      ['闹心', '难受 / 烦躁'],
      ['贼', '很 / 非常'],
    ],
  },
  {
    id: 'shanghai',
    name: '上海话',
    description: '整理常见上海方言词句，让就医沟通更清楚。',
    examples: ['侬哪能不舒服？', '阿拉勿晓得。', '覅紧张。'],
    speechLang: 'zh-CN',
    replacements: [
      ['侬', '你'],
      ['阿拉', '我们'],
      ['哪能', '怎么'],
      ['勿晓得', '不知道'],
      ['覅', '不要'],
      ['勿', '不'],
    ],
  },
]

const cardioPaths = [
  {
    id: 'cardiology',
    name: '心血管内科',
    fit: '胸闷、心悸、高血压、冠心病等内科评估',
    color: 'coral',
    steps: ['线上或现场挂号', '门诊分诊与问诊', '按医嘱完成心电图等检查', '复诊并制定治疗方案'],
  },
  {
    id: 'cardiac-surgery',
    name: '心脏外科',
    fit: '需要评估心脏结构性疾病或手术治疗',
    color: 'blue',
    steps: ['专科门诊初诊', '携带完整影像与检查资料', '多学科评估手术指征', '住院安排与术前准备'],
  },
  {
    id: 'vascular',
    name: '血管外科',
    fit: '下肢肿痛、静脉曲张、动脉狭窄等血管问题',
    color: 'green',
    steps: ['血管外科挂号', '症状与血管体征评估', '按医嘱完成血管超声等检查', '复诊选择药物、介入或手术方案'],
  },
]

const onboardingSteps = [
  {
    eyebrow: '第一步 · 智能导诊',
    icon: '01',
    title: '先确定该挂什么科',
    description: '用自己的话描述症状，诊途会提供初步挂号方向和就诊前准备建议。',
    module: 'guide' as ModuleId,
    action: '试试智能导诊',
  },
  {
    eyebrow: '第二步 · 方言翻译',
    icon: '02',
    title: '把方言说法讲清楚',
    description: '选择熟悉的方言，通过录音或文字输入，将常见表达整理成普通话，帮助您更顺畅地和医护人员沟通。',
    module: 'dialect' as ModuleId,
    action: '试试方言翻译',
  },
  {
    eyebrow: '第三步 · 全程准备',
    icon: '03',
    title: '本地、异地就医都从容',
    description: '查看专科流程，或生成异地就医准备清单，把关键事项逐一完成。',
    module: 'remote' as ModuleId,
    action: '制定异地计划',
  },
]

const remoteSteps = [
  {
    id: 'appointment',
    phase: '就医确认',
    title: '确认医院、科室与号源',
    detail: '通过医院官方渠道确认院区、出诊时间、预约规则及是否需要转诊材料。',
  },
  {
    id: 'insurance',
    phase: '医保准备',
    title: '办理异地就医备案',
    detail: '出发前通过国家医保服务平台或参保地医保渠道确认备案与报销要求。',
  },
  {
    id: 'records',
    phase: '资料整理',
    title: '带齐病历和原始检查资料',
    detail: '整理身份证件、医保凭证、用药清单、病历，以及影像光盘或原始文件。',
  },
  {
    id: 'travel',
    phase: '行程安排',
    title: '规划交通、住宿与陪同',
    detail: '根据检查时间预留行程，确认无障碍需求，并为可能的复诊留出弹性。',
  },
  {
    id: 'follow-up',
    phase: '就医之后',
    title: '保存资料并确认复诊方式',
    detail: '离院前保存处方、费用票据和检查结果，问清线上或线下复诊安排。',
  },
]

function translateDialect(text: string, dialect: (typeof dialectOptions)[number]): string {
  const normalizedText = text.trim()
  if (!normalizedText) {
    return ''
  }

  const translatedText = dialect.replacements.reduce(
    (currentText, [dialectTerm, mandarinTerm]) => currentText.split(dialectTerm).join(mandarinTerm),
    normalizedText,
  )

  return translatedText === normalizedText
    ? '暂未识别出常见方言词，请补充更具体的说法，或直接使用普通话描述。'
    : translatedText
}

function getRecommendation(symptoms: string): Recommendation {
  if (urgentKeywords.some((keyword) => symptoms.includes(keyword))) {
    return {
      department: '急诊 / 立即拨打 120',
      reason: '描述中出现可能需要紧急处理的症状，请不要等待普通门诊。',
      preparation: ['保持有人陪同', '不要自行驾车前往医院'],
      urgent: true,
    }
  }

  const match = departmentRules.find(({ keywords }) =>
    keywords.some((keyword) => symptoms.includes(keyword)),
  )

  return (
    match?.recommendation ?? {
      department: '全科医学科',
      reason: '目前信息不足以匹配到单一专科，可先由全科医生进行初步评估。',
      preparation: ['整理症状出现时间和变化', '携带既往病历与正在使用的药物'],
    }
  )
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('guide')
  const [symptoms, setSymptoms] = useState('')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [formError, setFormError] = useState('')
  const [selectedDialect, setSelectedDialect] = useState(dialectOptions[0])
  const [dialectText, setDialectText] = useState('')
  const [translation, setTranslation] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const dialectTextRef = useRef('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const [selectedPath, setSelectedPath] = useState(cardioPaths[0])
  const [showOnboarding, setShowOnboarding] = useState(
    () => window.localStorage.getItem('zhentu-onboarding-complete') !== 'true',
  )
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [destination, setDestination] = useState('北京')
  const [completedRemoteSteps, setCompletedRemoteSteps] = useState<string[]>([])

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl)
      }
    }
  }, [recordingUrl])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const submitSymptoms = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedSymptoms = symptoms.trim()

    if (!normalizedSymptoms) {
      setFormError('请先描述您的主要症状。')
      setRecommendation(null)
      return
    }

    setFormError('')
    setRecommendation(getRecommendation(normalizedSymptoms))
  }

  const startRecording = async () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !SpeechRecognition) {
      setRecordingError('当前浏览器不支持录音翻译，请使用最新版 Chrome 或 Edge，或改用文字输入。')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const recognition = new SpeechRecognition()
      recordingChunksRef.current = []
      setRecordingError('')
      dialectTextRef.current = ''
      setDialectText('')
      setTranslation('')
      setRecordingUrl('')

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const audioBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setRecordingUrl(URL.createObjectURL(audioBlob))
        setTranslation(translateDialect(dialectTextRef.current, selectedDialect))
        setIsRecording(false)
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      }

      recognition.lang = selectedDialect.speechLang
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        let transcript = ''
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript
        }
        dialectTextRef.current = transcript
        setDialectText(transcript)
      }
      recognition.onerror = () => {
        setRecordingError('语音识别暂时失败，请靠近麦克风重试，或改用文字输入。')
      }
      recognition.onend = () => {
        setTranslation(translateDialect(dialectTextRef.current, selectedDialect))
      }

      mediaRecorderRef.current = recorder
      mediaStreamRef.current = stream
      recognitionRef.current = recognition
      recorder.start()
      recognition.start()
      setIsRecording(true)
    } catch {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      setIsRecording(false)
      setRecordingError('无法访问麦克风，请检查浏览器权限后重试。')
    }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const submitDialectTranslation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTranslation(translateDialect(dialectText, selectedDialect))
  }

  const finishOnboarding = (module?: ModuleId) => {
    window.localStorage.setItem('zhentu-onboarding-complete', 'true')
    if (module) {
      setActiveModule(module)
    }
    setShowOnboarding(false)
  }

  const reopenOnboarding = () => {
    setOnboardingStep(0)
    setShowOnboarding(true)
  }

  const toggleRemoteStep = (stepId: string) => {
    setCompletedRemoteSteps((current) =>
      current.includes(stepId)
        ? current.filter((completedId) => completedId !== stepId)
        : [...current, stepId],
    )
  }

  const remoteProgress = Math.round(
    (completedRemoteSteps.length / remoteSteps.length) * 100,
  )
  const currentOnboarding = onboardingSteps[onboardingStep]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveModule('guide')}>
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
          <span>
            <strong>诊途</strong>
            <small>让就医少走弯路</small>
          </span>
        </button>
        <nav aria-label="主要功能">
          {[
            ['guide', '智能导诊'],
            ['dialect', '方言翻译'],
            ['cardio', '就医流程'],
            ['remote', '异地就医'],
          ].map(([id, label]) => (
            <button
              className={activeModule === id ? 'nav-item active' : 'nav-item'}
              type="button"
              key={id}
              onClick={() => setActiveModule(id as ModuleId)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <span className="competition-pill">HOSA 参赛作品</span>
          <button className="guide-trigger" type="button" onClick={reopenOnboarding}>
            使用引导
          </button>
        </div>
      </header>

      <main>
        {activeModule === 'guide' && (
          <section className="module guide-module">
            <div className="intro">
              <span className="eyebrow">不知道该挂什么科？</span>
              <h1>
                描述不舒服的地方，
                <br />
                帮您找到合适的科室
              </h1>
              <p>请用自己的话描述症状、持续时间和严重程度，我们会提供初步就医方向。</p>
            </div>

            <div className="guide-grid">
              <form className="symptom-card" onSubmit={submitSymptoms}>
                <label htmlFor="symptoms">症状描述</label>
                <textarea
                  id="symptoms"
                  value={symptoms}
                  onChange={(event) => setSymptoms(event.target.value)}
                  placeholder="例如：最近三天经常胸闷，走快时会心慌……"
                  rows={6}
                />
                <div className="examples" aria-label="症状示例">
                  <span>快速填写</span>
                  {symptomExamples.map((example) => (
                    <button type="button" key={example} onClick={() => setSymptoms(example)}>
                      {example}
                    </button>
                  ))}
                </div>
                {formError && <p className="form-error">{formError}</p>}
                <button className="primary-action" type="submit">
                  获取挂号建议
                  <span aria-hidden="true">→</span>
                </button>
                <p className="medical-note">
                  本工具不提供诊断。危急情况下请立即拨打 120 或前往急诊。
                </p>
              </form>

              <aside
                className={recommendation?.urgent ? 'result-card urgent' : 'result-card'}
                aria-live="polite"
              >
                {recommendation ? (
                  <>
                    <span className="result-label">
                      {recommendation.urgent ? '紧急提示' : '建议挂号科室'}
                    </span>
                    <h2>{recommendation.department}</h2>
                    <p>{recommendation.reason}</p>
                    <div className="preparation">
                      <strong>就诊前建议</strong>
                      <ul>
                        {recommendation.preparation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="result-empty">
                    <span className="result-icon" aria-hidden="true">
                      ✦
                    </span>
                    <h2>您的导诊结果会显示在这里</h2>
                    <p>描述越具体，建议越有参考价值。</p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}

        {activeModule === 'dialect' && (
          <section className="module dialect-module">
            <div className="section-heading">
              <div>
                <span className="eyebrow">就医沟通辅助</span>
                <h1>方言听得懂，沟通更安心</h1>
                <p>选择方言后直接录音，或输入常见说法，诊途会将其中的方言词整理为普通话表达。</p>
              </div>
              <span className="demo-badge">词汇辅助 · 结果请人工确认</span>
            </div>

            <div className="dialect-grid">
              <form className="dialect-card" onSubmit={submitDialectTranslation}>
                <label htmlFor="dialect">选择方言</label>
                <select
                  id="dialect"
                  value={selectedDialect.id}
                  disabled={isRecording}
                  onChange={(event) => {
                    const nextDialect = dialectOptions.find(
                      (dialect) => dialect.id === event.target.value,
                    )
                    if (nextDialect) {
                      stopRecording()
                      setSelectedDialect(nextDialect)
                      dialectTextRef.current = ''
                      setDialectText('')
                      setTranslation('')
                    }
                  }}
                >
                  {dialectOptions.map((dialect) => (
                    <option key={dialect.id} value={dialect.id}>
                      {dialect.name}
                    </option>
                  ))}
                </select>
                <p className="dialect-description">{selectedDialect.description}</p>

                <label htmlFor="dialect-text">方言内容</label>
                <textarea
                  id="dialect-text"
                  value={dialectText}
                  disabled={isRecording}
                  onChange={(event) => {
                    dialectTextRef.current = event.target.value
                    setDialectText(event.target.value)
                    setTranslation('')
                  }}
                  placeholder={`请输入${selectedDialect.name}说法`}
                  rows={5}
                />
                <div className="recording-panel">
                  <button
                    className={isRecording ? 'record-action recording' : 'record-action'}
                    type="button"
                    aria-pressed={isRecording}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    <span className="record-dot" aria-hidden="true" />
                    {isRecording ? '停止并翻译' : '开始录音翻译'}
                  </button>
                  <span className="recording-status">
                    {isRecording ? '正在聆听，请说出方言内容…' : '录音停止后自动生成普通话结果'}
                  </span>
                </div>
                {recordingError && (
                  <p className="recording-error" role="alert">
                    {recordingError}
                  </p>
                )}
                {recordingUrl && (
                  <audio className="recording-playback" controls src={recordingUrl}>
                    您的浏览器不支持音频播放。
                  </audio>
                )}
                <div className="examples dialect-examples" aria-label="方言示例">
                  <span>快速填写</span>
                  {selectedDialect.examples.map((example) => (
                    <button
                      type="button"
                      key={example}
                      disabled={isRecording}
                      onClick={() => {
                        dialectTextRef.current = example
                        setDialectText(example)
                        setTranslation('')
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <button
                  className="primary-action"
                  type="submit"
                  disabled={isRecording || !dialectText.trim()}
                >
                  翻译成普通话
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              <aside className="translation-card" aria-live="polite">
                <span className="panel-kicker">普通话结果</span>
                {translation ? (
                  <>
                    <h2>{translation}</h2>
                    <button
                      className="use-translation"
                      type="button"
                      onClick={() => {
                        setSymptoms(translation)
                        setActiveModule('guide')
                      }}
                    >
                      用于智能导诊
                    </button>
                  </>
                ) : (
                  <div className="translation-empty">
                    <span aria-hidden="true">译</span>
                    <h2>翻译结果会显示在这里</h2>
                    <p>当前版本支持常见方言词汇，不替代专业人工翻译。</p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}

        {activeModule === 'cardio' && (
          <section className="module cardio-module">
            <div className="section-heading">
              <div>
                <span className="eyebrow">心脏与血管疾病</span>
                <h1>从挂号到复诊，一步一步看明白</h1>
                <p>选择细分科室，了解一般就医路径和每一步需要准备的内容。</p>
              </div>
              <span className="demo-badge">流程参考 · 以院方安排为准</span>
            </div>

            <div className="path-selector">
              {cardioPaths.map((path) => (
                <button
                  type="button"
                  key={path.id}
                  className={selectedPath.id === path.id ? 'path-card active' : 'path-card'}
                  onClick={() => setSelectedPath(path)}
                >
                  <i className={path.color} aria-hidden="true" />
                  <strong>{path.name}</strong>
                  <span>{path.fit}</span>
                </button>
              ))}
            </div>

            <div className="journey-card">
              <div className="journey-header">
                <div>
                  <span className="panel-kicker">推荐流程</span>
                  <h2>{selectedPath.name}</h2>
                </div>
                <span>预计 4 个阶段</span>
              </div>
              <ol className="journey-steps">
                {selectedPath.steps.map((step, index) => (
                  <li key={step}>
                    <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                    <div className="photo-placeholder" aria-label="实景批注图占位">
                      <span>实景批注图</span>
                      <small>待接入院方授权图片</small>
                      <i className={`annotation annotation-${index + 1}`} aria-hidden="true">
                        {index + 1}
                      </i>
                    </div>
                    <h3>{step}</h3>
                    <p>{index === 0 ? '提前确认出诊时间与号源。' : '听从医护人员指引，保留本次资料。'}</p>
                  </li>
                ))}
              </ol>
              <div className="journey-notice">
                <strong>就医提示</strong>
                <p>
                  实际检查和治疗顺序由医生根据病情决定。若出现持续剧烈胸痛、呼吸困难或意识不清，请立即拨打
                  120。
                </p>
              </div>
            </div>
          </section>
        )}

        {activeModule === 'remote' && (
          <section className="module remote-module">
            <div className="section-heading">
              <div>
                <span className="eyebrow">异地就医准备</span>
                <h1>去外地看病，也能心里有数</h1>
                <p>选择目的地，按时间顺序整理预约、医保、病历和行程事项。</p>
              </div>
              <span className="demo-badge">通用清单 · 具体要求以官方信息为准</span>
            </div>

            <div className="remote-overview">
              <div className="destination-card">
                <label htmlFor="destination">计划前往</label>
                <select
                  id="destination"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                >
                  {['北京', '上海', '广州', '其他城市'].map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
                <div className="destination-route" aria-hidden="true">
                  <span className="route-origin">我的城市</span>
                  <i>·········································→</i>
                  <span className="route-target">{destination}</span>
                </div>
                <p>
                  诊途不会替您选择医院。请优先通过目标医院官网、公众号或官方电话核对信息。
                </p>
              </div>

              <aside className="progress-card">
                <span className="panel-kicker">准备进度</span>
                <strong>{remoteProgress}%</strong>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="异地就医准备进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={remoteProgress}
                >
                  <i style={{ width: `${remoteProgress}%` }} />
                </div>
                <p>
                  已完成 {completedRemoteSteps.length} / {remoteSteps.length} 项
                </p>
              </aside>
            </div>

            <div className="remote-checklist">
              <div className="checklist-heading">
                <span className="panel-kicker">{destination}就医准备单</span>
                <h2>出发前逐项确认</h2>
              </div>
              <ol>
                {remoteSteps.map((step, index) => {
                  const isComplete = completedRemoteSteps.includes(step.id)

                  return (
                    <li className={isComplete ? 'complete' : ''} key={step.id}>
                      <button
                        type="button"
                        aria-pressed={isComplete}
                        onClick={() => toggleRemoteStep(step.id)}
                      >
                        <span className="check-control" aria-hidden="true">
                          {isComplete ? '✓' : String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="check-content">
                          <small>{step.phase}</small>
                          <strong>{step.title}</strong>
                          <span>{step.detail}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <p className="remote-notice">
                各地医保和医院政策可能调整，清单仅用于准备提醒，不代表医院或医保部门的正式要求。
              </p>
            </div>
          </section>
        )}
      </main>

      <footer>
        <span>诊途 · HOSA 参赛作品</span>
        <span>信息仅供就医导航参考，不替代专业医疗意见</span>
      </footer>

      {showOnboarding && (
        <div className="onboarding-backdrop">
          <section
            className="onboarding-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <button
              className="onboarding-skip"
              type="button"
              onClick={() => finishOnboarding()}
            >
              跳过引导
            </button>
            <div className="onboarding-visual" aria-hidden="true">
              <span>{currentOnboarding.icon}</span>
              <i className={`visual-orbit orbit-${onboardingStep + 1}`} />
              <strong>诊途</strong>
            </div>
            <div className="onboarding-copy">
              <span className="eyebrow">{currentOnboarding.eyebrow}</span>
              <h2 id="onboarding-title">{currentOnboarding.title}</h2>
              <p>{currentOnboarding.description}</p>
              <div className="onboarding-dots" aria-label="引导进度">
                {onboardingSteps.map((step, index) => (
                  <span
                    className={index === onboardingStep ? 'active' : ''}
                    key={step.title}
                  />
                ))}
              </div>
              <div className="onboarding-actions">
                {onboardingStep > 0 && (
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => setOnboardingStep((step) => step - 1)}
                  >
                    上一步
                  </button>
                )}
                {onboardingStep < onboardingSteps.length - 1 ? (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => setOnboardingStep((step) => step + 1)}
                  >
                    下一步
                    <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => finishOnboarding(currentOnboarding.module)}
                  >
                    {currentOnboarding.action}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
