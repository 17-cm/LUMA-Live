// 全局 API 声明与防空处理
(function initAiPhoneSdkPolyfill() {
  const hostApi = window.AiPhone || window.AiPhoneApp;
  if (hostApi && hostApi.db && hostApi.characters) {
    window.api = hostApi;
    return;
  }

  const defaultCharacters = [
    {
      id: "char_1",
      name: "傲娇同桌",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      description: "班级里的傲娇学霸，私底下是游戏高能主播",
      tags: ["电竞竞技", "无畏契约"]
    },
    {
      id: "char_2",
      name: "赛博歌姬 · 露娜",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      description: "来自赛博空间的虚拟歌姬，深夜治愈点唱中",
      tags: ["声动音律", "深夜电台"]
    },
    {
      id: "char_3",
      name: "绝地枪神 · 凯文",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400",
      description: "前职业电竞选手，硬核压枪教学",
      tags: ["电竞竞技", "王者荣耀"]
    },
    {
      id: "char_4",
      name: "次元猫娘 · 桃桃",
      avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400",
      description: "萌系全能宅舞与即兴声优主播",
      tags: ["次元才艺", "虚拟歌姬"]
    },
    {
      id: "char_5",
      name: "极客阿峰",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      description: "硬核数码与新奇数码潮玩开箱测评",
      tags: ["探索开箱", "硬核数码"]
    }
  ];

  const defaultLiveSessions = [
    {
      id: "sess_1",
      characterId: "char_1",
      name: "傲娇同桌",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      cover: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",
      category: "电竞竞技",
      subTag: "无畏契约",
      topic: "谁说我打不过？今晚单排上赋能！",
      heat: 88500,
      roomId: 102938,
      startTime: Date.now() - 1000 * 60 * 20,
      endTime: Date.now() + 1000 * 60 * 100,
      isNPC: false
    },
    {
      id: "sess_2",
      characterId: "char_2",
      name: "赛博歌姬 · 露娜",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
      category: "声动音律",
      subTag: "深夜电台",
      topic: "雨夜温柔点唱，倾听你的心事 🎵",
      heat: 124000,
      roomId: 492019,
      startTime: Date.now() - 1000 * 60 * 35,
      endTime: Date.now() + 1000 * 60 * 85,
      isNPC: false
    },
    {
      id: "sess_3",
      characterId: "char_4",
      name: "次元猫娘 · 桃桃",
      avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
      category: "次元才艺",
      subTag: "虚拟歌姬",
      topic: "新装扮发布！快来投喂小鱼干喵~",
      heat: 64200,
      roomId: 773912,
      startTime: Date.now() - 1000 * 60 * 10,
      endTime: Date.now() + 1000 * 60 * 110,
      isNPC: false
    },
    {
      id: "sess_4",
      characterId: "char_5",
      name: "极客阿峰",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      cover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800",
      category: "探索开箱",
      subTag: "硬核数码",
      topic: "首发上手！超旗舰透明主机拆解",
      heat: 45100,
      roomId: 883192,
      startTime: Date.now() - 1000 * 60 * 5,
      endTime: Date.now() + 1000 * 60 * 95,
      isNPC: false
    }
  ];

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
      async writeState({ characterId, stateValues }) {
        return { success: true };
      }
    },
    user: {
      async getProfile() {
        return {
          name: "玩家",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
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
        console.log("[LUMA Chat Polyfill] Message sent:", msg);
        return { success: true };
      }
    },
    tools: {
      handlers: {},
      handle(name, fn) {
        this.handlers[name] = fn;
      },
      register(tool) {
        console.log("[LUMA Tools Polyfill] Tool registered:", tool);
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
        const charName = options?.characterName || "主播";
        
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
        const sampleCovers = [
          "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800",
          "https://images.unsplash.com/photo-1563089145-599997674d42?w=800",
          "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800",
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800"
        ];
        const randomCover = sampleCovers[Math.floor(Math.random() * sampleCovers.length)];
        return { imageUrl: randomCover, url: randomCover };
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

// 全局共享变量声明
window.followedHosts = window.followedHosts || [];
window.allCharacters = window.allCharacters || [];
window.liveList = window.liveList || [];

// 用户资料状态
let userProfileData = {
  uid: '88291048',
  ip: 'LUMA',
  tag: '新人主播',
  bio: '白天是理智社畜，深夜是某主播的头号榜一大哥。理性看播，感性砸车。',
  follows: 1,
  fans: 0,
  likes: 0,
  medals: 0
};
window.userProfileData = userProfileData;

let currentUser = { name: '玩家', avatar: '' };
let revenueBalance = 0;
let activeSpaceHost = null;
let guestbookData = {};
let transactionLedger = [];
let currentRankTab = 'fans';

// 9 大沙盒参数配置状态 (补齐 guestbookRate: 75 缺省值防空)
let appParams = {
  charSpawnRate: 45,
  maxLiveDuration: 120,
  maxRestDuration: 360,
  replyRandomDanmakuRate: 25,
  mentionUserRate: 30,
  enterOtherLiveRate: 35,
  danmakuSpeed: 50,
  giftFrequency: 30,
  enterPlayerLiveRate: 60,
  guestbookRate: 75
};
window.appParams = appParams;

// 自定义 API 配置与全局开关
let customApiConfig = {
  apiType: 'siliconflow',
  text: { url: '', key: '', model: '' },
  image: { url: '', key: '', model: '' },
  enableGlobalModel: false,
  enableGlobalImageModel: false
};
window.customApiConfig = customApiConfig;

// 生图参数与提示词
let imageSettings = {
  size: '1:1',
  quality: 'standard',
  prompts: [
    { id: 'ratio_prompt', title: '画面比例', content: '正方形 1:1 构图，square 1:1 composition' }
  ]
};
window.imageSettings = imageSettings;

// 5 大固定预设分类
let presetCategories = {
  'plan': {
    name: '直播企划预设',
    desc: '规范直播怎么进行、赛道与标题生成规则',
    entries: [
      { id: 'e1', title: '赛道与标题企划', content: '请以【{{char}}】的身份决定本次直播的赛道与标题。\n输出格式：[赛道]...\\n[标题]...\\n[开播状态]...' }
    ]
  },
  'host': {
    name: '主播互动预设',
    desc: '规范直播间主播口吻、台词动作与回复格式',
    entries: [
      { id: 'e1', title: '主播实时控场与台词', content: '以【{{char}}】的身份直播，口语化短句回应公屏。\n输出格式 JSON：{\"speech\":\"台词\",\"emotion\":\"happy\",\"action\":\"动作\"}' }
    ]
  },
  'danmaku': {
    name: '弹幕生态预设',
    desc: '规范直播间观众众生相弹幕生成格式',
    entries: [
      { id: 'e1', title: '观众众生相弹幕批处理', content: '生成15~20条性格各异的弹幕（乐子人/真爱粉/挑刺）。\n输出格式 JSON 数组：[{\"sender\":\"网名\",\"text\":\"内容\",\"type\":\"meme\"}]' }
    ]
  },
  'trends': {
    name: '热搜事件预设',
    desc: '规范热搜怎么发、直播高光与切片格式',
    entries: [
      { id: 'e1', title: '全网热搜八卦切片', content: '根据直播生成1条热搜话题与切片总结。\n输出格式 JSON：{\"tag\":\"#话题#\",\"heat\":\"88w\",\"summary\":\"总结\",\"comments\":[]}' }
    ]
  },
  'netizen': {
    name: '吃瓜网民预设',
    desc: '规范热搜评论区互动与随机网友/NPC格式',
    entries: [
      { id: 'e1', title: '热搜评论区路人跟评', content: '以随机路人NPC身份跟评一句话（带梗）。\n输出格式 JSON：{\"user\":\"昵称\",\"text\":\"内容\"}' }
    ]
  }
};

let currentEditingCategoryKey = null;

// 通用数据库设置保存辅助函数 (严格遵循 AiPhone SDK get/update/create 机制)
async function saveDbSetting(settingKey, data) {
  try {
    const existing = await api.db.get("app_settings", settingKey);
    if (existing) {
      await api.db.update("app_settings", settingKey, data);
    } else {
      await api.db.create("app_settings", { id: settingKey, ...data });
    }
    return true;
  } catch (e) {
    try {
      if (typeof api.db.set === 'function') {
        await api.db.set("app_settings", settingKey, data);
        return true;
      }
    } catch (err) {}
    console.warn(`[LUMA DB] 保存 ${settingKey} 异常:`, e);
    return false;
  }
}
window.saveDbSetting = saveDbSetting;

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadPersistedAppData();
    await syncUserProfile();
    renderPresetCategoryList();
    renderImagePromptEntries();
    renderDualRankList();
    renderParamsToUI();
  } catch (e) {
    console.warn("Main DOMContentLoaded 捕获:", e);
  }
});

// 全量数据持久化读取
async function loadPersistedAppData() {
  try {
    const p = await api.db.get("app_profile", "user_profile");
    if (p) {
      userProfileData = { ...userProfileData, ...p };
      window.userProfileData = userProfileData;
    }

    const follows = await api.db.list("follows") || [];
    window.followedHosts = follows.map(f => f.id);
    const followCount = window.followedHosts.length + 1; // 包含初始关注的 LUMA 官方运营组
    
    const uidEl = document.getElementById('displayUserUID');
    const ipEl = document.getElementById('displayUserIP');
    const tagEl = document.getElementById('displayUserTag');
    const bioEl = document.getElementById('userBioText');
    const followEl = document.getElementById('statFollowCount');
    const fanEl = document.getElementById('statFanCount');
    const likeEl = document.getElementById('statLikeCount');
    const medalEl = document.getElementById('statMedalCount');

    if (uidEl) uidEl.textContent = userProfileData.uid;
    if (ipEl) ipEl.textContent = userProfileData.ip;
    if (tagEl) tagEl.textContent = userProfileData.tag;
    if (bioEl) bioEl.textContent = `“${userProfileData.bio}”`;
    if (followEl) followEl.textContent = followCount;
    if (fanEl) fanEl.textContent = userProfileData.fans || 128;
    if (likeEl) likeEl.textContent = userProfileData.likes;
    if (medalEl) medalEl.textContent = userProfileData.medals;

    const w = await api.db.get("app_wallet", "vault_data");
    if (w) {
      revenueBalance = w.balance || 0;
      const revEl = document.getElementById('liveRevenueAmount');
      if (revEl) revEl.textContent = revenueBalance.toLocaleString();
    }

    const ledger = await api.db.list("app_ledger") || [];
    transactionLedger = ledger;

    const list = await api.db.list("guestbook") || [];
    list.forEach(item => {
      if (!guestbookData[item.hostId]) guestbookData[item.hostId] = [];
      guestbookData[item.hostId].push(item);
    });

    // 读取参数设置
    const savedParams = await api.db.get("app_settings", "params_config");
    if (savedParams) {
      appParams = { ...appParams, ...savedParams };
      window.appParams = appParams;
    }

    // 读取预设设置
    const savedPresets = await api.db.get("app_settings", "presets_config");
    if (savedPresets && savedPresets.categories) {
      presetCategories = savedPresets.categories;
      window.presetCategories = presetCategories;
    }

    // 读取生图设置
    const savedImage = await api.db.get("app_settings", "image_settings");
    if (savedImage) {
      imageSettings = { ...imageSettings, ...savedImage };
      window.imageSettings = imageSettings;
      const selSize = document.getElementById('selectImageSize');
      const selQual = document.getElementById('selectImageQuality');
      if (selSize && imageSettings.size) selSize.value = imageSettings.size;
      if (selQual && imageSettings.quality) selQual.value = imageSettings.quality;
    }

    // 读取 API 配置
    const savedApi = await api.db.get("app_settings", "api_config");
    if (savedApi) {
      customApiConfig = { ...customApiConfig, ...savedApi };
      window.customApiConfig = customApiConfig;
      const swModel = document.getElementById('switchGlobalModel');
      const swImg = document.getElementById('switchGlobalImageModel');
      if (swModel) swModel.checked = customApiConfig.enableGlobalModel || false;
      if (swImg) swImg.checked = customApiConfig.enableGlobalImageModel || false;
    }
  } catch (e) {
    console.warn("读取持久化数据异常:", e);
  }
}

async function syncUserProfile() {
  try {
    const u = await api.user.getProfile();
    if (u) {
      currentUser.name = u.name || '玩家';
      currentUser.avatar = u.avatar || u.avatarUrl || u.icon || '';
      const nameEl = document.getElementById('userName');
      const avatarBox = document.getElementById('userAvatarBox');
      if (nameEl) nameEl.textContent = currentUser.name;
      if (avatarBox && currentUser.avatar) avatarBox.src = currentUser.avatar;
    }
  } catch (e) {}
}

// 核心 Tab 切换
function switchTab(tab) {
  document.querySelectorAll('.tab-page').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.dock-btn').forEach(btn => btn.classList.remove('active'));

  const activePage = document.getElementById(`tab-${tab}`);
  if (activePage) activePage.classList.remove('hidden');

  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'trends' && typeof renderTrends === 'function') renderTrends();
  if (tab === 'profile') renderDualRankList();
}
window.switchTab = switchTab;

