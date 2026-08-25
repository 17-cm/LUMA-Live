// =========================================================================
// LUMA Live 直播运营核心
// 包含：LUMA官方运营组（定时器轮询决策）+ 房管（审核裁决网关）+ 工具注册
// 本文件从 core.js 和 live.js 抽取，独立管理直播流程逻辑
// 依赖：core.js (dbUpsert/saveDbSetting/api) + live.js (renderLiveGrid/normalizeCategory)
// =========================================================================

// 轮询日志：文件加载即初始化，避免首次轮询前访问报错
if (!window.lumaOpsLog) window.lumaOpsLog = [];
// =========================================================================
// 【角色意愿值管理】角色聊天驱动，仅存放聊天真实获取的意愿值
// 聊天中输出[意愿:X]时，后台先判定角色当前状态（直播中=下播意愿，休息中=开播意愿）
// 意愿值范围 0-100，轮询计算时取 1/2（0-50分）+ 比例式增长（0-50分）
// 未聊过/未获取的角色返回 null，基础分按 0 计算，日志与UI标注「暂未获取」
// =========================================================================
// 【角色意愿值管理】角色聊天驱动，仅存放聊天真实获取的意愿值
// 聊天中输出[意愿:X]时，后台先判定角色当前状态（直播中=下播意愿，休息中=开播意愿）
// 意愿值范围 0-100，轮询计算时取 1/2（0-50分）+ 比例式增长（0-50分）
// 未聊过/未获取的角色返回 null，基础分按 0 计算，日志与UI标注「暂未获取」
// =========================================================================

// 宽容模式提取文本中的意愿数值（支持开播意愿、下播意愿、通用意愿、中英文冒号、等号、多标签连缀等）
function extractWillValueFromText(rawText) {
  if (!rawText) return null;
  const str = typeof rawText === 'object' ? JSON.stringify(rawText) : String(rawText);
  
  // 1. 精准提取【开播意愿】
  const mStart = str.match(/(?:\[|【)?\s*(?:LUMA)?(?:Live)?(?:开启)?开播意愿(?:值)?\s*[:：=—\- ]\s*(\d+(?:\.\d+)?)\s*(?:\/100|分|%)?\s*(?:\]|】)?/i);
  if (mStart) {
    const num = Number(mStart[1]);
    if (!isNaN(num)) return { type: 'startWill', value: Math.max(0, Math.min(100, Math.round(num))) };
  }

  // 2. 精准提取【下播意愿】
  const mStop = str.match(/(?:\[|【)?\s*(?:LUMA)?(?:Live)?(?:关闭)?下播意愿(?:值)?\s*[:：=—\- ]\s*(\d+(?:\.\d+)?)\s*(?:\/100|分|%)?\s*(?:\]|】)?/i);
  if (mStop) {
    const num = Number(mStop[1]);
    if (!isNaN(num)) return { type: 'stopWill', value: Math.max(0, Math.min(100, Math.round(num))) };
  }

  // 3. 标准通用正则：[意愿:10] / [意愿：10] / [LUMA直播意愿:10] / 【意愿：10】 / [意愿值:10] / [当前意愿值：10]
  const m1 = str.match(/(?:\[|【)?\s*(?:LUMA)?(?:Live)?(?:直播)?(?:当前)?意愿(?:值)?\s*[:：=—\- ]\s*(\d+(?:\.\d+)?)\s*(?:\/100|分|%)?\s*(?:\]|】)?/i);
  if (m1) {
    const num = Number(m1[1]);
    if (!isNaN(num)) return { type: 'auto', value: Math.max(0, Math.min(100, Math.round(num))) };
  }

  // 4. 卡片 json 格式如 "body": "当前意愿值：10" 或 "label": "10"
  const m2 = str.match(/意愿.*?(\d+)/);
  if (m2) {
    const num = Number(m2[1]);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      return { type: 'auto', value: Math.round(num) };
    }
  }

  return null;
}

// 获取全量意愿字典（三级缓存：内存 -> localStorage -> 宿主数据库）
async function getCharWillMap() {
  let map = {};
  // 1. 内存极速缓存
  if (window._lumaCharWillMemory && typeof window._lumaCharWillMemory === 'object') {
    map = { ...window._lumaCharWillMemory };
  }
  // 2. localStorage 跨 iframe 同源即时同步
  try {
    const local = localStorage.getItem("luma_char_will_map");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') {
        map = { ...parsed, ...map };
      }
    }
  } catch (e) {}
  // 3. 宿主数据库持久化层
  try {
    if (typeof api !== 'undefined' && api.db && typeof api.db.get === 'function') {
      const saved = await api.db.get("app_settings", "char_will_map").catch(() => null);
      if (saved && typeof saved === 'object') {
        const dbData = saved.data || saved.value || saved;
        for (const k in dbData) {
          if (k !== 'id' && typeof dbData[k] === 'object') {
            map[k] = { ...(map[k] || {}), ...dbData[k] };
          }
        }
      }
    }
  } catch (e) {}
  window._lumaCharWillMemory = map;
  return map;
}

