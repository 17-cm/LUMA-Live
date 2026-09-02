// =========================================================================
// LUMA Live 直播运营核心 (v1.4.0 - 时间差结算器)
// 包含：LUMA官方运营组（打开APP时一次性时间差结算）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// =========================================================================
// 【角色倾向值管理】
// 倾向值由角色自行判定状态后，通过富媒体指令注入到原生状态栏
// 状态栏数值格式：[名称:数字]，例如 [开播倾向:75] / [下播倾向:20]
// 后台通过 AiPhone.characters.readState 读取，参与统一概率判定
// 倾向换算分 = tendency/200 → 0~0.5，倾向越高起始概率越高
// 下播倾向影响下播概率（越高越早触发下播），开播倾向影响开播概率（越高越早触发开播）
// 未获取的角色返回 null，倾向分按 0（纯比例式增长驱动）
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
    // 强制休息锁：锁期内（含刚下播/被劝退）一律驳回开播申请，杜绝"下播下一秒又开播"
    const forcedRestUntil = sched && sched.forcedRestUntil;
    const inForcedLock = (forcedRestUntil != null && now < forcedRestUntil) ||
                         (sched && sched.lastEndTime && (now - sched.lastEndTime < minRestMs));
    if (inForcedLock) {
      const remainingMins = Math.max(1, Math.ceil((minRestMs - ((sched.lastEndTime ? now - sched.lastEndTime : 0))) / 60000));
      lumaOpsNotify("开播驳回", `【${charName}】刚下播休息不足，需再休息 ${remainingMins} 分钟`, "reject");
      return {
        success: false,
        reason: `【LUMA官方运营组通告】主播【${charName}】开播申请未通过：您距上次下播不久，平台强制休息期还剩约 ${remainingMins} 分钟，请劳逸结合。`
      };
    }

    const activeSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const existing = activeSessions.find(s => s.characterId === characterId);
    if (existing) {
      lumaOpsNotify("开播拒绝", `【${charName}】已在直播中 (房号:${existing.roomId})`, "reject");
      return { success: false, reason: `【LUMA官方运营组通告】主播【${charName}】已在直播中（房号:${existing.roomId}），请勿重复开播。` };
    }

    const dur = durationMins || (params.maxLiveDuration || 120);
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
      await syncLiveSessions();
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
  },

  async requestStopLive({ characterId, reason, source = 'system' }, nowTime = null) {
    if (!characterId) {
      return { success: false, reason: "未指定主播身份" };
    }
    const now = nowTime || Date.now();
    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const session = sessions.find(s => s.characterId === characterId);
    if (!session) {
      return { success: false, reason: "该主播没有正在直播的场次" };
    }
    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === characterId);
    await closeAndArchive(character, session, now);

    // 下播后强制进入休息期：加"强制休息锁"，锁期内轮询/改签/Tool 一律不得提前重开，
    // 杜绝"刚下播下一秒又开播"。真正生效的是 forcedRestUntil + 最短休息判定。
    const sparams = window.appParams || {};
    const sMinRestMs = (sparams.minRestDuration || 10) * 60 * 1000;
    if (!window.charSchedulesMap) window.charSchedulesMap = {};
    let sched = window.charSchedulesMap[characterId] || (window.charSchedulesMap[characterId] = { initialized: true });
    sched.isLive = false;
    sched.currentSessionId = null;
    sched.plannedEndTime = null;
    sched.lastEndTime = now;
    sched.forcedRestUntil = now + sMinRestMs; // 强制休息锁：锁期内禁止任何提前开播
    try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch (e) {}
    lumaOpsNotify("下播完成", `【${session.name || '主播'}】${reason || '正常下播'}`, "approve");
    if (typeof syncLiveSessions === 'function') await syncLiveSessions();
    return { success: true, message: `主播已下播（${reason || '正常下播'}）` };
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

  // 冷启动不再强行让固定比例的角色同时在线（去除"打开就有一批人在播"）。
  // 改为按"今日自主决定"给每个角色排期：今天想播 → 定下它自己想开播的时刻，
  // 到点由节拍器开播；今天休播 → 今天完全不排。像真人一样各过各的。
  for (const c of allChars) {
    if (!c || !c.id) continue;
    if (existingSessionCharIds.has(c.id)) {
      // 已有在入场次（可能来自上一段时间结算/用户互动）：如实保留，不强行处理
      const sess = currentSessions.find(s => s.characterId === c.id);
      window.charSchedulesMap[c.id] = {
        initialized: true,
        isLive: true,
        currentSessionId: sess?.id,
        lastStartTime: sess?.startTime || now,
        plannedEndTime: sess?.endTime || (now + 60 * 60 * 1000),
        lastEndTime: null,
        nextOpenAt: null,
        nextCloseAt: null
      };
      continue;
    }
    // 无在入场次：只初始化空排班，把"何时开播/播多久"完全交给每刻哈希概率决定。
    // 绝不预判任何角色"此刻该播"，杜绝"打开就有一批人在播"。
    const sched = ensureSchedEntry(window.charSchedulesMap[c.id]);
    sched.isLive = false;
    sched.currentSessionId = null;
    sched.nextCloseAt = null;
    sched.forcedRestUntil = null;
    sched.lastEndTime = null;
    sched.lastStartTime = null;   // 视为"今天还没开过"，休息增长从本日清晨起算
    window.charSchedulesMap[c.id] = sched;
  }

  try {
    await saveDbSetting("char_schedules", window.charSchedulesMap);
    await saveDbSetting("world_bootstrapped", { date: new Date().toISOString(), bootstrapped: true });
  } catch (e) {}
}
window.bootstrapWorldInitialState = bootstrapWorldInitialState;

