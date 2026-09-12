// =========================================================================
// LUMA Live 直播运营核心（复用 LUMA-Live-test3 直播机制版）
//
// 直播分两条轨，互不掺和：
//   · 自主开播/下播 —— 角色根据全局预设与自己状态栏（含开播/下播倾向值）自行
//     调用 handleRequestStartLive / handleRequestStopLive，房管网关照常审核
//     （停机维护驳回、强制休息期驳回、防重复开播）。这条链路 test3 与 AAA 一致。
//   · APP 随机开播 —— test3 的「概率排班」机制：设置面板 char开播概率(charSpawnRate,
//     0-80%) + maxLiveDuration/maxRestDuration，由 LIVE/live/live_logic.js 的
//     syncLiveSessions() 每 30 秒心跳轮询排班，到点"向房管提交开播申请"、超时走房管切断；
//     概率=0 时全服停机维护（后台不排班、驳回开播申请，仅保留一个
//     "被迫营业"彩蛋）。决策走 Math.random()，与倾向值无任何关联。
//
// 本版已彻底删除 AAA v2.1 的时间块推演引擎（作息纸条/seededHash 定数/
// 比例式增长/reconcileLive 核算/settleAllLive/每日场次上限），换回 test3 的调度。
// 四条铁律（房管唯一出口版）：
//   1. live_sessions 是"她在不在播"的唯一真相
//   2. 所有开播/下播（含 AI 工具、排班随机开播、排班超时切断、台词下播协议）
//      必须过 lumaOpsGateway 房管审核 —— 【严禁任何模块绕过房管直接写 live_sessions】
//   3. 同一 char 在全平台只允许存在一个直播间（防多开/防分身）：
//      · 审核串行化（withGatewayLock），杜绝并发审核竞态
//      · 建房使用确定性房契 id（live_<charId>）走 dbUpsert，物理上不可能产生第二条
//      · 每次审核前先跑 auditLiveSessions() 巡检，清掉历史遗留的分身房
//      · 审核通过前不落库 → 直播广场只渲染房管批准过的房间
//   4. 下播结算走 closeAndArchive（归档 streamer_history + 场次/粉丝联动），
//      且一次下播结束该主播名下【全部】直播间，绝不留幽灵房
// 依赖：core.js (dbUpsert/saveDbSetting/api/charSchedulesMap)
//       + LIVE/live/live_logic.js (renderLiveGrid/SUB_CATEGORIES/syncLiveSessions)
// =========================================================================

// =========================================================================
// 【状态同步到角色日程】后台定时把每个角色的直播状态写入角色日程
// 通过 {{当前日程}} 宏自动注入提示词，角色聊天时自动看到真实状态
// 不依赖短期记忆、不依赖聊天历史、不依赖工具调用
// —— 说明：这条链路曾于房管收口重构时被误删，此处按原设计恢复并增强：
//    1) 状态/分钟数没变化就不重复写宿主（原来每 30 秒无脑写一次）
//    2) 维护模式下写"维护中"，不再显示"休息中"
//    3) 只替换标题以 "LUMA Live" 开头的条目，她自己原本的日程一条都不动
// =========================================================================
const _lumaCalendarState = {};