function toggleAccordion(id) {
  const item = document.getElementById(id);
  if (!item) return;
  if (item.classList.contains('open')) {
    item.classList.remove('open');
  } else {
    document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('open'));
    item.classList.add('open');
  }
}
window.toggleAccordion = toggleAccordion;

// 9 大参数更新与安全持久化（需显式点击保存按钮后生效）
function updateParam(key, val) {
  appParams[key] = parseInt(val);
  window.appParams = appParams;
  
  const valEl = document.getElementById(`val_${key}`) || 
                document.getElementById(`val${key.charAt(0).toUpperCase() + key.slice(1)}`);
  
  if (valEl) {
    if (key === 'charSpawnRate' || key === 'replyRandomDanmakuRate' || key === 'mentionUserRate' || key === 'enterOtherLiveRate' || key === 'enterPlayerLiveRate' || key === 'guestbookRate') {
      valEl.textContent = `${val}%`;
    } else if (key === 'maxLiveDuration' || key === 'maxRestDuration') {
      valEl.textContent = `${val}分钟`;
    } else if (key === 'danmakuSpeed') {
      const sec = (6 - (val / 16)).toFixed(1);
      valEl.textContent = `${val} (约${sec}秒/条)`;
    } else {
      valEl.textContent = val;
    }
  }

  if (key === 'charSpawnRate') {
    const tagEl = document.getElementById('tagCharRate');
    if (tagEl) tagEl.textContent = `${val}% 概率开播`;
  }
}
window.updateParam = updateParam;

async function saveAllParamsExplicitly() {
  await saveDbSetting("params_config", appParams);
  
  if (appParams.charSpawnRate === 0) {
    // 1. 0% 维护模式：全服瞬间强制下播清空
    if (window.lumaOpsGateway) {
      const activeSessions = await api.db.list("live_sessions") || [];
      for (const s of activeSessions) {
        await lumaOpsGateway.requestStopLive({
          characterId: s.characterId,
          reason: "官方全服停机维护",
          source: "maint_shutdown"
        });
      }
    }
    // 重置彩蛋待触发标记
    await saveDbSetting("maint_egg_triggered", { value: false });
    if (typeof renderLiveGrid === 'function') renderLiveGrid();
    api.ui.toast("参数已保存！当前为 0% 官方维护模式，请刷新页面生效");
  } else {
    // 恢复正常开服
    await saveDbSetting("maint_egg_triggered", { value: false });
    if (typeof syncLiveSessions === 'function') {
      await syncLiveSessions({ allowSpawn: true });
    }
    api.ui.toast("参数设置已保存并实时生效！");
  }
}
window.saveAllParamsExplicitly = saveAllParamsExplicitly;

function renderParamsToUI() {
  for (let key in appParams) {
    const input = document.getElementById(`param_${key}`) || 
                  document.getElementById(`param${key.charAt(0).toUpperCase() + key.slice(1)}`);
    if (input) input.value = appParams[key];
    updateParam(key, appParams[key], false);
  }
}

