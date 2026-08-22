// =========================================================================
// 【模块四·逻辑底座与网关】LIVE/core.js
// 包含：AiPhone SDK 适配、持久化数据存取、LUMA 官方运营网关、离线时间差推演、AI接口
// =========================================================================

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

  window.getAiPhoneApi = function() {
    return window.AiPhone || window.AiPhoneApp || window.api || polyfill;
  };

  window.api = Object.assign(polyfill, hostApi || {});
})();

var api = window.api;

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
    const targetApi = window.api || window.AiPhone || window.AiPhoneApp;
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

// =========================================================================
// 【调试回调与运营组专用通知系统】(正式运行已静默调试弹层)
// =========================================================================
function lumaOpsNotify(title, detail, type = 'info') {
}
window.lumaOpsNotify = lumaOpsNotify;

// =========================================================================
// 【LUMA 直播官方运营组】：唯一权威审核裁决网关（Single Source of Truth）
// =========================================================================
const lumaOpsGateway = {
  async requestStartLive({ characterId, category, topic, durationMins, source = 'system' }) {
    if (!characterId) {
      lumaOpsNotify("开播驳回", "未指定有效的主播身份", "reject");
      return { success: false, reason: "【LUMA官方运营组通告】开播申请未通过：未指定有效的主播身份。" };
    }

    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = character?.name || "主播";
    const now = Date.now();

    const params = window.appParams || {};
    if (params.charSpawnRate === 0) {
      lumaOpsNotify("开播驳回", `【${charName}】申请开播，全服正处于停机维护中`, "reject");
      return { success: false, reason: `【LUMA官方运营组通告】抱歉【${charName}】，平台全服正在停机维护升级中，暂不开放推流权限。` };
    }

    let sched = window.charSchedulesMap[characterId];
    if (!sched) {
      const savedMap = await api.db.get("app_settings", "char_schedules").catch(() => null);
      if (savedMap && savedMap[characterId]) {
        sched = savedMap[characterId];
        window.charSchedulesMap[characterId] = sched;
      }
    }

    const minRestMs = (params.minRestDuration || 10) * 60 * 1000;
    if (sched && sched.lastEndTime && (now - sched.lastEndTime < minRestMs)) {
      const remainingMins = Math.max(1, Math.ceil((minRestMs - (now - sched.lastEndTime)) / 60000));
      lumaOpsNotify("开播驳回", `【${charName}】刚下播休息不足，需再休息 ${remainingMins} 分钟`, "reject");
      return {
        success: false,
        reason: `【LUMA官方运营组通告】主播【${charName}】开播申请未通过：您距离上次下播仅过去不久，平台规定强制休息期还剩 ${remainingMins} 分钟，请劳逸结合。`
      };
    }

    const activeSessions = await api.db.list("live_sessions") || [];
    const existing = activeSessions.find(s => s.characterId === characterId);
    if (existing) {
      lumaOpsNotify("开播拒绝", `【${charName}】已在直播中 (房号:${existing.roomId})`, "reject");
      return { success: false, reason: `【LUMA官方运营组通告】主播【${charName}】已在直播中（房号:${existing.roomId}），请勿重复开播。` };
    }

    const dur = durationMins || Math.floor(Math.random() * (params.maxLiveDuration || 120) / 2 + 30);
    const start = now;
    const end = start + dur * 60 * 1000;

    let coverUrl = character?.cover || character?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
    let rawCat = category || (character?.tags ? character.tags[0] : '随性杂谈');
    let chosenCat = (typeof normalizeCategory === 'function') ? normalizeCategory(rawCat) : rawCat;
    let chosenSubTag = (character?.tags && character.tags[1]) ? character.tags[1] : (rawCat !== chosenCat ? rawCat : '日常唠嗑');
    let chosenTopic = topic || `${charName}的精彩直播`;

    const newSession = {
      characterId: characterId,
      name: charName,
      avatar: character?.avatar || coverUrl,
      cover: coverUrl,
      category: chosenCat,
      subTag: chosenSubTag,
      topic: chosenTopic,
      heat: Math.floor(Math.random() * 80000 + 20000),
      roomId: Math.floor(Math.random() * 899999 + 100000),
      startTime: start,
      endTime: end,
      isNPC: false
    };

    const created = await api.db.create("live_sessions", newSession);

    window.charSchedulesMap[characterId] = {
      isLive: true,
      currentSessionId: created.id,
      lastStartTime: start,
      plannedEndTime: end,
      lastEndTime: null
    };
    await saveDbSetting("char_schedules", window.charSchedulesMap);

    try {
      if (api.characters?.writeState) {
        await api.characters.writeState({
          characterId: characterId,
          stateValues: [
            { name: "状态", value: `${charName}直播中` }
          ]
        });
      }
    } catch (err) {}

    lumaOpsNotify("开播批准", `【${charName}】通过审核已成功推流开播 (房号:${created.roomId})`, "approve");

    if (typeof syncLiveSessions === 'function') {
      await syncLiveSessions({ allowSpawn: false });
    }

    return {
      success: true,
      data: {
        roomId: created.roomId,
        topic: created.topic,
        category: created.category
      },
      userNotice: `主播【${charName}】已成功开播，房号：${created.roomId}`,
      message: `【LUMA官方运营组】恭喜主播【${charName}】，推流申请已通过！直播间房号【${created.roomId}】现已正式向全平台公开发送推流广播。`
    };
  },

  async requestStopLive({ characterId, reason = "正常下播", source = "system" }) {
    if (!characterId) return { success: false, reason: "未指定有效主播身份" };

    const activeSessions = await api.db.list("live_sessions") || [];
    const session = activeSessions.find(s => s.characterId === characterId || s.id === characterId);
    
    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = session?.name || character?.name || "主播";
    const now = Date.now();

    if (session) {
      await api.db.delete("live_sessions", session.id);
    }

    window.charSchedulesMap[characterId] = {
      isLive: false,
      currentSessionId: null,
      lastStartTime: session ? session.startTime : null,
      lastEndTime: now,
      plannedEndTime: null
    };
    await saveDbSetting("char_schedules", window.charSchedulesMap);

    try {
      if (api.characters?.writeState) {
        await api.characters.writeState({
          characterId: characterId,
          stateValues: [
            { name: "状态", value: `${charName}已下播` }
          ]
        });
      }
    } catch (err) {}

    const isForced = source === 'maint_shutdown' || source === 'max_duration_reached';
    lumaOpsNotify(
      isForced ? "运营强制下播" : "主播已下播",
      `【${charName}】已结束推流（原因:${reason}），进入强制休息期`,
      isForced ? "force" : "info"
    );

    if (window.currentRoom && (window.currentRoom.characterId === characterId || window.currentRoom.id === session?.id)) {
      if (typeof window.showHostLeftRoomStage === 'function') {
        window.showHostLeftRoomStage(window.currentRoom);
      } else if (typeof closeLiveRoom === 'function') {
        closeLiveRoom();
      }
      api.ui.toast(`主播【${charName}】已下播休息`);
    }

    if (typeof syncLiveSessions === 'function') {
      await syncLiveSessions({ allowSpawn: false });
    }

    return {
      success: true,
      userNotice: `主播【${charName}】已下播休息`,
      message: `【LUMA官方运营组】主播【${charName}】已成功关闭推流并同步下线状态。`
    };
  },

  async getCharSchedule(characterId) {
    if (!characterId) return null;
    let sched = window.charSchedulesMap ? window.charSchedulesMap[characterId] : null;
    if (!sched) {
      try {
        const savedMap = await api.db.get("app_settings", "char_schedules").catch(() => null);
        if (savedMap && savedMap[characterId]) {
          sched = savedMap[characterId];
          if (!window.charSchedulesMap) window.charSchedulesMap = {};
          window.charSchedulesMap[characterId] = sched;
        }
      } catch (e) {}
    }
    return sched;
  },

  async saveCharSchedule(characterId, scheduleData) {
    if (!characterId || !scheduleData) return false;
    if (!window.charSchedulesMap) window.charSchedulesMap = {};
    window.charSchedulesMap[characterId] = scheduleData;
    return await saveDbSetting("char_schedules", window.charSchedulesMap);
  }
};
window.lumaOpsGateway = lumaOpsGateway;

