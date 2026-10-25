export type DialectId = 'cantonese' | 'minnan' | 'shanghai' | 'sichuan' | 'northeast'

export type Phrase = {
  source: string
  text: string
  pronunciation: string
  note: string
  aliases?: readonly string[]
}

type HospitalCategory =
  | 'registration'
  | 'directions'
  | 'symptoms'
  | 'history'
  | 'examination'
  | 'medication'
  | 'inpatient'
  | 'communication'

export type HospitalEntry = {
  source: string
  category: HospitalCategory
  variants: Record<DialectId, string>
  aliases?: readonly string[]
  pronunciation?: Partial<Record<DialectId, string>>
  note?: string
}

const categoryNotes: Record<HospitalCategory, string> = {
  registration: '预约、叫号和证件要求请向医院服务台确认。',
  directions: '科室名称保留正式名称；位置请以医院现场标识为准。',
  symptoms: '请补充症状位置、开始时间与严重程度，让医护人员核对。',
  history: '请同时出示病历或用药记录，保留病史、过敏史和怀孕信息的原意。',
  examination: '这是向医护人员提出的问题，检查准备和报告解释以其答复为准。',
  medication: '这是用药询问，不提供服药建议；药名、剂量、单位和次数请让医护人员写清。',
  inpatient: '住院、陪同和出院安排请向病区医护人员确认。',
  communication: '请对方重复或写下关键信息，确认双方理解一致。',
}

const readingNotes: Record<DialectId, string> = {
  cantonese: '粤语文字表达参考；这条短句的完整读音尚待核对。',
  minnan: '采用台湾台语常见用字作参考；各地闽南语读音不同，完整读音尚待核对。',
  shanghai: '上海话各地读音不同，文字仅作表达参考。',
  sichuan: '采用成都片区口语作参考；四川各地读音不同。',
  northeast: '东北各地口音不同，文字仅作表达参考。',
}