// =========================================================================
// 直播列表刷新：房管/工具操作后、结算完成后调用，仅读取并渲染当前场次
// =========================================================================
async function syncLiveSessions() {
  const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  if (typeof renderLiveGrid === 'function') renderLiveGrid();
  return sessions;
}
window.syncLiveSessions = syncLiveSessions;

// =========================================================================
// 【时间差结算器】APP打开时一次性推演全场次，替代后台轮询
// 原理：所有开播/下播时间戳都落在 [上次离开, now] 的历史时刻，
//       正在播的场次保持原 startTime，时长 = now - startTime 真实累计，
//       绝不为"打开瞬间"造一个 startTime（绝不从0秒计直播时长）
// 随机性：seededRandom(charId + 上一个事件时间戳)，确定性随机游走
//        —— 事件推进式：本场未结束时，下一场的开播时刻在数学上还不存在
// =========================================================================
// 简单确定性伪随机：基于字符串种子返回 [0,1)
function seededHash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// =========================================================================
// 【轮询评估器】(恢复 76a5f13 的"倾向 + 比例式增长"决策公式)
// 在线轮询与离线补跑共用同一套评估，统一口径：
//   直播中 → 下播倾向分 = min(100, 下播倾向/2 + 已播分钟/上限×50)
//   休息中 → 开播倾向分 = min(100, 开播倾向/2 + 已休息分钟/上限×50)
//   每轮掷 0~100 骰子：骰子 < 倾向分 → 下播/开播
//   达到时长上限(必)：已播>上限必收 / 已休息>上限必开
// 说明：全程纯 JS 决策、不调 AI；nowTime 用作模拟时间，离线补跑时传入以便重建历史。
// =========================================================================
async function evaluateLivePoll(nowTime = null) {
  const now = nowTime || Date.now();
  const allChars = window.allCharacters || [];
  if (!allChars.length) return;
  if (!window.charSchedulesMap) window.charSchedulesMap = {};
  const params = window.appParams || {};
  const maxLiveMins = params.maxLiveDuration || 240;
  const maxRestMins = params.maxRestDuration || 480;
  const minRestMins = params.minRestDuration || 10;
  const dailyLimit = ((params.dailyLiveLimit ?? 0) > 0) ? Number(params.dailyLiveLimit) : Infinity;

  // ── 轮询日志初始化（记录本轮所有决定与汇总，保留最近 50 轮，对齐 76a5f13）──
  if (!window.lumaOpsLog) window.lumaOpsLog = [];
  window.__lumaPollCycle = (window.__lumaPollCycle || 0) + 1;
  const cycleLog = {
    time: new Date(now).toLocaleTimeString(),
    cycle: window.__lumaPollCycle,
    params: { maxLiveMins, maxRestMins, minRestMins, dailyLimit: dailyLimit === Infinity ? '不限制' : dailyLimit },
    decisions: [],
    summary: { totalChars: allChars.length, streaming: 0, started: 0, stopped: 0, evaluated: 0, offlineSim: !!nowTime }
  };

  const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const streamingIds = new Set(sessions.map(s => s.characterId));
  cycleLog.summary.streaming = sessions.length;

  // ── 直播中：评估下播 ──
  for (const s of sessions) {
    const cid = s.characterId;
    const startTs = Number(s.startTime) || now;
    const liveMins = Math.max(0, (now - startTs) / 60000);
    const urgent = liveMins >= maxLiveMins;
    // 下播倾向值取二分之一折算为 0~50 分；未获取则基础分计 0
    let score = 0;
    let rawTendency = null;
    try {
      const t = await getCharTendency(cid);
      if (t && t.stopTendency != null) { rawTendency = Number(t.stopTendency); score = rawTendency / 2; }
    } catch (e) {}
    const timeScore = Math.round((liveMins / maxLiveMins) * 50);
    const stopScore = urgent ? 100 : Math.min(100, score + timeScore);
    const dice = Math.round(Math.random() * 100);
    const willStop = dice < stopScore;
    cycleLog.decisions.push({
      char: s.name || cid, state: '直播中', liveMins: Math.round(liveMins),
      tendency: rawTendency != null ? `${rawTendency} (折算${Math.round(rawTendency / 2)})` : '暂未获取',
      score: stopScore, dice, result: willStop ? '下播' : '继续播'
    });
    cycleLog.summary.evaluated++;
    if (willStop) {
      cycleLog.summary.stopped++;
      await lumaOpsGateway.requestStopLive({
        characterId: cid,
        reason: urgent ? "达到直播时长上限" : "下播倾向(1/2)+时长增长 决定下播",
        source: "ticker"
      }, nowTime);
    }
  }

  // ── 休息中：评估开播 ──
  for (const c of allChars) {
    const cid = c.id;
    if (!cid || streamingIds.has(cid)) continue;
    const sched = window.charSchedulesMap[cid];
    const lastEndTime = sched?.lastEndTime;
    const restMins = lastEndTime ? Math.max(0, (now - lastEndTime) / 60000) : 9999;
    // 强制休息期：休息未够最短时长，或仍在网关强制休息锁内 → 一律不开播
    if (restMins < minRestMins) continue;
    if (sched?.forcedRestUntil != null && now < sched.forcedRestUntil) continue;
    // 每日场次上限兜底
    if (dailyLimit !== Infinity) {
      try {
        if ((await getDailyStartCount(cid)) >= dailyLimit) continue;
      } catch (e) {}
    }
    const urgent = restMins >= maxRestMins;
    // 开播倾向值取二分之一折算为 0~50 分；未获取则基础分计 0
    let score = 0;
    let rawTendency = null;
    try {
      const t = await getCharTendency(cid);
      if (t && t.startTendency != null) { rawTendency = Number(t.startTendency); score = rawTendency / 2; }
    } catch (e) {}
    const timeScore = Math.round((restMins / maxRestMins) * 50);
    const startScore = urgent ? 100 : Math.min(100, score + timeScore);
    const dice = Math.round(Math.random() * 100);
    const willStart = dice < startScore;
    const charName = c.name || c.displayName || c.username || cid;
    cycleLog.decisions.push({
      char: charName, state: '休息中', restMins: restMins >= 9999 ? '蓄势(未插播过)' : Math.round(restMins),
      tendency: rawTendency != null ? `${rawTendency} (折算${Math.round(rawTendency / 2)})` : '暂未获取',
      score: startScore, dice, result: willStart ? '开播' : '继续休'
    });
    cycleLog.summary.evaluated++;
    if (willStart) {
      cycleLog.summary.started++;
      await lumaOpsGateway.requestStartLive({ characterId: cid, source: "ticker" }, nowTime);
    }
  }

  // ── 写入轮询日志（保留最近 50 轮）──
  window.lumaOpsLog.unshift(cycleLog);
  if (window.lumaOpsLog.length > 50) window.lumaOpsLog.pop();
}
window.evaluateLivePoll = evaluateLivePoll;

