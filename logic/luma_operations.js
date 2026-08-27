// =========================================================================
// LUMA Live 直播运营核心 (v1.3.2 - readState 状态栏倾向值读取)
// 包含：LUMA官方运营组（定时器轮询决策）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 轮询日志：文件加载即初始化，避免首次轮询前访问报错
if (!window.lumaOpsLog) window.lumaOpsLog = [];
// =========================================================================
// 【角色倾向值管理】
// 倾向值由角色自行判定状态后，通过富媒体指令注入到原生状态栏
// 状态栏数值格式：[名称:数字]，例如 [开播倾向:75] / [下播倾向:20]
// 后台通过 AiPhone.characters.readState 读取，再参与轮询投骰
// 倾向值范围 0-100，轮询计算时取 1/2（0-50分）+ 比例式增长（0-50分）
// 未获取的角色返回 null，基础分按 0 计算，日志与UI标注「暂未获取」
// =========================================================================

// 状态栏中「开播倾向」「下播倾向」的条目名称（匹配 readState 返回的 name）
const TENDENCY_START_NAME = '开播倾向';
const TENDENCY_STOP_NAME = '下播倾向';

// 获取宿主 SDK 引用（宿主注入 window.AiPhone；宿主导入时若走别名则回退 api）
function getHostSdk() {
  const w = window;
  let sdk = w.AiPhone || w.AiPhoneApp;
  if (!sdk && typeof api !== 'undefined' && api.characters) sdk = api;
  return sdk;
}

// 从 stateValues 风格数组里解析出开播/下播倾向值
function parseTendencyFromStateArray(arr) {
  let startTendency = null;
  let stopTendency = null;
  if (!Array.isArray(arr)) return { startTendency, stopTendency };
  for (const it of arr) {
    if (!it) continue;
    const name = String(it.name ?? it.label ?? it.key ?? '');
    const num = Number(it.value ?? it.num ?? it.score);
    if (!isFinite(num)) continue;
    const v = Math.max(0, Math.min(100, Math.round(num)));
    if (name === TENDENCY_START_NAME) startTendency = v;
    else if (name === TENDENCY_STOP_NAME) stopTendency = v;
  }
  return { startTendency, stopTendency };
}

// 从 readState 返回的状态数组里解析出指定名称的数值（0-100）
async function readCharTendency(characterId) {
  if (!characterId) return { startTendency: null, stopTendency: null };

  // 1. 首选：AiPhone.characters.readState 直接读原生状态栏
  const sdk = getHostSdk();
  let result = { startTendency: null, stopTendency: null };
  try {
    if (sdk && sdk.characters && typeof sdk.characters.readState === 'function') {
      const res = await sdk.characters.readState({ characterId }).catch(() => null);
      const list = Array.isArray(res) ? res
        : (res && Array.isArray(res.data) ? res.data
        : (res && Array.isArray(res.stateValues) ? res.stateValues
        : (res && Array.isArray(res.value) ? res.value : null)));
      result = parseTendencyFromStateArray(list);
      if (result.startTendency !== null || result.stopTendency !== null) return result;
    }
  } catch (e) {
    console.warn(`[LUMA Live] readState 读取失败 ${characterId}:`, e);
  }

  // 2. 兜底：chat.readHistory 最近消息里携带的 stateValues
  try {
    if (sdk && sdk.chat && typeof sdk.chat.readHistory === 'function') {
      const history = await sdk.chat.readHistory({ characterId, limit: 20 }).catch(() => null);
      const list = Array.isArray(history) ? history : (history && Array.isArray(history.messages) ? history.messages : null);
      if (Array.isArray(list)) {
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          const sv = m && (m.stateValues || m.freshStateValues || m.state);
          const parsed = parseTendencyFromStateArray(sv);
          result.startTendency = result.startTendency ?? parsed.startTendency;
          result.stopTendency = result.stopTendency ?? parsed.stopTendency;
          if (result.startTendency !== null && result.stopTendency !== null) break;
        }
      }
    }
  } catch (e) {
    console.warn(`[LUMA Live] readHistory 兜底读取失败 ${characterId}:`, e);
  }

  return result;
}

