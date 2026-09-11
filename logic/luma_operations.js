// =========================================================================
// LUMA Live 直播运营核心 (v2.1 时间块推演版)
//
// 决策机制：「作息纸条 + 心跳核对 + 时间块推演」—— 决策里没有随机数
//   · 每个主播一条纸条：她在播还是在歇、这个状态从哪一刻开始、下一个块几点到
//   · 某一刻她要不要翻面，由 seededHash("开/下:谁:第几块") 与概率 p 比大小决定。
//     这个"定数"跟什么时候来问无关：现在算、一小时后算、一周后算，答案同一个。
//   · p = 倾向值/200 + min(1, 该状态已持续/对应上限) × 0.5
//     倾向值就是她在这个块里翻面的底分（45 → 每块多 22.5% 的把握），
//     时间拖得越久越倾向翻面 —— 所以每场播多久、每次歇多久都是活的。
//   · 时间块 = 1 分钟（与以前的推演一致），所以"45%"指的是每个分钟块里的把握。
//   · 没有定时器：谁要用直播状态谁就算一次（开APP、切回前台、手动刷新、房管
//     操作之后）。每次核算顺着她的链条推到此刻，该翻的那一步当场送房管审核、
//     当场落地，且写入的是**那一步的真实历史时刻**，不是"现在"。
//   · 因此离线 12 小时不需要任何"补跑"：晚问一步，同一段代码把中间缺的几场
//     依次算成正常场次（经房管、写历史时刻、正常结算场次与涨粉）。
//     直播机制只有一套，在线离线都是它 —— 离线只是"晚一点问"，不是另一套算法。
//   · 已彻底移除：后台轮询与一切常驻定时器(setInterval)、延迟1-10分钟执行队列、
//     离线6000步重演、逾时硬收盘、forcedRestUntil 强制休息锁、决策用的 Math.random()
//   · 上限改由一行保证：拖到上限时 p 钉成 1，必翻面（不再有赖播的僵尸房间）
//   · 在播未满最短门槛（最长时长的 35%，最低 15 分钟）不进入判定 —— 杜绝横跳
//   · 结算链保持不动：下播仍走 closeAndArchive（归档 streamer_history + 场次/粉丝）
//   · 每日场次上限 dailyLiveLimit 保留，位置在推演之前当闸门
// 三条铁律：
//   1. 纸条是决策的唯一真相；live_sessions 是"她在不在播"的唯一真相（心跳校正纸条）
//   2. 一次心跳只改被判定那一个人的那一条，绝不整块读改写
//   3. 所有开播/下播（含 AI 工具、手动、核算）必须过 lumaOpsGateway 房管审核
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 作息事件流：文件加载即初始化，避免首次心跳前访问报错
if (!window.lumaOpsLog) window.lumaOpsLog = [];
// =========================================================================
// 【角色倾向值管理】
// 倾向值由角色自行判定状态后，通过富媒体指令注入到原生状态栏
// 状态栏数值格式：[名称:数字]，例如 [开播倾向:75] / [下播倾向:20]
// 后台通过 AiPhone.characters.readState 读取，再参与时间块推演
// 倾向值范围 0-100：换算成每块 0~0.5 的底分，再加上 0~0.5 的时间增长
// 未获取的角色返回 null，推演时按中性 50 折算（按 0 会把机制退化成纯倒计时），面板标注「暂未获取」
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
    // 只有"刚刚才下的播"才清公屏快照；核算回填出来的历史场次不能清 ——
    // 否则用户正在看的房间会被抹成空白（表现为点进去没弹幕）
    if (endTime >= Date.now() - 90 * 1000
        && window.LiveRoomStore && typeof window.LiveRoomStore.clearRoom === 'function') {
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
// 【作息纸条】每个主播一条，是她作息状态的唯一真相
//   state    : 'live' 在播 / 'rest' 在歇
//   anchorAt : 这个状态从哪一刻开始（在播=本场开播时刻；在歇=本次下播时刻）
//   sessionId: 在播时对应的房间记录 id（仅记录；判重仍以 live_sessions 为准）
//   seq      : 任期号，每翻一次面 +1
//   lastFlip : 上一次核算的快照 {kind, at, mins, p, r}，只给面板看，不参与决策
// 存储沿用 app_settings.char_schedules；旧字段(lastStartTime/lastEndTime/
// plannedEndTime/forcedRestUntil/isLive/lastRollAt/nextCheckAt)一律作废。
// =========================================================================
const RHYTHM_BLOCK_MS = 60 * 1000;   // 时间块 = 1 分钟（与以前的推演一致）

function rhythmMap() {
  if (!window.charSchedulesMap) window.charSchedulesMap = {};
  return window.charSchedulesMap;
}
async function saveRhythmMap() {
  try { await saveDbSetting("char_schedules", window.charSchedulesMap || {}); } catch (e) {}
}

// 在播门槛：本场已播不满这个时长，不进入下播判定 —— 杜绝"开播下播开播"横跳
function getMinLiveGateMins() {
  const maxLive = Number((window.appParams || {}).maxLiveDuration) || 240;
  return Math.max(15, Math.round(maxLive * 0.35));
}

// 房管翻纸条的唯一入口（AI 工具、手动、核算三条路都汇聚到这里）
async function bumpRhythm(characterId, nextState, atTime, sessionId) {
  const map = rhythmMap();
  const prev = map[characterId] || {};
  map[characterId] = {
    state: nextState,
    anchorAt: Number(atTime) || Date.now(),
    sessionId: sessionId || null,
    seq: (Number(prev.seq) || 0) + 1,
    lastFlip: prev.lastFlip || null
  };
  await saveRhythmMap();
  return map[characterId];
}
window.bumpRhythm = bumpRhythm;

// 翻面流水（给面板/排查用）：只记真正发生了的事，保留最近 80 条
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
      if (!e || e.state !== 'live' || e.anchorAt !== anchor) {
        map[c.id] = { state: 'live', anchorAt: anchor, sessionId: room.id || null, seq: (e && Number(e.seq)) || 0, lastFlip: (e && e.lastFlip) || null };
        dirty = true;
      }
      continue;
    }

    // 没有房间 = 她没在播。纸条说要播 → 房间被手动关了/结算失败，一律信房间。
    if (!e || e.state !== 'rest' || typeof e.anchorAt !== 'number') {
      // 新加入或旧字段作废的角色：给一个"已经歇了一会儿"的锚点，免得全员同一分钟一起开播
      const minRest = Number((window.appParams || {}).minRestDuration) || 10;
      const anchor = (e && Number(e.lastEndTime)) || (now - (minRest + 5 + Math.floor(Math.random() * 180)) * 60000);
      map[c.id] = { state: 'rest', anchorAt: anchor, sessionId: null, seq: (e && Number(e.seq)) || 0, lastFlip: (e && e.lastFlip) || null };
      dirty = true;
    }
  }

  if (dirty) await saveRhythmMap();
  return map;
}