// New entries are written communication references, pending native-speaker review.
// Preserve clinical terms and question/statement polarity instead of adding dialect markers mechanically.
const baseHospitalLexicon: readonly HospitalEntry[] = [
  {
    source: '我已经预约了', category: 'registration', aliases: ['我预约好了', '我已经预约'],
    variants: {
      cantonese: '我已经预约咗。', minnan: '我已經預約矣。', shanghai: '我已经预约好了。',
      sichuan: '我已经预约好了。', northeast: '我已经预约好了。',
    },
    pronunciation: { cantonese: 'ngo5 ji5 ging1 jyu6 joek3 zo2' },
  },
  {
    source: '我是第一次来这家医院', category: 'registration', aliases: ['我第一次来这家医院'],
    variants: {
      cantonese: '我係第一次嚟呢间医院。', minnan: '我是頭一擺來這間醫院。', shanghai: '我是第一次到这家医院来。',
      sichuan: '我是头一回来这家医院。', northeast: '我是头一回来这家医院。',
    },
  },
  {
    source: '我来复诊', category: 'registration', aliases: ['我是来复诊的'],
    variants: {
      cantonese: '我嚟覆诊。', minnan: '我來複診。', shanghai: '我是来复诊个。',
      sichuan: '我是来复诊的。', northeast: '我是来复诊的。',
    },
    pronunciation: { cantonese: 'ngo5 lai4 fuk1 zan2' },
  },
  {
    source: '需要带哪些证件', category: 'registration', aliases: ['需要带什么证件'],
    variants: {
      cantonese: '要带啲乜证件？', minnan: '愛帶啥物證件？', shanghai: '要带啥证件？',
      sichuan: '要带些啥子证件？', northeast: '得带啥证件？',
    },
  },
  {
    source: '可以现场挂号吗', category: 'registration', aliases: ['能现场挂号吗'],
    variants: {
      cantonese: '可唔可以喺现场挂号？', minnan: '會當佇現場掛號無？', shanghai: '能现场挂号伐？',
      sichuan: '可以在现场挂号不？', northeast: '能在现场挂号不？',
    },
  },
  {
    source: '这里怎么叫号', category: 'registration', aliases: ['这里是怎么叫号的'],
    variants: {
      cantonese: '呢度点样叫号？', minnan: '遮按怎叫號？', shanghai: '搿搭哪能叫号？',
      sichuan: '这里咋个叫号？', northeast: '这儿咋叫号？',
    },
    pronunciation: { cantonese: 'ni1 dou6 dim2 joeng6 giu3 hou6' },
  },
  {
    source: '请问儿科在哪里', category: 'directions', aliases: ['儿科在哪里'],
    variants: {
      cantonese: '唔该，儿科喺边度？', minnan: '請問兒科佇佗位？', shanghai: '请问儿科勒啥地方？',
      sichuan: '请问儿科在哪点？', northeast: '请问儿科搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, ji4 fo1 hai2 bin1 dou6' },
  },
  {
    source: '请问妇产科在哪里', category: 'directions', aliases: ['妇产科在哪里'],
    variants: {
      cantonese: '唔该，妇产科喺边度？', minnan: '請問婦產科佇佗位？', shanghai: '请问妇产科勒啥地方？',
      sichuan: '请问妇产科在哪点？', northeast: '请问妇产科搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, fu5 caan2 fo1 hai2 bin1 dou6' },
  },
  {
    source: '请问骨科在哪里', category: 'directions', aliases: ['骨科在哪里'],
    variants: {
      cantonese: '唔该，骨科喺边度？', minnan: '請問骨科佇佗位？', shanghai: '请问骨科勒啥地方？',
      sichuan: '请问骨科在哪点？', northeast: '请问骨科搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, gwat1 fo1 hai2 bin1 dou6' },
  },
  {
    source: '请问药房在哪里', category: 'directions', aliases: ['药房在哪里'],
    variants: {
      cantonese: '唔该，药房喺边度？', minnan: '請問藥房佇佗位？', shanghai: '请问药房勒啥地方？',
      sichuan: '请问药房在哪点？', northeast: '请问药房搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, joek6 fong4 hai2 bin1 dou6' },
  },
  {
    source: '请问采血区在哪里', category: 'directions', aliases: ['采血区在哪里', '抽血的地方在哪里'],
    variants: {
      cantonese: '唔该，采血区喺边度？', minnan: '請問採血區佇佗位？', shanghai: '请问采血区勒啥地方？',
      sichuan: '请问采血区在哪点？', northeast: '请问采血区搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, coi2 hyut3 keoi1 hai2 bin1 dou6' },
  },
  {
    source: '请问电梯在哪里', category: 'directions', aliases: ['电梯在哪里'],
    variants: {
      cantonese: '唔该，电梯喺边度？', minnan: '請問電梯佇佗位？', shanghai: '请问电梯勒啥地方？',
      sichuan: '请问电梯在哪点？', northeast: '请问电梯搁哪儿？',
    },
    pronunciation: { cantonese: 'm4 goi1, din6 tai1 hai2 bin1 dou6' },
  },
  {
    source: '我头痛', category: 'symptoms', aliases: ['我头疼'],
    variants: {
      cantonese: '我头痛。', minnan: '我頭疼。', shanghai: '我头痛。',
      sichuan: '我脑壳痛。', northeast: '我脑袋疼。',
    },
    pronunciation: { cantonese: 'ngo5 tau4 tung3', minnan: 'guá thâu thiànn' },
  },
  {
    source: '我头晕', category: 'symptoms', aliases: ['我觉得头晕', '我感觉头晕'],
    variants: {
      cantonese: '我头晕。', minnan: '我頭眩。', shanghai: '我头晕。',
      sichuan: '我脑壳昏。', northeast: '我脑袋晕。',
    },
    pronunciation: { cantonese: 'ngo5 tau4 wan4' },
  },
  {
    source: '我想吐', category: 'symptoms', aliases: ['我觉得想吐', '我想呕吐'],
    variants: {
      cantonese: '我想呕。', minnan: '我想欲吐。', shanghai: '我想吐。',
      sichuan: '我想吐。', northeast: '我想吐。',
    },
    pronunciation: { cantonese: 'ngo5 soeng2 au2' },
  },
  {
    source: '我已经吐了', category: 'symptoms', aliases: ['我已经呕吐了'],
    variants: {
      cantonese: '我已经呕咗。', minnan: '我已經吐矣。', shanghai: '我已经吐过了。',
      sichuan: '我已经吐了。', northeast: '我已经吐了。',
    },
    pronunciation: { cantonese: 'ngo5 ji5 ging1 au2 zo2' },
  },
  {
    source: '我咳嗽', category: 'symptoms', aliases: ['我在咳嗽'],
    variants: {
      cantonese: '我咳。', minnan: '我咧嗽。', shanghai: '我咳嗽。',
      sichuan: '我在咳嗽。', northeast: '我咳嗽。',
    },
    pronunciation: { cantonese: 'ngo5 kat1' },
  },
  {
    source: '我拉肚子', category: 'symptoms', aliases: ['我腹泻'],
    variants: {
      cantonese: '我肚屙。', minnan: '我落屎。', shanghai: '我拉肚皮。',
      sichuan: '我在拉肚子。', northeast: '我拉肚子。',
    },
    pronunciation: { cantonese: 'ngo5 tou5 o1' },
  },
  {
    source: '我呼吸困难', category: 'symptoms',
    variants: {
      cantonese: '我呼吸困难。', minnan: '我呼吸困難。', shanghai: '我呼吸困难。',
      sichuan: '我呼吸困难。', northeast: '我呼吸困难。',
    },
    pronunciation: { cantonese: 'ngo5 fu1 kap1 kwan3 naan4' },
    note: '请直接把症状告诉现场医护人员；此短句保留“呼吸困难”原义。',
  },
  {
    source: '我胸口很痛', category: 'symptoms', aliases: ['我胸口很疼'],
    variants: {
      cantonese: '我个胸口好痛。', minnan: '我胸口真疼。', shanghai: '我胸口老痛个。',
      sichuan: '我胸口痛得很。', northeast: '我胸口疼得厉害。',
    },
    pronunciation: { cantonese: 'ngo5 go3 hung1 hau2 hou2 tung3' },
  },
  {
    source: '疼痛越来越严重', category: 'symptoms', aliases: ['疼痛越来越厉害'],
    variants: {
      cantonese: '越嚟越痛。', minnan: '愈來愈疼。', shanghai: '越来越痛了。',
      sichuan: '越来越痛了。', northeast: '越来越疼了。',
    },
    pronunciation: { cantonese: 'jyut6 lai4 jyut6 tung3' },
  },
  {
    source: '从昨天开始不舒服', category: 'symptoms', aliases: ['我从昨天开始不舒服'],
    variants: {
      cantonese: '由琴日开始唔舒服。', minnan: '對昨昏開始毋舒適。', shanghai: '从昨日开始勿适意。',
      sichuan: '从昨天起就不舒服。', northeast: '从昨儿开始不舒坦。',
    },
  },
  {
    source: '我有高血压', category: 'history', aliases: ['我患有高血压'],
    variants: {
      cantonese: '我有高血压。', minnan: '我有高血壓。', shanghai: '我有高血压。',
      sichuan: '我有高血压。', northeast: '我有高血压。',
    },
    pronunciation: { cantonese: 'ngo5 jau5 gou1 hyut3 aat3' },
  },
  {
    source: '我有糖尿病', category: 'history', aliases: ['我患有糖尿病'],
    variants: {
      cantonese: '我有糖尿病。', minnan: '我有糖尿病。', shanghai: '我有糖尿病。',
      sichuan: '我有糖尿病。', northeast: '我有糖尿病。',
    },
    pronunciation: { cantonese: 'ngo5 jau5 tong4 niu6 beng6' },
  },
  {
    source: '我正在吃降压药', category: 'history', aliases: ['我在吃降压药'],
    variants: {
      cantonese: '我食紧降压药。', minnan: '我咧食降壓藥。', shanghai: '我勒吃降压药。',
      sichuan: '我在吃降压药。', northeast: '我正吃降压药呢。',
    },
  },
  {
    source: '我以前做过手术', category: 'history', aliases: ['我过去做过手术'],
    variants: {
      cantonese: '我以前做过手术。', minnan: '我以前做過手術。', shanghai: '我以前做过手术。',
      sichuan: '我以前做过手术。', northeast: '我以前做过手术。',
    },
  },
  {
    source: '我可能怀孕了', category: 'history', aliases: ['我可能怀孕'],
    variants: {
      cantonese: '我可能怀孕喇。', minnan: '我可能有身矣。', shanghai: '我可能怀孕了。',
      sichuan: '我可能怀孕了。', northeast: '我可能怀孕了。',
    },
    note: '保留“可能”，不要把尚未确认的怀孕信息翻译为确定事实。',
  },
  {
    source: '我没有药物过敏史', category: 'history', aliases: ['我没有药物过敏的历史'],
    variants: {
      cantonese: '我冇药物过敏史。', minnan: '我無藥物過敏史。', shanghai: '我呒没药物过敏史。',
      sichuan: '我没有药物过敏史。', northeast: '我没有药物过敏史。',
    },
    note: '此句表示“没有”药物过敏史；如果不确定，请保留不确定的原话。',
  },
  {
    source: '我对这个药过敏', category: 'history', aliases: ['我对这种药过敏'],
    variants: {
      cantonese: '我对呢只药过敏。', minnan: '我對這款藥過敏。', shanghai: '我对搿种药过敏。',
      sichuan: '我对这个药过敏。', northeast: '我对这药过敏。',
    },
    note: '请同时出示药盒或药名，让医护人员确认具体药物。',
  },
  {
    source: '检查前能喝水吗', category: 'examination', aliases: ['检查前可以喝水吗'],
    variants: {
      cantonese: '检查前可唔可以饮水？', minnan: '檢查進前會當啉水無？', shanghai: '检查前能喝水伐？',
      sichuan: '检查前可以喝水不？', northeast: '检查前能喝水不？',
    },
  },
  {
    source: '需要做哪些检查', category: 'examination', aliases: ['需要做什么检查'],
    variants: {
      cantonese: '要做啲乜检查？', minnan: '愛做啥物檢查？', shanghai: '要做啥检查？',
      sichuan: '要做哪些检查？', northeast: '得做哪些检查？',
    },
  },
  {
    source: '在哪里预约检查', category: 'examination', aliases: ['检查预约在哪里办'],
    variants: {
      cantonese: '喺边度预约检查？', minnan: '佇佗位預約檢查？', shanghai: '勒啥地方预约检查？',
      sichuan: '在哪点预约检查？', northeast: '搁哪儿预约检查？',
    },
  },
  {
    source: '检查结果在哪里取', category: 'examination', aliases: ['在哪里取检查结果'],
    variants: {
      cantonese: '喺边度攞检查结果？', minnan: '檢查結果佇佗位領？', shanghai: '检查结果勒啥地方拿？',
      sichuan: '检查结果在哪点拿？', northeast: '检查结果搁哪儿拿？',
    },
  },
  {
    source: '这份报告是什么意思', category: 'examination', aliases: ['这份报告的意思是什么'],
    variants: {
      cantonese: '呢份报告係乜意思？', minnan: '這份報告是啥物意思？', shanghai: '搿份报告是啥意思？',
      sichuan: '这份报告是啥子意思？', northeast: '这份报告是啥意思？',
    },
  },
  {
    source: '可以再解释一下吗', category: 'examination', aliases: ['能再解释一下吗'],
    variants: {
      cantonese: '可唔可以再解释一次？', minnan: '會當閣解釋一擺無？', shanghai: '能再解释一遍伐？',
      sichuan: '可以再解释一遍不？', northeast: '能再解释一遍不？',
    },
  },
  {
    source: '这个药每次吃多少', category: 'medication', aliases: ['这个药一次吃多少'],
    variants: {
      cantonese: '呢只药每次食几多？', minnan: '這款藥每擺食偌濟？', shanghai: '搿种药每趟吃多少？',
      sichuan: '这个药每次吃好多？', northeast: '这药每回吃多少？',
    },
  },
  {
    source: '这个药一天吃几次', category: 'medication', aliases: ['这个药每天吃几次', '这个药一天服用几次'],
    variants: {
      cantonese: '呢只药一日食几次？', minnan: '這款藥一工食幾擺？', shanghai: '搿种药一天吃几趟？',
      sichuan: '这个药一天吃几回？', northeast: '这药一天吃几回？',
    },
  },
  {
    source: '这个药饭前吃还是饭后吃', category: 'medication', aliases: ['这个药是饭前吃还是饭后吃'],
    variants: {
      cantonese: '呢只药饭前食定饭后食？', minnan: '這款藥飯前食抑是飯後食？', shanghai: '搿种药饭前吃还是饭后吃？',
      sichuan: '这个药饭前吃还是饭后吃？', northeast: '这药饭前吃还是饭后吃？',
    },
  },
  {
    source: '这个药需要吃多少天', category: 'medication', aliases: ['这个药要吃几天'],
    variants: {
      cantonese: '呢只药要食几多日？', minnan: '這款藥愛食幾工？', shanghai: '搿种药要吃几天？',
      sichuan: '这个药要吃好多天？', northeast: '这药得吃几天？',
    },
  },
  {
    source: '这个药有什么副作用', category: 'medication', aliases: ['这个药有哪些副作用'],
    variants: {
      cantonese: '呢只药有乜副作用？', minnan: '這款藥有啥物副作用？', shanghai: '搿种药有啥副作用？',
      sichuan: '这个药有啥子副作用？', northeast: '这药有啥副作用？',
    },
  },
  {
    source: '这些药可以一起吃吗', category: 'medication', aliases: ['这些药能一起吃吗'],
    variants: {
      cantonese: '呢啲药可唔可以一齐食？', minnan: '這寡藥會當做伙食無？', shanghai: '搿几种药能一道吃伐？',
      sichuan: '这些药可以一起吃不？', northeast: '这些药能一块儿吃不？',
    },
  },
  {
    source: '忘记吃药了怎么办', category: 'medication', aliases: ['忘了吃药怎么办'],
    variants: {
      cantonese: '唔记得食药，点算？', minnan: '袂記得食藥，按怎辦？', shanghai: '忘记吃药了哪能办？',
      sichuan: '忘了吃药咋个办？', northeast: '忘了吃药咋办？',
    },
  },
  {
    source: '请把药名写下来', category: 'medication', aliases: ['请写下药名'],
    variants: {
      cantonese: '唔该写低药名。', minnan: '請共藥名寫落來。', shanghai: '请侬把药名写下来。',
      sichuan: '麻烦把药名写下来。', northeast: '麻烦把药名写下来。',
    },
    pronunciation: { cantonese: 'm4 goi1 se2 dai1 joek6 meng2' },
  },
  {
    source: '住院手续在哪里办', category: 'inpatient', aliases: ['在哪里办理住院手续'],
    variants: {
      cantonese: '喺边度办住院手续？', minnan: '住院手續佇佗位辦？', shanghai: '住院手续勒啥地方办？',
      sichuan: '住院手续在哪点办？', northeast: '住院手续搁哪儿办？',
    },
  },
  {
    source: '家属可以陪同吗', category: 'inpatient', aliases: ['家属能陪同吗'],
    variants: {
      cantonese: '屋企人可唔可以陪住？', minnan: '家屬會當陪同無？', shanghai: '家属能陪同伐？',
      sichuan: '家属可以陪到不？', northeast: '家属能陪着不？',
    },
  },
  {
    source: '出院后需要注意什么', category: 'inpatient', aliases: ['出院以后要注意什么'],
    variants: {
      cantonese: '出院之后要注意啲乜？', minnan: '出院了後愛注意啥物？', shanghai: '出院以后要注意啥？',
      sichuan: '出院后要注意啥子？', northeast: '出院以后得注意啥？',
    },
  },
  {
    source: '什么时候拆线', category: 'inpatient', aliases: ['何时拆线'],
    variants: {
      cantonese: '几时拆线？', minnan: '啥物時陣拆線？', shanghai: '啥辰光拆线？',
      sichuan: '啥时候拆线？', northeast: '啥时候拆线？',
    },
    pronunciation: { cantonese: 'gei2 si4 caak3 sin3' },
  },
  {
    source: '请帮我叫护士', category: 'communication', aliases: ['请帮我找护士'],
    variants: {
      cantonese: '唔该帮我叫护士。', minnan: '請幫我叫護理師。', shanghai: '请侬帮我叫护士。',
      sichuan: '麻烦帮我叫下护士。', northeast: '麻烦帮我叫一下护士。',
    },
    pronunciation: { cantonese: 'm4 goi1 bong1 ngo5 giu3 wu6 si6' },
  },
  {
    source: '可以大声一点说吗', category: 'communication', aliases: ['能大声一点说吗'],
    variants: {
      cantonese: '可唔可以讲大声啲？', minnan: '會當講較大聲無？', shanghai: '能讲响一点伐？',
      sichuan: '可以说大声点不？', northeast: '能说大声点儿不？',
    },
    pronunciation: { cantonese: 'ho2 m4 ho2 ji5 gong2 daai6 seng1 di1' },
  },
  {
    source: '请把复诊时间写下来', category: 'communication', aliases: ['请写下复诊时间'],
    variants: {
      cantonese: '唔该写低覆诊时间。', minnan: '請共複診時間寫落來。', shanghai: '请侬把复诊时间写下来。',
      sichuan: '麻烦把复诊时间写下来。', northeast: '麻烦把复诊时间写下来。',
    },
    pronunciation: { cantonese: 'm4 goi1 se2 dai1 fuk1 zan2 si4 gaan3' },
  },
  {
    source: '我肚子痛', category: 'symptoms', aliases: ['我肚子疼', '我腹痛'],
    variants: {
      cantonese: '我肚痛。', minnan: '我腹肚疼。', shanghai: '我肚皮痛。',
      sichuan: '我肚皮痛。', northeast: '我肚子疼。',
    },
  },
  {
    source: '我没有发烧', category: 'symptoms', aliases: ['我没发烧', '没有发烧', '我没有发热'],
    variants: {
      cantonese: '我冇发烧。', minnan: '我無發燒。', shanghai: '我呒没发烧。',
      sichuan: '我没有发烧。', northeast: '我没发烧。',
    },
  },
  {
    source: '我没有咳嗽', category: 'symptoms', aliases: ['我没咳嗽', '没有咳嗽'],
    variants: {
      cantonese: '我冇咳。', minnan: '我無嗽。', shanghai: '我呒没咳嗽。',
      sichuan: '我没有咳嗽。', northeast: '我没咳嗽。',
    },
  },
  {
    source: '我没有呕吐', category: 'symptoms', aliases: ['我没吐', '没有呕吐'],
    variants: {
      cantonese: '我冇呕。', minnan: '我無吐。', shanghai: '我呒没呕吐。',
      sichuan: '我没有吐。', northeast: '我没吐。',
    },
  },
  {
    source: '我喉咙痛', category: 'symptoms', aliases: ['我嗓子疼', '我喉咙疼'],
    variants: {
      cantonese: '我喉咙痛。', minnan: '我喉嚨疼。', shanghai: '我喉咙痛。',
      sichuan: '我喉咙痛。', northeast: '我嗓子疼。',
    },
  },
  {
    source: '我皮肤痒', category: 'symptoms', aliases: ['我皮肤发痒'],
    variants: {
      cantonese: '我皮肤痕。', minnan: '我皮膚癢。', shanghai: '我皮肤痒。',
      sichuan: '我皮肤痒。', northeast: '我皮肤痒。',
    },
  },
  {
    source: '我左边肚子痛', category: 'symptoms', aliases: ['我左边肚子疼'],
    variants: {
      cantonese: '我左边肚痛。', minnan: '我左邊腹肚疼。', shanghai: '我左边肚皮痛。',
      sichuan: '我左边肚皮痛。', northeast: '我左边肚子疼。',
    },
  },
  {
    source: '我右边肚子痛', category: 'symptoms', aliases: ['我右边肚子疼'],
    variants: {
      cantonese: '我右边肚痛。', minnan: '我右邊腹肚疼。', shanghai: '我右边肚皮痛。',
      sichuan: '我右边肚皮痛。', northeast: '我右边肚子疼。',
    },
  },
  {
    source: '疼痛是持续的', category: 'symptoms', aliases: ['一直在痛'],
    variants: {
      cantonese: '一直都痛。', minnan: '一直咧疼。', shanghai: '一直勒痛。',
      sichuan: '一直都在痛。', northeast: '一直都疼。',
    },
  },
  {
    source: '疼痛是一阵一阵的', category: 'symptoms', aliases: ['一阵一阵地痛'],
    variants: {
      cantonese: '一阵阵咁痛。', minnan: '一陣一陣咧疼。', shanghai: '一阵一阵痛。',
      sichuan: '一阵一阵地痛。', northeast: '一阵一阵地疼。',
    },
  },
  {
    source: '疼痛没有减轻', category: 'symptoms', aliases: ['疼痛没有缓解'],
    variants: {
      cantonese: '痛楚冇减轻。', minnan: '疼痛無減輕。', shanghai: '疼痛呒没减轻。',
      sichuan: '疼痛没有减轻。', northeast: '疼痛没减轻。',
    },
  },
  {
    source: '我还没有吃药', category: 'medication', aliases: ['我还没吃药'],
    variants: {
      cantonese: '我仲未食药。', minnan: '我猶未食藥。', shanghai: '我还呒没吃药。',
      sichuan: '我还没有吃药。', northeast: '我还没吃药。',
    },
  },
  {
    source: '我吃药后起了皮疹', category: 'history', aliases: ['我吃药后出了皮疹'],
    variants: {
      cantonese: '我食药之后出咗皮疹。', minnan: '我食藥了後起皮疹。', shanghai: '我吃药以后出了皮疹。',
      sichuan: '我吃药后出了皮疹。', northeast: '我吃药以后起了皮疹。',
    },
    note: '此句描述服药后出现的情况，不自动判断为药物过敏；请同时出示药名与记录。',
  },
  {
    source: '我吃药后症状加重了', category: 'history',
    variants: {
      cantonese: '我食药之后症状加重咗。', minnan: '我食藥了後症狀加重矣。', shanghai: '我吃药以后症状加重了。',
      sichuan: '我吃药后症状加重了。', northeast: '我吃药以后症状加重了。',
    },
  },
  {
    source: '我不确定对这个药是否过敏', category: 'history', aliases: ['我不知道对这个药是否过敏'],
    variants: {
      cantonese: '我唔肯定对呢只药係咪过敏。', minnan: '我毋確定對這款藥敢有過敏。', shanghai: '我不确定对搿种药是不是过敏。',
      sichuan: '我不晓得对这个药是不是过敏。', northeast: '我不确定对这药是不是过敏。',
    },
    note: '保留“不确定”，不能改成“没有过敏”或“有过敏”。',
  },
  {
    source: '我没有怀孕', category: 'history', aliases: ['我没怀孕'],
    variants: {
      cantonese: '我冇怀孕。', minnan: '我無懷孕。', shanghai: '我呒没怀孕。',
      sichuan: '我没有怀孕。', northeast: '我没怀孕。',
    },
  },
  {
    source: '我正在哺乳', category: 'history', aliases: ['我目前正在哺乳'],
    variants: {
      cantonese: '我喺度喂母乳。', minnan: '我咧哺乳。', shanghai: '我勒哺乳。',
      sichuan: '我正在喂母乳。', northeast: '我正在喂母乳。',
    },
  },
  {
    source: '我今天还没有吃东西', category: 'examination', aliases: ['我今天还没吃东西'],
    variants: {
      cantonese: '我今日仲未食嘢。', minnan: '我今仔日猶未食物件。', shanghai: '我今朝还呒没吃东西。',
      sichuan: '我今天还没有吃东西。', northeast: '我今天还没吃东西。',
    },
  },
  {
    source: '我刚吃过东西', category: 'examination', aliases: ['我刚刚吃过东西'],
    variants: {
      cantonese: '我啱啱食过嘢。', minnan: '我拄仔食過物件。', shanghai: '我刚刚吃过东西。',
      sichuan: '我刚吃过东西。', northeast: '我刚吃过东西。',
    },
  },
  {
    source: '我需要停药吗', category: 'medication', aliases: ['我要停药吗'],
    variants: {
      cantonese: '我要唔要停药？', minnan: '我需要停藥無？', shanghai: '我要停药伐？',
      sichuan: '我要不要停药？', northeast: '我用停药不？',
    },
  },
  {
    source: '这两种药需要间隔多久', category: 'medication', aliases: ['这两种药要间隔多久'],
    variants: {
      cantonese: '呢两种药要隔几耐？', minnan: '這兩款藥愛隔偌久？', shanghai: '搿两种药要隔多少辰光？',
      sichuan: '这两种药要隔好久？', northeast: '这两种药得隔多久？',
    },
  },
  {
    source: '请确认药名和剂量', category: 'medication', aliases: ['请核对药名和剂量'],
    variants: {
      cantonese: '唔该核对药名同剂量。', minnan: '請核對藥名佮劑量。', shanghai: '请核对药名搭剂量。',
      sichuan: '麻烦核对药名和剂量。', northeast: '麻烦核对药名和剂量。',
    },
  },
  {
    source: '请用普通话再说一遍', category: 'communication', aliases: ['请再用普通话说一遍'],
    variants: {
      cantonese: '唔该用普通话再讲一次。', minnan: '請用華語閣講一擺。', shanghai: '请用普通话再讲一遍。',
      sichuan: '麻烦用普通话再说一遍。', northeast: '麻烦用普通话再说一遍。',
    },
  },
  {
    source: '请把检查的时间和地点写下来', category: 'communication', aliases: ['请写下检查的时间和地点'],
    variants: {
      cantonese: '唔该写低检查嘅时间同地点。', minnan: '請共檢查的時間佮地點寫落來。', shanghai: '请把检查个时间搭地点写下来。',
      sichuan: '麻烦把检查的时间和地点写下来。', northeast: '麻烦把检查的时间和地点写下来。',
    },
  },
]

