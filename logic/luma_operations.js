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

    if (window.charSchedulesMap) {
      const sched = window.charSchedulesMap[characterId];
      if (sched) {
        sched.isLive = false;
        sched.currentSessionId = null;
        sched.plannedEndTime = null;
        sched.lastEndTime = now;
      }
    }
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
// 【秒级随机倒计时模型】所有直播开播/下播共用的决策核心（替代原来的轮询骰子）
// 放弃"每个时间块抛 seededHash 骰子碰概率"，改为每角色一根秒级随机倒计时：
//   · 下播结算时 → 在 [最短休息, 最长休息] 内抽一个精确到秒的随机"下次开播"倒计时
//   · 开播时     → 在 [最短直播, 最长直播] 内抽一个精确到秒的随机"下播"倒计时
//   · nextOpenAt / nextCloseAt 持久化在 charSchedulesMap：
//       - 离线重放照表推进 → 稳定可复现（不再每次重抽，因此不需要骰子）
//       - 在线节拍器按秒校验 → 秒级精度天然错落，真正随机
// =========================================================================
// 秒级随机时长（精确到秒）：闭区间内均匀取整
function rollSeconds(minSecs, maxSecs) {
  minSecs = Math.max(0, Math.floor(minSecs));
  maxSecs = Math.max(minSecs, Math.floor(maxSecs));
  return minSecs + Math.floor(Math.random() * (maxSecs - minSecs + 1));
}
function drawRestSeconds(minRestMins, maxRestMins) {
  return rollSeconds(minRestMins * 60, maxRestMins * 60);
}
function drawLiveSeconds(minLiveMins, maxLiveMins) {
  return rollSeconds(minLiveMins * 60, maxLiveMins * 60);
}

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

