// =========================================================================
// LUMA Live APP 内部预设
// 只在 APP 内部使用，不注入到宿主全局预设
// 与 presets.json（全局预设）完全分离，互不干扰
// 分类：直播间设置、热搜设置、超话设置、评论设置、其他设置
// =========================================================================

window.appPresets = window.appPresets || {
  'live': {
    name: '直播间设置',
    desc: '推流打包、互动回复、赛道企划',
    entries: [
      {
        id: 'package',
        title: '直播推流打包',
        content: '你正在以【{{char}}】的身份进行直播推流与弹幕大包批处理生成。\n补充上下文：{{instruction}}\n\n# 生成任务与参数规则：\n1. 生成主播的 3 句随性发言与过渡台词（包含微动作）。\n2. 生成 15~20 条真实的观众弹幕（包含乐子人、黑粉、真爱粉、考据党、复读机）。\n3. 如果当前决定结束直播，请在最后一句台词末尾附带动作标记 [动作:关闭直播]；若继续直播则严禁出现该标记。\n4. 可根据情况让公屏或台词主动提及用户【{{user}}】。\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"hostSpeeches":[{"speech":"台词内容1","action":"喝了口水"},{"speech":"台词内容2","action":"看了眼公屏"},{"speech":"台词内容3","action":"调整麦克风"}],"danmakus":[{"sender":"网友A","text":"弹幕内容","type":"fan"},{"sender":"网友B","text":"弹幕内容","type":"meme"},{"sender":"网友C","text":"弹幕内容","type":"troll"}]}'
      },
      {
        id: 'reply',
        title: '主播互动回复',
        content: '你正在以【{{char}}】的身份进行直播，用户【{{user}}】刚刚有以下互动：{{instruction}}\n\n# 规则准则：\n1. 以主播身份立刻给出针对该用户的专属即时反馈（口语化短句，30~60字以内）。\n2. 若你认为该下播了，请在回复最后加上动作标记 [动作:关闭直播]；否则严禁附带该标记。\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"speech":"主播回复台词","emotion":"happy | shy | angry | surprised | neutral","action":"微动作描述"}'
      },
      {
        id: 'plan',
        title: '赛道与标题企划',
        content: '请以【{{char}}】的身份决定本次直播的赛道与标题。\n补充上下文：{{instruction}}\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"category":"主赛道","subTag":"二级词条","topic":"直播间标题"}'
      }
    ]
  },
  'trends': {
    name: '热搜设置',
    desc: '热搜切片、社区动态',
    entries: [
      {
        id: 'highlight',
        title: '热搜话题切片',
        content: '根据主播【{{char}}】的直播情况生成 1 条热搜话题与切片总结。\n补充上下文：{{instruction}}\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"tag":"#话题#","heat":"88w","category":"娱乐","summary":"50字以内总结","comments":[{"user":"路人昵称","text":"评论内容"}]}'
      },
      {
        id: 'post',
        title: '社区动态发布',
        content: '你是 LUMA Live 平台的内容生成系统。根据以下直播情况生成一条社区动态帖子。\n补充上下文：{{instruction}}\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"tag":"#话题标签#","mention":"@相关主播","content":"帖子正文，80-150字，搞笑八卦风格","linkText":"网页链接","clipText":"直播间切片"}'
      }
    ]
  },
  'supertopic': {
    name: '超话设置',
    desc: '超话动态生成',
    entries: [
      {
        id: 'supertopic_post',
        title: '超话动态',
        content: '根据主播【{{char}}】的直播情况生成一条超话动态。\n补充上下文：{{instruction}}\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"title":"动态标题","content":"动态正文","tags":["#标签#"]}'
      }
    ]
  },
  'comment': {
    name: '评论设置',
    desc: '评论区路人跟评',
    entries: [
      {
        id: 'netizen',
        title: '路人评论',
        content: '用户评论了热搜：{{instruction}}\n请以随机路人身份跟评一句话（带梗或吐槽）。\n\n# 输出格式（严格合法 JSON，不要输出任何多余文字）：\n{"user":"昵称","text":"内容"}'
      }
    ]
  },
  'other': {
    name: '其他设置',
    desc: '杂项预设',
    entries: []
  }
};
