// =========================================================================
// LUMA Live 直播运营核心 (v2.0 作息纸条版)
//
// 决策机制：抛弃后台轮询，改为「作息纸条 + 心跳核对 + 判定即执行」
//   · 每个主播一条纸条：她在哪个状态、这个状态从哪一刻开始、上次何时判定
//   · 心跳每 30 秒核对一次：只问"现在该不该为她掷一次骰"，不评估全员、不排队、不记账
//   · 掷中了当场送房管审核并落地；没掷中只留一个时间戳，下一拍自然还有机会
//   · 推演依据仍是【倾向值/2 + 比例式增长(已持续时长/上限×50)】——
//     因为这个概率本身随真实时间 continuously 变化，命中落在哪一拍不可预测，
//     所以推演出的"这一场播多久 / 这次歇多久"是活的，不是钉死的固定值
//   · 已彻底移除：后台轮询、延迟1-10分钟执行队列、离线6000步重演、逾时硬收盘、
//     forcedRestUntil 强制休息锁（改由"在播未满最短门槛不掷下播骰"这一道硬门槛承担）
//   · 结算链保持不动：下播仍走 closeAndArchive（归档 streamer_history + 场次/粉丝）
//   · 每日场次上限 dailyLiveLimit 保留，位置移到掷骰之前当闸门
// 三条铁律：
//   1. 纸条是决策的唯一真相；live_sessions 是"她在不在播"的唯一真相（心跳会校正纸条）
//   2. 一次心跳只改被判定那一个人的那一条，绝不整块读改写
//   3. 所有开播/下播（含 AI 工具、手动、心跳）必须过 lumaOpsGateway 房管审核
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 作息事件流：文件加载即初始化，避免首次心跳前访问报错
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

// 倾向值缓存：同一拍/相邻几拍反复用到同一个角色时，不必每次都打 readState + readHistory。
// 心跳是 30 秒一下、判定间隔至少 3 分钟，90 秒的缓存既能吸收同一拍的重复读，
// 又不至于让角色刚写进状态栏的数值迟迟不生效。
const TENDENCY_CACHE_MS = 90 * 1000;
const tendencyCache = {};
async function getCachedTendency(characterId) {
  const hit = tendencyCache[characterId];
  if (hit && (Date.now() - hit.at) < TENDENCY_CACHE_MS) return hit.data;
  const data = await readCharTendency(characterId);
  tendencyCache[characterId] = { at: Date.now(), data: data || {} };
  return data || { startTendency: null, stopTendency: null };
}
window.getCachedTendency = getCachedTendency;

// =========================================================================
// 【调试回调与运营组专用通知系统】(正式运行已静默调试弹层)
// =========================================================================
function lumaOpsNotify(title, detail, type = 'info') {
}
window.lumaOpsNotify = lumaOpsNotify;