// High-frequency expressions that benefit from an offline result during a hospital visit.
// Formal medical terms stay unchanged where possible; dialect wording is deliberately
// conservative because these entries are shown without a model or a remote service.
const additionalHospitalEntries: readonly HospitalEntry[] = [
  {
    source: '我胸口痛', category: 'symptoms', aliases: ['我胸口疼'],
    variants: {
      cantonese: '我个胸口痛。', minnan: '我胸坎疼。', shanghai: '我胸口痛。',
      sichuan: '我胸口痛。', northeast: '我胸口疼。',
    },
  },
  {
    source: '我恶心想吐', category: 'symptoms',
    variants: {
      cantonese: '我作呕，想呕。', minnan: '我噁心欲吐。', shanghai: '我恶心，要呕。',
      sichuan: '我恶心，想吐。', northeast: '我恶心想吐。',
    },
  },
  {
    source: '我对药物过敏', category: 'history', aliases: ['我有药物过敏'],
    variants: {
      cantonese: '我对药物过敏。', minnan: '我對藥物過敏。', shanghai: '我对药物过敏。',
      sichuan: '我对药物过敏。', northeast: '我对药物过敏。',
    },
  },
  {
    source: '我吃饭后更痛', category: 'symptoms',
    variants: {
      cantonese: '我食饭之后更加痛。', minnan: '我食飯了後閣較疼。', shanghai: '我吃饭以后更加痛。',
      sichuan: '我吃饭后更痛。', northeast: '我吃饭以后更疼。',
    },
  },
  {
    source: '检查前需要空腹吗', category: 'examination', aliases: ['检查前要空腹吗'],
    variants: {
      cantonese: '检查之前使唔使空肚？', minnan: '檢查以前愛空腹無？', shanghai: '检查前要空腹伐？',
      sichuan: '检查前要空肚子不？', northeast: '检查前得空腹不？',
    },
  },
  {
    source: '报告什么时候出来', category: 'examination', aliases: ['检查报告什么时候出来'],
    variants: {
      cantonese: '报告几时出？', minnan: '報告啥物時陣出？', shanghai: '报告啥辰光出来？',
      sichuan: '报告好久出来？', northeast: '报告啥时候出来？',
    },
  },
  {
    source: '我需要家属陪同', category: 'inpatient',
    variants: {
      cantonese: '我需要家属陪住。', minnan: '我需要家屬陪伴。', shanghai: '我需要家属陪着。',
      sichuan: '我需要家属陪着。', northeast: '我得家属陪着。',
    },
  },
  {
    source: '我想改预约时间', category: 'registration', aliases: ['我想更改预约时间'],
    variants: {
      cantonese: '我想改预约时间。', minnan: '我欲改預約時間。', shanghai: '我想改预约辰光。',
      sichuan: '我想改预约时间。', northeast: '我想改预约时间。',
    },
  },
  {
    source: '需要家属陪同吗', category: 'inpatient', aliases: ['需要家属陪着吗'],
    variants: {
      cantonese: '需唔需要家属陪住？', minnan: '需要家屬陪伴無？', shanghai: '需要家属陪着伐？',
      sichuan: '需不需要家属陪着？', northeast: '用家属陪着不？',
    },
    note: '此句询问是否要求家属陪同，不表示已经需要陪同，也不表示家属已经在场。',
  },
  {
    source: '我想改预约', category: 'registration', aliases: ['我想更改预约'],
    variants: {
      cantonese: '我想改预约。', minnan: '我欲改預約。', shanghai: '我想改预约。',
      sichuan: '我想改预约。', northeast: '我想改预约。',
    },
    note: '只表达想更改预约，不推断要更改的是时间、医生还是科室。',
  },
  {
    source: '我吃东西后更痛', category: 'symptoms',
    variants: {
      cantonese: '我食嘢之后更加痛。', minnan: '我食物件了後閣較疼。', shanghai: '我吃东西以后更加痛。',
      sichuan: '我吃东西后更痛。', northeast: '我吃东西以后更疼。',
    },
  },
  {
    source: '请重复一遍', category: 'communication', aliases: ['请再说一遍'],
    variants: {
      cantonese: '唔该再讲一次。', minnan: '請閣講一擺。', shanghai: '请再讲一遍。',
      sichuan: '麻烦再说一遍。', northeast: '麻烦再说一遍。',
    },
  },
  {
    source: '我没有带病历', category: 'history', aliases: ['我没带病历'],
    variants: {
      cantonese: '我冇带病历。', minnan: '我無帶病歷。', shanghai: '我呒没带病历。',
      sichuan: '我没得带病历。', northeast: '我没带病历。',
    },
  },
  {
    source: '我忘记带身份证', category: 'registration', aliases: ['我忘带身份证了'],
    variants: {
      cantonese: '我唔记得带身份证。', minnan: '我袂記得帶身分證。', shanghai: '我忘记带身份证了。',
      sichuan: '我忘了带身份证。', northeast: '我忘带身份证了。',
    },
  },
  {
    source: '需要住院几天', category: 'inpatient', aliases: ['要住院几天'],
    variants: {
      cantonese: '要住院几多日？', minnan: '欲住院幾工？', shanghai: '要住院几日？',
      sichuan: '要住院好久？', northeast: '得住院几天？',
    },
  },
]

export const hospitalLexicon: readonly HospitalEntry[] = [
  ...baseHospitalLexicon,
  ...additionalHospitalEntries,
]

export function hospitalPhrasesFor(dialect: DialectId): Phrase[] {
  return hospitalLexicon.map((entry) => ({
    source: entry.source,
    text: entry.variants[dialect],
    pronunciation: entry.pronunciation?.[dialect] ?? readingNotes[dialect],
    note: `${entry.note ?? categoryNotes[entry.category]} 新增方言表达尚待当地使用者核对。`,
    aliases: entry.aliases,
  }))
}
