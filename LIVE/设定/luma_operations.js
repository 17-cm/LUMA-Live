// =========================================================================
// LUMA Live 直播运营核心
// 包含：LUMA官方运营组（定时器轮询决策）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 轮询日志：文件加载即初始化，避免首次轮询前访问报错
if (!window.lumaOpsLog) window.lumaOpsLog = [];
// =========================================================================
// 【角色意愿值管理】AI聊天驱动，初始为0，无默认值
// 开播意愿(startWill)：休息中时AI想开播的意愿，0-50
// 下播意愿(stopWill)：直播中时AI想下播的意愿，0-50
// 意愿值由AI在聊天中输出[意愿：X]时通过events监听提取并更新
// =========================================================================
async function getCharWillMap() {
  try {
    const saved = await api.db.get("app_settings", "char_will_map").catch(() => null);
    return saved && typeof saved === 'object' ? saved : {};
  } catch (e) { return {}; }
}
async function getCharWill(characterId) {
  if (!characterId) return { startWill: 0, stopWill: 0 };
  const map = await getCharWillMap();
  const w = map[characterId];
  return { startWill: w?.startWill || 0, stopWill: w?.stopWill || 0 };
}
async function setCharWill(characterId, type, value) {
  if (!characterId || !type) return;
  const num = Math.max(0, Math.min(50, Number(value) || 0));
  const map = await getCharWillMap();
  if (!map[characterId]) map[characterId] = { startWill: 0, stopWill: 0 };
  map[characterId][type] = num;
  map[characterId].updatedAt = Date.now();
  try { await saveDbSetting("char_will_map", map); } catch (e) {}
}
window.getCharWill = getCharWill;
window.setCharWill = setCharWill;
window.getCharWillMap = getCharWillMap;

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

    const activeSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
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
// 决策公式：安全区外(达到时长上限)=100%必然；安全区内=基础意愿 + (已持续时长/上限)×50%
// =========================================================================
async function syncLiveSessions(options = {}) {
  let sessions = await api.db.list("live_sessions", { limit: 500 }) || [];

  // 仅刷新模式：房管操作后调用，不做新决策
  if (options.refreshOnly || options.allowSpawn === false) {
    window.liveList = sessions;
    renderLiveGrid();
    return;
  }

  const now = Date.now();
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

  // ── 新角色初始化：随机分配初始状态(开播/休息)和时长 ──
  const existingStreamIds = new Set(sessions.map(s => s.characterId));
  for (const c of allChars) {
    const sched = window.charSchedulesMap[c.id];
    if (sched && sched.initialized) continue;
    // 已有活跃直播间的角色：直接标记初始化，不重复创建
    if (existingStreamIds.has(c.id)) {
      window.charSchedulesMap[c.id] = { ...(sched || {}), initialized: true, isLive: true, lastEndTime: null };
      continue;
    }

    if (Math.random() < 0.5) {
      // 初始状态：开播中，随机已播时长
      const initLiveMins = Math.floor(Math.random() * Math.floor(maxLiveMins * 0.7)) + 1;
      const coverUrl = c.cover || c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
      const rawCat = c.tags ? c.tags[0] : '随性杂谈';
      const chosenCat = (typeof normalizeCategory === 'function') ? normalizeCategory(rawCat) : rawCat;
      const newSession = {
        characterId: c.id,
        name: c.name || '主播',
        avatar: c.avatar || coverUrl,
        cover: coverUrl,
        category: chosenCat,
        subTag: (c.tags && c.tags[1]) || '日常唠嗑',
        topic: `${c.name || '主播'}的精彩直播`,
        heat: Math.floor(Math.random() * 80000 + 20000),
        roomId: Math.floor(Math.random() * 899999 + 100000),
        startTime: now - initLiveMins * 60000,
        endTime: now - initLiveMins * 60000 + Math.floor(maxLiveMins * 0.5) * 60000,
        isNPC: false
      };
      try { await api.db.create("live_sessions", newSession); } catch(e) {}
      window.charSchedulesMap[c.id] = { initialized: true, isLive: true, lastEndTime: null };
    } else {
      // 初始状态：休息中，随机已休息时长（安全区内）
      const initRestMins = Math.floor(Math.random() * (maxRestMins - minRestMins)) + minRestMins;
      window.charSchedulesMap[c.id] = { initialized: true, isLive: false, lastEndTime: now - initRestMins * 60000 };
    }
  }
  try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch(e) {}

  // 刷新会话列表（新角色初始化后可能新增了直播间）
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const streamingIds = new Set(sessions.map(s => s.characterId));

  // ── 构建候选池 ──
  // 开播中候选：按已播时长降序
  const streamingPool = sessions
    .map(s => ({ charId: s.characterId, charName: s.name || s.characterId, session: s, liveMins: (now - (s.startTime || now)) / 60000 }))
    .sort((a, b) => b.liveMins - a.liveMins);

  // 休息中候选：排除开播中 + 排除强制休息期，按已休息时长降序
  const restingPool = allChars
    .filter(c => !streamingIds.has(c.id))
    .map(c => {
      const sched = window.charSchedulesMap[c.id];
      const lastEndTime = sched?.lastEndTime;
      const restMins = lastEndTime ? (now - lastEndTime) / 60000 : 0;
      return { char: c, charId: c.id, charName: c.name || c.id, restMins, inMandatoryRest: restMins < minRestMins };
    })
    .filter(x => !x.inMandatoryRest)
    .sort((a, b) => b.restMins - a.restMins);

  // ── 每轮只评估3个角色：最久开播 + 最久休息 + 随机 ──
  const toEvaluate = [];
  const selectedIds = new Set();

  // 1. 开播时间最长的
  if (streamingPool.length > 0) {
    const pick = streamingPool[0];
    toEvaluate.push({ type: 'stop', ...pick });
    selectedIds.add(pick.charId);
  }

  // 2. 休息时间最长的（排除已选）
  const restingAvail = restingPool.filter(x => !selectedIds.has(x.charId));
  if (restingAvail.length > 0) {
    const pick = restingAvail[0];
    toEvaluate.push({ type: 'start', ...pick });
    selectedIds.add(pick.charId);
  }

  // 3. 随机一个（排除已选，从开播中和休息中剩余角色里选）
  const randomPool = [
    ...streamingPool.filter(s => !selectedIds.has(s.charId)).map(s => ({ type: 'stop', ...s })),
    ...restingPool.filter(x => !selectedIds.has(x.charId)).map(x => ({ type: 'start', ...x })),
  ];
  if (randomPool.length > 0) {
    const pick = randomPool[Math.floor(Math.random() * randomPool.length)];
    toEvaluate.push(pick);
    selectedIds.add(pick.charId);
  }

  // ── 轮询日志初始化 ──
  const cycleLog = {
    time: new Date().toLocaleTimeString(),
    cycle: cycle,
    params: { maxLiveMins, maxRestMins, minRestMins },
    decisions: [],
    summary: { totalChars: allChars.length, streaming: sessions.length, started: 0, stopped: 0, evaluated: toEvaluate.length }
  };

  // ── 执行评估 ──
  for (const item of toEvaluate) {
    if (item.type === 'stop') {
      const liveMins = Math.round(item.liveMins);
      const isUrgent = liveMins >= maxLiveMins;
      const charWill = await getCharWill(item.charId);
      let stopWill, reason;
      if (isUrgent) { stopWill = 100; reason = '达到上限必然下播'; }
      else { stopWill = Math.round(charWill.stopWill + (liveMins / maxLiveMins) * 50); reason = '安全区比例增长'; }

      const dice = Math.round(Math.random() * 100);
      const willStop = dice < stopWill;

      cycleLog.decisions.push({
        char: item.charName, state: '直播中',
        liveMins: liveMins, baseWill: charWill.stopWill, stopWill: stopWill, dice: dice, reason: reason,
        result: willStop ? '下播' : '继续播'
      });

      if (willStop) {
        cycleLog.summary.stopped++;
        if (window.lumaOpsGateway) {
          await window.lumaOpsGateway.requestStopLive({
            characterId: item.charId,
            reason: isUrgent ? "达到直播时长上限，房管通知下播" : "AI自主决定下播休息",
            source: isUrgent ? "max_duration_reached" : "ai_decide_stop"
          });
        }
      }
    } else {
      const restMins = Math.round(item.restMins);
      const isUrgent = restMins >= maxRestMins;
      const charWill = await getCharWill(item.charId);
      let spawnWill, reason;
      if (isUrgent) { spawnWill = 100; reason = '达到上限必然开播'; }
      else { spawnWill = Math.round(charWill.startWill + (restMins / maxRestMins) * 50); reason = '安全区比例增长'; }

      const dice = Math.round(Math.random() * 100);
      const willSpawn = dice < spawnWill;

      cycleLog.decisions.push({
        char: item.charName, state: '休息中',
        restMins: restMins, baseWill: charWill.startWill, spawnWill: spawnWill, dice: dice, reason: reason,
        result: willSpawn ? '开播' : '不播'
      });

      if (willSpawn) {
        cycleLog.summary.started++;
        if (window.lumaOpsGateway) {
          await window.lumaOpsGateway.requestStartLive({
            characterId: item.charId,
            source: "ai_decide_start"
          });
        }
      }
    }
  }

  // 未被评估的角色：只标注当前状态，不投骰不判定
  const evaluatedIds = new Set(toEvaluate.map(e => e.charId));
  for (const c of allChars) {
    if (evaluatedIds.has(c.id)) continue;
    const isStreaming = streamingIds.has(c.id);
    cycleLog.decisions.push({
      char: c.name || c.id,
      state: isStreaming ? '直播中' : '休息中',
      result: isStreaming ? '持续直播中…' : '持续休息中…'
    });
  }

  // 最终刷新并渲染
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  renderLiveGrid();

  // ── 写入轮询日志 ──
  cycleLog.summary.streaming = sessions.length;
  if (!window.lumaOpsLog) window.lumaOpsLog = [];
  window.lumaOpsLog.unshift(cycleLog);
  if (window.lumaOpsLog.length > 3) window.lumaOpsLog.pop();
  console.log(`[LUMA官方运营组] 第${cycle}轮 ${cycleLog.time} | 在播${cycleLog.summary.streaming} | 评估${cycleLog.summary.evaluated}人 开播${cycleLog.summary.started} 下播${cycleLog.summary.stopped}`, cycleLog);
  // 轮询完成后同步状态到聊天历史
  syncCharStatusToChat();
}
window.syncLiveSessions = syncLiveSessions;
window.lumaOpsPoll = syncLiveSessions;