// 升级 charSchedulesMap 中"只有轮询残留字段"的旧条目为结算器需要的形状
function ensureSchedEntry(sched) {
  if (!sched) return {
    initialized: true, isLive: false, lastStartTime: null, plannedEndTime: null, lastEndTime: null,
    nextOpenAt: null, nextCloseAt: null
  };
  sched.initialized = sched.initialized !== false;
  sched.isLive = !!sched.isLive;
  sched.lastStartTime = sched.lastStartTime ?? null;
  sched.plannedEndTime = sched.plannedEndTime ?? null;
  sched.lastEndTime = sched.lastEndTime ?? null;
  // 秒级倒计时字段（缺失时置空，由结算器/节拍器按需生成并持久化）
  sched.nextOpenAt = sched.nextOpenAt ?? null;
  sched.nextCloseAt = sched.nextCloseAt ?? null;
  return sched;
}

// 给历史场次写归档：从 live_sessions 移除，写入 streamer_history
// 并同步到直播结算数据体系：直播场次 +1、按配置区间随机增粉（真实/离线结算都走这里）
async function closeAndArchive(char, session, endTime) {
  try {
    const startTs = Number(session.startTime) || endTime;
    const durationMin = Math.max(1, Math.round((endTime - startTs) / 60000));
    // 单场增粉：优先走直播结算模块（按用户设置的最低~最高区间随机），保证与场次/粉丝联动
    let fansGained = 0;
    if (window.LiveStatsManager && typeof window.LiveStatsManager.rollFansGain === 'function') {
      fansGained = window.LiveStatsManager.rollFansGain();
    } else {
      fansGained = Math.floor(durationMin * (seededHash(`fans:${startTs}`) * 3 + 1));
    }
    const historyRecord = {
      id: `show_${session.characterId}_${startTs}`,
      characterId: session.characterId,
      streamerName: session.name || char?.name || '主播',
      title: session.topic || '日常直播',
      cover: session.cover || session.avatar || '', 
      category: session.category || '随性杂谈',
      subTag: session.subTag || '日常唠嗑',
      startTime: startTs,
      endTime: endTime,
      durationMin: durationMin,
      peakViewers: session.viewers || Math.floor(seededHash(`viewer:${startTs}`) * 800 + 300),
      totalLikes: session.likes || Math.floor(seededHash(`like:${startTs}`) * 5000 + 1000),
      totalGifts: Math.floor(seededHash(`gift:${startTs}`) * 200 + 50),
      fansGained: fansGained,
      isOfflineSimulated: true
    };
    await api.db.create("streamer_history", historyRecord);
    // 结算上报：直播场次 +1 并按区间随机增粉 → 持久化 + 刷新粉丝/排行榜
    // 传入真实开播(startTs)/下播(endTime)时间戳，直播场次列表据此展示"几点开 ~ 几点收"
    if (window.LiveStatsManager && typeof window.LiveStatsManager.onShowSettled === 'function') {
      try { await window.LiveStatsManager.onShowSettled(session.characterId, fansGained, startTs, endTime); } catch (e) {}
    }
    await api.db.delete("live_sessions", session.id);
    if (window.LiveRoomStore && typeof window.LiveRoomStore.clearRoom === 'function') {
      const rid = session.roomId || session.id || session.characterId;
      try { await window.LiveRoomStore.clearRoom(rid); } catch (e) {}
    }
  } catch (e) {}
}