// 关注列表页面
function openFollowListPageView() {
  const container = document.getElementById('followListContentContainer');
  if (!container) return;
  const list = window.allCharacters || [];
  const follows = list.filter(c => (window.followedHosts || []).includes(c.id));

  let html = `
    <div class="luxe-card p-3.5 flex items-center justify-between bg-white">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-rose-500 flex-shrink-0">
          <div class="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-xs font-black">LUMA</div>
        </div>
        <div>
          <h4 class="text-xs font-black text-slate-900">LUMA 官方运营组</h4>
          <p class="text-[9px] text-slate-400 mt-0.5">官方特邀认证 · 24小时值班</p>
        </div>
      </div>
      <span class="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">已关注</span>
    </div>
  `;

  if (follows.length === 0) {
    html += `
      <div class="py-10 text-center text-slate-400 text-xs">
        <p class="font-bold">暂无关注的主播</p>
        <p class="text-[10px] text-slate-300 mt-1">前往直播广场关注心仪主播吧</p>
      </div>
    `;
  } else {
    html += follows.map(c => {
      const fansCount = window.getHostBaseFans ? window.getHostBaseFans(c.id, c) : 1280;
      const formattedFans = fansCount >= 10000 ? (fansCount / 10000).toFixed(1) + '万' : fansCount.toLocaleString();
      return `
        <div class="luxe-card p-3.5 flex items-center justify-between bg-white">
          <div class="flex items-center gap-3 cursor-pointer" onclick="openStreamerSpace('${c.id}')">
            <img src="${c.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-rose-500 flex-shrink-0">
            <div>
              <h4 class="text-xs font-black text-slate-900">${c.name}</h4>
              <p class="text-[9px] text-rose-600 font-bold mt-0.5">${formattedFans} 粉丝 · 签约主播</p>
            </div>
          </div>
          <button onclick="toggleFollowRoomHostById('${c.id}')" class="btn-action text-[10px] !py-1 !px-2.5 text-slate-500">取消关注</button>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = html;
  const page = document.getElementById('followListPageView');
  if (page) page.classList.remove('hidden');
}
window.openFollowListPageView = openFollowListPageView;

function closeFollowListPageView() {
  const page = document.getElementById('followListPageView');
  if (page) page.classList.add('hidden');
}
window.closeFollowListPageView = closeFollowListPageView;

async function toggleFollowRoomHostById(charId) {
  if (window.followedHosts.includes(charId)) {
    window.followedHosts = window.followedHosts.filter(id => id !== charId);
    if (window.followedHosts) {
      if (typeof followedHosts !== 'undefined') followedHosts = window.followedHosts;
    }
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
    openFollowListPageView();
    
    // 同步个人中心统计数
    const statEl = document.getElementById('statFollowCount');
    if (statEl) statEl.textContent = window.followedHosts.length + 1;

    // 同步直播间粉丝数与关注按钮
    if (typeof checkFollowState === 'function') checkFollowState();
    if (typeof updateLiveRoomHostFansDisplay === 'function') updateLiveRoomHostFansDisplay();
  }
}
window.toggleFollowRoomHostById = toggleFollowRoomHostById;

// 修改资料
function openEditProfileModal() {
  document.getElementById('editInputUID').value = userProfileData.uid;
  document.getElementById('editInputIP').value = userProfileData.ip;
  document.getElementById('editInputTag').value = userProfileData.tag;
  document.getElementById('editInputBio').value = userProfileData.bio;
  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.remove('hidden');
}
window.openEditProfileModal = openEditProfileModal;

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.add('hidden');
}
window.closeEditProfileModal = closeEditProfileModal;

async function saveUserProfileEdits() {
  userProfileData.uid = document.getElementById('editInputUID').value.trim() || '88291048';
  userProfileData.ip = document.getElementById('editInputIP').value.trim() || 'LUMA';
  userProfileData.tag = document.getElementById('editInputTag').value.trim() || '新人主播';
  userProfileData.bio = document.getElementById('editInputBio').value.trim();

  const uidEl = document.getElementById('displayUserUID');
  const ipEl = document.getElementById('displayUserIP');
  const tagEl = document.getElementById('displayUserTag');
  const bioEl = document.getElementById('userBioText');

  if (uidEl) uidEl.textContent = userProfileData.uid;
  if (ipEl) ipEl.textContent = userProfileData.ip;
  if (tagEl) tagEl.textContent = userProfileData.tag;
  if (bioEl) bioEl.textContent = `“${userProfileData.bio}”`;

  closeEditProfileModal();

  try {
    await api.db.create("app_profile", { id: "user_profile", ...userProfileData });
  } catch (e) {
    await api.db.update("app_profile", "user_profile", userProfileData).catch(() => {});
  }
  api.ui.toast("个人资料已保存！");
}
window.saveUserProfileEdits = saveUserProfileEdits;

// 双列排行榜
function switchRankTab(type) {
  currentRankTab = type;
  const btnFans = document.getElementById('btnRankFans');
  const btnMy = document.getElementById('btnRankMy');

  if (type === 'fans') {
    if (btnFans) btnFans.className = 'text-xs font-black text-rose-600 border-b-2 border-rose-600 pb-1';
    if (btnMy) btnMy.className = 'text-xs font-bold text-slate-400 pb-1';
  } else {
    if (btnMy) btnMy.className = 'text-xs font-black text-rose-600 border-b-2 border-rose-600 pb-1';
    if (btnFans) btnFans.className = 'text-xs font-bold text-slate-400 pb-1';
  }
  renderDualRankList();
}
window.switchRankTab = switchRankTab;

function renderDualRankList() {
  const box = document.getElementById('dualRankListContainer');
  if (!box) return;

  const getAvatarForTarget = (name) => {
    const chars = window.allCharacters || [];
    const foundChar = chars.find(c => c.name === name || c.id === name);
    if (foundChar && foundChar.avatar) return foundChar.avatar;
    const lives = window.liveList || [];
    const foundLive = lives.find(l => l.name === name);
    if (foundLive && foundLive.avatar) return foundLive.avatar;
    return `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200`;
  };

  let aggregatedList = [];

  if (currentRankTab === 'fans') {
    // 粉丝守护榜：汇总所有粉丝对直播间的送礼贡献
    const fanMap = {
      "星海漫游·榜一大哥": {
        targetName: "星海漫游·榜一大哥",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
        tag: "👑 至尊帝王",
        totalAmount: 18880,
        giftCount: 16,
        lastTime: "10分钟前"
      },
      "秋水共长天": {
        targetName: "秋水共长天",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
        tag: "💎 超级粉丝团",
        totalAmount: 9990,
        giftCount: 9,
        lastTime: "25分钟前"
      },
      "真爱喵星人": {
        targetName: "真爱喵星人",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
        tag: "💖 铁杆守护",
        totalAmount: 5200,
        giftCount: 6,
        lastTime: "1小时前"
      }
    };

    (transactionLedger || []).filter(t => t.type === 'income').forEach(tx => {
      const name = tx.targetName || '匿名粉丝';
      if (!fanMap[name]) {
        fanMap[name] = {
          targetName: name,
          avatar: tx.targetAvatar || getAvatarForTarget(name),
          tag: tx.targetTag || '直播间贵宾',
          totalAmount: 0,
          giftCount: 0,
          lastTime: tx.time || '刚刚'
        };
      }
      fanMap[name].totalAmount += Number(tx.amount) || 0;
      fanMap[name].giftCount += 1;
      if (tx.targetAvatar) fanMap[name].avatar = tx.targetAvatar;
    });

    aggregatedList = Object.values(fanMap).sort((a, b) => b.totalAmount - a.totalAmount);
  } else {
    // 我的守护榜：精确汇总当前用户送出的所有礼物，按主播归组累加
    const myGiftsMap = {};
    (transactionLedger || []).filter(t => t.type === 'gift').forEach(tx => {
      const name = tx.targetName || '签约主播';
      if (!myGiftsMap[name]) {
        myGiftsMap[name] = {
          targetName: name,
          avatar: tx.targetAvatar || getAvatarForTarget(name),
          tag: tx.targetTag || '守护主播',
          totalAmount: 0,
          giftCount: 0,
          lastTime: tx.time || '刚刚'
        };
      }
      myGiftsMap[name].totalAmount += Number(tx.amount) || 0;
      myGiftsMap[name].giftCount += 1;
      if (tx.targetAvatar) myGiftsMap[name].avatar = tx.targetAvatar;
    });

    aggregatedList = Object.values(myGiftsMap).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  if (aggregatedList.length === 0) {
    box.innerHTML = `
      <div class="py-8 text-center text-slate-400 text-xs">
        <div class="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
          <svg class="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
        <p class="font-bold">暂无${currentRankTab === 'fans' ? '粉丝守护' : '守护主播'}数据</p>
        <p class="text-[10px] text-slate-400 mt-1">进入直播间赠送心仪礼物，即可实时累加并登顶榜单！</p>
      </div>
    `;
    return;
  }

  const medals = [
    { label: '金牌守护', color: 'text-amber-500', bg: 'border-amber-200/80 bg-gradient-to-r from-amber-50/60 to-white', badge: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black', rankTag: 'Top 1 · 榜一' },
    { label: '银牌守护', color: 'text-slate-500', bg: 'border-slate-200/80 bg-gradient-to-r from-slate-50/60 to-white', badge: 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 font-bold', rankTag: 'Top 2 · 榜二' },
    { label: '铜牌守护', color: 'text-amber-700', bg: 'border-orange-200/80 bg-gradient-to-r from-orange-50/60 to-white', badge: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold', rankTag: 'Top 3 · 榜三' }
  ];

  box.innerHTML = aggregatedList.map((item, idx) => {
    const isTop3 = idx < 3;
    const m = isTop3 ? medals[idx] : null;
    const rankNum = idx + 1;

    return `
      <div class="luxe-card p-3 flex items-center justify-between ${m ? m.bg : 'bg-white'} border transition-all duration-200 hover:shadow-md">
        <div class="flex items-center gap-3">
          <!-- 排名徽章 -->
          <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${m ? m.badge : 'bg-slate-100 text-slate-600 font-bold'}">
            ${rankNum}
          </div>

          <!-- 头像 -->
          <div class="relative flex-shrink-0">
            <img src="${item.avatar}" class="w-10 h-10 rounded-full object-cover border-2 ${idx===0 ? 'border-amber-400 shadow-sm shadow-amber-200' : idx===1 ? 'border-slate-300' : idx===2 ? 'border-amber-600' : 'border-slate-200'}">
            ${idx === 0 ? '<span class="absolute -top-1.5 -right-1 text-xs">👑</span>' : ''}
          </div>

          <!-- 名字与累计数据 -->
          <div>
            <div class="flex items-center gap-1.5">
              <h5 class="text-xs font-black text-slate-900">${item.targetName}</h5>
              <span class="text-[8px] px-1.5 py-0.2 rounded-full ${idx===0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'} font-bold">${item.tag}</span>
            </div>
            <p class="text-[9px] text-slate-500 mt-0.5">
              累计贡献：<span class="font-black text-rose-600">${item.totalAmount.toLocaleString()} 币</span>
              <span class="text-slate-300 mx-1">|</span>
              共送出 <span class="font-bold text-slate-700">${item.giftCount}</span> 次礼物
            </p>
          </div>
        </div>

        <!-- 右侧荣誉标签 -->
        <div class="text-right flex-shrink-0">
          <span class="text-[10px] ${m ? m.color + ' font-black' : 'text-slate-400 font-bold'} block">
            ${m ? m.label : `No.${rankNum}`}
          </span>
          <span class="text-[8px] text-slate-400 block mt-0.5">${item.lastTime || '活跃'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// 钱包与流水
function openWalletPageView() {
  const pageRev = document.getElementById('pageRevenueBalance');
  if (pageRev) pageRev.textContent = revenueBalance.toLocaleString();
  renderTransactionLedger();
  const page = document.getElementById('walletPageView');
  if (page) page.classList.remove('hidden');
}
window.openWalletPageView = openWalletPageView;

function closeWalletPageView() {
  const page = document.getElementById('walletPageView');
  if (page) page.classList.add('hidden');
}
window.closeWalletPageView = closeWalletPageView;

function renderTransactionLedger() {
  const box = document.getElementById('transactionLedgerContainer');
  if (!box) return;

  if (transactionLedger.length === 0) {
    box.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">暂无流水记录</p>`;
    return;
  }

  box.innerHTML = transactionLedger.map(item => `
    <div class="luxe-card p-3 flex items-center justify-between bg-white">
      <div>
        <h5 class="text-xs font-black text-slate-900">${item.title}</h5>
        <p class="text-[9px] text-slate-400 mt-0.5">${item.time} · 对方: ${item.targetName}</p>
      </div>
      <span class="text-xs font-black ${item.type === 'income' || item.type === 'recharge' ? 'text-emerald-600' : item.type === 'cashout' ? 'text-amber-600' : 'text-rose-600'}">
        ${item.type === 'income' || item.type === 'recharge' ? '+' : '-'}${item.amount.toLocaleString()} LUMA 币
      </span>
    </div>
  `).join('');
}

async function recordTransaction(title, type, amount, targetName, targetAvatar, targetTag) {
  const record = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title,
    type: type,
    amount: amount,
    targetName: targetName || '系统',
    targetAvatar: targetAvatar || '',
    targetTag: targetTag || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  transactionLedger.unshift(record);
  try {
    await api.db.create("app_ledger", record);
  } catch (e) {}

  const page = document.getElementById('walletPageView');
  if (page && !page.classList.contains('hidden')) {
    renderTransactionLedger();
  }
}
window.recordTransaction = recordTransaction;

async function handleCashOutAll() {
  if (revenueBalance <= 0) {
    api.ui.toast("暂无待提现收益");
    return;
  }

  const rev = revenueBalance;
  revenueBalance = 0;
  const rev1 = document.getElementById('liveRevenueAmount');
  const rev2 = document.getElementById('pageRevenueBalance');
  if (rev1) rev1.textContent = '0';
  if (rev2) rev2.textContent = '0';

  await recordTransaction("全额提现至小手机钱包", "cashout", rev, "小手机主系统");

  await api.db.create("app_wallet", { id: "vault_data", balance: 0 }).catch(() => {
    api.db.update("app_wallet", "vault_data", { balance: 0 }).catch(() => {});
  });

  api.ui.toast(`成功提现 ${rev} LUMA 币至小手机主钱包！`);
}
window.handleCashOutAll = handleCashOutAll;

function openPlayerLiveView() { 
  const p = document.getElementById('playerLiveRoomView');
  if (p) p.classList.remove('hidden'); 
}
window.openPlayerLiveView = openPlayerLiveView;

function closePlayerLiveView() { 
  const p = document.getElementById('playerLiveRoomView');
  if (p) p.classList.add('hidden'); 
}
window.closePlayerLiveView = closePlayerLiveView;

// API 设置与模型拉取
function handleApiTypeChange(type) {
  customApiConfig.apiType = type;
  const urlInput = document.getElementById('inputApiUrl');
  if (!urlInput) return;
  if (type === 'siliconflow') {
    urlInput.placeholder = '不填则默认 (https://api.siliconflow.cn/v1)';
    if (!customApiConfig.text.url || customApiConfig.text.url.includes('deepseek')) urlInput.value = '';
  } else if (type === 'deepseek') {
    urlInput.placeholder = '不填则默认 (https://api.deepseek.com/v1)';
    if (!customApiConfig.text.url || customApiConfig.text.url.includes('siliconflow')) urlInput.value = '';
  } else {
    urlInput.placeholder = 'https://api.example.com/v1';
  }
}
window.handleApiTypeChange = handleApiTypeChange;

function openCustomApiModal() {
  const sel = document.getElementById('selectApiType');
  if (sel) sel.value = customApiConfig.apiType || 'siliconflow';
  handleApiTypeChange(customApiConfig.apiType || 'siliconflow');
  const u = document.getElementById('inputApiUrl');
  const k = document.getElementById('inputApiKey');
  if (u) u.value = customApiConfig.text.url || '';
  if (k) k.value = customApiConfig.text.key || '';
  const m = document.getElementById('customApiModal');
  if (m) m.classList.remove('hidden');
}
window.openCustomApiModal = openCustomApiModal;

function closeCustomApiModal() { 
  const m = document.getElementById('customApiModal');
  if (m) m.classList.add('hidden'); 
}
window.closeCustomApiModal = closeCustomApiModal;

async function saveCustomApiSettingsModal() {
  const type = document.getElementById('selectApiType')?.value || 'siliconflow';
  let url = document.getElementById('inputApiUrl')?.value.trim() || '';
  
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }

  customApiConfig.apiType = type;
  customApiConfig.text.url = url;
  customApiConfig.text.key = document.getElementById('inputApiKey')?.value.trim() || '';
  customApiConfig.text.model = document.getElementById('selectApiModel')?.value || '';

  await saveDbSetting("api_config", customApiConfig);

  const st = document.getElementById('statusCustomApi');
  if (st) st.textContent = `已配置: ${customApiConfig.text.model || type}`;
  closeCustomApiModal();
  api.ui.toast("自定义文本 API 配置已保存！");
}
window.saveCustomApiSettingsModal = saveCustomApiSettingsModal;

function openCustomImageApiModal() {
  const u = document.getElementById('inputImageApiUrl');
  const k = document.getElementById('inputImageApiKey');
  const sel = document.getElementById('selectImageApiModel');
  if (u) u.value = customApiConfig.image.url || '';
  if (k) k.value = customApiConfig.image.key || '';
  if (sel) {
    const savedModel = customApiConfig.image.model || 'dall-e-3';
    if (![...sel.options].some(o => o.value === savedModel)) {
      sel.insertAdjacentHTML('beforeend', `<option value="${savedModel}">${savedModel}</option>`);
    }
    sel.value = savedModel;
  }
  const modal = document.getElementById('customImageApiModal');
  if (modal) modal.classList.remove('hidden');
}
window.openCustomImageApiModal = openCustomImageApiModal;

function closeCustomImageApiModal() { 
  const modal = document.getElementById('customImageApiModal');
  if (modal) modal.classList.add('hidden'); 
}
window.closeCustomImageApiModal = closeCustomImageApiModal;

async function saveCustomImageApiSettingsModal() {
  customApiConfig.image.url = document.getElementById('inputImageApiUrl')?.value.trim() || '';
  customApiConfig.image.key = document.getElementById('inputImageApiKey')?.value.trim() || '';
  customApiConfig.image.model = document.getElementById('selectImageApiModel')?.value.trim() || 'dall-e-3';

  await saveDbSetting("api_config", customApiConfig);

  const st = document.getElementById('statusCustomImageApi');
  if (st) st.textContent = customApiConfig.image.url ? `已配置: ${customApiConfig.image.model}` : '默认宿主';
  closeCustomImageApiModal();
  api.ui.toast("自定义生图 API 配置已保存！");
}
window.saveCustomImageApiSettingsModal = saveCustomImageApiSettingsModal;

async function fetchImageApiModels() {
  const url = document.getElementById('inputImageApiUrl')?.value.trim() || '';
  const key = document.getElementById('inputImageApiKey')?.value.trim() || '';
  if (!url) { api.ui.toast("请先输入生图 API URL"); return; }

  const endpoint = formatOpenAIEndpoint(url, 'models');
  api.ui.toast("正在拉取模型列表...");

  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'GET',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' }
    });

    let data = res.json || (res.text ? JSON.parse(res.text) : null);
    if (res.ok && data && data.data && Array.isArray(data.data)) {
      const select = document.getElementById('selectImageApiModel');
      const models = data.data.map(m => m.id).sort();
      if (select) {
        select.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('') || '<option value="dall-e-3">dall-e-3</option>';
        if (customApiConfig.image.model && models.includes(customApiConfig.image.model)) {
          select.value = customApiConfig.image.model;
        }
      }
      api.ui.toast(`成功拉取 ${models.length} 个模型！`);
    } else {
      api.ui.toast(`拉取失败: ${data?.error?.message || res.status}`);
    }
  } catch (e) {
    api.ui.toast(`连接异常: ${e.message}`);
  }
}
window.fetchImageApiModels = fetchImageApiModels;

// 全局开关切换（保持底层逻辑，对齐文案与 Toast 说明）
async function toggleGlobalModelSwitch(checked) {
  customApiConfig.enableGlobalModel = checked;
  await saveDbSetting("api_config", customApiConfig);
  api.ui.toast(checked ? "已启用全局文本API" : "已切换为自定义模型");
}
window.toggleGlobalModelSwitch = toggleGlobalModelSwitch;

async function toggleGlobalImageModelSwitch(checked) {
  customApiConfig.enableGlobalImageModel = checked;
  await saveDbSetting("api_config", customApiConfig);
  api.ui.toast(checked ? "已启用全局生图API" : "已切换为自定义生图模型");
}
window.toggleGlobalImageModelSwitch = toggleGlobalImageModelSwitch;

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

const CUSTOM_API_PRESET_TEMPLATES = {
  package: `你正在以【{{char}}】的身份进行直播推流与弹幕大包批处理生成。
补充上下文：{{instruction}}

# 生成任务与参数规则：
1. 生成主播的 3 句随性发言与过渡台词（包含微动作）。
2. 生成 15~20 条真实的观众弹幕（包含乐子人、黑粉、真爱粉、考据党、复读机）。
3. 如果当前决定结束直播，请在最后一句台词末尾附带动作标记 [动作:关闭直播]；若继续直播则严禁出现该标记。
4. 可根据情况让公屏或台词主动提及用户【{{user}}】。

# 输出格式（严格合法 JSON，不要输出任何多余文字）：
{"hostSpeeches":[{"speech":"台词内容1","action":"喝了口水"},{"speech":"台词内容2","action":"看了眼公屏"},{"speech":"台词内容3","action":"调整麦克风"}],"danmakus":[{"sender":"网友A","text":"弹幕内容","type":"fan"},{"sender":"网友B","text":"弹幕内容","type":"meme"},{"sender":"网友C","text":"弹幕内容","type":"troll"}]}`,

  reply: `你正在以【{{char}}】的身份进行直播，用户【{{user}}】刚刚有以下互动：{{instruction}}

# 规则准则：
1. 以主播身份立刻给出针对该用户的专属即时反馈（口语化短句，30~60字以内）。
2. 若你认为该下播了，请在回复最后加上动作标记 [动作:关闭直播]；否则严禁附带该标记。

# 输出格式（严格合法 JSON，不要输出任何多余文字）：
{"speech":"主播回复台词","emotion":"happy | shy | angry | surprised | neutral","action":"微动作描述"}`,

  trends: `根据主播【{{char}}】的直播情况生成 1 条热搜话题与切片总结。补充上下文：{{instruction}}

# 输出格式（严格合法 JSON，不要输出任何多余文字）：
{"tag":"#话题#","heat":"88w","category":"娱乐","summary":"50字以内总结","comments":[]}`,

  netizen: `用户评论了热搜：{{instruction}}
请以随机路人身份跟评一句话（带梗或吐槽）。

# 输出格式（严格合法 JSON，不要输出任何多余文字）：
{"user":"昵称","text":"内容"}`
};

function renderPresetTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? vars[k] : ''));
}

