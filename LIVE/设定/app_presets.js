// =========================================================================
// LUMA Live APP 内部预设
// 只在 APP 内部使用，不注入到宿主全局预设
// 与 presets.json（全局预设）完全分离，互不干扰
// =========================================================================

window.appPresets = window.appPresets || {
  'plan': {
    name: '直播企划预设',
    desc: '规范直播怎么进行、赛道与标题生成规则',
    entries: [
      { id: 'e1', title: '赛道与标题企划', content: '请以【{{char}}】的身份决定本次直播的赛道与标题。\n输出格式：[赛道]...\n[标题]...\n[开播状态]...' }
    ]
  },
  'host': {
    name: '主播互动预设',
    desc: '规范直播间主播口吻、台词动作与回复格式',
    entries: [
      { id: 'e1', title: '主播实时控场与台词', content: '以【{{char}}】的身份直播，口语化短句回应公屏。\n输出格式 JSON：{"speech":"台词","emotion":"happy","action":"动作"}' }
    ]
  },
  'danmaku': {
    name: '弹幕生态预设',
    desc: '规范直播间观众众生相弹幕生成格式',
    entries: [
      { id: 'e1', title: '观众众生相弹幕批处理', content: '生成15~20条性格各异的弹幕（乐子人/真爱粉/挑刺）。\n输出格式 JSON 数组：[{"sender":"网名","text":"内容","type":"meme"}]' }
    ]
  },
  'trends': {
    name: '热搜事件预设',
    desc: '规范热搜怎么发、直播高光与切片格式',
    entries: [
      { id: 'e1', title: '全网热搜八卦切片', content: '根据直播生成1条热搜话题与切片总结。\n输出格式 JSON：{"tag":"#话题#","heat":"88w","summary":"总结","comments":[]}' }
    ]
  },
  'netizen': {
    name: '吃瓜网民预设',
    desc: '规范热搜评论区互动与随机网友/NPC格式',
    entries: [
      { id: 'e1', title: '热搜评论区路人跟评', content: '以随机路人NPC身份跟评一句话（带梗）。\n输出格式 JSON：{"user":"昵称","text":"内容"}' }
    ]
  }
};