// =========================================================================
// 【定数推演】某个时刻她翻不翻面，是一道可以反复验算的算式，不是随机数
//   每个时间块 b 的"定数" = seededHash("开/下:谁:第几块")  —— 永远同一个值
//   总概率 p = 倾向值的一半(0~50分换算成0~0.5) + 比例式增长(已持续/上限 × 50分)
//   定数 < p 的那一块，就是她翻面的时刻
// 因为算式只依赖(谁, 开还是下, 第几分钟)，不依赖"什么时候来问"：
//   在线算、离线 12 小时后算、一周后算，答案完全相同 ——
//   所以离线根本不需要补跑：晚问一步，那些场次本来就该在那几个时刻发生。
// 到上限那一块 p 钉成 1（必翻）：保证上限是真上限，不留赖播的僵尸房间。
// =========================================================================
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

// 从"锚点 + 最短门槛"之后的第一个块起逐块验算，返回第一个命中的块时刻；没有 → null
function rollToggleAt(charId, kind, anchorTs, nowTs, tendency, maxMins, minMins) {
  const minM = Math.max(1, minMins || 1);
  const maxM = Math.max(minM, maxMins || 120);
  const tendScore = (tendency != null && tendency >= 0) ? Math.min(100, tendency) / 200 : 0;
  const startBlock = Math.ceil((anchorTs + minM * 60000) / RHYTHM_BLOCK_MS);
  const endBlock = Math.floor(nowTs / RHYTHM_BLOCK_MS);
  for (let b = startBlock; b <= endBlock; b++) {
    const at = b * RHYTHM_BLOCK_MS;
    const elapsedMins = Math.max(0, (at - anchorTs) / 60000);
    const growth = Math.min(1, elapsedMins / maxM);
    const p = (growth >= 1) ? 1 : Math.min(1, tendScore + growth * 0.5);
    const r = seededHash(`${kind}:${charId}:${b}`);
    if (r < p) return { flipAt: at, block: b, p: Math.round(p * 100), r: Math.round(r * 100), mins: Math.round(elapsedMins) };
  }
  return null;
}
window.rollToggleAt = rollToggleAt;