function getEffectivePresetTemplate(tagKey) {
  if (presetCategories[tagKey]?.entries?.length > 0) {
    return presetCategories[tagKey].entries.map(e => e.content).join('\n\n');
  }
  if (tagKey === 'package') {
    const danmakuContent = presetCategories['danmaku']?.entries?.map(e => e.content).join('\n') || '';
    const hostContent = presetCategories['host']?.entries?.map(e => e.content).join('\n') || '';
    return CUSTOM_API_PRESET_TEMPLATES['package'] + (danmakuContent ? `\n\n# 弹幕参考规则：\n${danmakuContent}` : '') + (hostContent ? `\n\n# 主播参考规则：\n${hostContent}` : '');
  }
  if (tagKey === 'reply') {
    if (presetCategories['host']?.entries?.length > 0) {
      return presetCategories['host'].entries.map(e => e.content).join('\n\n');
    }
  }
  return CUSTOM_API_PRESET_TEMPLATES[tagKey] || '';
}

async function aiGenerate(params) {
  const tagKey = (params.appTags || []).find(t => t !== 'live') || 'reply';
  const tpl = getEffectivePresetTemplate(tagKey);

  let charName = '主播';
  let persona = '';
  if (params.characterId) {
    const found = (window.allCharacters || []).find(c => c.id === params.characterId);
    if (found) charName = found.name;
    try {
      const full = await api.characters.get(params.characterId);
      persona = full?.persona || full?.description || '';
    } catch (e) {}
  }
  const userName = (typeof currentUser !== 'undefined' && currentUser?.name) || 'user';

  const filledInstruction = tpl
    ? renderPresetTemplate(tpl, { char: charName, user: userName, instruction: params.instruction || '' })
    : (params.instruction || '');

  if (customApiConfig.enableGlobalModel) {
    return api.ai.generate({
      ...params,
      instruction: filledInstruction
    });
  }

  const type = customApiConfig.apiType || 'siliconflow';
  let url = customApiConfig.text.url || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    else if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = customApiConfig.text.key || '';
  const model = customApiConfig.text.model || 'gpt-3.5-turbo';
  if (!url) throw new Error('自定义文本API未配置地址');

  const systemPrompt = persona
    ? `你正在扮演角色【${charName}】。\n角色设定：${persona}`
    : `你正在扮演角色【${charName}】。`;

  const endpoint = formatOpenAIEndpoint(url, 'chat');
  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: filledInstruction }], temperature: 0.9 }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const text = data?.choices?.[0]?.message?.content;
    if (!res.ok || !text) throw new Error(`自定义API请求失败: ${data?.error?.message || res.status}`);
    return { text };
  } catch (e) {
    throw e;
  }
}
window.aiGenerate = aiGenerate;