// 注册小手机宿主工具箱 Handlers
function registerAiPhoneToolHandlers() {
  const targetApi = window.api || window.AiPhone || window.AiPhoneApp;
  if (targetApi && targetApi.tools && typeof targetApi.tools.handle === 'function') {
    targetApi.tools.handle("handleRequestStartLive", async (args, context) => {
      const charId = (context && (context.characterId || context.charId)) || 
                     (args && (args.characterId || args.charId)) || 
                     (window.allCharacters && window.allCharacters[0]?.id) || 
                     "char_1";
      return await lumaOpsGateway.requestStartLive({
        characterId: charId,
        category: args?.category,
        topic: args?.topic,
        durationMins: args?.durationMins,
        source: "chat_tool"
      });
    });

    targetApi.tools.handle("handleRequestStopLive", async (args, context) => {
      const charId = (context && (context.characterId || context.charId)) || 
                     (args && (args.characterId || args.charId)) || 
                     (window.allCharacters && window.allCharacters[0]?.id) || 
                     "char_1";
      return await lumaOpsGateway.requestStopLive({
        characterId: charId,
        reason: args?.reason || "正常下播",
        source: "chat_tool"
      });
    });
  }
}
registerAiPhoneToolHandlers();
window.registerAiPhoneToolHandlers = registerAiPhoneToolHandlers;

// =========================================================================
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
  const p = window.appPresets || {};
  if (p[tagKey]?.entries?.length > 0) {
    return p[tagKey].entries.map(e => e.content).join('\n\n');
  }
  if (tagKey === 'package') {
    const danmakuContent = p['danmaku']?.entries?.map(e => e.content).join('\n') || '';
    const hostContent = p['host']?.entries?.map(e => e.content).join('\n') || '';
    return CUSTOM_API_PRESET_TEMPLATES['package'] + (danmakuContent ? `\n\n# 弹幕参考规则：\n${danmakuContent}` : '') + (hostContent ? `\n\n# 主播参考规则：\n${hostContent}` : '');
  }
  if (tagKey === 'reply') {
    if (p['host']?.entries?.length > 0) {
      return p['host'].entries.map(e => e.content).join('\n\n');
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

  const customApi = window.customApiConfig || {};
  if (customApi.enableGlobalModel) {
    return api.ai.generate({
      ...params,
      instruction: filledInstruction
    });
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
  if (customApi.enableGlobalImageModel) {
    return api.ai.generateImage({
      ...params,
      prompt: promptText
    });
  }

  const url = customApi.image?.url || '';
  const key = customApi.image?.key || '';
  const model = customApi.image?.model || 'dall-e-3';
  if (!url) throw new Error('自定义生图API未配置地址');

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

    throw new Error(`自定义生图API请求失败: ${data?.error?.message || data?.message || res.status}`);
  } catch (e) {
    throw e;
  }
}
window.aiGenerateImage = aiGenerateImage;

async function robustNetworkRequest(options) {
  try {
    const res = await api.network?.fetch({
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
window.robustNetworkRequest = robustNetworkRequest;

function extractJsonFromText(text) {
  if (!text) return null;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
window.extractJsonFromText = extractJsonFromText;