function normBase(v) {
  // 倾向值读不到 → 按中性 50 折算，不按 0 算死（0 会把机制退化成纯倒计时）
  const n = (v == null || !isFinite(Number(v))) ? 50 : Number(v);
  return Math.max(0, Math.min(100, n));
}

// 她到此刻为止该不该翻面？该 → 给出那次翻面（含真实历史时刻）；不该 → null
async function nextDueFlip(char, entry, now) {
  const params = window.appParams || {};

  if (entry.state === 'live') {
    const cap = Number(params.maxLiveDuration) || 240;
    const gate = getMinLiveGateMins();
    if ((now - entry.anchorAt) / 60000 < gate) return null;
    const tend = await getCachedTendency(char.id);
    const base = normBase(tend && tend.stopTendency);
    const f = rollToggleAt(char.id, 'stop', entry.anchorAt, now, base, cap, gate);
    return f ? Object.assign({ kind: 'stop', base }, f) : null;
  }

  const minRest = Number(params.minRestDuration) || 10;
  if ((now - entry.anchorAt) / 60000 < minRest) return null;
  const dailyLimit = (params.dailyLiveLimit !== undefined && params.dailyLiveLimit > 0) ? Number(params.dailyLiveLimit) : Infinity;
  if (dailyLimit !== Infinity) {
    const todayCount = await getDailyStartCount(char.id);
    if (todayCount >= dailyLimit) return null;   // 闸门：今天播够了，不再推演出新场次
  }
  const cap = Number(params.maxRestDuration) || 480;
  const tend = await getCachedTendency(char.id);
  const base = normBase(tend && tend.startTendency);
  const f = rollToggleAt(char.id, 'start', entry.anchorAt, now, base, cap, minRest);
  return f ? Object.assign({ kind: 'start', base }, f) : null;
}

// =========================================================================
// 【核算】把每个人的链条顺到此刻 —— 没有定时器，谁要用直播状态谁才算一次：
//   开 APP / 切回前台 / 刷新直播页 / 房管开下播之后 / 手动调 window.reconcileLive()
// 每一步都走房管审核、写入的都是那一步的真实历史时刻，并正常结算场次与涨粉；
// 离线期间开完又下完的整场同样会被算出来并入账（同一套方法，不是另一套算法）。
// 单人格挡上限 60 步：几个月不打开也不会卡死。
// =========================================================================
const RECONCILE_MAX_STEPS = 60;