// 获取角色倾向值（开播倾向 / 下播倾向），直接读原生状态栏
async function getCharTendency(characterId) {
  return await readCharTendency(characterId);
}

window.getCharTendency = getCharTendency;
window.readCharTendency = readCharTendency;

// =========================================================================
// 【调试回调与运营组专用通知系统】(正式运行已静默调试弹层)
// =========================================================================
function lumaOpsNotify(title, detail, type = 'info') {
}
window.lumaOpsNotify = lumaOpsNotify;

// =========================================================================
// 【房管】：直播间开关权限管理 + 审核裁决网关（防多开、防分身、维护模式拦截）
// 官方运营组（定时器轮询）做概率决策后通知房管，房管审核通过才开关直播间
// =========================================================================
const lumaOpsGateway = {
  async requestStartLive({ characterId, category, topic, durationMins, source = 'system' }, nowTime = null) {
    if (!characterId) {
      lumaOpsNotify("开播驳回", "未指定有效的主播身份", "reject");
      return { success: false, reason: "【LUMA官方运营组通告】开播申请未通过：未指定有效的主播身份。" };
    }

    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = character?.name || "主播";
    const now = nowTime || Date.now();

    const params = window.appParams || {};

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

    const activeSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const existing = activeSessions.find(s => s.characterId === characterId);
    if (existing) {
      lumaOpsNotify("开播拒绝", `【${charName}】已在直播中 (房号:${existing.roomId})`, "reject");
      return { success: false, reason: `【LUMA官方运营组通告】主播【${charName}】已在直播中（房号:${existing.roomId}），请勿重复开播。` };
    }

    const dur = durationMins || Math.floor(Math.random() * (params.maxLiveDuration || 120) / 2 + 30);
    const start = now;
    const end = start + dur * 60 * 1000;

    let coverUrl = character?.cover || character?.avatar || '';
    // 分类选取：显式指定则用指定的，否则完全随机（先一级再二级）
    let chosenCat, chosenSubTag;
    if (category) {
      chosenCat = (typeof normalizeCategory === 'function') ? normalizeCategory(category) : category;
      chosenSubTag = (typeof getCanonicalSubCategory === 'function')
        ? getCanonicalSubCategory(chosenCat, '', characterId)
        : '日常唠嗑';
    } else {
      const picked = (typeof pickRandomLiveCategory === 'function') ? pickRandomLiveCategory() : { mainCat: '随性杂谈', subCat: '日常唠嗑' };
      chosenCat = picked.mainCat;
      chosenSubTag = picked.subCat;
    }
    let chosenTopic = '';
    if (source === 'tool' || source === 'ai' || source === 'char' || source === 'chat_tool' || source === 'manual' || String(source).includes('tool') || String(source).includes('ai')) {
      // char 调用 AI / 工具开播起名
      let cleanTopic = (topic || '').replace(new RegExp(`^【?${charName}】?[:：\\s]*`), '').trim();
      if (!cleanTopic) cleanTopic = '个人直播间';
      chosenTopic = `【${charName}】${cleanTopic}`;
    } else {
      // 随机生成 / 系统自动开播
      chosenTopic = `【${charName}】的精彩直播`;
    }

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
    await incrementDailyStartCount(characterId);

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

  async requestStopLive({ characterId, reason = "正常下播", source = "system" }, nowTime = null) {
    if (!characterId) return { success: false, reason: "未指定有效主播身份" };

    const activeSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const session = activeSessions.find(s => s.characterId === characterId || s.id === characterId);
    
    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = session?.name || character?.name || "主播";
    const now = nowTime || Date.now();

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

    const isForced = source === 'maint_shutdown' || source === 'max_duration_reached';
    lumaOpsNotify(
      isForced ? "运营强制下播" : "主播已下播",
      `【${charName}】已结束推流（原因:${reason}），进入强制休息期`,
      isForced ? "force" : "info"
    );

    if (window.currentRoom && (window.currentRoom.characterId === characterId || window.currentRoom.id === session?.id)) {
      if (typeof window.showHostLeftRoomStage === 'function') {
        window.showHostLeftRoomStage(window.currentRoom);
      } else if (typeof window.closeLiveRoom === 'function') {
        window.closeLiveRoom();
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
  const targetApi = window.api;
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


// =========================================================================
// 【延迟执行队列】判定为开播/下播后，延迟1-10分钟执行，避免同时开播下播
// =========================================================================
async function getPendingActions() {
  try {
    const saved = await api.db.get("app_settings", "luma_pending_actions").catch(() => null);
    const unwrapped = window.readDbSettingValue ? window.readDbSettingValue(saved) : saved;
    return Array.isArray(unwrapped) ? unwrapped : [];
  } catch (e) { return []; }
}
async function addPendingAction(characterId, action, delayMins, reason, nowTime = null) {
  const queue = await getPendingActions();
  // 移除该角色已有的同类型待执行动作
  const filtered = queue.filter(a => !(a.characterId === characterId && a.action === action));
  filtered.push({
    characterId,
    action, // 'start' or 'stop'
    executeAt: (nowTime || Date.now()) + delayMins * 60 * 1000,
    delayMins,
    reason,
    createdAt: nowTime || Date.now()
  });
  try { await saveDbSetting("luma_pending_actions", filtered); } catch (e) {}
  return filtered;
}
async function executeDueActions(nowTime = null) {
  const queue = await getPendingActions();
  const now = nowTime || Date.now();
  const due = queue.filter(a => a.executeAt <= now);
  const remaining = queue.filter(a => a.executeAt > now);
  try { await saveDbSetting("luma_pending_actions", remaining); } catch (e) {}
  for (const action of due) {
    try {
      if (action.action === 'start') {
        await window.lumaOpsGateway.requestStartLive({
          characterId: action.characterId,
          source: "delayed_start"
        }, action.executeAt || now);
      } else if (action.action === 'stop') {
        await window.lumaOpsGateway.requestStopLive({
          characterId: action.characterId,
          reason: action.reason || "角色下播倾向决定下播休息",
          source: "delayed_stop"
        }, action.executeAt || now);
      }
    } catch (e) {}
  }
  return due.length;
}
window.getPendingActions = getPendingActions;
window.addPendingAction = addPendingAction;
window.executeDueActions = executeDueActions;

// 【每日开播场次统计】记录每个角色今天的开播次数
async function getDailyStartCount(characterId) {
  try {
    const today = new Date().toDateString();
    const saved = await api.db.get("app_settings", "luma_daily_starts").catch(() => null);
    if (saved && saved.date === today && saved.counts && saved.counts[characterId]) {
      return saved.counts[characterId];
    }
    return 0;
  } catch (e) { return 0; }
}
async function incrementDailyStartCount(characterId) {
  try {
    const today = new Date().toDateString();
    let saved = await api.db.get("app_settings", "luma_daily_starts").catch(() => null);
    if (!saved || saved.date !== today) {
      saved = { date: today, counts: {} };
    }
    saved.counts[characterId] = (saved.counts[characterId] || 0) + 1;
    await saveDbSetting("luma_daily_starts", saved);
  } catch (e) {}
}
window.getDailyStartCount = getDailyStartCount;
window.incrementDailyStartCount = incrementDailyStartCount;

// =========================================================================
// 【世界生态冷启动初始化】（仅在首次安装或无历史调度记录时执行一次）
// 为全服所有角色一次性分配自然的初始分布（部分直播中、部分休息冷却中、部分蓄势待发）
// 杜绝后续运行中点进直播间突发倒退一小时的幽灵时间跳跃 Bug
// =========================================================================
async function bootstrapWorldInitialState(allChars, params = {}) {
  const now = Date.now();
  const maxLiveMins = params.maxLiveDuration || 120;
  const maxRestMins = params.maxRestDuration || 360;
  const minRestMins = params.minRestDuration || 10;

  if (!window.charSchedulesMap) window.charSchedulesMap = {};
  
  let currentSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const existingSessionCharIds = new Set(currentSessions.map(s => s.characterId));

  const total = allChars.length;
  if (total === 0) return;

  const shuffled = [...allChars].sort(() => Math.random() - 0.5);
  let targetLiveCount = Math.max(1, Math.round(total * 0.4));
  if (total === 1) targetLiveCount = 1;

  for (let i = 0; i < shuffled.length; i++) {
    const c = shuffled[i];
    if (existingSessionCharIds.has(c.id)) {
      const sess = currentSessions.find(s => s.characterId === c.id);
      window.charSchedulesMap[c.id] = {
        initialized: true,
        isLive: true,
        currentSessionId: sess?.id,
        lastStartTime: sess?.startTime || now,
        plannedEndTime: sess?.endTime || (now + 60 * 60 * 1000),
        lastEndTime: null
      };
      continue;
    }

    if (i < targetLiveCount) {
      // 初始直播中：分配 5 ~ 35 分钟的合理中盘已播时长
      const initLiveMins = Math.floor(Math.random() * Math.min(35, Math.floor(maxLiveMins * 0.5))) + 5;
      const startTime = now - initLiveMins * 60000;
      const plannedDurationMins = Math.floor(Math.random() * 60 + 60);
      const endTime = startTime + plannedDurationMins * 60000;

      const coverUrl = c.cover || c.avatar || '';
      // 分类选取：完全随机（先一级再二级）
      const picked = (typeof pickRandomLiveCategory === 'function') ? pickRandomLiveCategory() : { mainCat: '随性杂谈', subCat: '日常唠嗑' };
      const chosenCat = picked.mainCat;
      const chosenSubTag = picked.subCat;

      const newSession = {
        characterId: c.id,
        name: c.name || '主播',
        avatar: c.avatar || coverUrl,
        cover: coverUrl,
        category: chosenCat,
        subTag: chosenSubTag,
        topic: `【${c.name || '主播'}】的精彩直播`,
        heat: Math.floor(Math.random() * 80000 + 20000),
        roomId: Math.floor(Math.random() * 899999 + 100000),
        startTime: startTime,
        endTime: endTime,
        isNPC: false
      };

      try {
        const created = await api.db.create("live_sessions", newSession);
        window.charSchedulesMap[c.id] = {
          initialized: true,
          isLive: true,
          currentSessionId: created?.id,
          lastStartTime: startTime,
          plannedEndTime: endTime,
          lastEndTime: null
        };
      } catch (e) {
        console.warn("冷启动直播间创建失败:", e);
      }
    } else if (i < targetLiveCount + Math.round(total * 0.35)) {
      // 初始休息中：处于法定强制休息期内
      const initRestMins = Math.floor(Math.random() * Math.min(60, maxRestMins - minRestMins)) + minRestMins;
      const lastEndTime = now - initRestMins * 60000;
      window.charSchedulesMap[c.id] = {
        initialized: true,
        isLive: false,
        lastStartTime: null,
        plannedEndTime: null,
        lastEndTime: lastEndTime
      };
    } else {
      // 初始空闲/蓄势待发：已度过休息期，开播倾向较高，近期轮询可自然开播
      const lastEndTime = now - (minRestMins + Math.floor(Math.random() * 40 + 10)) * 60000;
      window.charSchedulesMap[c.id] = {
        initialized: true,
        isLive: false,
        lastStartTime: null,
        plannedEndTime: null,
        lastEndTime: lastEndTime
      };
    }
  }

  try {
    await saveDbSetting("char_schedules", window.charSchedulesMap);
    await saveDbSetting("world_bootstrapped", { date: new Date().toISOString(), bootstrapped: true });
  } catch (e) {}
}
window.bootstrapWorldInitialState = bootstrapWorldInitialState;

// =========================================================================
// 决策公式：安全区外(达到时长上限)=100%必然；安全区内=基础倾向 + (已持续时长/上限)×50%
// =========================================================================
async function syncLiveSessions(options = {}, nowTime = null) {
  let sessions = await api.db.list("live_sessions", { limit: 500 }) || [];

  // 仅刷新模式：房管操作后调用，不做新决策
  if (options.refreshOnly || options.allowSpawn === false) {
    window.liveList = sessions;
    renderLiveGrid();
    return;
  }

  const now = nowTime || Date.now();
  const params = window.appParams || {};
  const maxLiveMins = params.maxLiveDuration || 120;
  const maxRestMins = params.maxRestDuration || 360;
  const minRestMins = params.minRestDuration || 10;
  const allChars = window.allCharacters || [];
  if (!window.charSchedulesMap) window.charSchedulesMap = {};

  // ── 轮次计数：持久化 + 每天0点重置 ──
  const today = new Date().toDateString();
  let cycleStore = {};
  try {
    const raw = await api.db.get("app_settings", "luma_ops_cycle").catch(() => null);
    if (raw && typeof raw === 'object') cycleStore = raw;
  } catch(e) {}
  if (cycleStore.date !== today) {
    cycleStore = { date: today, cycle: 0 };
  }
  const cycle = ++cycleStore.cycle;
  try { await saveDbSetting("luma_ops_cycle", cycleStore); } catch(e) {}

  // ── 新加入角色平滑注册（如果有新增角色，安全初始化为休息状态，绝不倒推开播时间） ──
  let hasNewSched = false;
  for (const c of allChars) {
    if (!window.charSchedulesMap[c.id]) {
      const existingSession = sessions.find(s => s.characterId === c.id);
      if (existingSession) {
        window.charSchedulesMap[c.id] = {
          initialized: true,
          isLive: true,
          currentSessionId: existingSession.id,
          lastStartTime: existingSession.startTime || now,
          plannedEndTime: existingSession.endTime || (now + 60 * 60 * 1000),
          lastEndTime: null
        };
      } else {
        // 新角色平滑加入生态：设为已度过休息期的正常空闲状态，后续由轮询真实决策开播
        window.charSchedulesMap[c.id] = {
          initialized: true,
          isLive: false,
          lastStartTime: null,
          plannedEndTime: null,
          lastEndTime: now - (minRestMins + 5) * 60000
        };
      }
      hasNewSched = true;
    }
  }
  if (hasNewSched) {
    try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch(e) {}
  }

  // 刷新会话列表（新角色初始化后可能新增了直播间）
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const streamingIds = new Set(sessions.map(s => s.characterId));

  // ── 构建全部角色评估列表 ──
  const dailyLimit = (params.dailyLiveLimit !== undefined && params.dailyLiveLimit > 0) ? params.dailyLiveLimit : Infinity;
  const pendingActions = await getPendingActions();
  const pendingCharIds = new Set(pendingActions.map(a => a.characterId));

  const toEvaluate = [];
  // 直播中角色：评估下播
  for (const s of sessions) {
    const liveMins = (now - (s.startTime || now)) / 60000;
    toEvaluate.push({
      type: 'stop',
      charId: s.characterId,
      charName: s.name || s.characterId,
      liveMins: liveMins,
      hasPending: pendingCharIds.has(s.characterId)
    });
  }
  // 休息中角色：评估开播（排除强制休息期和已有待执行动作的）
  for (const c of allChars) {
    if (streamingIds.has(c.id)) continue;
    const sched = window.charSchedulesMap[c.id];
    const lastEndTime = sched?.lastEndTime;
    const restMins = lastEndTime ? (now - lastEndTime) / 60000 : 9999;
    const inMandatoryRest = restMins < minRestMins;
    if (inMandatoryRest) continue;
    if (pendingCharIds.has(c.id)) continue; // 已有待执行动作，跳过
    toEvaluate.push({
      type: 'start',
      charId: c.id,
      charName: c.name || c.id,
      restMins: restMins
    });
  }

  // ── 轮询日志初始化 ──
  const cycleLog = {
    time: new Date().toLocaleTimeString(),
    cycle: cycle,
    params: { maxLiveMins, maxRestMins, minRestMins, dailyLimit: dailyLimit === Infinity ? '不限制' : dailyLimit },
    decisions: [],
    summary: { totalChars: allChars.length, streaming: sessions.length, started: 0, stopped: 0, evaluated: toEvaluate.length, pending: pendingActions.length }
  };

  // ── 执行评估（全部角色）──
  for (const item of toEvaluate) {
    if (item.type === 'stop') {
      if (item.hasPending) {
        // 已有待执行下播动作，标注等待中
        const pending = pendingActions.find(a => a.characterId === item.charId && a.action === 'stop');
        const waitMins = Math.max(1, Math.round((pending.executeAt - now) / 60000));
        cycleLog.decisions.push({
          char: item.charName, state: '直播中',
          liveMins: Math.round(item.liveMins),
          result: `等待${waitMins}分后下播`
        });
        continue;
      }
      const liveMins = Math.round(item.liveMins);
      const isUrgent = liveMins >= maxLiveMins;
      const charTendency = await getCharTendency(item.charId);
      const hasRealTendency = charTendency.stopTendency !== null && charTendency.stopTendency !== undefined;
      const rawTendency = hasRealTendency ? Number(charTendency.stopTendency) : null;
      // 下播倾向值取二分之一折算为0-50分；若暂未获取则基础得分计0
      const tendencyScore = hasRealTendency ? Math.round(rawTendency / 2) : 0;
      const timeScore = Math.round((liveMins / maxLiveMins) * 50);
      
      let stopTendency, reason, baseTendencyText;
      if (isUrgent) {
        stopTendency = 100;
        reason = '达到上限必然下播';
        baseTendencyText = hasRealTendency ? `${rawTendency}` : '暂未获取';
      } else {
        stopTendency = Math.min(100, tendencyScore + timeScore);
        reason = hasRealTendency ? '下播倾向(1/2)+时间增长' : '暂未获取下播倾向(仅时间增长)';
        baseTendencyText = hasRealTendency ? `${rawTendency} (折算${tendencyScore})` : '暂未获取';
      }

      const dice = Math.round(Math.random() * 100);
      const willStop = dice < stopTendency;

      cycleLog.decisions.push({
        char: item.charName, state: '直播中',
        liveMins: liveMins,
        baseTendency: baseTendencyText,
        stopTendency: stopTendency,
        dice: dice,
        reason: reason,
        result: willStop ? '准备下播' : '继续播'
      });

      if (willStop) {
        cycleLog.summary.stopped++;
        // 延迟1-10分钟执行下播
        const delayMins = Math.floor(Math.random() * 10) + 1;
        await addPendingAction(item.charId, 'stop', delayMins, isUrgent ? "达到直播时长上限" : "角色下播倾向决定下播休息", now);
        cycleLog.decisions[cycleLog.decisions.length - 1].delayMins = delayMins;
        cycleLog.decisions[cycleLog.decisions.length - 1].result = `${delayMins}分后下播`;
      }
    } else {
      // 检查每日场次上限
      const todayCount = await getDailyStartCount(item.charId);
      if (todayCount >= dailyLimit) {
        cycleLog.decisions.push({
          char: item.charName, state: '休息中',
          restMins: Math.round(item.restMins),
          result: `今日已达${dailyLimit}场上限`
        });
        continue;
      }
      const restMins = Math.round(item.restMins);
      const isUrgent = restMins >= maxRestMins;
      const charTendency = await getCharTendency(item.charId);
      const hasRealTendency = charTendency.startTendency !== null && charTendency.startTendency !== undefined;
      const rawTendency = hasRealTendency ? Number(charTendency.startTendency) : null;
      // 开播倾向值取二分之一折算为0-50分；若暂未获取则基础得分计0
      const tendencyScore = hasRealTendency ? Math.round(rawTendency / 2) : 0;
      const timeScore = Math.round((restMins / maxRestMins) * 50);

      let spawnTendency, reason, baseTendencyText;
      if (isUrgent) {
        spawnTendency = 100;
        reason = '达到上限必然开播';
        baseTendencyText = hasRealTendency ? `${rawTendency}` : '暂未获取';
      } else {
        spawnTendency = Math.min(100, tendencyScore + timeScore);
        reason = hasRealTendency ? '开播倾向(1/2)+时间增长' : '暂未获取开播倾向(仅时间增长)';
        baseTendencyText = hasRealTendency ? `${rawTendency} (折算${tendencyScore})` : '暂未获取';
      }

      const dice = Math.round(Math.random() * 100);
      const willSpawn = dice < spawnTendency;

      cycleLog.decisions.push({
        char: item.charName, state: '休息中',
        restMins: restMins,
        baseTendency: baseTendencyText,
        spawnTendency: spawnTendency,
        dice: dice,
        reason: reason,
        result: willSpawn ? '准备开播' : '不播'
      });

      if (willSpawn) {
        cycleLog.summary.started++;
        // 延迟1-10分钟执行开播
        const delayMins = Math.floor(Math.random() * 10) + 1;
        await addPendingAction(item.charId, 'start', delayMins, "角色开播倾向决定开播", now);
        cycleLog.decisions[cycleLog.decisions.length - 1].delayMins = delayMins;
        cycleLog.decisions[cycleLog.decisions.length - 1].result = `${delayMins}分后开播`;
      }
    }
  }

  // 最终刷新并渲染
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  renderLiveGrid();

  // 更新上次轮询时间（正常轮询时，不是补跑时）
  if (!nowTime) {
    try { await saveDbSetting("last_poll_time", Date.now()); } catch (e) {}
  }

  // ── 写入轮询日志 ──
  cycleLog.summary.streaming = sessions.length;
  if (!window.lumaOpsLog) window.lumaOpsLog = [];
  window.lumaOpsLog.unshift(cycleLog);
  if (window.lumaOpsLog.length > 50) window.lumaOpsLog.pop();
  // 轮询完成后同步状态到聊天历史
  syncCharStatusToChat(now);
}
window.syncLiveSessions = syncLiveSessions;

// =========================================================================
// 【离线时间差推演·补跑机制】APP打开时根据离开时间补跑轮询，模拟后台一直在跑
// 原理：记录每次轮询时间，APP打开时计算离开了多久，按轮询间隔逐次补跑
// 补跑时传入模拟时间，开播/下播时间戳用模拟时间，保证直播时长真实
// =========================================================================
async function catchUpOfflinePolling() {
  try {
    const lastPollRec = await api.db.get("app_settings", "last_poll_time").catch(() => null);
    const lastPollTime = window.readDbSettingValue ? Number(window.readDbSettingValue(lastPollRec)) : Number(lastPollRec);
    const now = Date.now();
    
    // 第一次使用，没有记录，直接初始化
    if (!lastPollTime || isNaN(lastPollTime)) {
      try { await saveDbSetting("last_poll_time", now); } catch (e) {}
      return { caughtUp: false, reason: "first_run" };
    }
    
    const pollIntervalMs = ((window.appParams && window.appParams.opsPollInterval) || 3) * 60 * 1000;
    const elapsed = now - lastPollTime;
    
    // 离开时间不足一个轮询间隔，不需要补跑
    if (elapsed < pollIntervalMs) {
      return { caughtUp: false, reason: "too_short", elapsedMs: elapsed };
    }
    
    // 计算需要补跑的次数（最多补跑30次，避免太慢）
    const maxCatchUp = 30;
    const catchUpCount = Math.min(Math.floor(elapsed / pollIntervalMs), maxCatchUp);
    const actualElapsed = catchUpCount * pollIntervalMs;
    
    // 逐次补跑，每次传入模拟时间
    for (let i = 0; i < catchUpCount; i++) {
      const simulatedNow = lastPollTime + (i + 1) * pollIntervalMs;
      try {
        await syncLiveSessions({ allowSpawn: true, catchUp: true }, simulatedNow);
      } catch (e) {}
    }
    
    // 补跑完成后，用真实时间再执行一次到期延迟动作（补跑时用的是模拟时间，真实时间已超过）
    try { await executeDueActions(); } catch (e) {}
    
    // 补跑完成后，更新上次轮询时间为当前时间
    try { await saveDbSetting("last_poll_time", now); } catch (e) {}
    
    return { caughtUp: true, catchUpCount, elapsedMs: elapsed, simulatedMs: actualElapsed };
  } catch (e) {
    return { caughtUp: false, reason: "error", error: String(e) };
  }
}
window.catchUpOfflinePolling = catchUpOfflinePolling;
window.lumaOpsPoll = syncLiveSessions;

// =========================================================================
// 【状态同步到角色日程】后台定时把每个角色的直播状态写入角色日程
// 通过{{当前日程}}宏自动注入提示词，角色聊天时自动看到真实状态
// 不依赖短期记忆、不依赖聊天历史、不依赖工具调用
// =========================================================================
async function syncCharStatusToChat(nowTime = null) {
  try {
    const allChars = window.allCharacters || [];
    if (allChars.length === 0) return;
    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const streamingIds = new Set(sessions.map(s => s.characterId));
    const now = nowTime || Date.now();
    const today = new Date(now).toISOString().split('T')[0]; // YYYY-MM-DD
    const calendarApi = (typeof AiPhone !== 'undefined' && AiPhone.calendar) ? AiPhone.calendar : (api.calendar || null);
    if (!calendarApi || !calendarApi.write) {
      return;
    }
    for (const c of allChars) {
      try {
        const isStreaming = streamingIds.has(c.id);
        const session = sessions.find(s => s.characterId === c.id);
        let title;
        if (isStreaming && session) {
          const liveMins = Math.round((now - (session.startTime || now)) / 60000);
          title = `LUMA Live直播中，已播${liveMins}分钟`;
        } else {
          const sched = window.charSchedulesMap ? window.charSchedulesMap[c.id] : null;
          const lastEndTime = sched?.lastEndTime;
          const restMins = lastEndTime ? Math.round((now - lastEndTime) / 60000) : 0;
          title = `LUMA Live休息中，已休息${restMins}分钟`;
        }
        // 先读取整周日程，过滤掉已有的LUMA Live日程，再添加今天的新状态日程
        let existingItems = [];
        try {
          const weekData = await calendarApi.read({
            ownerType: "character",
            ownerId: c.id,
            weekStart: today
          }).catch(() => null);
          if (weekData && weekData.plan && Array.isArray(weekData.plan.items)) {
            existingItems = weekData.plan.items.filter(item => !String(item.title || '').startsWith('LUMA Live'));
          }
        } catch (e) {}
        // 添加今天的LUMA Live状态日程（全天）
        const lumaItem = {
          date: today,
          startTime: "00:00",
          endTime: "23:59",
          title: title,
          location: "LUMA Live",
          source: "luma_live"
        };
        const allItems = [...existingItems, lumaItem];
        await calendarApi.write({
          ownerType: "character",
          ownerId: c.id,
          operation: "replace",
          items: allItems
        }).catch(() => {});
      } catch (e) {}
    }
  } catch (e) {}
}
window.syncCharStatusToChat = syncCharStatusToChat;
