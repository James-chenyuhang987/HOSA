import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createVoiceSession } from './speech'
import type { VoiceSession, VoiceStatus } from './speech'
import HospitalMap from './HospitalMap'
import './App.css'

type ModuleId = 'translate' | 'map'
type DialectId = 'cantonese' | 'minnan' | 'shanghai' | 'sichuan' | 'northeast'
type Direction = 'toDialect' | 'toMandarin'
type TranslationConfidence = 'phrase' | 'wording' | 'unmatched'
type Translation = {
  text: string
  pronunciation: string
  note: string
  confidence: TranslationConfidence
}

type Phrase = {
  source: string
  text: string
  pronunciation: string
  note: string
}

const dialectOptions: Array<{
  id: DialectId
  label: string
  region: string
  description: string
}> = [
  {
    id: 'cantonese',
    label: '粤语',
    region: '广东 / 香港',
    description: '优先覆盖就诊、问路和日常请求。',
  },
  {
    id: 'minnan',
    label: '闽南语',
    region: '福建 / 台湾',
    description: '提供常用问候与求助表达。',
  },
  {
    id: 'shanghai',
    label: '上海话',
    region: '上海及周边',
    description: '提供常用问候与就诊沟通表达。',
  },
  {
    id: 'sichuan',
    label: '四川话',
    region: '成都片区参考',
    description: '优先覆盖成都口语中的就诊和求助表达。',
  },
  {
    id: 'northeast',
    label: '东北话',
    region: '东北官话参考',
    description: '提供常用问路、求助和就诊表达。',
  },
]

const phrases: Record<DialectId, Phrase[]> = {
  cantonese: [
    {
      source: '你好',
      text: '你好。',
      pronunciation: 'nei5 hou2',
      note: '粤语里“你好”与普通话写法相同，读音不同。',
    },
    {
      source: '我胸口有点痛',
      text: '我个胸口有啲痛。',
      pronunciation: 'ngo5 go3 hung1 hau2 jau5 di1 tung3',
      note: '“有啲”表示“有一点”，适合描述轻度不适。',
    },
    {
      source: '我听不清医生说什么',
      text: '我听唔清医生讲乜。',
      pronunciation: 'ngo5 teng1 m4 cing1 ji1 sang1 gong2 mat1',
      note: '需要对方重复时，可以继续说“唔该讲慢啲”。',
    },
    {
      source: '请问洗手间在哪里',
      text: '唔该，洗手间喺边度？',
      pronunciation: 'm4 goi1, sai2 sau2 gaan1 hai2 bin1 dou6',
      note: '“唔该”可以礼貌地询问，也可以请求别人帮忙。',
    },
    {
      source: '我对青霉素过敏',
      text: '我对青霉素过敏。',
      pronunciation: 'ngo5 deoi3 cing1 mui4 sou3 gwo3 man5',
      note: '过敏史请同时出示药物或病历记录，避免只依赖口头翻译。',
    },
    {
      source: '请慢一点说',
      text: '唔该讲慢啲。',
      pronunciation: 'm4 goi1 gong2 maan6 di1',
      note: '这是就诊沟通中很实用的礼貌请求。',
    },
    {
      source: '我需要翻译帮助',
      text: '我需要翻译帮手。',
      pronunciation: 'ngo5 seoi1 jiu3 faan1 jik6 bong1 sau2',
      note: '也可以把这句话交给医院服务台或志愿者。',
    },
  ],
  minnan: [
    {
      source: '你好',
      text: '你好。',
      pronunciation: 'lí hó',
      note: '闽南语常用读法为“lí hó”。',
    },
    {
      source: '谢谢',
      text: '多謝。',
      pronunciation: 'to-siā',
      note: '不同地区的闽南语读音会有差异。',
    },
    {
      source: '我不舒服',
      text: '我真毋舒適。',
      pronunciation: 'guá tsin m̄ sū-sit',
      note: '医疗沟通建议同时说出身体不舒服的具体位置。',
    },
    {
      source: '请慢一点说',
      text: '請講較慢。',
      pronunciation: 'tshiáⁿ kóng khah bān',
      note: '各地腔调不同，必要时请对方改用普通话或文字沟通。',
    },
  ],
  shanghai: [
    {
      source: '你好',
      text: '侬好。',
      pronunciation: 'nong ho',
      note: '上海话使用“侬”称呼“你”，读音与普通话不同。',
    },
    {
      source: '谢谢',
      text: '谢谢侬。',
      pronunciation: 'xia xia nong',
      note: '这是上海日常交流中常见的感谢表达。',
    },
    {
      source: '我不舒服',
      text: '我有点勿适意。',
      pronunciation: 'ngu hae tiq veh seh yi',
      note: '医疗沟通建议同时用普通话或文字补充症状。',
    },
    {
      source: '请慢一点说',
      text: '请侬讲慢点。',
      pronunciation: 'tshin nong kang mae ti',
      note: '各区口音会有差异，必要时请对方改用普通话。',
    },
  ],
  sichuan: [
    {
      source: '你好',
      text: '你好。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '四川话内部有地域差异，这里采用成都片区常见口语写法。',
    },
    {
      source: '我不舒服',
      text: '我有点不舒服嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '“嘛”是成都口语里常见的语气词，医疗沟通仍建议说清具体症状。',
    },
    {
      source: '我听不清医生说什么',
      text: '我听不清医生在说啥子。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '“啥子”相当于“什么”，正式场景可以同时展示普通话原文。',
    },
    {
      source: '请问洗手间在哪里',
      text: '请问厕所在哪点？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '“哪点”相当于“哪里”，不同城市也可能说“哪儿”。',
    },
    {
      source: '我对青霉素过敏',
      text: '我对青霉素过敏。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '请慢一点说',
      text: '麻烦你说慢点嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '这是较自然的礼貌请求，具体语气会随地区变化。',
    },
  ],
  northeast: [
    {
      source: '你好',
      text: '你好。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '东北官话覆盖范围很大，这里只提供常见口语写法。',
    },
    {
      source: '我不舒服',
      text: '我有点不舒坦。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '“不舒坦”是常见口语说法，症状描述请继续说具体位置。',
    },
    {
      source: '我听不清医生说什么',
      text: '我听不清医生说啥。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '“啥”相当于“什么”，正式场景建议同时展示普通话原文。',
    },
    {
      source: '请问洗手间在哪里',
      text: '请问厕所搁哪儿？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '“搁哪儿”是部分东北地区的常用问法，各地可能不同。',
    },
    {
      source: '我对青霉素过敏',
      text: '我对青霉素过敏。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '请慢一点说',
      text: '麻烦你说慢点儿。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '“点儿”是常见儿化形式，实际读法因城市而异。',
    },
  ],
}