// =========================================================================
// 【状态同步到聊天历史】后台定时把每个角色的直播状态写入聊天历史
// AI下次回复时从历史里读到真实状态，然后输出对应的意愿值
// =========================================================================
async function syncCharStatusToChat() {
  try {
    const allChars = window.allCharacters || [];
    if (allChars.length === 0) return;
    const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
    const streamingIds = new Set(sessions.map(s => s.characterId));
    const now = Date.now();
    for (const c of allChars) {
      try {
        const isStreaming = streamingIds.has(c.id);
        const session = sessions.find(s => s.characterId === c.id);
        let statusText;
        if (isStreaming && session) {
          const liveMins = Math.round((now - (session.startTime || now)) / 60000);
          statusText = `[LUMA Live 系统通知] 你当前正在直播中，已直播${liveMins}分钟。直播间：${session.topic || '正在直播'}。`;
        } else {
          const sched = window.charSchedulesMap ? window.charSchedulesMap[c.id] : null;
          const lastEndTime = sched?.lastEndTime;
          const restMins = lastEndTime ? Math.round((now - lastEndTime) / 60000) : 0;
          statusText = `[LUMA Live 系统通知] 你当前处于休息状态，已休息${restMins}分钟。可以随时申请开播。`;
        }
        if (api.chat?.writeHistory) {
          await api.chat.writeHistory({
            characterId: c.id,
            role: "system",
            content: statusText
          }).catch(() => {});
        }
      } catch (e) {}
    }
    console.log(`[LUMA Live] 状态同步完成，共同步 ${allChars.length} 个角色`);
  } catch (e) {
    console.log("[LUMA Live] 状态同步失败", e);
  }
}
window.syncCharStatusToChat = syncCharStatusToChat;

