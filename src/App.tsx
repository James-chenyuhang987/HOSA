import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ModuleId = 'guide' | 'map' | 'cardio'

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

const campusBuildings = [
  { id: 'outpatient', label: '门诊楼', detail: '挂号、分诊、专科门诊', className: 'building-a' },
  { id: 'medical', label: '内科楼', detail: '内科诊疗与住院服务', className: 'building-b' },
  { id: 'surgical', label: '外科楼', detail: '外科诊疗与住院服务', className: 'building-c' },
  { id: 'emergency', label: '急诊', detail: '24 小时急诊入口', className: 'building-d' },
]

const floors = [
  {
    floor: '1F',
    spaces: ['门诊大厅', '自助服务区', '药房', '检验服务台'],
    vertical: ['东侧电梯', '西侧楼梯', '无障碍电梯'],
  },
  {
    floor: '2F',
    spaces: ['心血管内科', '呼吸科', '候诊区', '采血区'],
    vertical: ['东侧电梯', '中庭扶梯', '西侧楼梯'],
  },
  {
    floor: '3F',
    spaces: ['神经内科', '消化内科', '超声检查', '缴费窗口'],
    vertical: ['东侧电梯', '中庭扶梯', '西侧楼梯'],
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
  const [selectedBuilding, setSelectedBuilding] = useState(campusBuildings[0])
  const [selectedFloor, setSelectedFloor] = useState(floors[0])
  const [selectedPath, setSelectedPath] = useState(cardioPaths[0])

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveModule('guide')}>
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
          <span>
            <strong>HOSA</strong>
            <small>就医向导</small>
          </span>
        </button>
        <nav aria-label="主要功能">
          {[
            ['guide', '智能导诊'],
            ['map', '院内地图'],
            ['cardio', '就医流程'],
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
        <span className="hospital-pill">北京大学第三医院 · 演示</span>
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

        {activeModule === 'map' && (
          <section className="module map-module">
            <div className="section-heading">
              <div>
                <span className="eyebrow">院内空间导航</span>
                <h1>先看清楚，再出发</h1>
                <p>查看院区、楼层功能与上下楼方式，减少在院内来回寻找。</p>
              </div>
              <span className="demo-badge">非实景 · 演示示意图</span>
            </div>

            <div className="map-grid">
              <div className="campus-map">
                <div className="map-road horizontal" />
                <div className="map-road vertical" />
                <span className="map-gate">南门入口</span>
                {campusBuildings.map((building) => (
                  <button
                    type="button"
                    key={building.id}
                    className={`map-building ${building.className} ${
                      selectedBuilding.id === building.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedBuilding(building)}
                  >
                    <strong>{building.label}</strong>
                    <small>{building.detail}</small>
                  </button>
                ))}
                <div className="map-legend">
                  <span>
                    <i className="legend-building" /> 建筑
                  </span>
                  <span>
                    <i className="legend-road" /> 通行道路
                  </span>
                </div>
              </div>

              <aside className="map-detail">
                <span className="panel-kicker">当前选择</span>
                <h2>{selectedBuilding.label}</h2>
                <p>{selectedBuilding.detail}</p>
                <div className="floor-tabs" role="group" aria-label="选择楼层">
                  {floors.map((floor) => (
                    <button
                      type="button"
                      key={floor.floor}
                      className={selectedFloor.floor === floor.floor ? 'active' : ''}
                      onClick={() => setSelectedFloor(floor)}
                    >
                      {floor.floor}
                    </button>
                  ))}
                </div>
                <div className="floor-plan">
                  {selectedFloor.spaces.map((space, index) => (
                    <div className={`space space-${index + 1}`} key={space}>
                      {space}
                    </div>
                  ))}
                  <span className="you-are-here">● 您在这里</span>
                </div>
                <div className="vertical-routes">
                  <strong>上下楼方式</strong>
                  {selectedFloor.vertical.map((route, index) => (
                    <span key={route}>
                      <i aria-hidden="true">{index === 1 ? '↗' : '↕'}</i>
                      {route}
                    </span>
                  ))}
                </div>
                <p className="map-warning">
                  此页面仅演示交互与信息结构，不代表真实院区布局，请以医院现场标识为准。
                </p>
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
      </main>

      <footer>
        <span>HOSA 就医向导 · 原型演示</span>
        <span>信息仅供就医导航参考，不替代专业医疗意见</span>
      </footer>
    </div>
  )
}

export default App