const hospitalPhraseAdditions: Record<DialectId, Phrase[]> = {
  cantonese: [
    {
      source: '你好，我是中国人',
      text: '你好，我係中国人。',
      pronunciation: 'nei5 hou2, ngo5 hai6 zung1 gwok3 jan4',
      note: '粤语书写会同时见到“係”和“是”，这里采用常见口语写法。',
    },
    {
      source: '我想挂号',
      text: '我想挂号。',
      pronunciation: 'ngo5 soeng2 gwaa3 hou6',
      note: '到医院服务台或自助机前，可以先用这句话说明需求。',
    },
    {
      source: '请问挂号处在哪里',
      text: '唔该，挂号处喺边度？',
      pronunciation: 'm4 goi1, gwaa3 hou6 cyu3 hai2 bin1 dou6',
      note: '“唔该”是粤语里很常用的礼貌请求。',
    },
    {
      source: '请问内科在哪里',
      text: '唔该，内科喺边度？',
      pronunciation: 'm4 goi1, noi6 fo1 hai2 bin1 dou6',
      note: '科室名称通常保留医院现场使用的正式叫法。',
    },
    {
      source: '我要看急诊',
      text: '我要睇急症。',
      pronunciation: 'ngo5 jiu3 tai2 gap1 zing3',
      note: '粤语中“急诊”常说“急症”，紧急情况仍应直接联系医护人员。',
    },
    {
      source: '我肚子痛两天了',
      text: '我个肚痛咗两日。',
      pronunciation: 'ngo5 go3 tou5 tung3 zo2 loeng5 jat6',
      note: '描述症状时建议继续补充疼痛位置和严重程度。',
    },
    {
      source: '我发烧了',
      text: '我发烧。',
      pronunciation: 'ngo5 faat3 siu1',
      note: '如果知道体温，可以一并告诉医护人员。',
    },
    {
      source: '这个检查需要空腹吗',
      text: '呢个检查使唔使空肚？',
      pronunciation: 'ni1 go3 gim2 caa4 sai2 m4 sai2 hung1 tou5',
      note: '检查前是否需要禁食，请以医院和医生的说明为准。',
    },
    {
      source: '这个药怎么吃',
      text: '呢只药点食？',
      pronunciation: 'ni1 zek3 joek6 dim2 sik6',
      note: '药名、剂量和次数仍需让医护人员或药袋上的说明确认。',
    },
    {
      source: '我对海鲜过敏',
      text: '我对海鲜过敏。',
      pronunciation: 'ngo5 deoi3 hoi2 sin1 gwo3 man5',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '我听不懂，请写下来',
      text: '我听唔明，唔该写低。',
      pronunciation: 'ngo5 teng1 m4 ming4, m4 goi1 se2 dai1',
      note: '可以请对方把药名、时间和注意事项写在纸上。',
    },
    {
      source: '可以请翻译吗',
      text: '可唔可以搵翻译？',
      pronunciation: 'ho2 m4 ho2 ji5 wan2 faan1 jik6',
      note: '需要专业口译时，可以把这句话交给医院服务台。',
    },
    {
      source: '什么时候复诊',
      text: '几时返嚟覆诊？',
      pronunciation: 'gei2 si4 faan1 lai4 fuk1 zan2',
      note: '复诊时间请同时记录日期、科室和医生姓名。',
    },
    {
      source: '费用是多少',
      text: '要几多钱？',
      pronunciation: 'jiu3 gei2 do1 cin2',
      note: '费用和医保报销比例请以医院窗口或官方渠道为准。',
    },
    {
      source: '我需要做检查',
      text: '我需要做检查。',
      pronunciation: 'ngo5 seoi1 jiu3 zou6 gim2 caa1',
      note: '可以把检查单一起交给医护人员核对项目和时间。',
    },
    {
      source: '我要验血',
      text: '我要验血。',
      pronunciation: 'ngo5 jiu3 jim6 hyut3',
      note: '抽血前是否需要空腹，请以医护人员的说明为准。',
    },
    {
      source: '疼痛是从什么时候开始的',
      text: '疼痛由几时开始？',
      pronunciation: 'tung3 tung3 jau4 gei2 si4 hoi1 ci2',
      note: '回答时可以补充持续多久、是否加重和疼痛程度。',
    },
    {
      source: '我现在正在吃药',
      text: '我而家食紧药。',
      pronunciation: 'ngo5 ji4 gaa1 sik6 gan2 joek6',
      note: '请同时说出药名、剂量和每天服用次数。',
    },
    {
      source: '我怀孕了',
      text: '我怀孕喇。',
      pronunciation: 'ngo5 waai4 jan6 laa3',
      note: '怀孕或可能怀孕时，请在检查和用药前主动告知医护人员。',
    },
    {
      source: '我需要轮椅',
      text: '我需要轮椅。',
      pronunciation: 'ngo5 seoi1 jiu3 leon4 ji2',
      note: '行动不便时可以向服务台或分诊台提出协助需求。',
    },
    {
      source: '可以用医保吗',
      text: '可唔可以用医保？',
      pronunciation: 'ho2 m4 ho2 ji5 jung6 ji1 bou2',
      note: '能否使用医保及报销比例请以医院窗口和当地政策为准。',
    },
    {
      source: '什么时候可以拿到结果',
      text: '几时可以攞到结果？',
      pronunciation: 'gei2 si4 ho2 ji5 lo2 dou3 git3 gwo2',
      note: '请记录取结果的时间、地点和领取方式。',
    },
    {
      source: '我需要住院吗',
      text: '使唔使住院？',
      pronunciation: 'sai2 m4 sai2 zyu6 jyun2',
      note: '是否住院由医生根据检查和病情判断。',
    },
    {
      source: '请给我一份书面说明',
      text: '唔该俾份书面说明我。',
      pronunciation: 'm4 goi1 bei2 fan6 syu1 min6 syat3 ming4 ngo5',
      note: '药物、复诊和注意事项尽量请医院提供书面记录。',
    },
  ],
  minnan: [
    {
      source: '你好，我是中国人',
      text: '你好，我是中國人。',
      pronunciation: 'lí hó, guá sī Tiong-kok lâng',
      note: '闽南语各地读法不同，这里采用台湾台语常见的罗马字参考。',
    },
    {
      source: '我想挂号',
      text: '我欲掛號。',
      pronunciation: 'guá beh kuà hō',
      note: '到医院柜台时可以先用这句话说明要登记就诊。',
    },
    {
      source: '请问挂号处在哪里',
      text: '請問掛號櫃台佇佗位？',
      pronunciation: 'tshiáⁿ-mn̄ kuà-hō kuī-tâi tī tó-uī',
      note: '不同地区可能使用“掛號櫃台”或“服務台”等说法。',
    },
    {
      source: '请问内科在哪里',
      text: '請問內科佇佗位？',
      pronunciation: 'tshiáⁿ-mn̄ lāi-kho tī tó-uī',
      note: '科室名称建议同时展示普通话文字，方便现场核对。',
    },
    {
      source: '我要看急诊',
      text: '我欲看急診。',
      pronunciation: 'guá beh khuànn kip-chín',
      note: '紧急情况请直接向分診或急診柜台求助。',
    },
    {
      source: '我肚子痛两天了',
      text: '我腹肚疼兩工矣。',
      pronunciation: 'guá pak-tóo thiàⁿ nn̄g kang--ah',
      note: '描述症状时建议补充部位、持续时间和是否加重。',
    },
    {
      source: '我发烧了',
      text: '我發燒矣。',
      pronunciation: 'guá huat-sio--ah',
      note: '如果有体温记录，可以一并告诉医护人员。',
    },
    {
      source: '这个检查需要空腹吗',
      text: '這个檢查需要空腹無？',
      pronunciation: 'tsit ê kiám-tsha su-iàu khang-hok--bô',
      note: '是否需要禁食请以医院通知和医生说明为准。',
    },
    {
      source: '这个药怎么吃',
      text: '這个藥按怎食？',
      pronunciation: 'tsit ê ia̍h án-tsuáⁿ tsia̍h',
      note: '药名、剂量和次数要对照药袋或请药师再次说明。',
    },
    {
      source: '我对海鲜过敏',
      text: '我對海鮮過敏。',
      pronunciation: 'guá tuì hái-sian kòe-bín',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '我听不懂，请写下来',
      text: '我聽無，請寫落來。',
      pronunciation: 'guá thiaⁿ bô, tshiáⁿ siá lo̍h-lâi',
      note: '可以请对方把药名、时间和注意事项写下来。',
    },
    {
      source: '可以请翻译吗',
      text: '敢會當請翻譯？',
      pronunciation: 'kám ē-tàng tshiáⁿ hoan-e̍k',
      note: '需要专业口译时，可以把这句话交给医院服务台。',
    },
    {
      source: '什么时候复诊',
      text: '啥物時陣閣來複診？',
      pronunciation: 'siánn-mih sî-tsūn koh lâi ho̍k-chín',
      note: '复诊时间请同时记录日期、科室和医生姓名。',
    },
    {
      source: '费用是多少',
      text: '費用偌濟？',
      pronunciation: 'hùi-iōng guā-tsē',
      note: '费用和医保报销比例请以医院窗口或官方渠道为准。',
    },
    {
      source: '我需要做检查',
      text: '我需要做檢查。',
      pronunciation: 'guá su-iàu tsò kiám-tsha',
      note: '可以把检查单一起交给医护人员核对项目和时间。',
    },
    {
      source: '我要验血',
      text: '我欲驗血。',
      pronunciation: 'guá beh giām-hueh',
      note: '抽血前是否需要空腹，请以医护人员的说明为准。',
    },
    {
      source: '疼痛是从什么时候开始的',
      text: '疼痛是對啥物時陣開始？',
      pronunciation: 'thiàⁿ-thàng sī tuì siánn-mih sî-tsūn khai-sí',
      note: '回答时可以补充持续多久、是否加重和疼痛程度。',
    },
    {
      source: '我现在正在吃药',
      text: '我現此時咧食藥。',
      pronunciation: 'guá hiān-tshit-sî teh tsia̍h ia̍h',
      note: '请同时说出药名、剂量和每天服用次数。',
    },
    {
      source: '我怀孕了',
      text: '我有身矣。',
      pronunciation: 'guá ū sin--ah',
      note: '怀孕或可能怀孕时，请在检查和用药前主动告知医护人员。',
    },
    {
      source: '我需要轮椅',
      text: '我需要輪椅。',
      pronunciation: 'guá su-iàu liân-í',
      note: '行动不便时可以向服务台或分诊台提出协助需求。',
    },
    {
      source: '可以用医保吗',
      text: '會當用健保無？',
      pronunciation: 'ē-tàng īng kiān-póo--bô',
      note: '能否使用医保及报销比例请以医院窗口和当地政策为准。',
    },
    {
      source: '什么时候可以拿到结果',
      text: '幾時會當領結果？',
      pronunciation: 'kuí-sî ē-tàng niá kiat-kó',
      note: '请记录取结果的时间、地点和领取方式。',
    },
    {
      source: '我需要住院吗',
      text: '我需要住院無？',
      pronunciation: 'guá su-iàu tsū-iān--bô',
      note: '是否住院由医生根据检查和病情判断。',
    },
    {
      source: '请给我一份书面说明',
      text: '請予我一份文字說明。',
      pronunciation: 'tshiáⁿ hōo guá tsi̍t hun bûn-jī suat-bîng',
      note: '药物、复诊和注意事项尽量请医院提供书面记录。',
    },
  ],
  shanghai: [
    {
      source: '你好，我是中国人',
      text: '侬好，我是中国人。',
      pronunciation: 'nong ho, ngu zy tsong kuoq nyin',
      note: '上海话内部差异明显，读法仅作上海市区口语参考。',
    },
    {
      source: '我想挂号',
      text: '我想去挂号。',
      pronunciation: 'ngu xiang chi ko hao',
      note: '到医院柜台时可以先用这句话说明要登记就诊。',
    },
    {
      source: '请问挂号处在哪里',
      text: '请问挂号处勒啥地方？',
      pronunciation: 'tshin mon ko hao tsy le sa di fon',
      note: '不同区域可能会使用略有差异的问法。',
    },
    {
      source: '请问内科在哪里',
      text: '请问内科勒啥地方？',
      pronunciation: 'tshin mon no khuo le sa di fon',
      note: '科室名称建议同时展示普通话文字，方便现场核对。',
    },
    {
      source: '我要看急诊',
      text: '我要看急诊。',
      pronunciation: 'ngu yao khe tsik tsyen',
      note: '紧急情况请直接向分诊或急诊柜台求助。',
    },
    {
      source: '我肚子痛两天了',
      text: '我肚皮痛两日哉。',
      pronunciation: 'ngu du bi thon liang nyih ze',
      note: '描述症状时建议补充部位、持续时间和是否加重。',
    },
    {
      source: '我发烧了',
      text: '我发烧哉。',
      pronunciation: 'ngu fao shao ze',
      note: '如果有体温记录，可以一并告诉医护人员。',
    },
    {
      source: '这个检查需要空腹吗',
      text: '只个检查要空肚皮伐？',
      pronunciation: 'tsy ge chien kha yao khon du bi va',
      note: '是否需要禁食请以医院通知和医生说明为准。',
    },
    {
      source: '这个药怎么吃',
      text: '只个药哪能吃？',
      pronunciation: 'tsy ge yao na nung tshaq',
      note: '药名、剂量和次数要对照药袋或请药师再次说明。',
    },
    {
      source: '我对海鲜过敏',
      text: '我对海鲜过敏。',
      pronunciation: 'ngu tei hae shi kuoq min',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '我听不懂，请写下来',
      text: '我听勿懂，请侬写下来。',
      pronunciation: 'ngu thin veh don, tshin nong sia lo ka',
      note: '可以请对方把药名、时间和注意事项写下来。',
    },
    {
      source: '可以请翻译吗',
      text: '能勿能请翻译帮忙？',
      pronunciation: 'nung veh nung tshin faan yi pan mo',
      note: '需要专业口译时，可以把这句话交给医院服务台。',
    },
    {
      source: '什么时候复诊',
      text: '啥辰光再来？',
      pronunciation: 'sa zen kuan ze le',
      note: '复诊时间请同时记录日期、科室和医生姓名。',
    },
    {
      source: '费用是多少',
      text: '要多少钞票？',
      pronunciation: 'yao to tse nyi',
      note: '费用和医保报销比例请以医院窗口或官方渠道为准。',
    },
    {
      source: '我需要做检查',
      text: '我需要做检查。',
      pronunciation: 'ngu su yao tso chien kha',
      note: '可以把检查单一起交给医护人员核对项目和时间。',
    },
    {
      source: '我要验血',
      text: '我要验血。',
      pronunciation: 'ngu yao nyi xie',
      note: '抽血前是否需要空腹，请以医护人员的说明为准。',
    },
    {
      source: '疼痛是从什么时候开始的',
      text: '痛是啥辰光开始个？',
      pronunciation: 'thon zy sa zen kuan khe she ka',
      note: '回答时可以补充持续多久、是否加重和疼痛程度。',
    },
    {
      source: '我现在正在吃药',
      text: '我现在勒吃药。',
      pronunciation: 'ngu yi ze le tshaq yao',
      note: '请同时说出药名、剂量和每天服用次数。',
    },
    {
      source: '我怀孕了',
      text: '我有身孕哉。',
      pronunciation: 'ngu hae sen yin ze',
      note: '怀孕或可能怀孕时，请在检查和用药前主动告知医护人员。',
    },
    {
      source: '我需要轮椅',
      text: '我需要轮椅。',
      pronunciation: 'ngu su yao lon yi',
      note: '行动不便时可以向服务台或分诊台提出协助需求。',
    },
    {
      source: '可以用医保吗',
      text: '能用医保伐？',
      pronunciation: 'nung yon yi bao va',
      note: '能否使用医保及报销比例请以医院窗口和当地政策为准。',
    },
    {
      source: '什么时候可以拿到结果',
      text: '啥辰光可以拿结果？',
      pronunciation: 'sa zen kuan khe yi na ji guo',
      note: '请记录取结果的时间、地点和领取方式。',
    },
    {
      source: '我需要住院吗',
      text: '要住院伐？',
      pronunciation: 'yao zyu yi va',
      note: '是否住院由医生根据检查和病情判断。',
    },
    {
      source: '请给我一份书面说明',
      text: '请侬写份说明。',
      pronunciation: 'tshin nong sia ven shen',
      note: '药物、复诊和注意事项尽量请医院提供书面记录。',
    },
  ],
  sichuan: [
    {
      source: '你好，我是中国人',
      text: '你好，我是中国人嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '四川话内部有地域差异，这里采用成都片区常见口语写法。',
    },
    {
      source: '我想挂号',
      text: '我想挂个号。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '到医院柜台时可以先用这句话说明要登记就诊。',
    },
    {
      source: '请问挂号处在哪里',
      text: '挂号的地方在哪点？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '“哪点”相当于“哪里”，不同城市也可能说“哪儿”。',
    },
    {
      source: '请问内科在哪里',
      text: '内科在哪点？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '科室名称建议同时展示普通话文字，方便现场核对。',
    },
    {
      source: '我要看急诊',
      text: '我要看急诊嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '紧急情况请直接向分诊或急诊柜台求助。',
    },
    {
      source: '我肚子痛两天了',
      text: '我肚皮痛两天了嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '描述症状时建议补充部位、持续时间和是否加重。',
    },
    {
      source: '我发烧了',
      text: '我在发烧嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '如果有体温记录，可以一并告诉医护人员。',
    },
    {
      source: '这个检查需要空腹吗',
      text: '这个检查要不要空肚子？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '是否需要禁食请以医院通知和医生说明为准。',
    },
    {
      source: '这个药怎么吃',
      text: '这个药咋个吃？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '药名、剂量和次数要对照药袋或请药师再次说明。',
    },
    {
      source: '我对海鲜过敏',
      text: '我对海鲜过敏。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '我听不懂，请写下来',
      text: '我听不懂，麻烦写下来嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '可以请对方把药名、时间和注意事项写下来。',
    },
    {
      source: '可以请翻译吗',
      text: '能不能找个翻译嘛？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '需要专业口译时，可以把这句话交给医院服务台。',
    },
    {
      source: '什么时候复诊',
      text: '好久回来复诊？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '“好久”在这里表示“什么时候”，复诊时间仍请记录清楚。',
    },
    {
      source: '费用是多少',
      text: '要好多钱？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '费用和医保报销比例请以医院窗口或官方渠道为准。',
    },
    {
      source: '我需要做检查',
      text: '我需要做检查嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '可以把检查单一起交给医护人员核对项目和时间。',
    },
    {
      source: '我要验血',
      text: '我要验血嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '抽血前是否需要空腹，请以医护人员的说明为准。',
    },
    {
      source: '疼痛是从什么时候开始的',
      text: '痛是从好久开始的？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '回答时可以补充持续多久、是否加重和疼痛程度。',
    },
    {
      source: '我现在正在吃药',
      text: '我现在在吃药嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '请同时说出药名、剂量和每天服用次数。',
    },
    {
      source: '我怀孕了',
      text: '我怀孕了嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '怀孕或可能怀孕时，请在检查和用药前主动告知医护人员。',
    },
    {
      source: '我需要轮椅',
      text: '我需要个轮椅。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '行动不便时可以向服务台或分诊台提出协助需求。',
    },
    {
      source: '可以用医保吗',
      text: '可以用医保不？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '能否使用医保及报销比例请以医院窗口和当地政策为准。',
    },
    {
      source: '什么时候可以拿到结果',
      text: '好久可以拿结果？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '请记录取结果的时间、地点和领取方式。',
    },
    {
      source: '我需要住院吗',
      text: '要不要住院嘛？',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '是否住院由医生根据检查和病情判断。',
    },
    {
      source: '请给我一份书面说明',
      text: '麻烦给我写个说明嘛。',
      pronunciation: '四川各地读音不同，文字仅作表达参考。',
      note: '药物、复诊和注意事项尽量请医院提供书面记录。',
    },
  ],
  northeast: [
    {
      source: '你好，我是中国人',
      text: '你好，我是中国人。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '东北官话覆盖范围很大，这里只提供常见口语写法。',
    },
    {
      source: '我想挂号',
      text: '我想挂个号。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '到医院柜台时可以先用这句话说明要登记就诊。',
    },
    {
      source: '请问挂号处在哪里',
      text: '挂号的地方搁哪儿？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '“搁哪儿”是部分东北地区的常用问法，各地可能不同。',
    },
    {
      source: '请问内科在哪里',
      text: '内科搁哪儿？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '科室名称建议同时展示普通话文字，方便现场核对。',
    },
    {
      source: '我要看急诊',
      text: '我要看急诊。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '紧急情况请直接向分诊或急诊柜台求助。',
    },
    {
      source: '我肚子痛两天了',
      text: '我肚子疼两天了。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '描述症状时建议补充部位、持续时间和是否加重。',
    },
    {
      source: '我发烧了',
      text: '我发烧了。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '如果有体温记录，可以一并告诉医护人员。',
    },
    {
      source: '这个检查需要空腹吗',
      text: '这检查得空腹不？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '是否需要禁食请以医院通知和医生说明为准。',
    },
    {
      source: '这个药怎么吃',
      text: '这药咋吃？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '药名、剂量和次数要对照药袋或请药师再次说明。',
    },
    {
      source: '我对海鲜过敏',
      text: '我对海鲜过敏。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '过敏史请同时出示药物或病历记录。',
    },
    {
      source: '我听不懂，请写下来',
      text: '我听不懂，麻烦写下来。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '可以请对方把药名、时间和注意事项写下来。',
    },
    {
      source: '可以请翻译吗',
      text: '能帮我找个翻译不？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '需要专业口译时，可以把这句话交给医院服务台。',
    },
    {
      source: '什么时候复诊',
      text: '啥时候回来复诊？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '复诊时间请同时记录日期、科室和医生姓名。',
    },
    {
      source: '费用是多少',
      text: '得多少钱？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '费用和医保报销比例请以医院窗口或官方渠道为准。',
    },
    {
      source: '我需要做检查',
      text: '我得做个检查。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '可以把检查单一起交给医护人员核对项目和时间。',
    },
    {
      source: '我要验血',
      text: '我要验血。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '抽血前是否需要空腹，请以医护人员的说明为准。',
    },
    {
      source: '疼痛是从什么时候开始的',
      text: '疼是啥时候开始的？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '回答时可以补充持续多久、是否加重和疼痛程度。',
    },
    {
      source: '我现在正在吃药',
      text: '我现在正吃着药呢。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '请同时说出药名、剂量和每天服用次数。',
    },
    {
      source: '我怀孕了',
      text: '我怀孕了。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '怀孕或可能怀孕时，请在检查和用药前主动告知医护人员。',
    },
    {
      source: '我需要轮椅',
      text: '我需要个轮椅。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '行动不便时可以向服务台或分诊台提出协助需求。',
    },
    {
      source: '可以用医保吗',
      text: '能用医保不？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '能否使用医保及报销比例请以医院窗口和当地政策为准。',
    },
    {
      source: '什么时候可以拿到结果',
      text: '啥时候能拿结果？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '请记录取结果的时间、地点和领取方式。',
    },
    {
      source: '我需要住院吗',
      text: '我得住院不？',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '是否住院由医生根据检查和病情判断。',
    },
    {
      source: '请给我一份书面说明',
      text: '麻烦给我写个说明。',
      pronunciation: '东北各地口音不同，文字仅作表达参考。',
      note: '药物、复诊和注意事项尽量请医院提供书面记录。',
    },
  ],
}