// =========================================================================
// 【事件监听】监听角色聊天消息，提取[意愿：X]指令并更新角色意愿值
// =========================================================================
function registerLumaEventListeners() {
  try {
    if (typeof AiPhone !== 'undefined' && AiPhone.on) {
      AiPhone.on("chat.message.created", async (event) => {
        try {
          // 只处理角色发出的消息
          if (!event || event.role !== 'assistant') return;
          const content = event.content || event.text || '';
          if (!content) return;
          // 提取[意愿：X]指令
          const match = content.match(/\[意愿[：:]\s*(\d+(?:\.\d+)?)\s*\]/);
          if (!match) return;
          const willValue = Math.max(0, Math.min(50, Number(match[1]) || 0));
          const characterId = event.characterId || event.charId;
          if (!characterId) return;
          // 判断角色当前状态，更新对应的意愿值
          const sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
          const isStreaming = sessions.some(s => s.characterId === characterId);
          const willType = isStreaming ? 'stopWill' : 'startWill';
          await setCharWill(characterId, willType, willValue);
          console.log(`[LUMA Live] 角色意愿更新: ${characterId} ${willType}=${willValue} (${isStreaming ? '直播中' : '休息中'})`);
        } catch (e) {
          console.log("[LUMA Live] 意愿提取失败", e);
        }
      });
      console.log("[LUMA Live] 事件监听已注册");
    }
  } catch (e) {
    console.log("[LUMA Live] 事件监听注册失败", e);
  }
}
window.registerLumaEventListeners = registerLumaEventListeners;
// 文件加载时自动注册事件监听
registerLumaEventListeners();