async function reconcileLive(nowTs) {
  if (window.__reconcileBusy) return { skipped: 'busy' };
  window.__reconcileBusy = true;
  try {
    const now = Number(nowTs) || Date.now();
    let sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const map = await ensureRhythm(sessions, now);
    const allChars = window.allCharacters || [];
    let flips = 0;

    for (const c of allChars) {
      if (!c || !c.id) continue;
      let guard = 0;
      while (guard++ < RECONCILE_MAX_STEPS) {
        const entry = map[c.id];
        if (!entry) break;
        const f = await nextDueFlip(c, entry, now);
        if (!f) break;
        entry.lastFlip = { kind: f.kind, at: f.flipAt, mins: f.mins, p: f.p, r: f.r, base: f.base };

        const wasState = entry.state;
        let res = null;
        try {
          if (wasState === 'live') {
            const cap = Number((window.appParams || {}).maxLiveDuration) || 240;
            res = await lumaOpsGateway.requestStopLive({
              characterId: c.id,
              reason: f.mins >= cap ? '已达直播时长上限' : '倾向与时长共同判定该下播',
              source: 'rhythm'
            }, f.flipAt);
          } else {
            res = await lumaOpsGateway.requestStartLive({ characterId: c.id, source: 'rhythm' }, f.flipAt);
          }
        } catch (e) { res = { success: false, reason: String(e) }; }

        pushRhythmEvent({
          at: f.flipAt, char: c.name || c.id, kind: f.kind, from: wasState,
          to: (res && res.success) ? (wasState === 'live' ? 'rest' : 'live') : wasState,
          mins: f.mins, p: f.p, r: f.r, base: f.base,
          ok: !!(res && res.success),
          note: (res && res.success) ? '' : ((res && res.reason) || '房管驳回')
        });
        flips++;
        if (!res || !res.success) break;   // 被驳回就停在这一步，不硬往前推
      }
    }

    await saveRhythmMap();
    if (flips) {
      sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
      window.liveList = sessions;
      if (typeof renderLiveGrid === 'function') { try { renderLiveGrid(); } catch (e) {} }
      try { syncCharStatusToChat(now); } catch (e) {}
    }
    return { flips, live: (window.liveList || []).length };
  } finally {
    window.__reconcileBusy = false;
  }
}
window.reconcileLive = reconcileLive;

// 列表刷新 = 先核算再取列表（保留旧函数名，房管与启动流程多处调用）
async function syncLiveSessions(options = {}) {
  await reconcileLive();
  const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  if (typeof renderLiveGrid === 'function') { try { renderLiveGrid(); } catch (e) {} }
  return sessions;
}
async function refreshLiveList() { return await syncLiveSessions(); }
window.syncLiveSessions = syncLiveSessions;
window.refreshLiveList = refreshLiveList;

// 重开 APP 的核对：清掉旧版遗留的延迟队列，然后核算一次（不重演、不补跑）
async function settleAllLive() {
  const now = Date.now();
  try {
    const leftover = await api.db.get("app_settings", "luma_pending_actions").catch(() => null);
    if (leftover) await saveDbSetting("luma_pending_actions", []);
  } catch (e) {}
  const r = await reconcileLive(now);
  try { await saveDbSetting("last_poll_time", now); } catch (e) {}
  return r;
}
window.settleAllLive = settleAllLive;

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
      window.charSchedulesMap[c.id] = { state: 'live', anchorAt: a, sessionId: roomOf[c.id].id, seq: 1, lastFlip: null };
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
        window.charSchedulesMap[c.id] = { state: 'live', anchorAt: startTime, sessionId: (created && created.id) || null, seq: 1, lastFlip: null };
      } catch (e) {
        console.warn("冷启动直播间创建失败:", e);
        const fa = now - (minRestMins + 5 + Math.floor(Math.random() * 90)) * 60000;
        window.charSchedulesMap[c.id] = { state: 'rest', anchorAt: fa, sessionId: null, seq: 0, lastFlip: null };
      }
      continue;
    }

    // 在歇：歇了多久随机散开 —— 有人马上就能开播，有人还要磨蹭半天
    const ra = now - (minRestMins + Math.floor(Math.random() * 120)) * 60000;
    window.charSchedulesMap[c.id] = { state: 'rest', anchorAt: ra, sessionId: null, seq: 0, lastFlip: null };
  }

  try {
    await saveDbSetting("char_schedules", window.charSchedulesMap);
    await saveDbSetting("world_bootstrapped", { date: new Date().toISOString(), bootstrapped: true });
  } catch (e) {}
}
window.bootstrapWorldInitialState = bootstrapWorldInitialState;

// （列表刷新与重开核对已并入上方【核算】）

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

// 兼容导出：lumaOpsPoll 老名字保留给外部调用点，语义 = 核算一次（无任何定时器）
window.lumaOpsPoll = reconcileLive;