for (const option of dialectOptions) {
  phrases[option.id].push(...hospitalPhraseAdditions[option.id])
}

const hospitalQuickSources = [
  '我想挂号',
  '我要看急诊',
  '这个药怎么吃',
  '我需要做检查',
  '我怀孕了',
  '可以用医保吗',
]

const cantoneseReplacements: Array<[string, string]> = [
  ['什么时候', '几时'],
  ['在哪里', '喺边度'],
  ['不能', '唔可以'],
  ['不可以', '唔得'],
  ['疼痛', '痛'],
  ['这个检查需要空腹吗', '呢个检查使唔使空肚'],
  ['这个药怎么吃', '呢只药点食'],
  ['我要看急诊', '我要睇急症'],
  ['什么时候复诊', '几时返嚟覆诊'],
  ['可以请翻译吗', '可唔可以搵翻译'],
  ['请问挂号处在哪里', '唔该，挂号处喺边度'],
  ['请问内科在哪里', '唔该，内科喺边度'],
  ['我想挂号', '我想挂号'],
  ['我发烧了', '我发烧'],
  ['两天了', '两日'],
  ['我是', '我係'],
  ['我听不清', '我听唔清'],
  ['听不清', '听唔清'],
  ['有一点', '有一啲'],
  ['有点', '有啲'],
  ['最近三天', '最近三日'],
  ['没有', '冇'],
  ['不舒服', '唔舒服'],
  ['不清楚', '唔清楚'],
  ['请问', '唔该'],
  ['请', '唔该'],
  ['哪里', '边度'],
  ['什么', '乜'],
  ['怎么', '点样'],
  ['现在', '而家'],
  ['吃', '食'],
  ['说', '讲'],
  ['看', '睇'],
]