async function aiGenerateImage(params) {
  let promptText = params.prompt || '';
  if (imageSettings?.prompts?.length > 0) {
    const promptModifiers = imageSettings.prompts
      .map(p => p.content?.trim())
      .filter(Boolean)
      .join(', ');
    if (promptModifiers) {
      promptText = `${promptText}, ${promptModifiers}`;
    }
  }

  if (customApiConfig.enableGlobalImageModel) {
    return api.ai.generateImage({
      ...params,
      prompt: promptText
    });
  }

  const url = customApiConfig.image.url || '';
  const key = customApiConfig.image.key || '';
  const model = customApiConfig.image.model || 'dall-e-3';
  if (!url) throw new Error('自定义生图API未配置地址');

  const endpoint = formatOpenAIEndpoint(url, 'images');
  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, prompt: promptText, n: 1, size: imageSettings.size === '9:16' ? '1024x1792' : (imageSettings.size === '16:9' ? '1792x1024' : '1024x1024'), quality: imageSettings.quality || 'standard' }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const item = data?.data?.[0];
    if (res.ok && item?.url) return { dataUrl: item.url };
    if (res.ok && item?.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}` };
    throw new Error(`自定义生图API请求失败: ${data?.error?.message || res.status}`);
  } catch (e) {
    throw e;
  }
}
window.aiGenerateImage = aiGenerateImage;

async function robustNetworkRequest(options) {
  try {
    const res = await api.network.fetch({
      url: options.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      proxy: true,
      timeoutMs: 20000
    });
    if (res && (res.ok || res.status)) return res;
  } catch (e) {}

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

async function fetchOpenAIModels() {
  const type = document.getElementById('selectApiType')?.value || 'siliconflow';
  let url = document.getElementById('inputApiUrl')?.value.trim() || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = document.getElementById('inputApiKey')?.value.trim() || '';
  if (!url) { api.ui.toast("请先输入 API Base URL"); return; }

  const endpoint = formatOpenAIEndpoint(url, 'models');
  api.ui.toast("正在拉取模型列表...");

  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'GET',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' }
    });

    let data = res.json || (res.text ? JSON.parse(res.text) : null);
    if (res.ok && data && data.data && Array.isArray(data.data)) {
      const select = document.getElementById('selectApiModel');
      const models = data.data.map(m => m.id).sort();
      if (select) {
        select.innerHTML = '<option value="">默认模型</option>' + models.map(m => `
          <option value="${m}" ${m === customApiConfig.text.model ? 'selected' : ''}>${m}</option>
        `).join('');

        if (!customApiConfig.text.model && models.length > 0) {
          select.value = models[0];
          customApiConfig.text.model = models[0];
        }
      }
      api.ui.toast(`成功拉取 ${models.length} 个模型！`);
    } else {
      api.ui.toast(`拉取失败: ${data?.error?.message || res.status}`);
    }
  } catch (e) {
    api.ui.toast(`连接异常: ${e.message}`);
  }
}
window.fetchOpenAIModels = fetchOpenAIModels;

async function testCustomApiConnection() {
  const type = document.getElementById('selectApiType')?.value || 'siliconflow';
  let url = document.getElementById('inputApiUrl')?.value.trim() || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = document.getElementById('inputApiKey')?.value.trim() || '';
  const model = document.getElementById('selectApiModel')?.value || 'gpt-3.5-turbo';
  if (!url) { api.ui.toast("请先输入 API Base URL"); return; }

  const endpoint = formatOpenAIEndpoint(url, 'chat');
  api.ui.toast("正在测试连通性...");

  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }
    });
    if (res.ok) {
      api.ui.toast(`测试通过！模型【${model}】连接正常！`);
    } else {
      api.ui.toast(`失败: HTTP ${res.status}`);
    }
  } catch (e) {
    api.ui.toast(`连接失败: ${e.message}`);
  }
}
window.testCustomApiConnection = testCustomApiConnection;

async function testCustomImageApiConnection() {
  const url = document.getElementById('inputImageApiUrl')?.value.trim() || 'https://api.openai.com/v1';
  const key = document.getElementById('inputImageApiKey')?.value.trim() || '';
  const model = document.getElementById('selectImageApiModel')?.value.trim() || 'dall-e-3';

  const endpoint = formatOpenAIEndpoint(url, 'images');
  api.ui.toast("正在测试生图连通性...");

  try {
    const res = await robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, prompt: 'ping test', n: 1, size: '1024x1024' }
    });
    if (res.ok) {
      api.ui.toast("生图测试通过！");
    } else {
      api.ui.toast(`失败: HTTP ${res.status}`);
    }
  } catch (e) {
    api.ui.toast(`生图异常: ${e.message}`);
  }
}
window.testCustomImageApiConnection = testCustomImageApiConnection;

// 文件导入导出
function downloadJsonFile(objData, fileName) {
  const jsonStr = JSON.stringify(objData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  api.ui.toast(`${fileName} 已触发下载！`);
}

function exportAppDataFile() {
  const appData = {
    profile: userProfileData,
    guestbook: guestbookData,
    revenue: revenueBalance,
    ledger: transactionLedger,
    params: appParams,
    apiConfig: customApiConfig,
    imageSettings: imageSettings,
    exportTime: new Date().toISOString()
  };
  downloadJsonFile(appData, `LUMA_RunningData_${Date.now()}.json`);
}
window.exportAppDataFile = exportAppDataFile;

function triggerImportAppDataFile() { 
  const el = document.getElementById('fileInputData');
  if (el) el.click(); 
}
window.triggerImportAppDataFile = triggerImportAppDataFile;

function handleFileImportData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.profile) userProfileData = data.profile;
      if (data.guestbook) guestbookData = data.guestbook;
      if (data.revenue !== undefined) revenueBalance = data.revenue;
      if (data.ledger) transactionLedger = data.ledger;
      if (data.params) appParams = data.params;
      if (data.apiConfig) customApiConfig = data.apiConfig;
      if (data.imageSettings) imageSettings = data.imageSettings;

      const revEl = document.getElementById('liveRevenueAmount');
      if (revEl) revEl.textContent = revenueBalance.toLocaleString();
      renderImagePromptEntries();
      renderDualRankList();
      renderParamsToUI();
      api.ui.toast("运行数据已全量导入生效！");
    } catch (err) {
      api.ui.toast("导入失败，JSON 格式错误");
    }
  };
  reader.readAsText(file);
}
window.handleFileImportData = handleFileImportData;

function exportPresetsDataFile() { downloadJsonFile(presetCategories, `LUMA_Presets_${Date.now()}.json`); }
window.exportPresetsDataFile = exportPresetsDataFile;

function triggerImportPresetsDataFile() { 
  const el = document.getElementById('fileInputPresets');
  if (el) el.click(); 
}
window.triggerImportPresetsDataFile = triggerImportPresetsDataFile;

async function handleFileImportPresets(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      presetCategories = JSON.parse(e.target.result);
      window.presetCategories = presetCategories;
      await saveDbSetting("presets_config", { categories: presetCategories });
      renderPresetCategoryList();
      api.ui.toast("提示词预设导入并保存生效！");
    } catch (err) { api.ui.toast("格式错误"); }
  };
  reader.readAsText(file);
}
window.handleFileImportPresets = handleFileImportPresets;

// 生图参数（需显式点击“保存生图设置”后生效）
function handleImageSizeChange(val) {
  imageSettings.size = val;
  const ratioEntry = imageSettings.prompts.find(p => p.id === 'ratio_prompt');
  if (ratioEntry) {
    if (val === '1:1') ratioEntry.content = '正方形 1:1 构图，square 1:1 composition';
    else if (val === '9:16') ratioEntry.content = '竖屏 9:16 构图，portrait 9:16 composition';
    else if (val === '16:9') ratioEntry.content = '横屏 16:9 构图，landscape 16:9 composition';
  }
  renderImagePromptEntries();
  api.ui.toast(`已切换比例：${val}（请点击下方保存）`);
}
window.handleImageSizeChange = handleImageSizeChange;

function handleImageQualityChange(val) {
  imageSettings.quality = val;
  api.ui.toast(`已切换质量：${val}（请点击下方保存）`);
}
window.handleImageQualityChange = handleImageQualityChange;

function renderImagePromptEntries() {
  const box = document.getElementById('imagePromptEntriesContainer');
  if (!box) return;
  box.innerHTML = imageSettings.prompts.map((entry, idx) => `
    <div class="luxe-card p-2.5 bg-white space-y-1.5 border border-slate-100">
      <div class="flex justify-between items-center">
        <input value="${entry.title}" oninput="imageSettings.prompts[${idx}].title = this.value;" class="input-ins !py-1 text-xs font-bold w-1/2">
        ${entry.id !== 'ratio_prompt' ? `<button onclick="deleteImagePromptEntry(${idx})" class="text-[10px] text-rose-500 font-bold">删除</button>` : '<span class="text-[9px] text-slate-400">尺寸联动</span>'}
      </div>
      <textarea oninput="imageSettings.prompts[${idx}].content = this.value;" rows="2" class="input-ins !p-1.5 text-xs leading-relaxed">${entry.content}</textarea>
    </div>
  `).join('');
}

function addNewImagePromptEntry() {
  imageSettings.prompts.push({ id: `img_p_${Date.now()}`, title: `画风修饰词 ${imageSettings.prompts.length}`, content: 'masterpiece, best quality' });
  renderImagePromptEntries();
}
window.addNewImagePromptEntry = addNewImagePromptEntry;

function deleteImagePromptEntry(idx) {
  imageSettings.prompts.splice(idx, 1);
  renderImagePromptEntries();
}
window.deleteImagePromptEntry = deleteImagePromptEntry;

async function saveImageSettingsExplicitly() {
  await saveDbSetting("image_settings", imageSettings);
  api.ui.toast("生图参数与提示词已成功保存！");
}
window.saveImageSettingsExplicitly = saveImageSettingsExplicitly;

// 预设分类编辑（只有点击保存按钮才持久化入库，取消则还原）
let activeCategoryBackup = null;

function renderPresetCategoryList() {
  const box = document.getElementById('presetCategoryList');
  if (!box) return;
  box.innerHTML = Object.keys(presetCategories).map(key => `
    <div onclick="openPresetCategoryModal('${key}')" class="luxe-card p-3 flex items-center justify-between cursor-pointer active:scale-98 transition bg-white">
      <div>
        <h5 class="text-xs font-black text-slate-800">${presetCategories[key].name}</h5>
        <p class="text-[9px] text-slate-400">${presetCategories[key].desc}</p>
      </div>
      <span class="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">${presetCategories[key].entries.length} 条目 ›</span>
    </div>
  `).join('');
}

function openPresetCategoryModal(key) {
  currentEditingCategoryKey = key;
  activeCategoryBackup = JSON.parse(JSON.stringify(presetCategories[key]));
  const titleEl = document.getElementById('presetModalCategoryTitle');
  if (titleEl) titleEl.textContent = presetCategories[key].name;
  renderPromptEntries();
  const modal = document.getElementById('presetCategoryModal');
  if (modal) modal.classList.remove('hidden');
}
window.openPresetCategoryModal = openPresetCategoryModal;

function closePresetCategoryModal() {
  if (activeCategoryBackup && currentEditingCategoryKey && presetCategories[currentEditingCategoryKey]) {
    presetCategories[currentEditingCategoryKey] = activeCategoryBackup;
    activeCategoryBackup = null;
  }
  const modal = document.getElementById('presetCategoryModal');
  if (modal) modal.classList.add('hidden'); 
}
window.closePresetCategoryModal = closePresetCategoryModal;

function renderPromptEntries() {
  const box = document.getElementById('promptEntriesContainer');
  if (!box) return;
  const entries = presetCategories[currentEditingCategoryKey].entries;
  box.innerHTML = entries.map((entry, idx) => `
    <div class="prompt-entry-card open" id="promptCard_${idx}">
      <div class="prompt-entry-header" onclick="const p = document.getElementById('promptCard_${idx}'); if(p) p.classList.toggle('open');">
        <div class="flex items-center gap-2">
          <span class="prompt-entry-arrow">▶</span>
          <span class="text-xs font-bold text-slate-800" id="titleText_${idx}">${entry.title}</span>
        </div>
        <button onclick="deletePromptEntry(${idx}, event)" class="text-[10px] text-rose-500 font-bold px-1.5 py-0.5">删除</button>
      </div>
      <div class="prompt-entry-body space-y-2">
        <input value="${entry.title}" oninput="presetCategories[currentEditingCategoryKey].entries[${idx}].title = this.value; const t = document.getElementById('titleText_${idx}'); if(t) t.textContent = this.value" class="input-ins !p-1.5 text-xs font-bold">
        <textarea oninput="presetCategories[currentEditingCategoryKey].entries[${idx}].content = this.value" rows="4" class="input-ins !p-2 text-xs leading-relaxed">${entry.content}</textarea>
      </div>
    </div>
  `).join('');
}

function addNewPromptEntryToCurrentCategory() {
  presetCategories[currentEditingCategoryKey].entries.push({ id: `e_${Date.now()}`, title: `自定义条目`, content: '提示词内容...' });
  renderPromptEntries();
}
window.addNewPromptEntryToCurrentCategory = addNewPromptEntryToCurrentCategory;

function deletePromptEntry(idx, e) {
  if (e) e.stopPropagation();
  if (presetCategories[currentEditingCategoryKey].entries.length <= 1) { api.ui.toast("至少保留一个条目"); return; }
  presetCategories[currentEditingCategoryKey].entries.splice(idx, 1);
  renderPromptEntries();
}
window.deletePromptEntry = deletePromptEntry;

async function saveCurrentCategoryPresets() {
  activeCategoryBackup = null;
  await saveDbSetting("presets_config", { categories: presetCategories });
  const modal = document.getElementById('presetCategoryModal');
  if (modal) modal.classList.add('hidden');
  renderPresetCategoryList();
  api.ui.toast("预设提示词已成功保存！");
}
window.saveCurrentCategoryPresets = saveCurrentCategoryPresets;

// 主播档案与微博个人主页管理器 (粉丝数与直播场数强相关联动体系)
let streamerProfilesMap = {};
let currentViewingProfile = null;
let activeSpTab = 'posts';

// 人设模板池（用于根据角色名字、分类、人设智能匹配个性签名、标签、微博博文）
const STREAMER_PERSONA_PRESETS = [
  {
    keywords: ['歌', '音乐', '唱', '音', '曲', '乐'],
    bio: '心怀旷野，在直播间弹琴唱歌给你听。商务合作/演出请私信联系经纪人~ 🎧',
    category: '音乐主唱',
    tags: ['#原创音乐人', '#治愈系弹唱', '#深夜电台', '#声优大V'],
    fanClub: '星光守护团',
    posts: [
      { text: '练琴练到现在，今晚准备给你们唱首新歌，记得带好耳机哦~ 🌙', likes: 1240, comments: 88, forwards: 15, time: '2小时前' },
      { text: '感谢今天直播间所有守护榜的大哥和宝子们！破百万人气啦，爱你们！🎸✨', likes: 3560, comments: 230, forwards: 42, time: '昨天 23:40' },
      { text: '买到了心心念念的复古吉他，手感绝了，下次开播给你们展示！', likes: 980, comments: 45, forwards: 8, time: '3天前' }
    ]
  },
  {
    keywords: ['电竞', '游', '玩', '战', '王者', '吃鸡', '原神', '二次元', '宅'],
    bio: '峡谷百星野王 / 技术流游戏少女。每天固定晚8点带粉上分，不鸽！🎮',
    category: '电竞高玩',
    tags: ['#王者百星', '#硬核技术流', '#单排冲国服', '#下饭日常'],
    fanClub: '极客特战队',
    posts: [
      { text: '今天单排20连胜！谁说女生打野带不起节奏的，出来挨夸！🔥', likes: 2890, comments: 194, forwards: 35, time: '3小时前' },
      { text: '下播吃夜宵啦！今天直播间谁送的至尊摩天轮，私信我领专属水友车队车票~ 🚗', likes: 4120, comments: 310, forwards: 58, time: '昨天 01:15' },
      { text: '新赛季战令皮肤好帅，今晚8点直播间抽5个宝子送！', likes: 1650, comments: 120, forwards: 22, time: '2天前' }
    ]
  },
  {
    keywords: ['搞笑', '脱口秀', '话痨', '聊', '幽默', '逗'],
    bio: '全网最严肃的搞笑主播。进来聊天不要喝水，呛到了我不赔！🍉',
    category: '娱乐脱口秀',
    tags: ['#搞笑博主', '#人间清醒', '#连麦整活', '#段子手'],
    fanClub: '快乐制造局',
    posts: [
      { text: '今天出门被粉丝认出来了，TA第一句话居然是：“主播你怎么比直播间矮？”，我当场裂开！', likes: 5890, comments: 620, forwards: 140, time: '1小时前' },
      { text: '今晚连麦PK，家人们准备好灯牌，输了的要去大街上深情唱《孤勇者》！', likes: 3200, comments: 280, forwards: 76, time: '昨天 19:20' }
    ]
  },
  {
    keywords: ['舞', '才艺', '美', '仙', '古风', '雅'],
    bio: '一袭清欢，舞动人间烟火。LUMA年度舞蹈赛道十佳主播。✨',
    category: '舞蹈艺术',
    tags: ['#国风舞蹈', '#古典舞', '#仙气飘飘', '#年度十佳'],
    fanClub: '青鸾阁',
    posts: [
      { text: '新排的古风水袖舞《青玉案》，大家今晚直播间想看哪一套汉服呢？🌸', likes: 4520, comments: 360, forwards: 89, time: '4小时前' },
      { text: '晨练打卡，保持最好的体态见你们。早安大家！', likes: 2100, comments: 95, forwards: 12, time: '昨天 08:30' }
    ]
  },
  {
    keywords: ['默认', '主播'],
    bio: '记录真实生活，与你分享每一次开播的温柔与心动。💛',
    category: '签约大V',
    tags: ['#生活日常', '#治愈互动', '#签约主播', '#真诚分享'],
    fanClub: '星光守护团',
    posts: [
      { text: '今天天气特别好，出门抓拍了几张风景，晚上开播跟你们慢慢聊~ 📷', likes: 1580, comments: 92, forwards: 18, time: '2小时前' },
      { text: '感谢每一次相遇与陪伴，直播间有你们在真的很温暖。', likes: 3890, comments: 240, forwards: 60, time: '前天 22:10' }
    ]
  }
];

function getOrGenerateStreamerProfile(characterId, characterObj) {
  if (!characterId) return null;
  if (streamerProfilesMap[characterId]) {
    return streamerProfilesMap[characterId];
  }
  const idStr = String(characterId || 'char_01');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) hash += idStr.charCodeAt(i) * (i + 13);
  
  // 1. 直播场数设定 (35 ~ 380 场，与粉丝数核心强绑定)
  const totalShows = (characterObj && characterObj.totalShows) ? Number(characterObj.totalShows) : (38 + (hash % 290));
  
  // 2. 粉丝数算法：强绑定直播场数！
  // 基础粉丝量 = 直播场数 * 每场吸粉系数(320 ~ 780) + 初始热度加成
  const avgFansPerShow = 360 + (hash % 420);
  const baseFans = totalShows * avgFansPerShow + 2400 + (hash % 5000);
  
  // 3. 关注数与获赞数
  const followCount = 28 + (hash % 150);
  const likesCount = Math.floor(baseFans * (3.8 + (hash % 5) * 0.8));
  
  // 4. IP 属地与入驻天数
  const ipList = ['广东', '上海', '北京', '浙江', '四川', '江苏', '山东', '湖北', '东京', '首尔'];
  const ipLocation = ipList[hash % ipList.length];
  const joinDays = Math.max(30, Math.floor(totalShows * 1.6 + (hash % 60)));
  
  // 5. 人设匹配
  const charName = characterObj?.name || '主播';
  const charDesc = characterObj?.description || characterObj?.persona || characterObj?.category || '';
  const fullText = `${charName} ${charDesc}`;
  
  let matchedPreset = STREAMER_PERSONA_PRESETS[STREAMER_PERSONA_PRESETS.length - 1];
  for (let p of STREAMER_PERSONA_PRESETS) {
    if (p.keywords.some(k => fullText.includes(k))) {
      matchedPreset = p;
      break;
    }
  }
  
  const bio = (characterObj && characterObj.bio) ? characterObj.bio : matchedPreset.bio;
  const category = (characterObj && (characterObj.subTag || characterObj.category)) ? (characterObj.subTag || characterObj.category) : matchedPreset.category;
  const tags = matchedPreset.tags;
  const fanClubName = matchedPreset.fanClub;
  const verifyTitle = `LUMA 平台年度认证大V主播 · ${category}`;
  
  // 6. 动态博文生成
  const posts = matchedPreset.posts.map((item, idx) => ({
    id: `post_${characterId}_${idx}`,
    text: item.text,
    likes: item.likes,
    comments: item.comments,
    forwards: item.forwards,
    time: item.time,
    userLikes: false
  }));
  
  // 7. 直播历史场次记录生成 (根据 totalShows)
  const showsHistory = [];
  const titlesPool = [
    `深夜治愈弹唱会 · 唱给每一个未眠的你`,
    `冲国服巅峰赛！带粉车队极速发车`,
    `聊天互动碎碎念 · 聊聊最近发生的好玩事`,
    `开箱测评与好物分享专场`,
    `粉丝专属连麦PK！输了有惩罚哦`,
    `早安元气电台 · 开启美好的一天`
  ];
  for (let i = 0; i < Math.min(8, totalShows); i++) {
    const showNum = totalShows - i;
    const durMins = 90 + ((hash + i * 27) % 150);
    const h = Math.floor(durMins / 60);
    const m = durMins % 60;
    showsHistory.push({
      showNumber: showNum,
      title: `第 ${showNum} 场 · ${titlesPool[(hash + i) % titlesPool.length]}`,
      duration: `${h}小时${m}分`,
      heat: ((hash * 13 + i * 1500) % 65000 + 25000).toLocaleString(),
      newFans: `+${300 + ((hash + i * 17) % 450)} 粉丝`,
      timeAgo: `${i === 0 ? '刚刚' : (i === 1 ? '昨天' : `${i + 1}天前`)}`
    });
  }
  
  // 8. 高清相册
  const cover = characterObj?.cover || characterObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
  const avatar = characterObj?.avatar || cover;
  const gallery = [cover, avatar, cover, avatar, cover, avatar];
  
  const profile = {
    characterId,
    name: charName,
    avatar,
    cover,
    vip: characterObj?.vip || `VIP ${8 + (hash % 3)}`,
    totalShows,
    baseFans,
    avgFansPerShow,
    followCount,
    likesCount,
    bio,
    category,
    tags,
    fanClubName,
    verifyTitle,
    ipLocation,
    joinDays,
    posts,
    showsHistory,
    gallery
  };
  
  streamerProfilesMap[characterId] = profile;
  return profile;
}
window.getOrGenerateStreamerProfile = getOrGenerateStreamerProfile;

// 主播基础粉丝动态统一计算 (由直播场次体系决定)
function getHostBaseFans(characterId, room) {
  const prof = getOrGenerateStreamerProfile(characterId, room);
  return prof ? prof.baseFans : 12800;
}
window.getHostBaseFans = getHostBaseFans;

// 增量直播场次接口 (每次开播/结算自动场次 +1，粉丝量动态增加)
function incrementStreamerLiveShow(characterId) {
  const profile = getOrGenerateStreamerProfile(characterId);
  if (profile) {
    profile.totalShows += 1;
    const newGain = Math.floor(profile.avgFansPerShow * (0.8 + Math.random() * 0.4));
    profile.baseFans += newGain;
    profile.likesCount += Math.floor(newGain * 4.5);
    profile.showsHistory.unshift({
      showNumber: profile.totalShows,
      title: `第 ${profile.totalShows} 场 · 精彩互动专场`,
      duration: '1小时45分',
      heat: (45000 + Math.floor(Math.random() * 20000)).toLocaleString(),
      newFans: `+${newGain} 粉丝`,
      timeAgo: '刚刚'
    });
    if (currentViewingProfile && currentViewingProfile.characterId === characterId) {
      renderStreamerProfileToUI(profile);
    }
    if (typeof updateLiveRoomHostFansDisplay === 'function') {
      updateLiveRoomHostFansDisplay();
    }
  }
}
window.incrementStreamerLiveShow = incrementStreamerLiveShow;

// 打开主播微博风格个人主页
function openStreamerProfilePage(id) {
  let charObj = (window.allCharacters || []).find(c => c.id === id) || (window.liveList || []).find(s => s.characterId === id || s.id === id);
  if (!charObj && id) {
    charObj = { id, name: '主播', avatar: '' };
  }
  if (!charObj) return;

  const profile = getOrGenerateStreamerProfile(charObj.id || charObj.characterId || id, charObj);
  if (!profile) return;
  
  currentViewingProfile = profile;
  activeSpaceHost = charObj;

  renderStreamerProfileToUI(profile);

  const page = document.getElementById('streamerProfilePageView');
  if (page) page.classList.add('open');
}
window.openStreamerProfilePage = openStreamerProfilePage;
window.openStreamerSpace = openStreamerProfilePage; // 兼容旧接口

function closeStreamerProfilePage() {
  const page = document.getElementById('streamerProfilePageView');
  if (page) page.classList.remove('open');
  currentViewingProfile = null;
}
window.closeStreamerProfilePage = closeStreamerProfilePage;
window.closeStreamerSpace = closeStreamerProfilePage;

function renderStreamerProfileToUI(p) {
  // 封面与头像
  const coverEl = document.getElementById('spCoverImg');
  const avatarEl = document.getElementById('spAvatar');
  if (coverEl) coverEl.src = p.cover;
  if (avatarEl) avatarEl.src = p.avatar;

  // 基础名字与头衔
  const nameEl = document.getElementById('spName');
  const vipEl = document.getElementById('spVipTag');
  const catEl = document.getElementById('spCategoryBadge');
  const verifyEl = document.getElementById('spVerifyTitle');
  if (nameEl) nameEl.textContent = p.name;
  if (vipEl) vipEl.textContent = p.vip;
  if (catEl) catEl.textContent = p.category;
  if (verifyEl) verifyEl.textContent = p.verifyTitle;

  // 核心数据 (粉丝数与直播场数强绑定)
  const isFollowed = (window.followedHosts || []).includes(p.characterId);
  const totalFans = p.baseFans + (isFollowed ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  const showsEl = document.getElementById('spLiveShowsCount');
  const followEl = document.getElementById('spFollowCount');
  const likesEl = document.getElementById('spLikesCount');

  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();
  if (showsEl) showsEl.textContent = `${p.totalShows} 场`;
  if (followEl) followEl.textContent = p.followCount;
  if (likesEl) likesEl.textContent = p.likesCount >= 10000 ? (p.likesCount / 10000).toFixed(1) + '万' : p.likesCount.toLocaleString();

  // 个签与基本信息
  const bioEl = document.getElementById('spBioText');
  const ipEl = document.getElementById('spIpLocation');
  const joinEl = document.getElementById('spJoinDays');
  const clubEl = document.getElementById('spFanClubName');
  if (bioEl) bioEl.textContent = p.bio;
  if (ipEl) ipEl.textContent = `IP属地: ${p.ipLocation}`;
  if (joinEl) joinEl.textContent = `入驻 ${p.joinDays} 天`;
  if (clubEl) clubEl.textContent = `粉丝团: ${p.fanClubName}`;

  // 标签 Tags
  const tagsBox = document.getElementById('spTagsContainer');
  if (tagsBox) {
    tagsBox.innerHTML = (p.tags || []).map(t => `<span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">${t}</span>`).join('');
  }

  // 关注按钮状态
  updateSpFollowBtnState();

  // 是否当前在直播 (动态展示直达直播间按钮)
  const isLive = (window.liveList || []).some(l => (l.characterId === p.characterId || l.id === p.characterId) && l.isLive !== false);
  const goLiveBtn = document.getElementById('spBtnGoLiveRoom');
  if (goLiveBtn) {
    if (isLive) goLiveBtn.classList.remove('hidden');
    else goLiveBtn.classList.add('hidden');
  }

  // 渲染 Tab 内容
  switchSpTab(activeSpTab);
}