// 写入意愿（同步写入内存、localStorage、宿主数据库）
async function setCharWill(characterId, type, value) {
  if (!characterId || !type) return;
  const num = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  // 1. 内存更新
  if (!window._lumaCharWillMemory) window._lumaCharWillMemory = {};
  if (!window._lumaCharWillMemory[characterId]) window._lumaCharWillMemory[characterId] = { startWill: null, stopWill: null };
  window._lumaCharWillMemory[characterId][type] = num;
  window._lumaCharWillMemory[characterId].updatedAt = Date.now();

  // 2. localStorage 同步
  try {
    localStorage.setItem(`luma_will_${characterId}_${type}`, String(num));
    const fullMap = JSON.parse(localStorage.getItem('luma_char_will_map') || '{}');
    if (!fullMap[characterId]) fullMap[characterId] = { startWill: null, stopWill: null };
    fullMap[characterId][type] = num;
    fullMap[characterId].updatedAt = Date.now();
    localStorage.setItem('luma_char_will_map', JSON.stringify(fullMap));
  } catch (e) {}

  // 3. 宿主数据库持久化
  try {
    const map = await getCharWillMap();
    if (!map[characterId]) map[characterId] = { startWill: null, stopWill: null };
    map[characterId][type] = num;
    map[characterId].updatedAt = Date.now();
    await saveDbSetting("char_will_map", map);
  } catch (e) {}
}

// 深度扫描宿主所有可能的消息表与聊天历史
async function scanAllMessagesForCharWill(characterId) {
  if (!characterId) return null;
  try {
    const tablesToTry = ["messages", "chat_messages", "chat_history", "chats", "conversations", "records"];
    let allFound = [];

    // 1. 尝试从 api.db 读取
    if (typeof api !== 'undefined' && api.db && typeof api.db.list === 'function') {
      for (const tbl of tablesToTry) {
        try {
          const list = await api.db.list(tbl, { limit: 200 }).catch(() => []);
          if (Array.isArray(list) && list.length > 0) {
            allFound = allFound.concat(list);
          }
        } catch (err) {}
      }
    }

    // 2. 尝试从 localStorage 扫描可能存在的宿主聊天记录 key
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('msg') || k.includes('chat') || k.includes('history') || k.includes('message'))) {
          try {
            const raw = localStorage.getItem(k);
            if (raw && (raw.startsWith('[') || raw.startsWith('{'))) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) allFound = allFound.concat(parsed);
              else if (parsed && typeof parsed === 'object') allFound.push(parsed);
            }
          } catch(e) {}
        }
      }
    } catch (e) {}

    if (allFound.length === 0) return null;

    // 筛选角色发言
    const targetMsgs = allFound.filter(m => {
      if (!m) return false;
      // 排除明确是用户的消息
      if (m.role === 'user' || m.isUser === true || m.sender === 'user') return false;
      
      const mCharId = m.characterId || m.charId || m.senderId || m.author || m.speaker || m.character_id || m.targetId || m.from;
      // 角色ID匹配
      if (mCharId === characterId) return true;
      // 角色名称匹配
      const allChars = window.allCharacters || [];
      const charObj = allChars.find(c => c.id === characterId);
      if (charObj && (m.characterName === charObj.name || m.senderName === charObj.name || m.name === charObj.name)) return true;
      // 单人或通用消息且包含意愿字样
      const txt = m.content || m.text || m.message || '';
      return typeof txt === 'string' && (txt.includes('意愿') || txt.includes('[意愿'));
    });

    // 按时间倒序排序
    targetMsgs.sort((a, b) => (b.createdAt || b.timestamp || b.time || 0) - (a.createdAt || a.timestamp || a.time || 0));

    for (const msg of targetMsgs) {
      const content = msg.content || msg.text || msg.message || msg.body || (typeof msg === 'string' ? msg : JSON.stringify(msg));
      const val = extractWillValueFromText(content);
      if (val !== null) {
        // 判断当前状态
        let isStreaming = false;
        try {
          const sessions = (typeof api !== 'undefined' && api.db && await api.db.list("live_sessions", { limit: 500 }).catch(() => [])) || [];
          isStreaming = sessions.some(s => s.characterId === characterId);
        } catch (e) {}
        const willType = isStreaming ? 'stopWill' : 'startWill';
        await setCharWill(characterId, willType, val);
        console.log(`[LUMA Live] 深度扫描成功恢复角色 ${characterId} 意愿: ${willType}=${val}`);
        return { type: willType, value: val };
      }
    }
  } catch (e) {
    console.warn("[LUMA Live] 深度扫描消息库异常:", e);
  }
  return null;
}

