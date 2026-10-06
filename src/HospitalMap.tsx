import { useState } from 'react'
import { hospitalBuildings } from './hospitalMapData'
import './HospitalMap.css'

function HospitalMap() {
  const [buildingId, setBuildingId] = useState(hospitalBuildings[0].id)
  const [floorId, setFloorId] = useState('1F')
  const [selectedSpace, setSelectedSpace] = useState('')
  const [query, setQuery] = useState('')
  const building = hospitalBuildings.find((item) => item.id === buildingId) ?? hospitalBuildings[0]
  const floor = building.floors.find((item) => item.id === floorId) ?? building.floors[0]
  const searchTerm = query.trim()
  const results = searchTerm
    ? hospitalBuildings.flatMap((item) =>
        item.floors.flatMap((level) =>
          level.spaces
            .filter((space) => `${item.label}${space}`.includes(searchTerm))
            .map((space) => ({ building: item, floor: level, space })),
        ),
      )
    : []

  return (
    <section className="module hospital-map-module" aria-labelledby="hospital-map-title">
      <div className="hm-heading">
        <div>
          <span className="eyebrow">院区 · 楼层 · 服务点</span>
          <h1 id="hospital-map-title">先看清楚，再出发</h1>
          <p>点选建筑，查看楼层与服务点；也可以直接搜索想去的地方。</p>
        </div>
        <span className="hm-demo-badge">演示示意图 · 非真实院区</span>
      </div>

      <div className="hm-search-card">
        <label htmlFor="hospital-map-search">想去哪里？</label>
        <div className="hm-search-field">
          <span aria-hidden="true">⌕</span>
          <input
            id="hospital-map-search"
            type="search"
            placeholder="搜索科室、药房、采血区……"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="清空地图搜索">
              ×
            </button>
          )}
        </div>
        <div className="hm-shortcuts" role="group" aria-label="常用地图目的地">
          <span>常用目的地</span>
          {['挂号', '药房', '采血', '卫生间'].map((destination) => (
            <button type="button" key={destination} onClick={() => setQuery(destination)}>
              {destination}
            </button>
          ))}
        </div>
        {searchTerm && (
          <div className="hm-search-results">
            <p role="status">
              {results.length ? `找到 ${results.length} 个示意位置，点击查看楼层。` : '没有找到这个地点，请换个关键词或查看各楼层。'}
            </p>
            {results.length > 0 && (
              <ul aria-label="地图搜索结果">
                {results.map((result) => (
                  <li key={`${result.building.id}-${result.floor.id}-${result.space}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setBuildingId(result.building.id)
                        setFloorId(result.floor.id)
                        setSelectedSpace(result.space)
                      }}
                    >
                      <strong>{result.space}</strong>
                      <span>{result.building.label} · {result.floor.id}</span>
                      <i aria-hidden="true">↗</i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="hm-layout">
        <section className="hm-campus-card" aria-labelledby="hm-campus-title">
          <div className="hm-card-heading">
            <h2 id="hm-campus-title">院区总览</h2>
            <span>点击建筑查看</span>
          </div>
          <div className="hm-campus" role="group" aria-label="医院院区示意图">
            <svg className="hm-map-ground" viewBox="0 0 720 580" aria-hidden="true">
              <path className="hm-road-edge" d="M350 575V55 M20 330H700" />
              <path className="hm-road" d="M350 575V55 M20 330H700" />
              <path className="hm-road-lines" d="M350 520V90 M40 330H680" />
              <g className="hm-garden">
                <circle cx="90" cy="80" r="24" /><circle cx="126" cy="66" r="19" />
                <circle cx="638" cy="265" r="22" /><circle cx="661" cy="291" r="17" />
                <circle cx="95" cy="523" r="24" /><circle cx="130" cy="530" r="17" />
              </g>
            </svg>
            <span className="hm-north" aria-hidden="true">↑<small>北</small></span>
            {hospitalBuildings.map((item) => (
              <button
                className={`hm-building hm-building-${item.id} ${item.id === buildingId ? 'selected' : ''}`}
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={item.id === buildingId}
                onClick={() => {
                  setBuildingId(item.id)
                  setFloorId(item.floors[0].id)
                  setSelectedSpace('')
                }}
              >
                <span className="hm-building-number" aria-hidden="true">{item.marker}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
            <span className="hm-gate">南门入口（示意）</span>
          </div>
          <div className="hm-legend" aria-label="地图图例">
            <span><i className="hm-legend-building" />建筑</span>
            <span><i className="hm-legend-selected" />当前选择</span>
            <span><i className="hm-legend-road" />通行道路</span>
          </div>
        </section>

        <section className="hm-floor-card" aria-labelledby="hm-floor-title">
          <div className="hm-floor-summary">
            <span className="hm-kicker">当前建筑</span>
            <h2 id="hm-floor-title">{building.label}</h2>
            <p>{building.description}</p>
          </div>
          <div className="hm-floor-tabs" role="group" aria-label="选择楼层">
            {building.floors.map((level) => (
              <button
                key={level.id}
                type="button"
                aria-pressed={level.id === floor.id}
                onClick={() => {
                  setFloorId(level.id)
                  setSelectedSpace('')
                }}
              >
                {level.id}
              </button>
            ))}
          </div>
          <div className="hm-floor-content" key={`${building.id}-${floor.id}`}>
            <p className="hm-floor-label">{floor.label}</p>
            <div className="hm-floor-plan" role="group" aria-label={`${building.label} ${floor.id} 楼层示意图`}>
              {floor.spaces.map((space) => (
                <button
                  key={space}
                  type="button"
                  aria-pressed={selectedSpace === space}
                  onClick={() => setSelectedSpace(space)}
                >
                  {space}
                </button>
              ))}
              <span className="hm-corridor" aria-hidden="true">公共通道</span>
            </div>
            <p className="hm-selection" role="status">
              {selectedSpace ? `已选：${selectedSpace} · ${building.label} ${floor.id}` : '点击服务点，可查看所在建筑与楼层。'}
            </p>
            <div className="hm-connections">
              <h3>通行设施</h3>
              <div>{floor.connections.map((connection) => <span key={connection}>{connection}</span>)}</div>
            </div>
          </div>
        </section>
      </div>
      <p className="hm-notice">当前地图为交互演示，不代表真实医院布局，也不提供实时定位。实际科室位置请以医院官方地图与现场标识为准。</p>
    </section>
  )
}

export default HospitalMap