async function syncCharStatusToChat(nowTime = null, onlyCharId = null) {
  try {
    // 离线唤醒（隐藏运行环境）冷启动时 window.allCharacters 可能还是空的，
    // 所以开播/下播触发的即时同步会把 charId 直接带进来。
    const allChars = onlyCharId ? [{ id: onlyCharId }] : (window.allCharacters || []);
    if (allChars.length === 0) return;
    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const now = nowTime || Date.now();
    const today = new Date(now).toISOString().split('T')[0]; // YYYY-MM-DD
    const calendarApi = (typeof AiPhone !== 'undefined' && AiPhone.calendar) ? AiPhone.calendar : (api.calendar || null);
    if (!calendarApi || !calendarApi.write) return;

    const maint = Number((window.appParams || {}).charSpawnRate) === 0;

    for (const c of allChars) {
      try {
        const session = sessions.find(s => isSameLiveChar(liveSessionCharId(s), c.id) || isSameLiveChar(s.characterId, c.id));
        let title;
        if (session) {
          const liveMins = Math.max(0, Math.round((now - (Number(session.startTime) || now)) / 60000));
          title = `LUMA Live直播中，已播${liveMins}分钟`;
        } else {
          const sched = window.charSchedulesMap ? window.charSchedulesMap[c.id] : null;
          const anchor = Number(sched && sched.lastEndTime) || null;
          const restMins = anchor ? Math.max(0, Math.round((now - anchor) / 60000)) : 0;
          title = anchor
            ? `LUMA Live休息中，已休息${restMins}分钟`
            : (maint ? 'LUMA Live维护中，暂时没有直播安排' : 'LUMA Live今日暂无直播安排');
        }

        const cached = _lumaCalendarState[c.id];
        if (cached && cached.title === title && cached.day === today) continue;

        // 先读取整周日程，过滤掉已有的 LUMA Live 条目，再写回今天的新状态
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

        await calendarApi.write({
          ownerType: "character",
          ownerId: c.id,
          operation: "replace",
          items: existingItems.concat([{
            date: today,
            startTime: "00:00",
            endTime: "23:59",
            title: title,
            location: "LUMA Live",
            source: "luma_live"
          }])
        }).catch(() => {});
        _lumaCalendarState[c.id] = { title: title, day: today };
      } catch (e) {}
    }
  } catch (e) {}
}
window.syncCharStatusToChat = syncCharStatusToChat;
// 历史名字带一个零宽字符，保留别名，避免旧调用点失效
window['sync\u200bCharStatusToChat'] = syncCharStatusToChat;
// 开播/下播后立刻同步一次（不等下一拍轮询）
function syncCharStatusSoon(charId = null) {
  try { Promise.resolve(syncCharStatusToChat(null, charId)).catch(() => {}); } catch (e) {}
}
window.syncCharStatusSoon = syncCharStatusSoon;

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
  console.log(`[LUMA 官方运营组] ${title}: ${detail}`);
}
window.lumaOpsNotify = lumaOpsNotify;