const cantoneseReverseReplacements: Array<[string, string]> = [
  ['睇急症', '看急诊'],
  ['讲乜', '说什么'],
  ['喺边度', '在哪里'],
  ['几时', '什么时候'],
  ['唔可以', '不能'],
  ['唔得', '不可以'],
  ['食', '吃'],
  ['讲', '说'],
  ['睇', '看'],
  ['呢个检查使唔使空肚', '这个检查需要空腹吗'],
  ['呢只药点食', '这个药怎么吃'],
  ['睇急症', '看急诊'],
  ['覆诊', '复诊'],
  ['搵翻译', '找翻译'],
  ['返嚟', '回来'],
  ['我係', '我是'],
  ['两日', '两天'],
  ['我个', '我的'],
  ['唔该', '请'],
  ['听唔清', '听不清'],
  ['有一啲', '有一点'],
  ['有啲', '有一点'],
  ['最近三日', '最近三天'],
  ['唔舒服', '不舒服'],
  ['唔清楚', '不清楚'],
  ['边度', '哪里'],
  ['喺', '在'],
  ['点样', '怎么样'],
  ['而家', '现在'],
  ['讲乜', '说什么'],
  ['乜', '什么'],
  ['冇', '没有'],
  ['帮手', '帮助'],
]

const minnanReplacements: Array<[string, string]> = [
  ['什么时候', '啥物時陣'],
  ['请问', '請問'],
  ['不舒服', '毋舒適'],
  ['医院', '醫院'],
  ['医生', '醫生'],
  ['检查', '檢查'],
  ['挂号', '掛號'],
  ['哪里', '佗位'],
  ['什么', '啥物'],
  ['怎么', '按怎'],
  ['现在', '現此時'],
  ['没有', '無'],
  ['可以', '會當'],
  ['在', '佇'],
  ['药', '藥'],
  ['吃', '食'],
  ['请', '請'],
]

