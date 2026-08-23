// =========================================================================
// LUMA Live 直播运营核心
// 包含：LUMA官方运营组（定时器轮询决策）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 轮询日志：文件加载即初始化，避免首次轮询前访问报错
if (!window.lumaOpsLog) window.lumaOpsLog = [];

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
  const baseSpawnRate = params.charSpawnRate !== undefined ? params.charSpawnRate : 25;
  const baseStopRate = params.baseStopRate !== undefined ? params.baseStopRate : 10;
  const maxLiveMins = params.maxLiveDuration || 120;
  const maxRestMins = params.maxRestDuration || 360;
  const minRestMins = params.minRestDuration || 10;
  const allChars = window.allCharacters || [];

  // 轮次计数器（用于评估冷却错峰）
  if (window.__lumaOpsCycle === undefined) window.__lumaOpsCycle = 0;
  const cycle = ++window.__lumaOpsCycle;
  if (!window.charSchedulesMap) window.charSchedulesMap = {};

  // ── 轮询日志初始化 ──
  const cycleLog = {
    time: new Date().toLocaleTimeString(),
    cycle: cycle,
    params: { baseSpawnRate, baseStopRate, maxLiveMins, maxRestMins, minRestMins },
    decisions: [],
    summary: { totalChars: allChars.length, streaming: 0, started: 0, stopped: 0, cooldownSkip: 0 }
  };

  // 评估冷却辅助：判断角色本轮是否可评估
  // 达到时长上限的角色不受冷却限制（安全网优先）
  function canEvaluate(charId, isUrgent) {
    const sched = window.charSchedulesMap[charId];
    if (isUrgent) return true;
    if (!sched || sched.lastEvalCycle === undefined) return true;
    const cooldown = sched.evalCooldown || 1;
    return (cycle - sched.lastEvalCycle) >= cooldown;
  }
  function markEvaluated(charId) {
    if (!window.charSchedulesMap[charId]) window.charSchedulesMap[charId] = {};
    window.charSchedulesMap[charId].lastEvalCycle = cycle;
    // 随机1-2轮冷却，天然错峰，防止扎堆同时开播下播
    window.charSchedulesMap[charId].evalCooldown = 1 + Math.floor(Math.random() * 2);
  }

  // ── 下播决策：遍历直播中的角色 ──
  for (const s of sessions) {
    const charName = s.name || s.characterId || '未知';
    const liveMins = Math.round((now - (s.startTime || now)) / 60000);
    const isUrgent = liveMins >= maxLiveMins;

    // 评估冷却：非紧急角色可能跳过本轮
    if (!canEvaluate(s.characterId, isUrgent)) {
      cycleLog.summary.cooldownSkip++;
      cycleLog.decisions.push({
        char: charName, state: '直播中', liveMins: liveMins,
        stopWill: '-', dice: '-', reason: '评估冷却中', result: '跳过'
      });
      continue;
    }

    let stopWill, reason;
    if (isUrgent) {
      stopWill = 100;
      reason = '达到上限必然下播';
    } else {
      stopWill = Math.round(baseStopRate + (liveMins / maxLiveMins) * 50);
      reason = '安全区比例增长';
    }

    const dice = Math.round(Math.random() * 100);
    const willStop = dice < stopWill;
    markEvaluated(s.characterId);

    cycleLog.decisions.push({
      char: charName, state: '直播中', liveMins: liveMins,
      stopWill: stopWill, dice: dice, reason: reason,
      result: willStop ? '下播' : '继续播'
    });

    if (willStop) {
      cycleLog.summary.stopped++;
      if (window.lumaOpsGateway) {
        await window.lumaOpsGateway.requestStopLive({
          characterId: s.characterId,
          reason: isUrgent ? "达到直播时长上限，房管通知下播" : "AI自主决定下播休息",
          source: isUrgent ? "max_duration_reached" : "ai_decide_stop"
        });
      }
    }
  }

  // 下播后刷新会话列表
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const streamingIds = new Set(sessions.map(s => s.characterId));
  cycleLog.summary.streaming = sessions.length;

  // ── 开播决策：遍历休息中的角色 ──
  if (baseSpawnRate > 0) {
    for (const c of allChars) {
      const charName = c.name || c.id || '未知';
      if (streamingIds.has(c.id)) continue;

      // 读取/初始化上次下播时间
      let lastEndTime = null;
      const sched = window.charSchedulesMap[c.id];
      if (sched && sched.lastEndTime) {
        lastEndTime = sched.lastEndTime;
      } else {
        // 新角色：随机分配安全区内已休息时长
        const initRestMins = Math.floor(Math.random() * (maxRestMins - minRestMins) + minRestMins);
        lastEndTime = now - initRestMins * 60000;
        if (!window.charSchedulesMap[c.id]) window.charSchedulesMap[c.id] = {};
        window.charSchedulesMap[c.id].lastEndTime = lastEndTime;
        window.charSchedulesMap[c.id].isNew = true;
      }

      const restMins = Math.round((now - lastEndTime) / 60000);
      const isUrgent = restMins >= maxRestMins;

      // 强制休息期
      if (restMins < minRestMins) {
        cycleLog.decisions.push({
          char: charName, state: '休息中', restMins: restMins,
          spawnWill: 0, dice: '-', reason: `强制休息期(${restMins}/${minRestMins}分)`, result: '跳过'
        });
        continue;
      }

      // 评估冷却：非紧急角色可能跳过本轮
      if (!canEvaluate(c.id, isUrgent)) {
        cycleLog.summary.cooldownSkip++;
        cycleLog.decisions.push({
          char: charName, state: '休息中', restMins: restMins,
          spawnWill: '-', dice: '-', reason: '评估冷却中', result: '跳过'
        });
        continue;
      }

      let spawnWill, reason;
      if (isUrgent) {
        spawnWill = 100;
        reason = '达到上限必然开播';
      } else {
        spawnWill = Math.round(baseSpawnRate + (restMins / maxRestMins) * 50);
        reason = '安全区比例增长';
      }

      const dice = Math.round(Math.random() * 100);
      const willSpawn = dice < spawnWill;
      markEvaluated(c.id);

      cycleLog.decisions.push({
        char: charName, state: '休息中', restMins: restMins,
        spawnWill: spawnWill, dice: dice, reason: reason,
        result: willSpawn ? '开播' : '不播'
      });

      if (willSpawn) {
        cycleLog.summary.started++;
        if (window.lumaOpsGateway) {
          await window.lumaOpsGateway.requestStartLive({
            characterId: c.id,
            source: "ai_decide_start"
          });
        }
      }
    }
  } else {
    cycleLog.decisions.push({ char: '(全服维护)', state: '-', restMins: '-', spawnWill: 0, dice: '-', reason: 'charSpawnRate=0', result: '跳过全部' });
  }

  // 持久化调度数据
  try { await saveDbSetting("char_schedules", window.charSchedulesMap); } catch(e) {}

  // 最终刷新并渲染
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  window.liveList = sessions;
  renderLiveGrid();

  // ── 写入轮询日志 ──
  cycleLog.summary.streaming = sessions.length;
  if (!window.lumaOpsLog) window.lumaOpsLog = [];
  window.lumaOpsLog.unshift(cycleLog);
  if (window.lumaOpsLog.length > 50) window.lumaOpsLog.pop();
  console.log(`[LUMA官方运营组] 第${cycle}轮 ${cycleLog.time} | 在播${cycleLog.summary.streaming} | 开播${cycleLog.summary.started} 下播${cycleLog.summary.stopped} 冷却跳过${cycleLog.summary.cooldownSkip}`, cycleLog);
}
window.syncLiveSessions = syncLiveSessions;
window.lumaOpsPoll = syncLiveSessions;