function updateSpFollowBtnState() {
  if (!currentViewingProfile) return;
  const isFollowed = (window.followedHosts || []).includes(currentViewingProfile.characterId);
  const btn = document.getElementById('spBtnFollow');
  const txt = document.getElementById('spFollowBtnText');
  if (btn && txt) {
    if (isFollowed) {
      btn.className = "px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 active:scale-95 transition flex items-center gap-1";
      txt.textContent = "已关注";
      btn.querySelector('svg').classList.add('hidden');
    } else {
      btn.className = "px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm active:scale-95 transition flex items-center gap-1";
      txt.textContent = "关注";
      btn.querySelector('svg').classList.remove('hidden');
    }
  }
}

async function spToggleFollow() {
  if (!currentViewingProfile) return;
  const charId = currentViewingProfile.characterId;
  const isFollowed = (window.followedHosts || []).includes(charId);

  if (isFollowed) {
    window.followedHosts = (window.followedHosts || []).filter(id => id !== charId);
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
  } else {
    if (!window.followedHosts.includes(charId)) {
      window.followedHosts.push(charId);
    }
    await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
    api.ui.toast("关注成功！");
  }

  updateSpFollowBtnState();
  if (typeof updateLiveRoomHostFansDisplay === 'function') {
    updateLiveRoomHostFansDisplay();
  }

  // 更新个人主页粉丝数
  const totalFans = currentViewingProfile.baseFans + ((window.followedHosts || []).includes(charId) ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();

  // 同步用户中心的我的关注
  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = window.followedHosts.length;
}
window.spToggleFollow = spToggleFollow;

function switchSpTab(tab) {
  activeSpTab = tab;
  const tabs = ['posts', 'shows', 'gallery', 'guestbook'];
  tabs.forEach(t => {
    const tabEl = document.getElementById(`spTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panelEl = document.getElementById(`spPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (tabEl) {
      if (t === tab) tabEl.classList.add('active');
      else tabEl.classList.remove('active');
    }
    if (panelEl) {
      if (t === tab) panelEl.classList.remove('hidden');
      else panelEl.classList.add('hidden');
    }
  });

  if (!currentViewingProfile) return;

  if (tab === 'posts') renderSpPosts();
  else if (tab === 'shows') renderSpShows();
  else if (tab === 'gallery') renderSpGallery();
  else if (tab === 'guestbook') renderSpGuestbook();
}
window.switchSpTab = switchSpTab;

function renderSpPosts() {
  const box = document.getElementById('spPanelPosts');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;
  
  box.innerHTML = p.posts.map(post => `
    <div class="weibo-post-card">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2.5">
          <img src="${p.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-100">
          <div>
            <div class="flex items-center gap-1">
              <span class="text-xs font-black text-slate-900">${p.name}</span>
              <span class="w-3 h-3 rounded-full bg-amber-400 text-slate-950 font-black text-[7px] flex items-center justify-center">V</span>
            </div>
            <span class="text-[9px] text-slate-400 font-medium">${post.time} · 来自 iPhone 16 Pro</span>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-800 leading-relaxed font-normal">${post.text}</p>

      <div class="flex items-center justify-between border-t border-slate-100 mt-3 pt-2.5">
        <div class="weibo-action-btn" onclick="api.ui.toast('转发功能已模拟')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span>${post.forwards}</span>
        </div>
        <div class="weibo-action-btn" onclick="api.ui.toast('评论区已展开')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>${post.comments}</span>
        </div>
        <div class="weibo-action-btn ${post.userLikes ? 'liked' : ''}" onclick="spLikePost('${post.id}')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          <span>${post.likes}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function spLikePost(postId) {
  if (!currentViewingProfile) return;
  const post = currentViewingProfile.posts.find(p => p.id === postId);
  if (!post) return;
  post.userLikes = !post.userLikes;
  post.likes += post.userLikes ? 1 : -1;
  renderSpPosts();
}
window.spLikePost = spLikePost;

function renderSpShows() {
  const box = document.getElementById('spPanelShows');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;

  box.innerHTML = `
    <div class="bg-gradient-to-r from-rose-500 to-pink-500 p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between mb-3">
      <div>
        <span class="text-[10px] text-white/80 font-bold">历史开播总览</span>
        <div class="text-base font-black mt-0.5">累计直播 ${p.totalShows} 场</div>
      </div>
      <div class="text-right">
        <span class="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">场均增粉 +${p.avgFansPerShow}</span>
      </div>
    </div>
    <div class="space-y-2.5">
      ${p.showsHistory.map(s => `
        <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <h4 class="text-xs font-bold text-slate-900">${s.title}</h4>
            <div class="flex items-center gap-2 text-[10px] text-slate-400">
              <span>时长: ${s.duration}</span>
              <span>·</span>
              <span>人气: ${s.heat}</span>
              <span>·</span>
              <span class="text-rose-500 font-bold">${s.newFans}</span>
            </div>
          </div>
          <span class="text-[9px] text-slate-400 font-medium">${s.timeAgo}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSpGallery() {
  const box = document.getElementById('spPanelGallery');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;
  
  box.innerHTML = `
    <div class="gallery-grid-3">
      ${p.gallery.map(img => `
        <img src="${img}" onclick="api.ui.toast('已查看高清大图')" class="rounded-xl shadow-xs">
      `).join('')}
    </div>
  `;
}

function renderSpGuestbook() {
  const box = document.getElementById('spaceGuestbookList');
  if (!box || !currentViewingProfile) return;
  const list = guestbookData[currentViewingProfile.characterId] || [];
  box.innerHTML = list.length === 0 ? '<p class="text-[11px] text-slate-400 py-3 text-center">暂无留言，快来给主播抢个沙发吧~</p>' : list.map(m => `
    <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
      <div class="flex justify-between text-[10px]">
        <span class="font-bold text-slate-900">${m.user}</span>
        <span class="text-slate-400">${m.time || '刚刚'}</span>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed">${m.text}</p>
      ${m.reply ? `<div class="mt-2 p-2 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-800"><strong>主播回复：</strong>${m.reply}</div>` : ''}
    </div>
  `).join('');
}

async function submitGuestbookComment() {
  const input = document.getElementById('inputSpaceComment');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !currentViewingProfile) return;

  const hostId = currentViewingProfile.characterId;
  if (!guestbookData[hostId]) guestbookData[hostId] = [];
  const item = {
    id: `gb_${Date.now()}`,
    hostId: hostId,
    user: currentUser.name,
    text: val,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reply: null
  };
  guestbookData[hostId].unshift(item);
  input.value = '';

  const rate = (appParams.guestbookRate !== undefined ? appParams.guestbookRate : 75) / 100;
  if (Math.random() < rate) {
    try {
      const res = await api.ai.generate({
        characterId: hostId,
        instruction: `粉丝【${currentUser.name}】在你的主页留言：“${val}”。请以你的角色人设简短温馨回复一句。`
      });
      item.reply = res.text;
    } catch (e) {}
  }
  renderSpGuestbook();
  try { await api.db.create("guestbook", item); } catch (e) {}
}
window.submitGuestbookComment = submitGuestbookComment;

function spEnterLiveRoom() {
  if (!currentViewingProfile) return;
  const live = (window.liveList || []).find(l => l.characterId === currentViewingProfile.characterId || l.id === currentViewingProfile.characterId);
  if (live && typeof openLiveRoom === 'function') {
    closeStreamerProfilePage();
    openLiveRoom(live.id);
  } else {
    api.ui.toast("主播当前不在直播中");
  }
}
window.spEnterLiveRoom = spEnterLiveRoom;

function spOpenPrivateChat() {
  if (!currentViewingProfile) return;
  api.ui.toast(`已向【${currentViewingProfile.name}】发送私信招呼`);
}
window.spOpenPrivateChat = spOpenPrivateChat;

function shareCurrentStreamerProfile() {
  if (!currentViewingProfile) return;
  api.ui.toast(`已生成【${currentViewingProfile.name}】的专属主页分享卡片`);
}
window.shareCurrentStreamerProfile = shareCurrentStreamerProfile;

function openCurrentHostProfile() {
  if (window.currentRoom) {
    openStreamerProfilePage(window.currentRoom.characterId || window.currentRoom.id);
  }
}
window.openCurrentHostProfile = openCurrentHostProfile;

// 清除本地所有模拟缓存弹窗与初始化
function openResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.remove('hidden');
}
window.openResetConfirmModal = openResetConfirmModal;

function closeResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.add('hidden');
}
window.closeResetConfirmModal = closeResetConfirmModal;

async function executeConfirmResetAppData() {
  closeResetConfirmModal();

  const collections = ["live_sessions", "guestbook", "follows", "app_ledger", "app_settings", "app_wallet", "app_profile", "app_posts"];
  try {
    for (const col of collections) {
      const items = await api.db.list(col) || [];
      for (const item of items) {
        await api.db.delete(col, item.id).catch(() => {});
      }
    }
  } catch (e) {}

  revenueBalance = 0;
  guestbookData = {};
  transactionLedger = [];
  window.followedHosts = [];
  followedHosts = [];

  // 恢复默认参数
  appParams = {
    charSpawnRate: 0,
    maxLiveDuration: 60,
    maxRestDuration: 60,
    danmakuSpeed: 50,
    replyRandomDanmakuRate: 40,
    mentionUserRate: 35,
    enterOtherLiveRate: 20,
    enterPlayerLiveRate: 20,
    guestbookRate: 75
  };
  window.appParams = appParams;

  // 恢复默认预设
  try {
    const res = await fetch('presets.json');
    if (res.ok) {
      const data = await res.json();
      presetCategories = data.categories || data;
      window.presetCategories = presetCategories;
    }
  } catch (e) {}

  renderParamsToUI();
  renderPresetCategoryList();
  renderImagePromptEntries();
  renderDualRankList();

  const revEl = document.getElementById('liveRevenueAmount');
  const rev2 = document.getElementById('pageRevenueBalance');
  if (revEl) revEl.textContent = '0';
  if (rev2) rev2.textContent = '0';

  const statFollow = document.getElementById('statFollowCount');
  if (statFollow) statFollow.textContent = '1';

  if (typeof syncLiveSessions === 'function') {
    await syncLiveSessions({ allowSpawn: false });
  }

  api.ui.toast('本地所有模拟缓存已成功清除，应用已重置！');
}
window.executeConfirmResetAppData = executeConfirmResetAppData;