const minnanReverseReplacements: Array<[string, string]> = [
  ['啥物時陣', '什么时候'],
  ['毋舒適', '不舒服'],
  ['醫院', '医院'],
  ['醫生', '医生'],
  ['檢查', '检查'],
  ['掛號', '挂号'],
  ['佗位', '哪里'],
  ['啥物', '什么'],
  ['按怎', '怎么'],
  ['現此時', '现在'],
  ['無', '没有'],
  ['會當', '可以'],
  ['佇', '在'],
  ['藥', '药'],
  ['食', '吃'],
  ['請問', '请问'],
  ['請', '请'],
]

const shanghaiReplacements: Array<[string, string]> = [
  ['什么时候', '啥辰光'],
  ['在哪里', '勒啥地方'],
  ['不舒服', '勿适意'],
  ['疼痛', '痛'],
  ['你', '侬'],
  ['什么', '啥'],
  ['怎么', '哪能'],
  ['没有', '呒没'],
  ['现在', '现在勒'],
  ['可以', '能'],
]

const shanghaiReverseReplacements: Array<[string, string]> = [
  ['啥辰光', '什么时候'],
  ['勒啥地方', '哪里'],
  ['勿适意', '不舒服'],
  ['侬', '你'],
  ['哪能', '怎么'],
  ['呒没', '没有'],
  ['现在勒', '现在'],
]