// =========================================================================
// 【给历史场次写归档】把场次从 live_sessions 移除，写入 streamer_history
// 并同步到直播结算数据体系：直播场次 +1、按配置区间随机增粉（真实/离线结算都走这里）
// 直播时长按真实 startTs ~ endTime 累计；人气/礼物等展示数据为随机模拟值
// =========================================================================
async function closeAndArchive(char, session, endTime) {
  try {
    const startTs = Number(session.startTime) || endTime;
    const durationMin = Math.max(1, Math.round((endTime - startTs) / 60000));
    // 单场增粉：优先走直播结算模块（按用户设置的最低~最高区间随机），保证与场次/粉丝联动
    let fansGained = 0;
    if (window.LiveStatsManager && typeof window.LiveStatsManager.rollFansGain === 'function') {
      fansGained = window.LiveStatsManager.rollFansGain();
    } else {
      fansGained = Math.floor(durationMin * (Math.random() * 3 + 1));
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
      peakViewers: session.viewers || Math.floor(Math.random() * 800 + 300),
      totalLikes: session.likes || Math.floor(Math.random() * 5000 + 1000),
      totalGifts: Math.floor(Math.random() * 200 + 50),
      fansGained: fansGained,
      isOfflineSimulated: true
    };
    await api.db.create("streamer_history", historyRecord);
    // 结算上报：直播场次 +1 并按区间随机增粉 → 持久化 + 刷新粉丝/排行榜
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
window.closeAndArchive = closeAndArchive;

// =========================================================================
// 【房管】：直播间开关权限管理 + 审核裁决网关（防多开、防分身、维护模式拦截）
// 官方运营组（后台轮询）做概率决策后通知房管，房管审核通过才开关直播间
// 关闭直播走 closeAndArchive 做结算归档；下播后加【强制休息锁】
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
    // 法定休息门槛：纸条上她这次"从哪一刻开始歇"距今不足 minRestDuration，一律驳回。
    // 取代原先的 forcedRestUntil 双轨锁 —— 门槛只在这一处判定，判定只依据一个时刻。
    const restAnchor = sched && (typeof sched.anchorAt === 'number'
      ? (sched.state === 'rest' ? sched.anchorAt : null)
      : (sched.lastEndTime || null));
    if (restAnchor != null && (now - restAnchor < minRestMs)) {
      const remainingMins = Math.max(1, Math.ceil((minRestMs - (now - restAnchor)) / 60000));
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

    // 本场计划时长：未显式指定时，在 最长直播时长的一半 ~ 最长直播时长 之间随机
    const dur = durationMins || (Math.floor(Math.random() * (params.maxLiveDuration || 120)) / 2 + Math.max(15, Math.floor((params.maxLiveDuration || 120) / 4)));
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

    // 纸条翻面：进入"在播"，锚点=本场开播时刻，任期号+1（旧的心跳判定若还挂着会自动作废）
    await bumpRhythm(characterId, 'live', start, created.id);
    await incrementDailyStartCount(characterId);

    lumaOpsNotify("开播批准", `【${charName}】通过审核已成功推流开播 (房号:${created.roomId})`, "approve");

    await refreshLiveList();

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
    // 结算归档：直播场次 +1、按配置区间随机增粉、写 streamer_history、清空房号临存
    await closeAndArchive(character, session, now);

    // 纸条翻面：进入"在歇"，锚点=本次下播时刻。
    // 法定休息期不再另存一份锁，房管驳回只看这个锚点，避免两处真相。
    await bumpRhythm(characterId, 'rest', now, null);
    lumaOpsNotify("下播完成", `【${session.name || '主播'}】${reason || '正常下播'}`, "approve");
    await refreshLiveList();
    return { success: true, message: `主播已下播（${reason || '正常下播'}）` };
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
// 【作息纸条】每个主播一条，是"她下一步什么时候可能被推翻"的唯一真相
//   state     : 'live' 在播 / 'rest' 在歇
//   anchorAt  : 这个状态从哪一刻开始（在播=本场开播时刻；在歇=本次下播时刻）
//   sessionId : 在播时对应的房间记录 id（仅记录，判重仍以 live_sessions 为准）
//   lastRollAt: 上一次为她掷骰的时刻（判定间隔节流用）
//   seq       : 任期号，每翻一次面 +1
//   lastRoll  : 最后一掷的快照（{mins,base,p,dice,hit,note}），只给面板看，不参与决策
// 存储沿用 app_settings.char_schedules；旧字段(lastStartTime/lastEndTime/
// plannedEndTime/forcedRestUntil/isLive)一律作废，由 ensureRhythm 一次性迁移成纸条。
// =========================================================================
const RHYTHM_HEARTBEAT_MS = 30 * 1000;   // 心跳：30 秒核对一次，只核对不决策

function rhythmMap() {
  if (!window.charSchedulesMap) window.charSchedulesMap = {};
  return window.charSchedulesMap;
}
async function saveRhythmMap() {
  try { await saveDbSetting("char_schedules", window.charSchedulesMap || {}); } catch (e) {}
}

// 判定间隔（分钟）：同一个主播隔多久才允许再掷一次骰 —— 这就是"45% 的分母"。
// 字段语义已从"后台轮询间隔"换成"直播判定间隔"，兼容读旧存档里的 opsPollInterval。
function getRollIntervalMins() {
  const p = window.appParams || {};
  const v = Number(p.liveRollInterval !== undefined ? p.liveRollInterval : p.opsPollInterval);
  return (isFinite(v) && v > 0) ? v : 3;
}

// 在播门槛：本场已播不满这个时长，一次下播骰都不掷 —— 杜绝"开播下播开播"横跳
function getMinLiveGateMins() {
  const maxLive = Number((window.appParams || {}).maxLiveDuration) || 240;
  return Math.max(15, Math.round(maxLive * 0.35));
}

// 房管翻纸条的唯一入口（AI 工具、手动、心跳三条路都汇聚到这里）
async function bumpRhythm(characterId, nextState, atTime, sessionId) {
  const map = rhythmMap();
  const prev = map[characterId] || {};
  map[characterId] = {
    state: nextState,
    anchorAt: Number(atTime) || Date.now(),
    sessionId: sessionId || null,
    lastRollAt: Number(prev.lastRollAt) || 0,
    seq: (Number(prev.seq) || 0) + 1,
    lastRoll: prev.lastRoll || null
  };
  await saveRhythmMap();
  return map[characterId];
}
window.bumpRhythm = bumpRhythm;

// 事件流（取代原先"每轮一份"的轮询日志）：只记真正发生了的事，保留最近 80 条
function pushRhythmEvent(evt) {
  if (!window.lumaOpsLog) window.lumaOpsLog = [];
  window.lumaOpsLog.unshift(Object.assign({ time: new Date(evt.at).toLocaleTimeString() }, evt));
  if (window.lumaOpsLog.length > 80) window.lumaOpsLog.length = 80;
}

// 校正 + 补齐纸条：以 live_sessions 为唯一真相。纸条和房间对不上，一律信房间。
async function ensureRhythm(sessions, now) {
  const map = rhythmMap();
  const allChars = window.allCharacters || [];
  const roomOf = {};
  (sessions || []).forEach(s => { if (s && s.characterId) roomOf[s.characterId] = s; });
  let dirty = false;

  for (const c of allChars) {
    if (!c || !c.id) continue;
    const room = roomOf[c.id];
    const e = map[c.id];

    if (room) {
      const anchor = Number(room.startTime) || now;
      if (!e || e.state !== 'live' || typeof e.anchorAt !== 'number' || e.anchorAt !== anchor) {
        map[c.id] = {
          state: 'live', anchorAt: anchor, sessionId: room.id || null,
          lastRollAt: (e && e.state === 'live' && Number(e.lastRollAt) > anchor) ? e.lastRollAt : anchor,
          seq: (e && Number(e.seq)) || 0, lastRoll: (e && e.lastRoll) || null
        };
        dirty = true;
      }
      continue;
    }

    // 没有房间 = 她没在播。纸条说要播 → 房间被手动关了/结算失败，一律信房间。
    if (!e || e.state !== 'rest' || typeof e.anchorAt !== 'number') {
      // 新加入或旧字段作废的角色：给她一个"已经歇了一会儿"的随机锚点，
      // 免得所有人心跳同拍对齐、挤在同一分钟一起开播。
      const minRest = Number((window.appParams || {}).minRestDuration) || 10;
      const anchor = (e && Number(e.lastEndTime)) || (now - (minRest + 5 + Math.floor(Math.random() * 90)) * 60000);
      map[c.id] = {
        state: 'rest', anchorAt: anchor, sessionId: null,
        lastRollAt: anchor, seq: (e && Number(e.seq)) || 0, lastRoll: (e && e.lastRoll) || null
      };
      dirty = true;
    }
  }

  if (dirty) await saveRhythmMap();
  return map;
}

// 为一个人掷一次骰。返回 null = 这一拍根本不掷（门槛没过）；返回对象 = 掷了。
// 概率 p = 倾向值/2 + min(1, 该状态已持续分钟/对应上限) × 50   （区间 0~100）
// 倾向值读不到 → 按中性 50 折算 25 分，不再按 0 分算死（0 分会把机制退化成纯倒计时）
async function rollOneChar(char, entry, now) {
  const params = window.appParams || {};
  const heldMins = Math.max(0, (now - entry.anchorAt) / 60000);

  if (entry.state === 'live') {
    if (heldMins < getMinLiveGateMins()) return null;               // 时长没走完，一次都不掷
    const cap = Number(params.maxLiveDuration) || 240;
    const tend = await getCachedTendency(char.id);
    const raw = (tend && tend.stopTendency != null) ? Number(tend.stopTendency) : null;
    const base = (raw == null || !isFinite(raw)) ? 50 : Math.max(0, Math.min(100, raw));
    // 概率 = 倾向/2 + 时间增长；到上限直接钉成 100 —— 这一行替代了旧版整段"逾时硬收盘"，
    // 保证上限是真上限（不再有赖播的僵尸房间），上限以内的时刻仍然完全随机
    const p = (heldMins >= cap) ? 100 : Math.min(100, Math.round(base / 2 + Math.min(1, heldMins / cap) * 50));
    const dice = Math.floor(Math.random() * 100);
    return { kind: 'stop', mins: Math.round(heldMins), base: (raw == null ? '暂未获取(按中性50)' : raw), p, dice, hit: dice < p };
  }

  const minRest = Number(params.minRestDuration) || 10;
  if (heldMins < minRest) return null;                              // 法定休息期没过，不掷
  const dailyLimit = (params.dailyLiveLimit !== undefined && params.dailyLiveLimit > 0) ? Number(params.dailyLiveLimit) : Infinity;
  if (dailyLimit !== Infinity) {
    const todayCount = await getDailyStartCount(char.id);
    if (todayCount >= dailyLimit) {
      return { kind: 'start', mins: Math.round(heldMins), base: '-', p: 0, dice: '-', hit: false, note: `今日已达${dailyLimit}场上限` };
    }
  }
  const cap = Number(params.maxRestDuration) || 480;
  const tend = await getCachedTendency(char.id);
  const raw = (tend && tend.startTendency != null) ? Number(tend.startTendency) : null;
  const base = (raw == null || !isFinite(raw)) ? 50 : Math.max(0, Math.min(100, raw));
  // 同上：歇到休息上限必开播，上限以内看倾向和运气
  const p = (heldMins >= cap) ? 100 : Math.min(100, Math.round(base / 2 + Math.min(1, heldMins / cap) * 50));
  const dice = Math.floor(Math.random() * 100);
  return { kind: 'start', mins: Math.round(heldMins), base: (raw == null ? '暂未获取(按中性50)' : raw), p, dice, hit: dice < p };
}

// =========================================================================
// 【心跳】每 30 秒核对一次：谁到了该掷的时候，就只替她掷一次、办一件事。
// 与旧轮询的本质区别：不遍历评估全员倾向、不写延迟队列、不整块读改写、带重入锁。
// =========================================================================
async function rhythmTick() {
  if (window.__rhythmBusy) return { skipped: 'busy' };
  window.__rhythmBusy = true;
  try {
    const now = Date.now();
    const rollMs = getRollIntervalMins() * 60000;
    let sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const map = await ensureRhythm(sessions, now);
    const allChars = window.allCharacters || [];
    let changed = false, touched = false;

    for (const c of allChars) {
      if (!c || !c.id) continue;
      const entry = map[c.id];
      if (!entry) continue;
      if (now - (Number(entry.lastRollAt) || 0) < rollMs) continue;   // 没到她的判定时刻
      entry.lastRollAt = now;
      touched = true;

      const r = await rollOneChar(c, entry, now);
      if (!r) continue;
      entry.lastRoll = { mins: r.mins, base: r.base, p: r.p, dice: r.dice, hit: r.hit, note: r.note || '' };
      if (!r.hit) continue;

      const wasState = entry.state;
      let res = null;
      try {
        if (wasState === 'live') {
          const cap = Number((window.appParams || {}).maxLiveDuration) || 240;
          res = await lumaOpsGateway.requestStopLive({
            characterId: c.id,
            reason: r.mins >= cap ? '已达直播时长上限' : '倾向与时长共同判定该下播',
            source: 'rhythm'
          });
        } else {
          res = await lumaOpsGateway.requestStartLive({ characterId: c.id, source: 'rhythm' });
        }
      } catch (e) { res = { success: false, reason: String(e) }; }

      // 房管驳回同样记账：旧版通知是空函数，驳回原因用户永远看不到
      pushRhythmEvent({
        at: now, char: c.name || c.id, kind: r.kind, from: wasState,
        to: (res && res.success) ? (wasState === 'live' ? 'rest' : 'live') : wasState,
        mins: r.mins, base: r.base, p: r.p, dice: r.dice,
        ok: !!(res && res.success),
        note: (res && res.success) ? (r.note || '') : ((res && res.reason) || '房管驳回')
      });
      if (res && res.success) changed = true;
    }

    if (touched) await saveRhythmMap();
    if (changed) {
      sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
      window.liveList = sessions;
      if (typeof renderLiveGrid === 'function') { try { renderLiveGrid(); } catch (e) {} }
      try { syncCharStatusToChat(now); } catch (e) {}
    }
    return { rolls: touched, changed };
  } finally {
    window.__rhythmBusy = false;
  }
}
window.rhythmTick = rhythmTick;

// 启停心跳（全局只允许存在一个心跳）
function startLiveRhythm() {
  stopLiveRhythm();
  window.__lumaLiveSyncInterval = setInterval(() => {
    try { rhythmTick(); } catch (e) {}
  }, RHYTHM_HEARTBEAT_MS);
}
function stopLiveRhythm() {
  if (window.__lumaLiveSyncInterval) { clearInterval(window.__lumaLiveSyncInterval); window.__lumaLiveSyncInterval = null; }
}
window.startLiveRhythm = startLiveRhythm;
window.stopLiveRhythm = stopLiveRhythm;

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
// 【世界生态冷启动】只在首次安装（char_schedules 为空）时执行一次。
// 只发纸条、造少量房间，之后一切交给心跳 —— 不在这里预排"她几点开几点下"。
// 锚点刻意打散：在播的人已播时长都落在最短门槛之内，避免打开瞬间集体下播。
// =========================================================================
async function bootstrapWorldInitialState(allChars, params = {}) {
  const now = Date.now();
  const minRestMins = params.minRestDuration || 10;
  const gateMins = Math.max(15, Math.round((params.maxLiveDuration || 240) * 0.35));

  if (!window.charSchedulesMap) window.charSchedulesMap = {};
  const total = (allChars || []).length;
  if (!total) return;

  const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const roomOf = {};
  sessions.forEach(s => { if (s && s.characterId) roomOf[s.characterId] = s; });

  for (const c of allChars) {
    if (!c || !c.id) continue;

    // 已经有房间的：以房间为真相，纸条照着房间写
    if (roomOf[c.id]) {
      const a = Number(roomOf[c.id].startTime) || now;
      window.charSchedulesMap[c.id] = { state: 'live', anchorAt: a, sessionId: roomOf[c.id].id, lastRollAt: a, seq: 1, lastRoll: null };
      continue;
    }

    if (Math.random() < 0.4 || total === 1) {
      // 发一张"在播"的纸条并造出这个房间：已播 2 分钟 ~ 门槛前一分钟，全员打散
      const heldMins = 2 + Math.floor(Math.random() * Math.max(1, gateMins - 3));
      const startTime = now - heldMins * 60000;
      const coverUrl = c.cover || c.avatar || '';
      const picked = (typeof pickRandomLiveCategory === 'function') ? pickRandomLiveCategory() : { mainCat: '随性杂谈', subCat: '日常唠嗑' };
      try {
        const created = await api.db.create("live_sessions", {
          characterId: c.id, name: c.name || '主播', avatar: c.avatar || coverUrl, cover: coverUrl,
          category: picked.mainCat, subTag: picked.subCat,
          topic: `【${c.name || '主播'}】的精彩直播`,
          heat: Math.floor(Math.random() * 80000 + 20000),
          roomId: Math.floor(Math.random() * 899999 + 100000),
          startTime: startTime, endTime: startTime + gateMins * 60000, isNPC: false
        });
        window.charSchedulesMap[c.id] = { state: 'live', anchorAt: startTime, sessionId: (created && created.id) || null, lastRollAt: startTime, seq: 1, lastRoll: null };
      } catch (e) {
        console.warn("冷启动直播间创建失败:", e);
        const fa = now - (minRestMins + 5 + Math.floor(Math.random() * 90)) * 60000;
        window.charSchedulesMap[c.id] = { state: 'rest', anchorAt: fa, sessionId: null, lastRollAt: fa, seq: 0, lastRoll: null };
      }
      continue;
    }

    // 在歇：歇了多久随机散开 —— 有人马上就能开播，有人还要磨蹭半天
    const ra = now - (minRestMins + Math.floor(Math.random() * 120)) * 60000;
    window.charSchedulesMap[c.id] = { state: 'rest', anchorAt: ra, sessionId: null, lastRollAt: ra, seq: 0, lastRoll: null };
  }

  try {
    await saveDbSetting("char_schedules", window.charSchedulesMap);
    await saveDbSetting("world_bootstrapped", { date: new Date().toISOString(), bootstrapped: true });
  } catch (e) {}
}
window.bootstrapWorldInitialState = bootstrapWorldInitialState;

// =========================================================================
// 【列表刷新】只做一件事：把 live_sessions 挂到 window.liveList 并重渲染。
// 保留旧函数名 syncLiveSessions，是因为房管与启动流程多处调用它（旧 allowSpawn:false
// 分支走的就是这里）。它不做任何决策 —— 决策只发生在 rhythmTick。
// =========================================================================
async function syncLiveSessions(options = {}) {
  const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  if (typeof renderLiveGrid === 'function') { try { renderLiveGrid(); } catch (e) {} }
  return sessions;
}
async function refreshLiveList() { return await syncLiveSessions(); }
window.syncLiveSessions = syncLiveSessions;
window.refreshLiveList = refreshLiveList;

// =========================================================================
// 【重开 APP 核对】取代旧版"离线 6000 步重演 + 逾时硬收盘"。
// 新机制不需要重演：纸条上只有绝对时刻，概率按真实已持续时长计算，
// 所以离开多久回来，第一拍心跳就能算出她此刻该不该切换，
// 且切换时刻仍落在真实历史上（已播时长 = now - anchorAt，绝不为"打开瞬间"造时间）。
//   · 离线期间"开了一场又下完"的整场不入账 —— 本机制的已知取舍，暂不改
//   · 顺手清掉旧版遗留的延迟队列，避免历史数据继续干扰判断
// =========================================================================
async function settleAllLive() {
  const now = Date.now();
  try {
    const leftover = await api.db.get("app_settings", "luma_pending_actions").catch(() => null);
    if (leftover) await saveDbSetting("luma_pending_actions", []);
  } catch (e) {}
  try {
    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    await ensureRhythm(sessions, now);
    window.liveList = sessions;
  } catch (e) {}
  try { await rhythmTick(); } catch (e) {}
  try { await saveDbSetting("last_poll_time", now); } catch (e) {}
  const liveNow = await api.db.list("live_sessions", { limit: 500 }).catch(() => []) || [];
  return { settled: true, live: liveNow.length };
}
window.settleAllLive = settleAllLive;

// =========================================================================
// 【在线后台轮询入口】注意：在线决策轮询由 settings/main.js 的 resetLumaOpsTimer
// 定时调用 syncLiveSessions({allowSpawn:true}) 驱动（间隔=设置页「后台轮询时长间隔」，
// 默认3分钟可调）——这是 76a5f13 原版机制，不设独立的在线决策节拍器。
// =========================================================================

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
          const lastEndTime = (sched && sched.state === 'rest' && typeof sched.anchorAt === 'number') ? sched.anchorAt : null;
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

// 兼容导出：lumaOpsPoll 名字保留给外部调用点，实际已指向心跳判定
window.lumaOpsPoll = rhythmTick;