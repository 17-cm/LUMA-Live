// =========================================================================
// 【模块四·逻辑底座与网关】LIVE/core.js
// 包含：AiPhone SDK 适配、持久化数据存取、LUMA 官方运营网关、离线时间差推演、AI接口
// =========================================================================

(function initAiPhoneSdkPolyfill() {
  // SDK 可能注入在 window / window.parent / window.top；按顺序探测
  let hostApi = window.AiPhone || window.AiPhoneApp;
  if (!hostApi) {
    try { if (window.parent && window.parent.AiPhone) hostApi = window.parent.AiPhone; } catch (e) {}
  }
  if (!hostApi) {
    try { if (window.top && window.top !== window && window.top.AiPhone) hostApi = window.top.AiPhone; } catch (e) {}
  }
  if (hostApi && hostApi.db && hostApi.characters) {
    window.api = hostApi;
    return;
  }

  const defaultCharacters = [
    {
      id: "char_1",
      name: "傲娇同桌",
      avatar: getAvatar('傲娇同桌', 'first'),
      description: "班级里的傲娇学霸，私底下是游戏高能主播",
      tags: ["电竞竞技", "无畏契约"]
    },
    {
      id: "char_2",
      name: "赛博歌姬 · 露娜",
      avatar: getAvatar('赛博歌姬 · 露娜', 'first'),
      description: "来自赛博空间的虚拟歌姬，深夜治愈点唱中",
      tags: ["声动音律", "深夜电台"]
    },
    {
      id: "char_3",
      name: "绝地枪神 · 凯文",
      avatar: getAvatar('绝地枪神 · 凯文', 'first'),
      description: "前职业电竞选手，硬核压枪教学",
      tags: ["电竞竞技", "王者荣耀"]
    },
    {
      id: "char_4",
      name: "次元猫娘 · 桃桃",
      avatar: getAvatar('次元猫娘 · 桃桃', 'first'),
      description: "萌系全能宅舞与即兴声优主播",
      tags: ["次元才艺", "虚拟歌姬"]
    },
    {
      id: "char_5",
      name: "极客阿峰",
      avatar: getAvatar('极客阿峰', 'first'),
      description: "硬核数码与新奇数码潮玩开箱测评",
      tags: ["探索开箱", "硬核数码"]
    }
  ];

  const defaultLiveSessions = [];

  function getStore(table) {
    try {
      const raw = localStorage.getItem(`luma_db_${table}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStore(table, data) {
    try {
      localStorage.setItem(`luma_db_${table}`, JSON.stringify(data));
    } catch {}
  }

  if (!getStore("live_sessions")) {
    setStore("live_sessions", defaultLiveSessions);
  }
  if (!getStore("characters")) {
    setStore("characters", defaultCharacters);
  }

  function showBrowserToast(msg) {
    const text = typeof msg === 'object' ? (msg.message || msg.title || JSON.stringify(msg)) : String(msg);
    let container = document.getElementById('luma-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'luma-toast-container';
      container.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center gap-2';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl backdrop-blur-md border border-white/20 transition-all duration-300 transform -translate-y-2 opacity-0';
    toast.textContent = text;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('-translate-y-2', 'opacity-0');
    });
    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  const memoryEventHandlers = {};

  const polyfill = {
    db: {
      async get(table, id) {
        const store = getStore(table);
        if (!store) return null;
        if (Array.isArray(store)) {
          return store.find(item => item.id === id) || null;
        }
        return store[id] || null;
      },
      async set(table, id, value) {
        let store = getStore(table) || {};
        if (Array.isArray(store)) {
          const idx = store.findIndex(item => item.id === id);
          if (idx !== -1) store[idx] = { ...store[idx], ...value, id };
          else store.push({ ...value, id });
        } else {
          store[id] = value;
        }
        setStore(table, store);
        return value;
      },
      async list(table) {
        const store = getStore(table);
        if (!store) return [];
        if (Array.isArray(store)) return [...store];
        return Object.values(store);
      },
      async create(table, item) {
        const id = item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newItem = { ...item, id };
        let store = getStore(table) || [];
        if (Array.isArray(store)) {
          store.unshift(newItem);
        } else {
          store[id] = newItem;
        }
        setStore(table, store);
        return newItem;
      },
      async update(table, id, partial) {
        let store = getStore(table) || [];
        if (Array.isArray(store)) {
          const idx = store.findIndex(item => item.id === id);
          if (idx !== -1) {
            store[idx] = { ...store[idx], ...partial };
            setStore(table, store);
            return store[idx];
          }
        } else if (store[id]) {
          store[id] = { ...store[id], ...partial };
          setStore(table, store);
          return store[id];
        }
        return null;
      },
      async delete(table, id) {
        let store = getStore(table);
        if (!store) return true;
        if (Array.isArray(store)) {
          store = store.filter(item => item.id !== id);
        } else {
          delete store[id];
        }
        setStore(table, store);
        return true;
      }
    },
    characters: {
      async list() {
        return getStore("characters") || defaultCharacters;
      },
      async get(id) {
        const list = getStore("characters") || defaultCharacters;
        return list.find(c => c.id === id) || null;
      },
      async readState({ characterId } = {}) {
        const raw = getStore(`luma_state_${characterId}`);
        if (Array.isArray(raw)) return raw;
        return [];
      },
      async writeState({ characterId, stateValues } = {}) {
        setStore(`luma_state_${characterId}`, stateValues || []);
        return { success: true };
      }
    },
    user: {
      async getProfile() {
        return {
          name: "玩家",
          avatar: getAvatar('玩家', 'first'),
          uid: "88291048",
          ip: "LUMA"
        };
      }
    },
    wallet: {
      async getWallet() {
        const w = await polyfill.db.get("app_wallet", "vault_data");
        return { balance: w?.balance !== undefined ? Number(w.balance) : 5000 };
      },
      async get() {
        return this.getWallet();
      },
      async pay(params) {
        const cost = typeof params === 'object' ? (Number(params.amount) || 0) : (Number(params) || 0);
        let w = await polyfill.db.get("app_wallet", "vault_data");
        const currentBal = w?.balance !== undefined ? Number(w.balance) : 5000;
        if (currentBal < cost) {
          return { success: false, ok: false, error: '余额不足', balance: currentBal };
        }
        const balance = currentBal - cost;
        await polyfill.db.set("app_wallet", "vault_data", { balance });
        return { success: true, ok: true, balance };
      },
      async recharge(amount) {
        const add = Number(amount) || 0;
        let w = await polyfill.db.get("app_wallet", "vault_data");
        const currentBal = w?.balance !== undefined ? Number(w.balance) : 5000;
        const balance = currentBal + add;
        await polyfill.db.set("app_wallet", "vault_data", { balance });
        return { success: true, ok: true, balance };
      }
    },
    memory: {
      async addTimeline(event) {
        return { success: true };
      }
    },
    chat: {
      async sendMessage(msg) {
        return { success: true };
      }
    },
    tools: {
      handlers: {},
      handle(name, fn) {
        this.handlers[name] = fn;
      },
      register(tool) {
      }
    },
    ui: {
      showToast: showBrowserToast,
      toast: showBrowserToast,
      showNotification: showBrowserToast
    },
    ai: {
      async generate(options) {
        const instructions = options?.instruction || options?.prompt || "";
        if (instructions.includes("live_stream_batch_package") || instructions.includes("danmakus")) {
          return {
            text: JSON.stringify({
              hostSpeeches: [
                { speech: "欢迎新进直播间的朋友们！记得点点关注不迷路~", action: "喝了口水" },
                { speech: "公屏刷起来，让我们看看今天榜一大哥是谁！", action: "调整麦克风" },
                { speech: "这波操作怎么样？给主播扣波666！", action: "兴奋比心" }
              ],
              danmakus: [
                { sender: "乐子人小王", text: "66666 太强了吧！", type: "fan" },
                { sender: "夜猫子77", text: "主播今天状态拉满啊！", type: "fan" },
                { sender: "吃瓜群众A", text: "刚刚那个失误笑死我了哈哈哈", type: "meme" },
                { sender: "神秘大哥", text: "给主播排面走起！", type: "gift" },
                { sender: "星空旅人", text: "声音太好听了，已常驻直播间", type: "fan" },
                { sender: "随风而行", text: "前排打卡混个脸熟~", type: "meme" },
                { sender: "瓜田李下", text: "好耶！今晚通宵播吗？", type: "meme" }
              ]
            })
          };
        }

        if (instructions.includes("live_stream_user_reply") || instructions.includes("互动")) {
          return {
            text: JSON.stringify({
              speech: `谢谢宝子的互动！爱你哟，今天一起嗨翻全场~`,
              emotion: "happy",
              action: "向镜头微笑挥手"
            })
          };
        }

        return {
          text: JSON.stringify({
            speech: "很高兴和大家相聚在直播间！",
            emotion: "happy",
            action: "微笑"
          })
        };
      },
      async generateImage(options) {
        return { imageUrl: null, url: null };
      }
    },
    on(event, handler) {
      if (!memoryEventHandlers[event]) memoryEventHandlers[event] = [];
      memoryEventHandlers[event].push(handler);
    },
    emit(event, data) {
      if (memoryEventHandlers[event]) {
        memoryEventHandlers[event].forEach(fn => fn(data));
      }
    }
  };

  window.api = Object.assign(polyfill, hostApi || {});
})();

var api = window.api;

/**
 * 安全 upsert：宿主 db.create 对重复 ID 不报错（直接 prepend），
 * 所以 create().catch(()=>update()) 模式会产生重复记录。
 * 正确做法：先 update（找到则合并返回，找不到返回 null），再 create。
 */
async function dbUpsert(collection, id, data) {
  if (!api || !api.db) return null;
  try {
    const existing = await api.db.get(collection, id).catch(() => null);
    if (existing) {
      return await api.db.update(collection, id, data);
    } else {
      return await api.db.create(collection, { id, ...data });
    }
  } catch (e) {
    console.warn("[dbUpsert] failed:", collection, id, e);
    return null;
  }
}
window.dbUpsert = dbUpsert;

// 清除小手机桌面 APP 图标上的未读红色标记与通知角标 (类似微信未读红点)
async function clearAppIconNotificationBadges() {
  try {
    if (typeof navigator !== 'undefined') {
      if (typeof navigator.clearAppBadge === 'function') {
        navigator.clearAppBadge().catch(() => {});
      }
      if (typeof navigator.setAppBadge === 'function') {
        navigator.setAppBadge(0).catch(() => {});
      }
    }
  } catch (e) {}

  try {
    const targetApi = window.api;
    if (targetApi && targetApi.notifications) {
      if (typeof targetApi.notifications.clear === 'function') {
        await targetApi.notifications.clear().catch(() => {});
      }
      if (typeof targetApi.notifications.readAll === 'function') {
        await targetApi.notifications.readAll().catch(() => {});
      }
      if (typeof targetApi.notifications.setCount === 'function') {
        await targetApi.notifications.setCount(0).catch(() => {});
      }
      if (typeof targetApi.notifications.setBadge === 'function') {
        await targetApi.notifications.setBadge(0).catch(() => {});
      }
    }
  } catch (e) {}
}
window.clearAppIconNotificationBadges = clearAppIconNotificationBadges;
clearAppIconNotificationBadges();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearAppIconNotificationBadges();
    }
  });
  window.addEventListener('focus', () => {
    clearAppIconNotificationBadges();
  });
}

// 全局权威共享状态挂载
window.followedHosts = window.followedHosts || [];
window.followedSuperTopics = window.followedSuperTopics || [];
window.allCharacters = window.allCharacters || [];
window.liveList = window.liveList || [];
window.charSchedulesMap = window.charSchedulesMap || {};

// 9 大沙盒核心参数
window.appParams = window.appParams || {
  maxLiveDuration: 240,
  maxRestDuration: 480,
  minRestDuration: 10,
  dailyLiveLimit: 0,
  replyRandomDanmakuRate: 25,
  mentionUserRate: 30,
  enterOtherLiveRate: 35,
  danmakuSpeed: 50,
  giftFrequency: 30,
  enterPlayerLiveRate: 60,
  guestbookRate: 75,
  fansGainMin: 1000,
  fansGainMax: 5000
};

// 自定义 API 配置
window.customApiConfig = window.customApiConfig || {
  apiType: 'siliconflow',
  text: { url: '', key: '', model: '' },
  image: { url: '', key: '', model: '' },
  enableGlobalModel: false,
  enableGlobalImageModel: false
};

// 生图参数与修饰词
window.imageSettings = window.imageSettings || {
  size: '1:1',
  quality: 'standard',
  prompts: [
    { id: 'ratio_prompt', title: '画面比例', content: '正方形 1:1 构图，square 1:1 composition' }
  ]
};

// 预设配置
// APP 内部预设已移到 LIVE/设定/app_presets.js
// window.appPresets 由 app_presets.js 定义并自动赋值


async function saveDbSetting(settingKey, data) {
  try {
    // 存储层使用 { id, ...data } 展开方式落地，对普通对象（如 { date, cycle }）安全，
    // 但对数组或标量（如时间戳数字）做 {...data} 展开会丢失原始数据结构/数值。
    // 因此数组与标量统一包裹为 { value: data } 存储，读取端需对应做 .value 解包。
    const isPlainObject = data !== null && typeof data === 'object' && !Array.isArray(data);
    const payload = isPlainObject ? { id: settingKey, ...data } : { id: settingKey, value: data };
    const existing = await api.db.get("app_settings", settingKey);
    if (existing) {
      await api.db.update("app_settings", settingKey, payload);
    } else {
      await api.db.create("app_settings", payload);
    }
    return true;
  } catch (e) {
    console.warn(`[LUMA DB] 保存 ${settingKey} 异常:`, e);
    return false;
  }
}
window.saveDbSetting = saveDbSetting;

// 读取由 saveDbSetting 包裹存储的标量/数组类数据，自动解包 { value: ... } 结构；
// 若记录本身就是普通对象字段集合（历史格式），原样返回。
function readDbSettingValue(record) {
  if (record && typeof record === 'object' && Object.prototype.hasOwnProperty.call(record, 'value')) {
    return record.value;
  }
  return record;
}
window.readDbSettingValue = readDbSettingValue;

// AI 生成与网络请求核心
// =========================================================================
function formatOpenAIEndpoint(rawUrl, path) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/+$/, '');
  let rootBase = url.replace(/\/v1$/i, '');
  if (path === 'models') return `${rootBase}/v1/models`;
  if (path === 'chat') return `${rootBase}/v1/chat/completions`;
  if (path === 'images') return `${rootBase}/v1/images/generations`;
  return `${rootBase}/v1/${path}`;
}
window.formatOpenAIEndpoint = formatOpenAIEndpoint;

const CUSTOM_API_PRESET_TEMPLATES = {
  package: `你正在以【{{char}}】的身份进行直播推流与弹幕大包批处理生成。
补充上下文：{{instruction}}
# 输出格式（严格合法 JSON）：
{"hostSpeeches":[{"speech":"台词","action":"动作"}],"danmakus":[{"sender":"昵称","text":"弹幕","type":"fan"}]}`,

  reply: `你正在以【{{char}}】的身份直播，用户【{{user}}】互动：{{instruction}}
以主播身份口语化短句回复（30-60字）。
# 输出格式（严格合法 JSON）：
{"speech":"回复","emotion":"happy","action":"动作"}`,

  plan: `请以【{{char}}】的身份决定本次直播赛道与标题。上下文：{{instruction}}
# 输出格式（严格合法 JSON）：
{"category":"赛道","subTag":"子分类","topic":"标题"}`,

  highlight: `根据主播【{{char}}】的直播情况生成1条热搜话题与切片。上下文：{{instruction}}
# 输出格式（严格合法 JSON）：
{"tag":"#话题#","heat":"88w","category":"娱乐","summary":"总结","comments":[{"user":"昵称","text":"评论"}]}`,

  post: `根据直播情况生成一条社区动态帖子。上下文：{{instruction}}
# 输出格式（严格合法 JSON）：
{"tag":"#话题#","mention":"@主播","content":"正文","linkText":"网页链接","clipText":"直播间切片"}`,

  supertopic_post: `根据直播情况生成一条超话动态。上下文：{{instruction}}
# 输出格式（严格合法 JSON）：
{"title":"标题","content":"正文","tags":["#标签#"]}`,

  netizen: `热搜：{{instruction}}。以随机路人身份跟评一句话（带梗）。
# 输出格式（严格合法 JSON）：
{"user":"昵称","text":"内容"}`
};

function renderPresetTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? vars[k] : ''));
}

function getEffectivePresetTemplate(tagKey, categoryKey = null, presetIds = null) {
  const p = window.appPresets || {};
  // 1. 如果指定了分类（例如 live 或 trends），且该分类下有预设条目：
  if (categoryKey && p[categoryKey]?.entries?.length > 0) {
    const entries = p[categoryKey].entries;
    // 显式点名时只下发被点到的那几条：两阶段生成需要分别取「帖子协议」和
    // 「评论协议」，而 appTags 走 find(t => t !== 'live') 永远只会命中第一个
    // 元素，选不出具体条目，所以另开这个口子。
    if (Array.isArray(presetIds) && presetIds.length) {
      const picked = presetIds.map(id => entries.find(e => e.id === id)).filter(Boolean);
      if (picked.length) return picked.map(e => `${e.title}\n${e.content}`).join('\n\n---\n\n');
    }
    // 多条目分类必须整册下发：这些分类的规范是拆成 ①②③ 写的，
    // 只取 entries[0] 会让模型只看到总纲、看不到文风与输出协议。
    // 新增多条目分类时要在这里登记，否则后面的条目会被静默丢弃。
    if (categoryKey === 'live' || categoryKey === 'trends' || categoryKey === 'supertopic') {
      return entries.map(e => `${e.title}\n${e.content}`).join('\n\n---\n\n');
    }
    // 否则按 id 查找
    const found = entries.find(e => e.id === tagKey);
    if (found && found.content) return found.content;
    return entries[0]?.content || '';
  }

  // 2. 遍历所有分类查找 id === tagKey 的条目
  for (const catKey of Object.keys(p)) {
    const entries = p[catKey]?.entries || [];
    const found = entries.find(e => e.id === tagKey);
    if (found && found.content) return found.content;
  }
  return CUSTOM_API_PRESET_TEMPLATES[tagKey] || '';
}

async function aiGenerate(params) {
  const appTags = params.appTags || [];
  const isLive = appTags.includes('live');
  const catKey = isLive ? 'live' : (appTags[0] || 'live');
  const tagKey = appTags.find(t => t !== 'live') || 'reply';
  const tpl = getEffectivePresetTemplate(tagKey, catKey, params.presetIds);

  let characterId = params.characterId;
  if (!characterId && window.allCharacters && window.allCharacters.length > 0) {
    characterId = window.allCharacters[0].id;
  }

  let charName = '主播';
  let persona = '';
  if (characterId) {
    const found = (window.allCharacters || []).find(c => c.id === characterId);
    if (found) charName = found.name;
    try {
      const full = await api.characters.get(characterId);
      persona = full?.persona || full?.description || '';
    } catch (e) {}
  }
  const userName = (typeof currentUser !== 'undefined' && currentUser?.name) || (window.currentUser && window.currentUser.name) || 'user';

  const filledInstruction = tpl
    ? renderPresetTemplate(tpl, { char: charName, user: userName, instruction: params.instruction || '' })
    : (params.instruction || '');

  // 历史上下文统一前缀（供全局宿主模型分支与纯文本兜底使用）
  const historyText = params.historyText || (
    Array.isArray(params.history)
      ? params.history.map(h => `${h.role === 'assistant' ? '主播' : '观众'}: ${h.content || ''}`).join('\n')
      : ''
  );

  const customApi = window.customApiConfig || {};
  if (customApi.enableGlobalModel) {
    const genOptions = {
      ...params,
      instruction: historyText ? `${historyText}\n\n${filledInstruction}` : filledInstruction
    };
    if (characterId && !genOptions.characterId) {
      genOptions.characterId = characterId;
    }
    const hostRes = await api.ai.generate(genOptions);
    let hostText = '';
    if (typeof hostRes === 'string') hostText = hostRes;
    else if (hostRes && typeof hostRes.text === 'string') hostText = hostRes.text;
    else if (hostRes && typeof hostRes.content === 'string') hostText = hostRes.content;
    else if (hostRes && typeof hostRes.message === 'string') hostText = hostRes.message;
    else if (hostRes) hostText = JSON.stringify(hostRes);
    return { text: hostText };
  }

  const type = customApi.apiType || 'siliconflow';
  let url = customApi.text?.url || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    else if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = customApi.text?.key || '';
  const model = customApi.text?.model || 'gpt-3.5-turbo';
  if (!url) throw new Error('自定义文本API未配置地址');

  const systemPrompt = persona
    ? `你正在扮演角色【${charName}】。\n角色设定：${persona}`
    : `你正在扮演角色【${charName}】。`;

  // 组装多轮 messages：system + (可选历史) + 当前 user 指令
  const messages = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(params.history) && params.history.length > 0) {
    params.history.forEach(h => {
      if (!h || !h.role) return;
      messages.push({ role: h.role, content: h.content });
    });
  }
  messages.push({ role: 'user', content: filledInstruction });

  const endpoint = formatOpenAIEndpoint(url, 'chat');
  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, messages: messages, temperature: 0.9 }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.text || data?.response;
    if (!res.ok || !text) throw new Error(`自定义API请求失败: ${data?.error?.message || res.status}`);
    return { text };
  } catch (e) {
    throw e;
  }
}
window.aiGenerate = aiGenerate;

async function aiGenerateImage(params) {
  let promptText = params.prompt || '';
  const imgSettings = window.imageSettings || {};
  if (imgSettings?.prompts?.length > 0) {
    const promptModifiers = imgSettings.prompts
      .map(p => p.content?.trim())
      .filter(Boolean)
      .join(', ');
    if (promptModifiers) {
      promptText = `${promptText}, ${promptModifiers}`;
    }
  }

  const customApi = window.customApiConfig || {};
  
  // 1. 全局宿主生图大模型分支
  if (customApi.enableGlobalImageModel) {
    try {
      const res = await api.ai.generateImage({
        ...params,
        prompt: promptText
      });
      if (res) {
        if (typeof res === 'string') return { dataUrl: res };
        if (res.dataUrl) return { dataUrl: res.dataUrl };
        if (res.imageUrl) return { dataUrl: res.imageUrl };
        if (res.url) return { dataUrl: res.url };
        if (res.image) return { dataUrl: res.image };
        if (Array.isArray(res.data) && res.data[0]?.url) return { dataUrl: res.data[0].url };
        if (Array.isArray(res.data) && res.data[0]?.b64_json) return { dataUrl: `data:image/png;base64,${res.data[0].b64_json}` };
      }
      return res;
    } catch (e) {
      console.warn('Global generateImage error:', e);
      throw e;
    }
  }

  // 2. 自定义生图 API 分支
  const url = customApi.image?.url || '';
  const key = customApi.image?.key || '';
  const model = customApi.image?.model || 'dall-e-3';
  
  if (!url) {
    // 若未配置自定义地址，但宿主环境支持全局生图，自动降级调用宿主 API
    if (api && api.ai && typeof api.ai.generateImage === 'function') {
      try {
        const res = await api.ai.generateImage({ ...params, prompt: promptText });
        if (res) {
          if (typeof res === 'string') return { dataUrl: res };
          if (res.dataUrl) return { dataUrl: res.dataUrl };
          if (res.imageUrl) return { dataUrl: res.imageUrl };
          if (res.url) return { dataUrl: res.url };
          if (res.image) return { dataUrl: res.image };
        }
        return res;
      } catch (e) {}
    }
    throw new Error('生图API未配置地址');
  }

  const endpoint = formatOpenAIEndpoint(url, 'images');
  try {
    // 兼容大多数中转站 (FLUX/SD/DALL-E)
    const requestBody = { 
      model: model, 
      prompt: promptText, 
      n: 1, 
      size: imgSettings.size === '9:16' ? '1024x1792' : (imgSettings.size === '16:9' ? '1792x1024' : '1024x1024')
    };
    if (model.toLowerCase().includes('dall-e-3')) {
      requestBody.quality = imgSettings.quality || 'standard';
    }

    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: requestBody
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    
    // 兼容标准 OpenAI 格式: { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] }
    const item = data?.data?.[0];
    if (res.ok && item?.url) return { dataUrl: item.url };
    if (res.ok && item?.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}` };
    
    // 兼容部分中转站与开源平台格式: { images: ["url/base64"] } 或 { url: "..." }
    if (res.ok && Array.isArray(data?.images) && data.images[0]) {
      const firstImg = data.images[0];
      if (firstImg.startsWith('http') || firstImg.startsWith('data:')) return { dataUrl: firstImg };
      return { dataUrl: `data:image/png;base64,${firstImg}` };
    }
    if (res.ok && data?.url) return { dataUrl: data.url };
    if (res.ok && data?.imageUrl) return { dataUrl: data.imageUrl };
    if (res.ok && data?.image) return { dataUrl: data.image };

    throw new Error(`自定义生图API请求失败: ${data?.error?.message || data?.message || res.status}`);
  } catch (e) {
    throw e;
  }
}
window.aiGenerateImage = aiGenerateImage;

async function robustNetworkRequest(options) {
  // 需要走宿主代理的请求（如 GitHub API，沙盒 iframe 直连会被 CORS 拦截）
  if (options.proxy === true && api.network?.fetch) {
    try {
      const res = await api.network.fetch({
        url: options.url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        proxy: true,
        timeoutMs: options.timeoutMs || 20000
      });
      if (res && (res.ok || res.status)) return res;
    } catch (e) {
      console.warn('[robustNetworkRequest] 宿主代理请求失败，降级为浏览器直连:', e?.message || e);
    }
  }

  // 浏览器直连（自定义大模型 API 等，目标接口通常允许 CORS）
  const rawRes = await fetch(options.url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await rawRes.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { ok: rawRes.ok, status: rawRes.status, text: text, json: json };
}
window.robustNetworkRequest = robustNetworkRequest;

function extractJsonFromText(text) {
  if (!text) return null;
  let cleaned = String(text).trim();

  // 1. 剥离思考链标签（兼容  与 </think> 包裹、[think]/[thinking]/【思考】等变体）
  cleaned = cleaned.replace(/<\s*(?:think|thinking)\s*>[\s\S]*?<\s*\/\s*(?:think|thinking)\s*>/gi, '');
  cleaned = cleaned.replace(/\[(?:think|thinking|思考|推理)[\s\S]*?\[\/(?:think|thinking|思考|推理)\]/gi, '');
  cleaned = cleaned.trim();

  // 2. 去除任意位置的代码块标记及语言标记（不依赖首尾锚定，兼容前后夹叙述文字）
  //    ```json / ```JSON / ```javascript / ```（无语言）等，统一剥掉围栏
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\s*/g, '').trim();
  // 清理残留的裸反引号围栏（若模型只输出一对 ``` 未闭合）
  cleaned = cleaned.replace(/```/g, '').trim();
  // 清理思考链拆出的 【动作/指令】 并非 JSON，这里只做轻度标点规整，不破坏内容

  // 3. 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // 4. 提取最外层的 { ... } 或 [ ... ]
  try {
    const objFirst = cleaned.indexOf('{');
    const objLast = cleaned.lastIndexOf('}');
    const arrFirst = cleaned.indexOf('[');
    const arrLast = cleaned.lastIndexOf(']');

    let candidate = null;
    if (objFirst !== -1 && objLast !== -1 && (arrFirst === -1 || objFirst < arrFirst)) {
      candidate = cleaned.slice(objFirst, objLast + 1);
    } else if (arrFirst !== -1 && arrLast !== -1) {
      candidate = cleaned.slice(arrFirst, arrLast + 1);
    }

    if (candidate) {
      const attempt = (s) => {
        try { return JSON.parse(s); } catch (e) { return null; }
      };

      // 直接解析
      let result = attempt(candidate);
      if (result !== null) return result;

      // 清洗常见的尾随逗号、注释与控制字符后重试
      const sanitized = candidate
        .replace(/,\s*([\}\]])/g, '$1')
        .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      result = attempt(sanitized);
      if (result !== null) return result;

      // 5. 修复字符串值内未转义的换行（AI 常在 speech 台词内直接换行）：
      //    把「字符串值内部的真实换行」转义为 \\n，前提是该换行不处于语法的逗号/冒号分隔位。
      //    保守做法：仅在匹配不到多行 JSON 合法解析时，逐行折叠换行符。
      result = attempt(candidate.replace(/\r?\n/g, '\\n'));
      if (result !== null) return result;

      // 6. 修复字符串值内未转义的双引号（全角引号保留原值），仅当明显是字符串内嵌时才罕见触发，
      //    这里做一次「中文引号绕行 + 单引号归一」的兜底：把未被 JSON 当作定界符的全角引号保持，
      //    仅对确认破坏结构的场景做最小修复。为避免误伤，此步仅在前面全部失败时执行。
      result = attempt(sanitized.replace(/\r?\n/g, '\\n'));
      if (result !== null) return result;
    }
  } catch (e) {}

  return null;
}
window.extractJsonFromText = extractJsonFromText;

// =========================================================================
// 【Float 品牌设备标识】所有"来源/设备/客户端"显示统一品牌
// 品牌固定为 Float，型号随机（17 Pro / 17 Pro Max / 17 Ultra / 17 mini / 17）
// =========================================================================
window.FLOAT_BRAND = 'Float';
// 品牌固定 Float，只有后缀变化 —— 数字 / Pro / Plus / Max / Ultra / Air /
// Note / SE / Mini / GT / Turbo 混着来，看起来像不同人在不同设备上发的
window.FLOAT_MODEL_POOL = [
  '12', '15', '16 Pro', '17 Pro Max', '20 Plus', '30 Pro', '40 Ultra',
  '50 Pro+', '60', '60 Plus', '70 Max', '80 Pro', '90 Max', '90 Pro',
  'Air', 'Air 5', 'Note 11', 'Note 12 Pro', 'X Ultra', 'Neo 9',
  'Play 6', 'Magic 5', 'SE', 'Mini 4', 'GT 7', 'Turbo 9', '13 Pro'
];
function getFloatClientTag(useModel) {
  const brand = window.FLOAT_BRAND || 'Float';
  if (useModel) {
    const pool = window.FLOAT_MODEL_POOL || ['17 Pro'];
    const model = pool[Math.floor(Math.random() * pool.length)];
    return `${brand} ${model}`;
  }
  return `${brand} 客户端`;
}
window.getFloatClientTag = getFloatClientTag;

// 机型标签（稳定版）：getFloatClientTag(true) 每次调用都会重新随机，而列表 /
// 详情在点赞、评论、展开回复时都会整块重渲染 → 机型跟着跳。
// 用这个：首次抽一个并写回 post.device，之后只读不再抽。
function postDeviceTag(post) {
  if (post && !post.device) {
    post.device = (typeof getFloatClientTag === 'function')
      ? getFloatClientTag(true) : 'Float 客户端';
  }
  return (post && post.device) || 'Float 客户端';
}
window.postDeviceTag = postDeviceTag;

// =========================================================================
// 【统一头像资源站】getAvatar(name, style)
// 所有需要随机头像的地方统一引用本标签，不再写死外部图片 URL
// 方案二选一（调用方自选）：
//   'emoji'：随机 emoji + 全色域随机背景色
//   'first'：名字首字/首字母 + 全色域随机背景色
// 传名字时同一角色头像稳定（内存缓存）；不传名字则每次真随机
// 未来新增方案（如 AI 生图/本地素材）在本函数内扩展分支即可，引用方式不变
// =========================================================================
window.AVATAR_EMOJI_POOL = [
  '😀','😎','🤖','👾','🎮','🎤','🎧','🚀','🪐','⚡','🔥','💫','🌸','🌙','⭐',
  '🎨','🎹','🎸','🦊','🐱','🐼','🦄','🍩','🧋','📱','💿','🎪','🃏','🛸','🌊',
  '🍀','🎲','🎯','🏆','💎','🧊','☄️','🌈','🍕','🐰','🦁','🎬','📡','🛰️','🌌'
];
var _avatarCache = null;
function getAvatar(name, style) {
  if (!_avatarCache) _avatarCache = new Map();
  const key = (style || 'emoji') + ':' + (name || '');
  if (name && _avatarCache.has(key)) return _avatarCache.get(key);
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 全色域随机背景（对角渐变）
  const h1 = Math.floor(Math.random() * 360);
  const h2 = (h1 + 40 + Math.floor(Math.random() * 140)) % 360;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, `hsl(${h1}, 68%, 56%)`);
  grad.addColorStop(1, `hsl(${h2}, 72%, 44%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (style === 'first') {
    const n = String(name || '?').trim();
    const first = n ? Array.from(n)[0] : '?';
    const ch = /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = '900 92px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
    ctx.fillText(ch, size / 2, size / 2 + 6);
  } else {
    const pool = window.AVATAR_EMOJI_POOL || ['🎉'];
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    ctx.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText(emoji, size / 2, size / 2 + 6);
  }
  const dataUrl = canvas.toDataURL('image/png');
  if (name) _avatarCache.set(key, dataUrl);
  return dataUrl;
}
window.getAvatar = getAvatar;