// 主结算入口：APP 打开时执行，返回统计摘要
// 离线期间没有轮询，这里按轮询间隔逐段补推演历史决策，模拟"后台一直在跑"，
// 与在线节拍器共用同一个评估器 evaluateLivePoll（倾向值/2 + 比例式增长 + 掷骰），口径完全一致。
async function settleAllLive() {
  try {
    const now = Date.now();
    const lastPollRec = await api.db.get("app_settings", "last_poll_time").catch(() => null);
    const lastSeen = window.readDbSettingValue ? Number(window.readDbSettingValue(lastPollRec)) : Number(lastPollRec);
    if (!lastSeen || isNaN(lastSeen) || lastSeen <= 0) {
      try { await saveDbSetting("last_poll_time", now); } catch (e) {}
      return { settled: false, reason: "first_run" };
    }
    if (now - lastSeen < 60 * 1000) {
      return { settled: false, reason: "too_short", elapsedMs: now - lastSeen };
    }

    // 先初始化缺失的排班（沿用 bootstrap 的安全语义，绝不倒推开播时间）
    if (typeof bootstrapWorldInitialState === 'function') {
      try { await bootstrapWorldInitialState(window.allCharacters || [], window.appParams || {}); } catch (e) {}
    }

    const params = window.appParams || {};
    const maxLiveMins = params.maxLiveDuration || 240;
    const pollIntervalMs = ((params.opsPollInterval || 3) * 60 * 1000);

    // ── 离线补跑：把 [lastSeen, now] 按轮询间隔切成若干历史时刻，逐段调用评估器推演 ──
    // 每个历史时刻都是真实时间戳，开播/下播落在历史，直播时长真实累计。
    // 上限 6000 步仅作防呆（覆盖数天），远大于旧版 30 步导致的"离线超限不收盘"。
    const elapsed = now - lastSeen;
    const steps = Math.min(Math.max(1, Math.ceil(elapsed / pollIntervalMs)), 6000);
    let replayedStop = 0;
    for (let i = 1; i <= steps; i++) {
      const simulatedNow = lastSeen + i * pollIntervalMs;
      if (simulatedNow > now) break;
      try {
        const before = await (api.db.list("live_sessions", { limit: 500 }).catch(() => [])) || [];
        await evaluateLivePoll(simulatedNow);
        const after = await (api.db.list("live_sessions", { limit: 500 }).catch(() => [])) || [];
        // 统计本次补跑收盘了多少场次（下播即从 live_sessions 移除）
        replayedStop += Math.max(0, before.length - after.length);
      } catch (e) {}
    }

    // ── 硬性安全网：无论补跑结果如何，仍超出最大直播时长的场次直接收盘，杜绝"离线显示7小时直播" ──
    const sessions = await api.db.list("live_sessions", { limit: 500 }).catch(() => []) || [];
    const allChars = window.allCharacters || [];
    for (const s of sessions) {
      const cid = s.characterId;
      const liveMins = Math.max(0, (now - (Number(s.startTime) || now)) / 60000);
      if (liveMins >= maxLiveMins) {
        const char = allChars.find(c => c.id === cid) || { id: cid };
        try { await closeAndArchive(char, s, now); } catch (e) {}
        replayedStop++;
      }
    }

    // 结算完成后用真实时间同步一次状态到角色日程，再刷新列表
    try { await syncCharStatusToChat(now); } catch (e) {}
    try { await syncLiveSessions(); } catch (e) {}

    try { await saveDbSetting("last_poll_time", now); } catch (e) {}

    const liveNow = await (api.db.list("live_sessions", { limit: 500 }).catch(() => [])) || [];
    return { settled: true, elapsedMs: now - lastSeen, steps, stopped: replayedStop, live: liveNow.length };
  } catch (e) {
    return { settled: false, reason: "error", error: String(e) };
  }
}
window.settleAllLive = settleAllLive;
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