// 结算单一角色：从 lastSeen 推演到 now，返回 { name, liveMins, ... }
// 离线：倾向固定忽略，纯秒级随机倒计时，照表(nextOpenAt/nextCloseAt)推进，可复现
async function settleOneChar(char, now, lastSeen) {
  const cid = char.id;
  if (!cid) return null;
  const params = window.appParams || {};
  const maxLiveMins = params.maxLiveDuration || 240;   // 直播上限（分钟）
  const minLiveMins = Math.max(15, Math.round(maxLiveMins * 0.35)); // 单场直播最短时长
  const maxRestMins = params.maxRestDuration || 480;
  const minRestMins = params.minRestDuration || 10;
  const dailyLimit = ((params.dailyLiveLimit ?? 0) > 0) ? Number(params.dailyLiveLimit) : Infinity;

  const sched = ensureSchedEntry(window.charSchedulesMap[cid]);

  // 当前场次
  const sessions = await api.db.list("live_sessions", { limit: 500 }).catch(() => []) || [];
  let session = sessions.find(s => s.characterId === cid) || null;

  // 在播但缺"下播倒计时"：补一个真实秒级直播时长
  if (session) {
    const startTs = Number(session.startTime) || lastSeen;
    if (!sched.lastStartTime) sched.lastStartTime = startTs;
    if (sched.nextCloseAt == null) {
      sched.nextCloseAt = startTs + drawLiveSeconds(minLiveMins, maxLiveMins) * 1000;
    }
  }

  // 事件推进循环：只生成时间戳落在 [lastSeen, now] 内的完整场次链
  let guard = 0;
  while (guard++ < 500) {
    if (session) {
      // ── 直播中：秒级下播倒计时到点 → 结算为历史场次，进入休息 ──
      const closeAt = Number(sched.nextCloseAt) || (Number(session.startTime) + maxLiveMins * 60000);
      if (closeAt > now) {
        sched.isLive = true;
        sched.currentSessionId = session.id;
        break;
      }
      await closeAndArchive(char, session, closeAt);
      session = null;
      sched.isLive = false;
      sched.currentSessionId = null;
      sched.lastEndTime = closeAt;
      sched.lastStartTime = sched.lastStartTime || now;
      sched.nextCloseAt = null;
      // 进入休息：在 [最短休息, 最长休息] 内抽一条精确到秒的"下次开播"倒计时
      sched.nextOpenAt = closeAt + drawRestSeconds(minRestMins, maxRestMins) * 1000;
      continue;
    }

    // ── 休息中：秒级开播倒计时到点 → 开播 ──
    let nextOpen = sched.nextOpenAt;
    if (nextOpen == null) {
      // 首次无排班（如冷启动未初始化到）→ 从上次下播/起始点抽一条秒级倒计时
      nextOpen = (sched.lastEndTime || lastSeen) + drawRestSeconds(minRestMins, maxRestMins) * 1000;
      sched.nextOpenAt = nextOpen;
    }
    if (nextOpen > now) { sched.isLive = false; break; }

    // 每日场次上限拦截
    if (dailyLimit !== Infinity) {
      try {
        const todayCount = await getDailyStartCount(cid);
        if (todayCount >= dailyLimit) { sched.isLive = false; break; }
      } catch (e) {}
    }

    // 到点开播：nextOpen 是历史/现在时刻，写入场次
    session = await openLiveFromHistory(char, nextOpen);
    if (!session) { sched.isLive = false; break; }
    const durSec = drawLiveSeconds(minLiveMins, maxLiveMins);
    sched.isLive = true;
    sched.currentSessionId = session.id;
    sched.lastStartTime = nextOpen;
    sched.lastEndTime = null; // 直播中
    sched.nextOpenAt = null;  // 已消费
    sched.nextCloseAt = nextOpen + durSec * 1000; // 拧直播段的秒级下播倒计时
    try { await incrementDailyStartCount(cid); } catch (e) {}
  }

  window.charSchedulesMap[cid] = sched;
  try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch (e) {}

  return { name: char.name || cid, liveMins: session ? Math.round((now - (Number(session.startTime) || now)) / 60000) : 0, isLive: !!session };
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

// 历史时刻开播：用给定历史时间戳创建场次（unsaved startTime 为历史值）
async function openLiveFromHistory(char, startAt, category, topic, durationMins) {
  try {
    const cid = char.id;
    const allChars = window.allCharacters || [];
    const character = allChars.find(c => c.id === cid);
    const charName = character?.name || '主播';

    let chosenCat = category, chosenSubTag = null, chosenTopic = null;
    if (!chosenCat) {
      if (typeof pickRandomLiveCategory === 'function') {
        const picked = pickRandomLiveCategory();
        chosenCat = picked.mainCat; chosenSubTag = picked.subCat;
      } else { chosenCat = '随性杂谈'; chosenSubTag = '日常唠嗑'; }
    }
    if (topic) chosenTopic = `【${charName}】${topic}`;
    if (!chosenTopic) chosenTopic = `【${charName}】的精彩直播`;

    const newSession = {
      characterId: cid,
      name: charName,
      avatar: character?.avatar || char?.avatar || '',
      cover: character?.cover || character?.avatar || '',
      category: chosenCat,
      subTag: chosenSubTag || '日常唠嗑',
      topic: chosenTopic,
      heat: Math.floor(seededHash(`heat:${startAt}`) * 80000 + 20000),
      roomId: Math.floor(seededHash(`room:${startAt}`) * 899999 + 100000),
      startTime: startAt,
      endTime: startAt + 60 * 60 * 1000,
      isNPC: false
    };

    const created = await api.db.create("live_sessions", newSession);
    return created;
  } catch (e) { return null; }
}

// 主结算入口：APP 打开时执行，返回统计摘要
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

    const chars = window.allCharacters || [];
    const results = [];
    for (const c of chars) {
      try {
        const r = await settleOneChar(c, now, lastSeen);
        if (r) results.push(r);
      } catch (e) {}
    }

    // 结算完成后用真实时间同步一次状态到角色日程，再刷新列表
    try { await syncCharStatusToChat(now); } catch (e) {}
    await syncLiveSessions();

    try { await saveDbSetting("last_poll_time", now); } catch (e) {}

    return { settled: true, elapsedMs: now - lastSeen, chars: results.length, live: results.filter(r => r.isLive).length };
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
// 【在线节拍器】APP 运行期间每 30 秒检查一次，推动角色按作息自动开播/下播
// 与结算器共用同一套 rollToggleAt 概率判定：倾向 + 比例式增长总概率 × 哈希随机源
// 同一时间块编号哈希值确定 → 在线实时判定与离线补账重放结果完全一致
// 休息中 → 该时间块触发开播 → requestStartLive
// 直播中 → 该时间块触发下播 → requestStopLive
// =========================================================================
let __lumaLiveTicker = null;
let __lumaLiveTickerBusy = false;

async function tickLiveLifecycle() {
  if (__lumaLiveTickerBusy) return;
  __lumaLiveTickerBusy = true;
  try {
    const allChars = window.allCharacters || [];
    if (!allChars.length || !window.charSchedulesMap) return;

    const now = Date.now();
    const params = window.appParams || {};
    const maxLiveMins = params.maxLiveDuration || 240;
    const minLiveMins = Math.max(15, Math.round(maxLiveMins * 0.35));
    const maxRestMins = params.maxRestDuration || 480;
    const minRestMins = params.minRestDuration || 10;
    const dailyLimit = ((params.dailyLiveLimit ?? 0) > 0) ? Number(params.dailyLiveLimit) : Infinity;

    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];

    for (const c of allChars) {
      const cid = c.id;
      if (!cid) continue;
      const sched = window.charSchedulesMap[cid];
      // 未初始化过（没结算也没 bootstrap 兜底）的角色跳过，交给结算器兜底
      if (!sched || sched.initialized === false) continue;

      const session = sessions.find(s => s.characterId === cid) || null;

      // 倾向值读取（在线时倾向可能变化，实时参与"改签"判定）；未获取按 null
      let stopTendency = null, startTendency = null;
      try {
        const t = await getCharTendency(cid);
        stopTendency = (t && t.stopTendency != null) ? t.stopTendency : null;
        startTendency = (t && t.startTendency != null) ? t.startTendency : null;
      } catch (e) {}

      if (session) {
        // ── 直播中：秒级下播倒计时到点必收；未到点按 倾向+比例式增长 决定是否提前收 ──
        const startTs = Number(session.startTime) || now;
        if (sched.nextCloseAt == null) {
          sched.nextCloseAt = now + drawLiveSeconds(minLiveMins, maxLiveMins) * 1000;
        }
        const liveElapsedMins = Math.max(0, (now - startTs) / 60000);
        const growth = Math.min(1, liveElapsedMins / maxLiveMins) * 0.5;
        const stopP = Math.min(1, ((stopTendency != null && stopTendency >= 0) ? stopTendency / 200 : 0) + growth);
        const dueStop = (sched.nextCloseAt != null && now >= sched.nextCloseAt) || Math.random() < stopP;
        if (dueStop) {
          await lumaOpsGateway.requestStopLive({
            characterId: cid,
            reason: "到点自动下播（运营组判定已到）",
            source: "ticker"
          });
          // 下播后进入休息，拧一条秒级随机的下次开播倒计时
          sched.nextCloseAt = null;
          sched.nextOpenAt = now + drawRestSeconds(minRestMins, maxRestMins) * 1000;
          try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch (e) {}
        }
        continue;
      }

      // ── 休息中：秒级开播倒计时到点必开；未到点按 倾向+比例式增长 是否"改签提前"开 ──
      const restBase = sched.lastEndTime || sched.lastStartTime || now;
      const restElapsedMins = Math.max(0, (now - restBase) / 60000);
      const g = Math.min(1, restElapsedMins / maxRestMins) * 0.5;
      const startP = Math.min(1, ((startTendency != null && startTendency >= 0) ? startTendency / 200 : 0) + g);
      // toBase = 秒级倒计时到点（必开）；tendLevel = 倾向"改签"，random<p 提前开（比例式增长随爬）
      const dueOpen = (sched.nextOpenAt != null && now >= sched.nextOpenAt) || Math.random() < startP;
      if (!dueOpen) continue;

      if (dailyLimit !== Infinity) {
        try {
          const todayCount = await getDailyStartCount(cid);
          if (todayCount >= dailyLimit) continue;
        } catch (e) {}
      }

      await lumaOpsGateway.requestStartLive({
        characterId: cid,
        source: "ticker"
      });
      // 开播后（w上一段倒计时已消费），拧本场直播的秒级下播倒计时
      sched.nextOpenAt = null;
      sched.nextCloseAt = now + drawLiveSeconds(minLiveMins, maxLiveMins) * 1000;
      try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch (e) {}
    }
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