const sichuanReplacements: Array<[string, string]> = [
  ['不能', '不得行'],
  ['疼痛', '痛'],
  ['这个检查需要空腹吗', '这个检查要不要空肚子'],
  ['这个药怎么吃', '这个药咋个吃'],
  ['请问挂号处在哪里', '挂号的地方在哪点'],
  ['请问内科在哪里', '内科在哪点'],
  ['我要看急诊', '我要看急诊嘛'],
  ['什么时候复诊', '好久回来复诊'],
  ['可以请翻译吗', '能不能找个翻译嘛'],
  ['我想挂号', '我想挂个号'],
  ['两天了', '两天了嘛'],
  ['肚子', '肚皮'],
  ['为什么', '为啥子'],
  ['怎么办', '咋个整'],
  ['什么', '啥子'],
  ['哪里', '哪点'],
  ['怎么', '咋个'],
  ['没有', '没得'],
]

const sichuanReverseReplacements: Array<[string, string]> = [
  ['不得行', '不能'],
  ['要不要空肚子', '需要空腹吗'],
  ['咋个吃', '怎么吃'],
  ['挂号的地方在哪点', '挂号处在哪里'],
  ['内科在哪点', '内科在哪里'],
  ['回来复诊', '复诊'],
  ['找个翻译嘛', '找翻译'],
  ['挂个号', '挂号'],
  ['肚皮', '肚子'],
  ['为啥子', '为什么'],
  ['咋个整', '怎么办'],
  ['啥子', '什么'],
  ['哪点', '哪里'],
  ['咋个', '怎么'],
  ['没得', '没有'],
  ['嘛', ''],
]

const northeastReplacements: Array<[string, string]> = [
  ['这个检查需要空腹吗', '这检查得空腹不'],
  ['这个药怎么吃', '这药咋吃'],
  ['请问挂号处在哪里', '挂号的地方搁哪儿'],
  ['请问内科在哪里', '内科搁哪儿'],
  ['什么时候复诊', '啥时候回来复诊'],
  ['可以请翻译吗', '能帮我找个翻译不'],
  ['我想挂号', '我想挂个号'],
  ['怎么办', '咋整'],
  ['什么', '啥'],
  ['哪里', '哪儿'],
  ['一点', '一点儿'],
]

const northeastReverseReplacements: Array<[string, string]> = [
  ['这检查得空腹不', '这个检查需要空腹吗'],
  ['这药咋吃', '这个药怎么吃'],
  ['挂号的地方搁哪儿', '挂号处在哪里'],
  ['内科搁哪儿', '内科在哪里'],
  ['回来复诊', '复诊'],
  ['找个翻译不', '找翻译'],
  ['挂个号', '挂号'],
  ['咋整', '怎么办'],
  ['说啥', '说什么'],
  ['搁哪儿', '在哪里'],
  ['不舒坦', '不舒服'],
  ['慢点儿', '慢一点'],
  ['哪儿', '哪里'],
  ['啥', '什么'],
  ['点儿', '一点'],
]

const dialectReplacements: Record<
  DialectId,
  { toDialect: Array<[string, string]>; toMandarin: Array<[string, string]> }
> = {
  cantonese: { toDialect: cantoneseReplacements, toMandarin: cantoneseReverseReplacements },
  minnan: { toDialect: minnanReplacements, toMandarin: minnanReverseReplacements },
  shanghai: { toDialect: shanghaiReplacements, toMandarin: shanghaiReverseReplacements },
  sichuan: { toDialect: sichuanReplacements, toMandarin: sichuanReverseReplacements },
  northeast: { toDialect: northeastReplacements, toMandarin: northeastReverseReplacements },
}

const onboardingSteps = [
  {
    eyebrow: '第一步 · 方言翻译',
    icon: '粤',
    title: '先把想说的话翻译好',
    description: '在普通话和目标方言之间切换，获得文字、读法和沟通提示。',
    module: 'translate' as ModuleId,
    action: '开始翻译',
  },
]

function hasCompletedOnboarding() {
  try {
    return window.localStorage.getItem('zhentu-onboarding-complete') === 'true'
  } catch {
    return false
  }
}

