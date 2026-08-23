// =========================================================================
// LUMA Live 直播运营核心
// 包含：LUMA官方运营组（定时器轮询决策）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

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

  // ── 下播决策：遍历直播中的角色 ──
  for (const s of sessions) {
    const liveMins = (now - (s.startTime || now)) / 60000;
    let stopWill;

    // 安全区判定：达到直播时长上限 → 必然下播
    if (liveMins >= maxLiveMins) {
      stopWill = 100;
    } else {
      // 安全区内：基础下播意愿 + 比例式增长（最高50%）
      stopWill = baseStopRate + (liveMins / maxLiveMins) * 50;
    }

    // 掷骰子：AI决定是否下播
    if (Math.random() * 100 < stopWill) {
      if (window.lumaOpsGateway) {
        await window.lumaOpsGateway.requestStopLive({
          characterId: s.characterId,
          reason: liveMins >= maxLiveMins ? "达到直播时长上限，房管通知下播" : "AI自主决定下播休息",
          source: liveMins >= maxLiveMins ? "max_duration_reached" : "ai_decide_stop"
        });
      }
    }
  }

  // 下播后刷新会话列表
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  const streamingIds = new Set(sessions.map(s => s.characterId));

  // ── 开播决策：遍历休息中的角色 ──
  // 维护模式：charSpawnRate=0 时跳过所有开播决策
  if (baseSpawnRate > 0) {
    for (const c of allChars) {
      // 已在直播中 → 跳过
      if (streamingIds.has(c.id)) continue;

      // 读取上次下播时间（从没播过的角色视为休息了很久）
      let lastEndTime = null;
      const sched = window.charSchedulesMap ? window.charSchedulesMap[c.id] : null;
      if (sched && sched.lastEndTime) lastEndTime = sched.lastEndTime;
      const restMins = lastEndTime ? (now - lastEndTime) / 60000 : Infinity;

      // 强制休息期：房管会驳回，跳过
      if (restMins < minRestMins) continue;

      let spawnWill;
      // 安全区判定：达到休息时长上限 → 必然开播
      if (restMins >= maxRestMins) {
        spawnWill = 100;
      } else {
        // 安全区内：基础开播意愿 + 比例式增长（最高50%）
        spawnWill = baseSpawnRate + (restMins / maxRestMins) * 50;
      }

      // 掷骰子：AI决定是否开播
      if (Math.random() * 100 < spawnWill) {
        if (window.lumaOpsGateway) {
          await window.lumaOpsGateway.requestStartLive({
            characterId: c.id,
            source: "ai_decide_start"
          });
        }
      }
    }
  }

  // 最终刷新并渲染
  sessions = await api.db.list("live_sessions", { limit: 500 }) || [];
  liveList = sessions;
  window.liveList = liveList;
  renderLiveGrid();
}
window.syncLiveSessions = syncLiveSessions;
window.lumaOpsPoll = syncLiveSessions;