async function getCharWill(characterId) {
  if (!characterId) return { startWill: null, stopWill: null };
  const map = await getCharWillMap();
  const w = map[characterId];
  let startWill = (w && typeof w.startWill === 'number') ? w.startWill : null;
  let stopWill = (w && typeof w.stopWill === 'number') ? w.stopWill : null;

  // 若尚未获取，启动全表全源扫描保底
  if (startWill === null && stopWill === null) {
    const scanned = await scanAllMessagesForCharWill(characterId);
    if (scanned) {
      if (scanned.type === 'startWill') startWill = scanned.value;
      else stopWill = scanned.value;
    }
  }

  return { startWill, stopWill };
}

window.getCharWill = getCharWill;
window.setCharWill = setCharWill;
window.getCharWillMap = getCharWillMap;
window.extractWillValueFromText = extractWillValueFromText;
window.scanAllMessagesForCharWill = scanAllMessagesForCharWill;

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
// 【延迟执行队列】判定为开播/下播后，延迟1-10分钟执行，避免同时开播下播
// =========================================================================
async function getPendingActions() {
  try {
    const saved = await api.db.get("app_settings", "luma_pending_actions").catch(() => null);
    return Array.isArray(saved) ? saved : [];
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
        });
      } else if (action.action === 'stop') {
        await window.lumaOpsGateway.requestStopLive({
          characterId: action.characterId,
          reason: action.reason || "角色意愿值决定下播休息",
          source: "delayed_stop"
        });
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
      const rawCat = c.tags ? c.tags[0] : '随性杂谈';
      const chosenCat = (typeof normalizeCategory === 'function') ? normalizeCategory(rawCat) : rawCat;
      const chosenSubTag = (c.tags && c.tags[1]) || (rawCat !== chosenCat ? rawCat : '日常唠嗑');

      const newSession = {
        characterId: c.id,
        name: c.name || '主播',
        avatar: c.avatar || coverUrl,
        cover: coverUrl,
        category: chosenCat,
        subTag: chosenSubTag,
        topic: `${c.name || '主播'}的精彩直播`,
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
      // 初始空闲/蓄势待发：已度过休息期，意愿较高，近期轮询可自然开播
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
  
  console.log("[LUMA世界冷启动] ✅ 角色初始生态已统一完成分配与持久化落盘");
}
window.bootstrapWorldInitialState = bootstrapWorldInitialState;

// =========================================================================
// 决策公式：安全区外(达到时长上限)=100%必然；安全区内=基础意愿 + (已持续时长/上限)×50%
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
      const charWill = await getCharWill(item.charId);
      const hasRealWill = charWill.stopWill !== null && charWill.stopWill !== undefined;
      const rawWill = hasRealWill ? Number(charWill.stopWill) : null;
      // 意愿值取二分之一折算为0-50分；若暂未获取则基础得分计0
      const willScore = hasRealWill ? Math.round(rawWill / 2) : 0;
      const timeScore = Math.round((liveMins / maxLiveMins) * 50);
      
      let stopWill, reason, baseWillText;
      if (isUrgent) {
        stopWill = 100;
        reason = '达到上限必然下播';
        baseWillText = hasRealWill ? `${rawWill}` : '暂未获取';
      } else {
        stopWill = Math.min(100, willScore + timeScore);
        reason = hasRealWill ? '意愿(1/2)+时间增长' : '暂未获取意愿(仅时间增长)';
        baseWillText = hasRealWill ? `${rawWill} (折算${willScore})` : '暂未获取';
      }

      const dice = Math.round(Math.random() * 100);
      const willStop = dice < stopWill;

      cycleLog.decisions.push({
        char: item.charName, state: '直播中',
        liveMins: liveMins,
        baseWill: baseWillText,
        stopWill: stopWill,
        dice: dice,
        reason: reason,
        result: willStop ? '准备下播' : '继续播'
      });

      if (willStop) {
        cycleLog.summary.stopped++;
        // 延迟1-10分钟执行下播
        const delayMins = Math.floor(Math.random() * 10) + 1;
        await addPendingAction(item.charId, 'stop', delayMins, isUrgent ? "达到直播时长上限" : "角色意愿值决定下播休息", now);
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
      const charWill = await getCharWill(item.charId);
      const hasRealWill = charWill.startWill !== null && charWill.startWill !== undefined;
      const rawWill = hasRealWill ? Number(charWill.startWill) : null;
      // 意愿值取二分之一折算为0-50分；若暂未获取则基础得分计0
      const willScore = hasRealWill ? Math.round(rawWill / 2) : 0;
      const timeScore = Math.round((restMins / maxRestMins) * 50);

      let spawnWill, reason, baseWillText;
      if (isUrgent) {
        spawnWill = 100;
        reason = '达到上限必然开播';
        baseWillText = hasRealWill ? `${rawWill}` : '暂未获取';
      } else {
        spawnWill = Math.min(100, willScore + timeScore);
        reason = hasRealWill ? '意愿(1/2)+时间增长' : '暂未获取意愿(仅时间增长)';
        baseWillText = hasRealWill ? `${rawWill} (折算${willScore})` : '暂未获取';
      }

      const dice = Math.round(Math.random() * 100);
      const willSpawn = dice < spawnWill;

      cycleLog.decisions.push({
        char: item.charName, state: '休息中',
        restMins: restMins,
        baseWill: baseWillText,
        spawnWill: spawnWill,
        dice: dice,
        reason: reason,
        result: willSpawn ? '准备开播' : '不播'
      });

      if (willSpawn) {
        cycleLog.summary.started++;
        // 延迟1-10分钟执行开播
        const delayMins = Math.floor(Math.random() * 10) + 1;
        await addPendingAction(item.charId, 'start', delayMins, "角色意愿值决定开播", now);
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
  if (window.lumaOpsLog.length > 3) window.lumaOpsLog.pop();
  console.log(`[LUMA官方运营组] 第${cycle}轮 ${cycleLog.time} | 在播${cycleLog.summary.streaming} | 评估${cycleLog.summary.evaluated}人 开播${cycleLog.summary.started} 下播${cycleLog.summary.stopped}`, cycleLog);
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
    const lastPollTime = await api.db.get("app_settings", "last_poll_time").catch(() => null);
    const now = Date.now();
    
    // 第一次使用，没有记录，直接初始化
    if (!lastPollTime) {
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
    
    console.log(`[LUMA Live] 离线补跑：离开 ${Math.round(elapsed/60000)} 分钟，补跑 ${catchUpCount} 次轮询`);
    
    // 逐次补跑，每次传入模拟时间
    for (let i = 0; i < catchUpCount; i++) {
      const simulatedNow = lastPollTime + (i + 1) * pollIntervalMs;
      try {
        await syncLiveSessions({ allowSpawn: true, catchUp: true }, simulatedNow);
      } catch (e) {
        console.log(`[LUMA Live] 补跑第 ${i+1} 次失败`, e);
      }
    }
    
    // 补跑完成后，用真实时间再执行一次到期延迟动作（补跑时用的是模拟时间，真实时间已超过）
    try { await executeDueActions(); } catch (e) {}
    
    // 补跑完成后，更新上次轮询时间为当前时间
    try { await saveDbSetting("last_poll_time", now); } catch (e) {}
    
    console.log(`[LUMA Live] 离线补跑完成：共补跑 ${catchUpCount} 次，模拟时长 ${Math.round(actualElapsed/60000)} 分钟`);
    return { caughtUp: true, catchUpCount, elapsedMs: elapsed, simulatedMs: actualElapsed };
  } catch (e) {
    console.log("[LUMA Live] 离线补跑失败", e);
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
      console.log("[LUMA Live] calendar.write 不可用，跳过状态同步");
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
    console.log(`[LUMA Live] 状态同步完成（日程），共同步 ${allChars.length} 个角色`);
  } catch (e) {
    console.log("[LUMA Live] 状态同步失败", e);
  }
}
window.syncCharStatusToChat = syncCharStatusToChat;

// =========================================================================
// 【事件监听】监听角色聊天消息，提取[意愿:X]指令并更新角色意愿值
// 读取时严格先判定该角色当前是【直播中】还是【休息中】，再归类记录为下播意愿或开播意愿
// =========================================================================
async function handleExtractedCharWill(characterId, rawText, willExtraction = null) {
  if (!characterId) return;
  const extraction = willExtraction || extractWillValueFromText(rawText);
  if (!extraction || typeof extraction.value !== 'number') return;
  
  const willValue = extraction.value;
  let willType = 'startWill';

  if (extraction.type === 'startWill') {
    willType = 'startWill';
  } else if (extraction.type === 'stopWill') {
    willType = 'stopWill';
  } else {
    // 自动判定：实时查验角色当前状态（直播中 vs 休息中）
    let isStreaming = false;
    try {
      const sessions = (typeof api !== 'undefined' && api.db && await api.db.list("live_sessions", { limit: 500 }).catch(() => [])) || [];
      isStreaming = sessions.some(s => s.characterId === characterId);
    } catch (e) {}
    willType = isStreaming ? 'stopWill' : 'startWill';
  }
  
  await setCharWill(characterId, willType, willValue);
  console.log(`[LUMA Live] 意愿提取成功并入库: 角色=${characterId}, 意愿类型=${willType}, 意愿值=${willValue}`);
}

// 供 manifest.json 中 extensions.events 后台直接回调的 handler
async function luma_will_listener(event) {
  try {
    if (!event) return;
    
    // 兼容可能的多层包裹 (event.data / event.payload / event.message / event)
    const raw = (event.payload || event.data || event.message || event);
    if (!raw) return;

    // 排除明确是用户发的消息
    if (raw.role === 'user' || raw.isUser === true || raw.sender === 'user' || raw.type === 'user') {
      return;
    }

    // 提取文本内容
    let content = raw.content || raw.text || raw.message || raw.body || raw.prompt || '';
    if (typeof content !== 'string') {
      content = typeof raw === 'string' ? raw : JSON.stringify(raw);
    }

    // 提取角色ID
    let charId = raw.characterId || raw.charId || raw.senderId || raw.author || raw.speaker || raw.character_id || raw.targetId || raw.from || event.characterId || event.charId || event.senderId;

    // 若无直接 ID，尝试按角色名匹配
    const allChars = window.allCharacters || (typeof api !== 'undefined' && api.characters && (await api.characters.list().catch(() => []))) || [];
    if (!charId && (raw.senderName || raw.characterName || raw.name)) {
      const sName = raw.senderName || raw.characterName || raw.name;
      const matched = allChars.find(c => c.name === sName || (c.name && sName.includes(c.name)));
      if (matched) charId = matched.id;
    }

    // 提取意愿数值
    let willVal = extractWillValueFromText(content);
    
    // 检查是否有 directives 结构化参数
    if (willVal === null && raw.directives && Array.isArray(raw.directives)) {
      for (const d of raw.directives) {
        if (d && (d.label?.includes('意愿') || d.syntax?.includes('意愿') || d.name?.includes('意愿'))) {
          const v = extractWillValueFromText(d.value || d.params || d.content);
          if (v !== null) { willVal = v; break; }
        }
      }
    }

    if (willVal !== null) {
      if (charId) {
        await handleExtractedCharWill(charId, content, willVal);
      } else {
        // 若事件中无法判定角色ID，为当前所有角色或单人角色同步该意愿
        if (allChars.length === 1) {
          await handleExtractedCharWill(allChars[0].id, content, willVal);
        } else {
          for (const c of allChars) {
            await handleExtractedCharWill(c.id, content, willVal);
          }
        }
      }
    }
  } catch (e) {
    console.warn("[LUMA Live] 后台事件 luma_will_listener 执行异常", e);
  }
}
window.luma_will_listener = luma_will_listener;
window.handleExtractedCharWill = handleExtractedCharWill;

function registerLumaEventListeners() {
  try {
    // 1. AiPhone SDK 原生事件监听
    if (typeof AiPhone !== 'undefined' && AiPhone.on) {
      AiPhone.on("chat.message.created", luma_will_listener);
      console.log("[LUMA Live] AiPhone 事件监听 (chat.message.created) 已注册");
    }

    // 2. Window postMessage 宿主跨窗口通信保底监听
    window.addEventListener('message', async (e) => {
      try {
        const data = e.data;
        if (!data) return;
        // 兼容宿主 postMessage 转发格式
        if (data.type === 'chat.message.created' || data.type === 'onMessage' || data.action === 'message_created' || data.event === 'chat.message.created') {
          const payload = data.payload || data.data || data;
          await luma_will_listener(payload);
        }
      } catch (err) {}
    });
  } catch (e) {
    console.log("[LUMA Live] 事件监听注册失败", e);
  }
}
window.registerLumaEventListeners = registerLumaEventListeners;
// 文件加载时自动注册事件监听
registerLumaEventListeners();