function markOnboardingComplete() {
  try {
    window.localStorage.setItem('zhentu-onboarding-complete', 'true')
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function normalizeSource(value: string) {
  return value.trim().replace(/[。！？!?]+$/u, '')
}

function translationPunctuation(source: string) {
  const trimmed = source.trim()
  if (/[?？]$/u.test(trimmed)) return '？'
  if (/[!！]$/u.test(trimmed)) return '！'
  return '。'
}

function translateSource(
  source: string,
  dialect: DialectId,
  direction: Direction,
): Translation | null {
  const normalized = normalizeSource(source)
  if (!normalized) return null

  const exact = phrases[dialect].find((phrase) =>
    direction === 'toDialect'
      ? phrase.source === normalized
      : normalizeSource(phrase.text) === normalized,
  )
  if (exact) {
    return {
      text:
        direction === 'toDialect'
          ? exact.text
          : `${exact.source}${translationPunctuation(source)}`,
      pronunciation:
        direction === 'toDialect' ? exact.pronunciation : '普通话无需额外标注读法。',
      note:
        direction === 'toDialect'
          ? exact.note
          : '这是根据常用短句识别出的普通话含义，涉及用药和检查安排时请再次确认。',
      confidence: 'phrase',
    }
  }

  const replacements = dialectReplacements[dialect][direction]
  const translated = replacements.reduce(
      (value, [from, to]) => value.replaceAll(from, to),
      normalized,
    )
  if (translated !== normalized) {
    return {
      text: translated + translationPunctuation(source),
      pronunciation:
        direction === 'toDialect'
          ? `${selectedDialectLabel(dialect)}各地读音不同，文字仅作表达参考。`
          : '普通话无需额外标注读法。',
      note:
        direction === 'toDialect'
          ? '这是根据方言常用词生成的参考表达，重要症状请再让医护人员确认。'
          : '这是根据方言常用词生成的参考含义，重要信息请让对方用普通话或文字确认。',
      confidence: 'wording',
    }
  }

  return {
    text: normalized,
    pronunciation: direction === 'toDialect' ? '暂未提供读法' : '暂未识别这句方言',
    note:
      direction === 'toDialect'
        ? '这句话暂未覆盖常用表达，可以先展示原文，再请现场人员协助确认。'
        : '这句话暂未覆盖常用表达，可以先保留原文，再请对方用普通话或文字说明。',
    confidence: 'unmatched',
  }
}

function selectedDialectLabel(dialect: DialectId) {
  return dialectOptions.find((option) => option.id === dialect)?.label ?? '方言'
}

function voiceLocaleFor(direction: Direction, dialect: DialectId) {
  if (direction === 'toDialect') return 'zh-CN'
  return dialect === 'cantonese' ? 'zh-HK' : 'zh-CN'
}

function voiceLocaleNote(direction: Direction, dialect: DialectId) {
  if (direction === 'toDialect' || dialect === 'cantonese') return ''
  return `${selectedDialectLabel(dialect)}暂使用普通话识别，方言口音可能影响识别结果。`
}

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('translate')
  const [sourceText, setSourceText] = useState('')
  const [dialect, setDialect] = useState<DialectId>('cantonese')
  const [direction, setDirection] = useState<Direction>('toDialect')
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !hasCompletedOnboarding(),
  )
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [voiceMessage, setVoiceMessage] = useState('点击麦克风，用语音输入一句话。')
  const voiceSessionRef = useRef<VoiceSession | null>(null)

  const selectedDialect = useMemo(
    () => dialectOptions.find((option) => option.id === dialect) ?? dialectOptions[0],
    [dialect],
  )

  const sourceLanguageLabel = direction === 'toDialect' ? '普通话' : selectedDialect.label
  const targetLanguageLabel = direction === 'toDialect' ? selectedDialect.label : '普通话'
  const inputLabel = direction === 'toDialect' ? '普通话内容' : `${selectedDialect.label}内容`
  const voiceLocale = voiceLocaleFor(direction, dialect)
  const voiceActive = ['starting', 'listening', 'reconnecting', 'stopping'].includes(voiceStatus)
  const confidenceLabels: Record<TranslationConfidence, string> = {
    phrase: '常用短句',
    wording: '词语参考',
    unmatched: '待本地确认',
  }
  const examplePhrases = [
    ...phrases[dialect].slice(0, 2),
    ...hospitalQuickSources
      .map((source) => phrases[dialect].find((phrase) => phrase.source === source))
      .filter((phrase): phrase is Phrase => Boolean(phrase)),
  ].map((phrase) => (direction === 'toDialect' ? phrase.source : phrase.text))

  useEffect(() => {
    return () => {
      voiceSessionRef.current?.cancel()
      voiceSessionRef.current = null
    }
  }, [])

  const submitTranslation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sourceText.trim()) {
      setFormError('请先输入想翻译的普通话。')
      setTranslation(null)
      return
    }
    setFormError('')
    setCopied(false)
    setTranslation(translateSource(sourceText, dialect, direction))
  }

  const chooseDialect = (nextDialect: DialectId) => {
    setDialect(nextDialect)
    setCopied(false)
    if (sourceText.trim()) setTranslation(translateSource(sourceText, nextDialect, direction))
  }

  const handleExample = (example: string) => {
    setSourceText(example)
    setFormError('')
    setCopied(false)
    setTranslation(translateSource(example, dialect, direction))
  }

  const clearSource = () => {
    voiceSessionRef.current?.cancel()
    voiceSessionRef.current = null
    setSourceText('')
    setTranslation(null)
    setFormError('')
    setCopied(false)
    setVoiceStatus('idle')
    setVoiceMessage('点击麦克风，用语音输入一句话。')
  }

  const toggleDirection = () => {
    const nextDirection: Direction = direction === 'toDialect' ? 'toMandarin' : 'toDialect'
    if (translation) {
      const nextInput = translation.text
      setSourceText(nextInput)
      setTranslation(translateSource(nextInput, dialect, nextDirection))
    } else {
      setTranslation(null)
    }
    setDirection(nextDirection)
    setFormError('')
    setCopied(false)
  }

  const copyTranslation = async () => {
    if (!translation) return
    try {
      await navigator.clipboard?.writeText(translation.text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const toggleVoiceInput = () => {
    const activeSession = voiceSessionRef.current
    if (activeSession) {
      if (voiceStatus === 'starting' || voiceStatus === 'stopping') activeSession.forceStop()
      else activeSession.requestStop()
      return
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceStatus('unsupported')
      setVoiceMessage('当前浏览器不支持语音识别，请直接输入文字。')
      return
    }

    const session = createVoiceSession({
      Recognition,
      language: voiceLocale,
      sourceLabel: sourceLanguageLabel,
      hint: voiceLocaleNote(direction, dialect),
      onStatus: (status, message) => {
        if (voiceSessionRef.current !== session) return
        setVoiceStatus(status)
        setVoiceMessage(message)
        if (status === 'complete' || status === 'error' || status === 'permission-denied') {
          voiceSessionRef.current = null
        }
      },
      onTranscript: (text) => {
        if (voiceSessionRef.current === session) setSourceText(text)
      },
      onComplete: (text) => {
        if (voiceSessionRef.current !== session) return
        setFormError('')
        setCopied(false)
        setTranslation(translateSource(text, dialect, direction))
      },
    })
    voiceSessionRef.current = session
    setFormError('')
    session.start()
  }

  const finishOnboarding = (module: ModuleId = 'translate') => {
    markOnboardingComplete()
    if (module) setActiveModule(module)
    setShowOnboarding(false)
  }

  const reopenOnboarding = () => {
    setShowOnboarding(true)
  }

  const currentOnboarding = onboardingSteps[0]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveModule('translate')}>
          <span className="brand-mark" aria-hidden="true">文</span>
          <span>
            <strong>诊途</strong>
            <small>让沟通少走弯路</small>
          </span>
        </button>
        <nav aria-label="主要功能">
          <button
            className={activeModule === 'translate' ? 'nav-item active' : 'nav-item'}
            type="button"
            onClick={() => setActiveModule('translate')}
          >
            方言翻译
          </button>
          <button
            className={`nav-item hospital-map-nav${activeModule === 'map' ? ' active' : ''}`}
            type="button"
            disabled={voiceActive}
            title={voiceActive ? '请先结束录音，再查看医院地图' : undefined}
            onClick={() => setActiveModule('map')}
          >
            医院地图
          </button>
        </nav>
        <div className="header-tools">
          <span className="competition-pill">HOSA 参赛作品</span>
          <button className="guide-trigger" type="button" onClick={reopenOnboarding}>
            使用引导
          </button>
        </div>
      </header>

      <main>
        {activeModule === 'translate' && (
          <section className="module translate-module">
            <div className="intro">
              <span className="eyebrow">普通话 · 粤语等方言</span>
              <h1>
                想说的话，
                <br />
                换一种听得懂的说法
              </h1>
              <p>在普通话和方言之间双向转换，获取文字、读法和适合就诊沟通的提示。</p>
            </div>

            <div className="translation-layout">
              <form className="translator-card" onSubmit={submitTranslation}>
                <div className="route-heading">
                  <span>翻译方向</span>
                  <small>支持双向沟通</small>
                </div>
                <div className="language-route" aria-label="翻译方向">
                  <span>{sourceLanguageLabel}</span>
                  <button
                    className="swap-action"
                    type="button"
                    aria-label="交换翻译方向"
                    title="交换翻译方向"
                    disabled={voiceActive}
                    onClick={toggleDirection}
                  >
                    ⇄
                  </button>
                  <strong>{targetLanguageLabel}</strong>
                </div>
                <div className="input-heading">
                  <label htmlFor="source-text">{inputLabel}</label>
                  <span className="voice-source">语音来源：{sourceLanguageLabel}</span>
                </div>
                <textarea
                  id="source-text"
                  aria-label={inputLabel}
                  aria-describedby="voice-status"
                  maxLength={240}
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={
                    direction === 'toDialect'
                      ? '例如：我听不清医生说什么，请慢一点说……'
                      : `例如：${phrases[dialect][1]?.text ?? '我听唔清医生讲乜。'}`
                  }
                  rows={6}
                />
                <div className={`voice-toolbar ${voiceStatus}`}>
                  <button
                    className={`voice-action ${voiceStatus}`}
                    type="button"
                    aria-label={
                      voiceStatus === 'listening'
                        ? '结束录音'
                        : voiceStatus === 'stopping'
                          ? '立即结束录音'
                          : voiceActive
                            ? '取消录音'
                            : '开始录音'
                    }
                    aria-pressed={voiceActive}
                    onClick={toggleVoiceInput}
                  >
                    <span className="voice-icon" aria-hidden="true" />
                    {voiceStatus === 'listening'
                      ? '结束录音'
                      : voiceStatus === 'stopping'
                        ? '立即结束'
                        : voiceActive
                          ? '取消录音'
                          : '开始录音'}
                  </button>
                  <span
                    className={`voice-status ${voiceStatus}`}
                    id="voice-status"
                    role="status"
                    aria-live="polite"
                  >
                    <i aria-hidden="true" />
                    {voiceMessage}
                  </span>
                </div>
                <div className="input-meta">
                  <span>建议输入完整的一句话</span>
                  <span>{sourceText.length} / 240</span>
                </div>
                <div className="examples" aria-label="常用表达示例">
                  <span>常用表达 · 医院场景</span>
                  {examplePhrases.map((example) => (
                    <button type="button" key={example} onClick={() => handleExample(example)}>
                      {example}
                    </button>
                  ))}
                </div>
                <div className="translator-actions">
                  <button
                    className="clear-action"
                    type="button"
                    onClick={clearSource}
                    disabled={!sourceText}
                  >
                    清空内容
                  </button>
                </div>
                <div className="dialect-field">
                  <label htmlFor="dialect">
                    {direction === 'toDialect' ? '翻译成' : '方言来自'}
                  </label>
                  <select
                    id="dialect"
                    value={dialect}
                    disabled={voiceActive}
                    onChange={(event) => chooseDialect(event.target.value as DialectId)}
                  >
                    {dialectOptions.map((option) => (
                      <option value={option.id} key={option.id}>
                        {option.label}（{option.region}）
                      </option>
                    ))}
                  </select>
                  <small>{selectedDialect.description}</small>
                </div>
                {formError && <p className="form-error">{formError}</p>}
                <button className="primary-action" type="submit">
                  翻译这句话
                  <span aria-hidden="true">→</span>
                </button>
                <p className="medical-note">翻译用于辅助沟通，不替代专业口译或医疗判断。</p>
              </form>

              <aside className="translation-result" aria-live="polite">
                <div className="result-content" key={translation?.text ?? 'empty'}>
                  {translation ? (
                    <>
                      <div className="result-topline">
                        <div className="result-label-group">
                          <span className="result-label">{targetLanguageLabel}译文</span>
                          <span className={`translation-confidence ${translation.confidence}`}>
                            {confidenceLabels[translation.confidence]}
                          </span>
                        </div>
                        <button className="copy-action" type="button" onClick={copyTranslation}>
                          {copied ? '已复制' : '复制译文'}
                        </button>
                      </div>
                      <p className="translated-text">{translation.text}</p>
                      <div className="pronunciation-block">
                        <span>读法参考</span>
                        <strong>{translation.pronunciation}</strong>
                      </div>
                      <div className="translation-note">
                        <strong>沟通提示</strong>
                        <p>{translation.note}</p>
                      </div>
                    </>
                  ) : (
                    <div className="result-empty">
                      <span className="result-icon" aria-hidden="true">Aa</span>
                      <h2>译文会显示在这里</h2>
                      <p>先输入一句普通话，再选择对方熟悉的方言。</p>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <div className="translation-principles" aria-label="翻译使用提示">
              <article>
                <span>01</span>
                <div>
                  <strong>先说最关键的信息</strong>
                  <p>不舒服的位置、持续时间和过敏史，优先翻译并指给医护人员看。</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <strong>文字和读法一起给</strong>
                  <p>可以把译文交给对方阅读，也可以按读法慢慢说，减少听错。</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <strong>重要内容请再次确认</strong>
                  <p>用药、剂量和检查安排等关键信息，要让医护人员复述确认。</p>
                </div>
              </article>
            </div>
          </section>
        )}

        {activeModule === 'map' && <HospitalMap />}
      </main>

      <footer>
        <span>诊途 · HOSA 参赛作品</span>
        <span>翻译仅供沟通参考，重要信息请与医护人员确认</span>
      </footer>

      {showOnboarding && (
        <div className="onboarding-backdrop">
          <section
            className="onboarding-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <button className="onboarding-skip" type="button" onClick={() => finishOnboarding()}>
              跳过引导
            </button>
            <div className="onboarding-visual" aria-hidden="true">
              <span>{currentOnboarding.icon}</span>
              <i className="visual-orbit orbit-1" />
              <strong>诊途</strong>
            </div>
            <div className="onboarding-copy">
              <span className="eyebrow">{currentOnboarding.eyebrow}</span>
              <h2 id="onboarding-title">{currentOnboarding.title}</h2>
              <p>{currentOnboarding.description}</p>
              <div className="onboarding-dots" aria-label="引导进度">
                {onboardingSteps.map((step) => (
                  <span className="active" key={step.title} />
                ))}
              </div>
              <div className="onboarding-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => finishOnboarding(currentOnboarding.module)}
                >
                  {currentOnboarding.action}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