// =========================================================================
// 【在线节拍器】APP 运行期间定时检查，推动角色按作息自动开播/下播
// 与离线补跑共用同一个评估器 evaluateLivePoll：
//   倾向值(开播/下播)/2 + 比例式增长(已持续/上限×50) → 掷骰判定
// 休息中 → 触发开播 → requestStartLive
// 直播中 → 触发下播 → requestStopLive
// =========================================================================
let __lumaLiveTicker = null;
let __lumaLiveTickerBusy = false;
let __lumaLastPollAt = 0;

async function tickLiveLifecycle() {
  if (__lumaLiveTickerBusy) return;
  __lumaLiveTickerBusy = true;
  try {
    const allChars = window.allCharacters || [];
    if (!allChars.length || !window.charSchedulesMap) return;

    const now = Date.now();
    const params = window.appParams || {};
    const pollIntervalMs = ((params.opsPollInterval || 3) * 60 * 1000);

    // 按轮询间隔节流：到节奏才真正做一次开播/下播决策，
    // 与离线补跑共用同一个评估器 evaluateLivePoll（倾向值/2 + 比例式增长 + 掷骰），口径完全一致
    if (now - __lumaLastPollAt >= pollIntervalMs) {
      __lumaLastPollAt = now;
      await evaluateLivePoll(null);
    }

    // 每次节拍都刷新 last_poll_time，下次离线时据此补跑离线窗口
    try { await saveDbSetting("last_poll_time", now); } catch (e) {}
  } catch (e) {
    console.warn("[LUMA Live] 在线节拍器异常:", e);
  } finally {
    __lumaLiveTickerBusy = false;
  }
}

// 启动在线节拍器（间隔可传，默认 30 秒）
function startLiveTicker(intervalMs = 30000) {
  if (__lumaLiveTicker) clearInterval(__lumaLiveTicker);
  __lumaLiveTicker = setInterval(() => { tickLiveLifecycle(); }, intervalMs);
  return __lumaLiveTicker;
}
window.startLiveTicker = startLiveTicker;
window.tickLiveLifecycle = tickLiveLifecycle;