// =========================================================================
// 【房管·防多开 / 防分身 基础设施】
// 同一 char（主播身份）在全平台只允许存在一个直播间。所有判断都走这里的归一化，
// 避免 id 类型不一致（number/string）、characterId 与 session.id 混用导致"同一个
// 人被判成两个主播"从而重复建房。
// =========================================================================
function normLiveCharId(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
window.normLiveCharId = normLiveCharId;

// 取一条在播场次归属的主播身份（优先 characterId，兼容历史脏数据落在 id 上）
function liveSessionCharId(session) {
  if (!session) return '';
  return normLiveCharId(session.characterId || session.charId || session.id);
}
window.liveSessionCharId = liveSessionCharId;

function isSameLiveChar(a, b) {
  const x = normLiveCharId(a);
  return !!x && x === normLiveCharId(b);
}
window.isSameLiveChar = isSameLiveChar;

// APP 随机排班来源判定：停机维护只掐这一类，角色自主开播不受任何影响
function isAutoSpawnSource(source) {
  const s = String(source || '').toLowerCase();
  return s === 'scheduler' || s === 'egg_force' || s.includes('sched') || s.includes('egg');
}
window.isAutoSpawnSource = isAutoSpawnSource;

// 按 char 归并一份在播表：同一 char 只保留最早开播的那条（原始房间），其余判为「分身房」
function splitLiveSessionsByChar(list) {
  const kept = [];
  const duplicates = [];
  const at = new Map();
  (Array.isArray(list) ? list : []).forEach(s => {
    if (!s) return;
    const key = liveSessionCharId(s);
    if (!key) { kept.push(s); return; }
    if (!at.has(key)) { at.set(key, kept.length); kept.push(s); return; }
    const cur = kept[at.get(key)];
    const curStart = Number(cur.startTime) || Number(cur.createdAt) || 0;
    const newStart = Number(s.startTime) || Number(s.createdAt) || 0;
    if (newStart && (!curStart || newStart < curStart)) {
      duplicates.push(cur);
      kept[at.get(key)] = s;
    } else {
      duplicates.push(s);
    }
  });
  return { kept, duplicates };
}
window.splitLiveSessionsByChar = splitLiveSessionsByChar;

function dedupeLiveSessions(list) {
  return splitLiveSessionsByChar(list).kept;
}
window.dedupeLiveSessions = dedupeLiveSessions;

function findLiveSessionByChar(list, characterId) {
  const arr = Array.isArray(list) ? list : [];
  return arr.find(s => isSameLiveChar(liveSessionCharId(s), characterId))
      || arr.find(s => isSameLiveChar(s.id, characterId))
      || null;
}
window.findLiveSessionByChar = findLiveSessionByChar;

// 房管巡检：清掉同一主播名下的分身房（只清在播表与房间数据，不重复结算场次/粉丝）
async function auditLiveSessions(reason = '房管巡检') {
  let removed = 0;
  try {
    const sessions = await api.db.list("live_sessions") || [];
    const { kept, duplicates } = splitLiveSessionsByChar(sessions);
    for (const s of duplicates) {
      try {
        const rid = s.roomId || s.id || s.characterId;
        if (window.LiveRoomStore && typeof window.LiveRoomStore.clearRoom === 'function') {
          await window.LiveRoomStore.clearRoom(rid);
        }
      } catch (e) {}
      try { await api.db.delete("live_sessions", s.id); removed++; } catch (e) {}
    }
    if (removed > 0) {
      // 排班表回填：把 isLive / currentSessionId 指向唯一保留的那条
      const map = window.charSchedulesMap;
      if (map) {
        kept.forEach(s => {
          const key = liveSessionCharId(s);
          const sched = map[key];
          if (sched) { sched.isLive = true; sched.currentSessionId = s.id; }
        });
        await saveDbSetting("char_schedules", map);
      }
      lumaOpsNotify("房管巡检", `${reason}：已清理同一主播的重复/分身直播间 ${removed} 个`, "reject");
    }
  } catch (e) {}
  return removed;
}
window.auditLiveSessions = auditLiveSessions;

// 房管审核队列：全平台的开播/下播审核串行执行。
// 没有这道锁时，"排班心跳"与"角色自主申请"可能同时看到干净的旧快照，
// 于是各自批准一次 → 同一个 char 出现两个直播间。
let _gatewayChain = Promise.resolve();
function withGatewayLock(task) {
  const run = _gatewayChain.then(task, task);
  _gatewayChain = run.then(() => {}, () => {});
  return run;
}
window.withGatewayLock = withGatewayLock;

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
// 【LUMA 直播官方运营组】唯一权威审核网关（test3 原版）：排班超时切断与角色自主开播都走这里
// =========================================================================
const lumaOpsGateway = {
  // 对外唯一开播入口：所有调用方（AI 工具 / 排班随机开播 / 维护彩蛋）都从这里进
  async requestStartLive(payload = {}) {
    return withGatewayLock(() => lumaOpsGateway._auditStartLive(payload));
  },

  async _auditStartLive({ characterId, category, topic, durationMins, subTag, startAt, source = 'system' } = {}) {
    const charId = normLiveCharId(characterId);
    if (!charId) {
      lumaOpsNotify("开播驳回", "未指定有效的主播身份", "reject");
      return { success: false, code: "invalid_char", reason: "【LUMA官方运营组通告】开播申请未通过：未指定有效的主播身份。" };
    }

    // 0) 审核前巡检：先把历史遗留的分身房清掉，保证下面判定的在播表是干净的
    await auditLiveSessions(source === 'scheduler' ? '排班开播前巡检' : '开播审核前巡检');

    const allChars = window.allCharacters || [];
    const character = allChars.find(c => isSameLiveChar(c.id, charId)) || await api.characters.get(charId).catch(() => null);
    const charName = character?.name || "主播";
    const now = Date.now();

    if (!window.charSchedulesMap) window.charSchedulesMap = {};

    const params = window.appParams || {};
    // 【停机维护模式】只掐 APP 随机排班这一路：维护期不再有随机抓人开播；
    // 角色自主开播（chat_tool / 工具 / 人工）依旧放行，开播后广场横幅自动下掉。
    if (params.charSpawnRate === 0 && isAutoSpawnSource(source)) {
      lumaOpsNotify("开播驳回", `【${charName}】的排期开播申请被驳回：平台正在维护中`, "reject");
      return {
        success: false,
        code: "maintenance",
        retryAfterMs: 10 * 60 * 1000,
        reason: `【LUMA官方运营组通告】平台正在进行系统维护升级，本次维护暂停推荐与开播排期服务；主播自主开播不受影响。`
      };
    }

    // 1) 防多开 / 防分身：同一 char 在全平台只允许一个直播间
    const activeSessions = await api.db.list("live_sessions") || [];
    const existing = findLiveSessionByChar(activeSessions, charId);
    if (existing) {
      lumaOpsNotify("开播拒绝", `【${charName}】已在直播中 (房号:${existing.roomId})，重复开播已驳回`, "reject");
      return {
        success: false,
        code: "already_live",
        data: { roomId: existing.roomId, sessionId: existing.id },
        reason: `【LUMA官方运营组通告】主播【${charName}】已在直播中（房号:${existing.roomId}），一位主播全平台只能拥有一个直播间，重复/分身开播申请已驳回。`
      };
    }

    // 2) 静默串行化：审核与落库在同一把锁内，不存在两次审核同时通过的空窗期

    let sched = window.charSchedulesMap[charId];
    if (!sched) {
      const savedMap = await api.db.get("app_settings", "char_schedules").catch(() => null);
      const savedKey = savedMap ? Object.keys(savedMap).find(k => isSameLiveChar(k, charId)) : null;
      if (savedKey && savedMap[savedKey]) {
        sched = savedMap[savedKey];
        window.charSchedulesMap[charId] = sched;
      }
    }

    // 幽灵标记自愈：排班表说她在线、但在播表里并没有她 → 以在播表为准，标记失效
    if (sched && sched.isLive === true) {
      sched.isLive = false;
      sched.currentSessionId = null;
      await saveDbSetting("char_schedules", window.charSchedulesMap);
    }

    // 3) 法定强制休息期
    const minRestMs = (params.minRestDuration || 10) * 60 * 1000;
    if (sched && sched.lastEndTime && (now - sched.lastEndTime < minRestMs)) {
      const remainingMs = Math.max(0, minRestMs - (now - sched.lastEndTime));
      const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
      lumaOpsNotify("开播驳回", `【${charName}】刚下播休息不足，需再休息 ${remainingMins} 分钟`, "reject");
      return {
        success: false,
        code: "resting",
        retryAfterMs: remainingMs,
        reason: `【LUMA官方运营组通告】主播【${charName}】开播申请未通过：您距离上次下播仅过去不久，平台规定强制休息期还剩 ${remainingMins} 分钟，请劳逸结合。`
      };
    }

    const dur = Math.max(5, Math.round(Number(durationMins) || (Math.floor(Math.random() * (params.maxLiveDuration || 120) / 2 + 30))));

    // 开播时刻：受理方可以指定（排班心跳会把"其实早就开播了"的房间倒推回它真实的开播时刻），
    // 否则一律按"此刻开播"。不倒推的后果就是每次重开 APP 全部主播都显示"刚刚开播"。
    // 倒推上限 = 单次直播时长上限，且倒推后不能已经该下播了。
    const maxBackMs = Math.max(1, Number(params.maxLiveDuration) || 120) * 60 * 1000;
    const requestedStart = Number(startAt);
    let start = now;
    if (Number.isFinite(requestedStart) && requestedStart > 0 && requestedStart < now
        && (now - requestedStart) <= maxBackMs) {
      start = Math.round(requestedStart);
    }
    let end = start + dur * 60 * 1000;
    if (end <= now) { start = now; end = start + dur * 60 * 1000; }

    let coverUrl = character?.cover || character?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
    let rawCat = category || (character?.tags ? character.tags[0] : '随性杂谈');
    let chosenCat = (typeof normalizeCategory === 'function') ? normalizeCategory(rawCat) : rawCat;
    let chosenSubTag = subTag || ((character?.tags && character.tags[1]) ? character.tags[1] : (rawCat !== chosenCat ? rawCat : '日常唠嗑'));
    let chosenTopic = topic || `${charName}的精彩直播`;

    // 房契 id 确定性化：一个 char 一张房契，dbUpsert 只可能更新、不可能再开一间房
    const sessionId = `live_${charId}`;
    const newSession = {
      characterId: charId,
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
      isNPC: false,
      // 房管审核凭据：未带此凭据的场次不参与直播广场渲染
      auditState: 'approved',
      auditSource: source,
      approvedAt: now
    };

    const saved = await dbUpsert("live_sessions", sessionId, newSession);
    if (!saved) {
      lumaOpsNotify("开播驳回", `【${charName}】推流落库失败`, "reject");
      return { success: false, code: "db_error", reason: `【LUMA官方运营组通告】主播【${charName}】推流通道异常，请稍后再试。` };
    }
    // 宿主 db.update 可能只回执不回记录，这里补全，保证后续字段一定拿得到
    const created = Object.assign({}, newSession, saved, { id: sessionId });

    // 4) 排班表合并写入：只改直播状态，绝不抹掉排班的 nextLiveAt / planDurationMins，
    //    否则排班心跳会把下播后的角色误判成"从没排过班"而立刻重新开播。
    const prevSched = sched || {};
    window.charSchedulesMap[charId] = {
      ...prevSched,
      characterId: charId,
      isLive: true,
      currentSessionId: created.id,
      lastStartTime: start,
      plannedEndTime: end,
      lastEndTime: prevSched.lastEndTime || null
    };
    await saveDbSetting("char_schedules", window.charSchedulesMap);

    // 不写角色状态值：状态栏归宿主/角色自己维护，房管只记排班（char_schedules）与事件流
    // 开播时间线由房管统一记账：无论自主开播还是随机开播都留痕，且 appEventId 幂等
    try {
      if (api.memory?.addTimeline) {
        await api.memory.addTimeline({
          characterId: charId,
          appLabel: "LUMA Live",
          detail: "live_started",
          summary: `【${charName}】开启了【${created.category}】网络直播，标题为《${created.topic}》。`,
          appEventId: `live_start_${created.id}_${start}`
        });
      }
    } catch (e) {}

    // 小手机通知（横幅 + 桌面红点）：只通知已关注她的用户
    try {
      const followed = Array.isArray(window.followedHosts) ? window.followedHosts : [];
      const isFollowed = followed.some(id => String(id) === String(charId));
      if (isFollowed && api.notifications && typeof api.notifications.create === 'function') {
        await api.notifications.create({
          title: `${charName} 开播了`,
          body: `《${created.topic}》· ${created.category}　点开 LUMA Live 进直播间`,
          badgeDelta: 1,
          data: { characterId: charId, roomId: created.roomId, from: 'luma-live' }
        });
      }
    } catch (e) {}

    syncCharStatusSoon(charId);
    lumaOpsNotify("开播批准", `【${charName}】通过审核已成功推流开播 (房号:${created.roomId})`, "approve");

    // 房管批准后才刷新直播广场（注意：这里不能回调 syncLiveSessions —— 排班心跳
    // 是在持锁状态下调用房管的，回调会形成环等死锁）
    if (typeof window.refreshLivePlaza === 'function') {
      try { await window.refreshLivePlaza(); } catch (e) {}
    }

    return {
      success: true,
      data: {
        sessionId: created.id,
        roomId: created.roomId,
        topic: created.topic,
        category: created.category
      },
      userNotice: `主播【${charName}】已成功开播，房号：${created.roomId}`,
      message: `【LUMA官方运营组】恭喜主播【${charName}】，推流申请已通过！直播间房号【${created.roomId}】现已正式向全平台公开发送推流广播。`
    };
  },

  // 对外唯一下播入口
  async requestStopLive(payload = {}) {
    return withGatewayLock(() => lumaOpsGateway._auditStopLive(payload));
  },

  async _auditStopLive({ characterId, reason = "正常下播", source = "system" } = {}) {
    const charId = normLiveCharId(characterId);
    if (!charId) return { success: false, code: "invalid_char", reason: "未指定有效主播身份" };

    if (!window.charSchedulesMap) window.charSchedulesMap = {};

    const activeSessions = await api.db.list("live_sessions") || [];
    // 防多开收口：一次下播结束该主播名下【全部】直播间，绝不留幽灵房挂在广场上
    const matched = activeSessions.filter(s => isSameLiveChar(liveSessionCharId(s), charId) || isSameLiveChar(s.id, charId));

    const allChars = window.allCharacters || [];
    const character = allChars.find(c => isSameLiveChar(c.id, charId)) || await api.characters.get(charId).catch(() => null);
    const charName = matched[0]?.name || character?.name || "主播";
    const now = Date.now();

    let sched = window.charSchedulesMap[charId];
    if (!sched) {
      const savedMap = await api.db.get("app_settings", "char_schedules").catch(() => null);
      const savedKey = savedMap ? Object.keys(savedMap).find(k => isSameLiveChar(k, charId)) : null;
      if (savedKey) { sched = savedMap[savedKey]; window.charSchedulesMap[charId] = sched; }
    }

    if (matched.length === 0) {
      // 不在播 → 房管驳回（对应工具说明里的"若当前未在直播将驳回"），只做幽灵标记自愈，
      // 不写 lastEndTime，避免把一次无效申请变成真实的强制休息期。
      if (sched && (sched.isLive || sched.currentSessionId)) {
        sched.isLive = false;
        sched.currentSessionId = null;
        await saveDbSetting("char_schedules", window.charSchedulesMap);
      }
      lumaOpsNotify("下播驳回", `【${charName}】当前未在直播，下播申请已驳回`, "reject");
      return { success: false, code: "not_live", reason: `【LUMA官方运营组通告】主播【${charName}】当前并未在直播，无需下播。` };
    }

    for (const session of matched) {
      // 结算归档（AAA 数据层原有能力，保持不动）：直播场次+1、区间增粉、写 streamer_history、清房
      await closeAndArchive(character, session, now);
    }

    // 强制休息期：合法性下限 minRestDuration，同时尊重排班自带的随机休息长度
    const isMaintCut = source === 'maint_shutdown';
    const params = window.appParams || {};
    const minRestMs = (params.minRestDuration || 10) * 60 * 1000;
    const planRestMins = Number(sched?.planRestMins) || 0;
    const restMs = Math.max(minRestMs, planRestMins * 60 * 1000);

    window.charSchedulesMap[charId] = {
      ...(sched || {}),
      characterId: charId,
      isLive: false,
      currentSessionId: null,
      lastStartTime: matched[0]?.startTime || null,
      // 运营维护切断不写 lastEndTime：她不是"播累了去休息"，只是被平台下线，
      // 因此不占用强制休息期，随时可以自主开播回来。
      lastEndTime: isMaintCut ? (sched?.lastEndTime || null) : now,
      plannedEndTime: null,
      // 下播即进入休息期：直接把排班的下一次开播点推到休息期之后
      nextLiveAt: now + restMs
    };
    await saveDbSetting("char_schedules", window.charSchedulesMap);

    // 不写角色状态值：同上，房管只记排班与事件流

    // 下播事件流：不写这条，聊天室里的她就不知道自己已经下播了
    try {
      if (api.memory?.addTimeline) {
        const endedTopic = matched[0]?.topic || '直播';
        await api.memory.addTimeline({
          characterId: charId,
          appLabel: "LUMA Live",
          detail: "live_stopped",
          summary: `【${charName}】结束了《${endedTopic}》的网络直播，已经下播${isMaintCut ? '（被平台下线）' : ''}。`,
          appEventId: `live_stop_${matched[0]?.id || charId}_${now}`
        });
      }
    } catch (e) {}
    syncCharStatusSoon(charId);
    const isForced = source === 'maint_shutdown' || source === 'max_duration_reached' || source === 'auto_timeout';
    lumaOpsNotify(
      isForced ? "运营强制下播" : "主播已下播",
      `【${charName}】已结束推流（原因:${reason}，共结束 ${matched.length} 个直播间），进入强制休息期`,
      isForced ? "force" : "info"
    );

    const matchedIds = matched.map(s => s.id);
    if (window.currentRoom && (isSameLiveChar(window.currentRoom.characterId, charId) || matchedIds.includes(window.currentRoom.id))) {
      if (typeof window.showHostLeftRoomStage === 'function') {
        window.showHostLeftRoomStage(window.currentRoom);
      } else if (typeof closeLiveRoom === 'function') {
        closeLiveRoom();
      }
      api.ui.toast(`主播【${charName}】已下播休息`);
    }

    // 同样不能回调 syncLiveSessions（房管可能在排班心跳的持锁上下文里被调用）
    if (typeof window.refreshLivePlaza === 'function') {
      try { await window.refreshLivePlaza(); } catch (e) {}
    }

    return {
      success: true,
      data: { endedSessions: matched.length },
      userNotice: `主播【${charName}】已下播休息`,
      message: `【LUMA官方运营组】主播【${charName}】已成功关闭推流并同步下线状态。`
    };
  },

  async getCharSchedule(characterId) {
    const charId = normLiveCharId(characterId);
    if (!charId) return null;
    if (!window.charSchedulesMap) window.charSchedulesMap = {};
    let sched = window.charSchedulesMap[charId];
    if (!sched) {
      try {
        const savedMap = await api.db.get("app_settings", "char_schedules").catch(() => null);
        const savedKey = savedMap ? Object.keys(savedMap).find(k => isSameLiveChar(k, charId)) : null;
        if (savedKey && savedMap[savedKey]) {
          sched = savedMap[savedKey];
          window.charSchedulesMap[charId] = sched;
        }
      } catch (e) {}
    }
    return sched || null;
  },

  // 排班写入统一走合并：排班心跳只负责 nextLiveAt / planDurationMins，
  // 房管只负责 isLive / lastEndTime，两边互不覆盖对方的字段。
  async saveCharSchedule(characterId, scheduleData) {
    const charId = normLiveCharId(characterId);
    if (!charId || !scheduleData) return false;
    if (!window.charSchedulesMap) window.charSchedulesMap = {};
    window.charSchedulesMap[charId] = {
      ...(window.charSchedulesMap[charId] || {}),
      ...scheduleData,
      characterId: charId
    };
    return await saveDbSetting("char_schedules", window.charSchedulesMap);
  }
};
window.lumaOpsGateway = lumaOpsGateway;

// 房管启动自检：清掉上次运行遗留的分身房（含 App 被强杀留下的脏数据）
if (typeof window !== 'undefined') {
  window.__lumaAuditTimer = setTimeout(() => {
    auditLiveSessions('启动自检').catch(() => {});
  }, 3000);
}

function registerAiPhoneToolHandlers() {
  const targetApi = window.api || window.AiPhone || window.AiPhoneApp;
  if (!targetApi || !targetApi.tools || typeof targetApi.tools.handle !== 'function') return;

  // 工具调用方（角色）的身份解析。宿主按契约把 context.characterId 交给我们，
  // 兜底顺序：context → 参数 → 名字匹配 → 全应用只有一个主播时就用她。
  // 最后才退化成"第一个主播"，并且记一条警告 —— 认错人会让别的直播间被顶掉。
  function resolveToolCharId(args, context) {
    const c = context || {}, a = args || {};
    const direct = c.characterId || c.charId || c.id
      || (c.character && (c.character.id || c.character.characterId))
      || (c.char && (c.char.id || c.char.characterId))
      || a.characterId || a.charId || a.id;
    if (direct) return direct;

    const nameHint = c.characterName || c.name || a.characterName || a.name || '';
    const all = window.allCharacters || [];
    if (nameHint) {
      const hit = all.find(x => x && (x.name === nameHint || x.id === nameHint));
      if (hit) return hit.id;
    }
    if (all.length === 1) return all[0].id;
    if (all.length > 1) {
      console.warn('[LUMA 房管] 工具调用未带角色身份，退化为第一个主播:', all[0].id);
      return all[0].id;
    }
    return 'char_1';
  }

  // 工具结果的统一封装。
  // 关键：宿主把 success:false 当成"工具执行失败"（见 app制造指南 的工具契约），
  // 那样房管的驳回原因根本传不回角色，界面只剩一句"自定义 APP 工具执行失败"。
  // 所以只要房管正常审完了（哪怕驳回），工具本身都算执行成功，结论放在 approved 里。
  function toolResult(verdict, fallbackLabel) {
    const v = verdict || {};
    const approved = v.success === true;
    return {
      success: true,
      approved,
      code: approved ? 'approved' : (v.code || 'rejected'),
      data: v.data || null,
      userNotice: v.userNotice || (approved ? '' : `${fallbackLabel}未通过`),
      message: v.message || v.reason || (approved ? '' : `${fallbackLabel}未通过`)
    };
  }

  targetApi.tools.handle("handleRequestStartLive", async (args, context) => {
    const charId = resolveToolCharId(args, context);
    try {
      const verdict = await lumaOpsGateway.requestStartLive({
        characterId: charId,
        category: args?.category,
        topic: args?.topic,
        durationMins: args?.durationMins,
        source: "chat_tool"
      });
      return toolResult(verdict, '开播申请');
    } catch (e) {
      lumaOpsNotify('开播异常', `[${charId}] ${e && e.message || e}`, 'reject');
      return toolResult({
        success: false,
        code: 'internal_error',
        reason: `【LUMA官方运营组通告】推流通道暂时繁忙，开播申请未受理，请稍后再试。`
      }, '开播申请');
    }
  });

  targetApi.tools.handle("handleRequestStopLive", async (args, context) => {
    const charId = resolveToolCharId(args, context);
    try {
      const verdict = await lumaOpsGateway.requestStopLive({
        characterId: charId,
        reason: args?.reason || "正常下播",
        source: "chat_tool"
      });
      return toolResult(verdict, '下播申请');
    } catch (e) {
      lumaOpsNotify('下播异常', `[${charId}] ${e && e.message || e}`, 'reject');
      return toolResult({
        success: false,
        code: 'internal_error',
        reason: `【LUMA官方运营组通告】推流通道暂时繁忙，下播申请未受理，请稍后再试。`
      }, '下播申请');
    }
  });
}
registerAiPhoneToolHandlers();
window.registerAiPhoneToolHandlers = registerAiPhoneToolHandlers;

