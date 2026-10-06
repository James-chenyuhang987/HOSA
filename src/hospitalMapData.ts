export type HospitalFloor = {
  id: string
  label: string
  spaces: string[]
  connections: string[]
}

export type HospitalBuilding = {
  id: string
  label: string
  description: string
  marker: string
  floors: HospitalFloor[]
}

// Demonstration data only; replace with an authorized hospital plan before real navigation.
export const hospitalBuildings: HospitalBuilding[] = [
  {
    id: 'outpatient',
    label: '门诊楼',
    description: '挂号、专科门诊与取药服务',
    marker: '01',
    floors: [
      {
        id: '1F',
        label: '一层 · 门诊服务',
        spaces: ['挂号收费', '服务台', '药房', '无障碍卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
      {
        id: '2F',
        label: '二层 · 内科门诊',
        spaces: ['心血管内科', '呼吸内科', '候诊区', '卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
      {
        id: '3F',
        label: '三层 · 专科门诊',
        spaces: ['神经内科', '消化内科', '外科门诊', '候诊区'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
    ],
  },
  {
    id: 'inpatient',
    label: '住院楼',
    description: '住院办理与病区服务',
    marker: '02',
    floors: [
      {
        id: '1F',
        label: '一层 · 住院服务',
        spaces: ['住院办理', '探视咨询', '服务台', '无障碍卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
      {
        id: '2F',
        label: '二层 · 内科病区',
        spaces: ['内科病区', '护士站', '家属等候区', '卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
      {
        id: '3F',
        label: '三层 · 外科病区',
        spaces: ['外科病区', '护士站', '家属等候区', '卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
    ],
  },
  {
    id: 'examination',
    label: '检查楼',
    description: '采血、检验与影像检查',
    marker: '03',
    floors: [
      {
        id: '1F',
        label: '一层 · 检验服务',
        spaces: ['采血区', '检验服务台', '报告领取', '无障碍卫生间'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
      {
        id: '2F',
        label: '二层 · 影像检查',
        spaces: ['超声检查', '心电图', '影像检查', '候诊区'],
        connections: ['电梯', '楼梯', '无障碍电梯'],
      },
    ],
  },
  {
    id: 'emergency',
    label: '急诊楼',
    description: '急诊分诊与诊疗服务',
    marker: '04',
    floors: [
      {
        id: '1F',
        label: '一层 · 急诊服务',
        spaces: ['急诊分诊', '急诊诊室', '急诊收费', '无障碍卫生间'],
        connections: ['无障碍入口', '平层通道'],
      },
    ],
  },
]
