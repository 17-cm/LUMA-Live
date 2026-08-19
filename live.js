// 全局 API 声明与防空处理
window.api = window.AiPhone || window.AiPhoneApp || {};
var api = window.api;

let liveList = [];
let allCharacters = [];
let currentRoom = null;
let followedHosts = [];
let activeMainCategory = 'all';
let activeSubCategory = 'all';

let danmakuPool = [];
let hostSpeechPool = [];
let danmakuDripTimer = null;
let hostSpeechDripTimer = null;
let liveDurationInterval = null;
let isFetchingBatchPackage = false;
let viewerCountInterval = null;
let currentWalletBalance = 0;

// 角色作息时刻表字典（内存缓存，持久化于 app_settings:char_schedules）
let charSchedulesMap = {};

const NPC_AVATAR_POOL = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200'
];

// =========================================================================
// 【调试回调与运营组专用通知系统】（独立于普通聊天室，悬浮胶囊展示）
// =========================================================================
function lumaOpsNotify(title, detail, type = 'info') {
  console.log(`[LUMA 官方运营组] ${title}: ${detail}`);

  // 1. 尝试调用小手机系统通知 (非聊天室消息)
  try {
    if (api.ui?.showNotification) {
      api.ui.showNotification({
        title: `[LUMA 官方运营] ${title}`,
        body: detail
      });
    }
  } catch (e) {}

  // 2. 界面顶部悬浮高亮运营胶囊 (用于清晰测试观察状态流转)
  let container = document.getElementById('luma-ops-debug-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'luma-ops-debug-container';
    container.className = 'fixed top-12 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none flex flex-col items-center gap-1.5 w-[90%] max-w-sm';
    document.body.appendChild(container);
  }

  const badge = document.createElement('div');
  const borderCol = type === 'reject' ? 'border-rose-500/60 bg-slate-950/95 text-rose-300' : 
                    type === 'force' ? 'border-amber-500/60 bg-slate-950/95 text-amber-300' : 
                    'border-emerald-500/60 bg-slate-950/95 text-emerald-300';
  badge.className = `w-full px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md border text-[11px] font-bold transition-all duration-300 transform -translate-y-2 opacity-0 flex items-start gap-2 ${borderCol}`;
  badge.innerHTML = `
    <div class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${type === 'reject' ? 'bg-rose-500 animate-ping' : type === 'force' ? 'bg-amber-400' : 'bg-emerald-400'}"></div>
    <div class="flex-1 min-w-0">
      <div class="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">🛡️ 官方运营组调度判定</div>
      <div class="text-white font-black truncate">${title}</div>
      <div class="text-[10px] text-slate-300 mt-0.5 leading-tight">${detail}</div>
    </div>
  `;
  container.appendChild(badge);

  requestAnimationFrame(() => {
    badge.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    badge.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => badge.remove(), 350);
  }, 4000);
}
window.lumaOpsNotify = lumaOpsNotify;

// =========================================================================
// 【LUMA 直播官方运营组】：唯一权威审核裁决网关（Single Source of Truth）
// =========================================================================
const lumaOpsGateway = {
  // 1. 申请开启直播
  async requestStartLive({ characterId, category, topic, durationMins, source = 'system' }) {
    if (!characterId) {
      lumaOpsNotify("开播驳回", "未指定有效的主播身份", "reject");
      return { success: false, reason: "【LUMA官方运营组通告】开播申请未通过：未指定有效的主播身份。" };
    }

    const allChars = window.allCharacters || allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = character?.name || "主播";
    const now = Date.now();
    const params = window.appParams || {};
    const spawnRate = params.charSpawnRate !== undefined ? params.charSpawnRate : 45;
    const maxMins = params.maxLiveDuration || 120;

    // 审核 1：0% 全服维护模式检测
    if (spawnRate === 0 && source !== 'egg_force') {
      lumaOpsNotify("全服维护拦截", `LUMA Live 当前处于全服停机维护状态，【${charName}】禁止自发开播`, "reject");
      return {
        success: false,
        reason: "【LUMA官方运营组通告】平台服务器当前正在进行全服停机维护与升级，公网推流通道暂未开放，暂不予批准开播。"
      };
    }

    // 审核 2：防分身、防重复开播（Reject Duplicate）
    const sessions = await api.db.list("live_sessions") || [];
    const existing = sessions.find(s => s.characterId === characterId);
    if (existing) {
      lumaOpsNotify("防多开驳回", `【${charName}】当前已在直播中（房间号：${existing.roomId}，标题：《${existing.topic}》），严禁重复分身开播！`, "reject");
      return {
        success: false,
        reason: `【LUMA官方运营组通告】主播当前已在房间 #${existing.roomId} 直播中，严禁分身重复开播。`
      };
    }

    // 审核 3：10分钟法定必须休息冷却期检测 (Mandatory Cooldown)
    const schedule = await lumaOpsGateway.getCharSchedule(characterId);
    const lastOffline = schedule?.lastOfflineAt || 0;
    const MANDATORY_REST_MS = 10 * 60 * 1000;
    if (source !== 'egg_force' && lastOffline > 0 && (now - lastOffline) < MANDATORY_REST_MS) {
      const restLeftMins = Math.ceil((MANDATORY_REST_MS - (now - lastOffline)) / 60000);
      lumaOpsNotify("法定休息期拦截", `【${charName}】刚刚下播，正处于10分钟法定休息冷却期（剩余 ${restLeftMins} 分钟），运营组驳回开播申请！`, "reject");
      return {
        success: false,
        reason: `【LUMA官方运营组通告】主播刚刚结束上一场推流，目前正处于法定10分钟护眼与体能恢复期（还需休息 ${restLeftMins} 分钟），暂不批准开播申请。`
      };
    }

    // 审核 4：时长合法性与边界保护
    const finalDurationMins = Math.min(Math.max(Number(durationMins) || 60, 20), maxMins);
    const finalCat = category || "随性杂谈";
    const finalTopic = topic || `【${charName}】的实时直播`;

    // 审核通过：统一落库写入 live_sessions
    const newSession = await api.db.create("live_sessions", {
      characterId: characterId,
      name: charName,
      avatar: character?.avatar || NPC_AVATAR_POOL[0],
      cover: character?.avatar || NPC_AVATAR_POOL[0],
      category: finalCat,
      subTag: "实时直播",
      topic: finalTopic,
      heat: Math.floor(Math.random() * 12000 + 3000),
      roomId: Math.floor(Math.random() * 899999 + 100000),
      startTime: now,
      endTime: now + finalDurationMins * 60 * 1000,
      isNPC: false
    });

    liveList.unshift(newSession);
    window.liveList = liveList;
    renderLiveGrid();

    // 更新角色状态为：{{char}}直播中，并记录单次权威时间线记忆
    try {
      if (api.characters?.writeState) {
        await api.characters.writeState({
          characterId: characterId,
          state: {
            name: "状态",
            value: `${charName}直播中`
          }
        });
      }
      if (api.memory?.addTimeline) {
        await api.memory.addTimeline({
          characterId: characterId,
          appLabel: "LUMA Live",
          detail: "live_started",
          summary: `【${charName}】在 LUMA Live 开启了网络直播《${finalTopic}》，预计直播 ${finalDurationMins} 分钟。`,
          appEventId: `live_start_${newSession.id}`
        });
      }
    } catch (e) {}

    // 触发调试回调与运营通知
    lumaOpsNotify("准予开播", `【${charName}】已正式开播！赛道：${finalCat}，标题：《${finalTopic}》，预计时长：${finalDurationMins}分钟`, "approve");

    // 0% 强开被迫营业彩蛋
    if (spawnRate === 0 && source === 'egg_force') {
      triggerProactiveEggMessage(characterId, charName, finalTopic);
    }

    return {
      success: true,
      message: `【LUMA官方运营组】开播申请已批准！直播间（房间号：${newSession.roomId}）推流通道已开启，祝直播顺利！`,
      data: { roomId: newSession.roomId, durationMins: finalDurationMins }
    };
  },

  // 2. 申请结束下播（统一权威出口）
  async requestStopLive({ characterId, reason = '正常下播', source = 'system' }) {
    if (!characterId) return { success: false, reason: "【LUMA官方运营组通告】下播申请未通过：未指定有效的主播身份。" };

    const sessions = await api.db.list("live_sessions") || [];
    const target = sessions.find(s => s.characterId === characterId);
    const allChars = window.allCharacters || allCharacters || [];
    const character = allChars.find(c => c.id === characterId) || await api.characters.get(characterId).catch(() => null);
    const charName = character?.name || target?.name || "主播";
    const now = Date.now();

    if (!target) {
      return {
        success: false,
        reason: "【LUMA官方运营组通告】主播当前并未开启直播推流，无需办理下播结算。"
      };
    }

    if (target) {
      await api.db.delete("live_sessions", target.id);
      liveList = liveList.filter(s => s.id !== target.id);
      window.liveList = liveList;
      renderLiveGrid();
    }

    // 如果当前玩家正身处这个直播间，安全退出并关闭弹窗
    if (currentRoom && currentRoom.characterId === characterId) {
      api.ui?.toast(`📢 主播【${charName}】已结束本次直播！`);
      closeLiveRoom();
    }

    // 更新角色作息时刻表：记录下播时间点，并根据意愿度推算下一场开播时刻
    const params = window.appParams || {};
    const maxRestMins = params.maxRestDuration || 360;
    const spawnRate = params.charSpawnRate !== undefined ? params.charSpawnRate : 45;

    // 意愿度映射休息时间：意愿度越高 (80%)，休息越短；意愿度越低 (20%)，休息越长
    const effectiveRate = Math.min(Math.max(spawnRate, 5), 80) / 100;
    const calculatedRestMins = Math.max(10, Math.round(maxRestMins - (maxRestMins - 10) * effectiveRate));
    const nextLiveTimestamp = now + (calculatedRestMins * 60 * 1000);

    await lumaOpsGateway.saveCharSchedule(characterId, {
      characterId: characterId,
      lastOfflineAt: now,
      nextLiveAt: nextLiveTimestamp,
      planRestMins: calculatedRestMins,
      planDurationMins: Math.floor(Math.random() * 40 + 50)
    });

    // 更新角色状态为：{{char}}已下播，并记录单次权威时间线记忆
    try {
      if (api.characters?.writeState) {
        await api.characters.writeState({
          characterId: characterId,
          state: {
            name: "状态",
            value: `${charName}已下播`
          }
        });
      }
      if (api.memory?.addTimeline) {
        await api.memory.addTimeline({
          characterId: characterId,
          appLabel: "LUMA Live",
          detail: "live_stopped",
          summary: `【${charName}】已结束在 LUMA Live 的网络直播（原因：${reason}），进入法定休息期。`,
          appEventId: `live_stop_${now}`
        });
      }
    } catch (e) {}

    // 触发调试回调与运营通知
    lumaOpsNotify("下播结算", `【${charName}】已正式下播（${reason}）。已开启10分钟法定休息，预计下次开播：${calculatedRestMins}分钟后`, "force");

    return {
      success: true,
      message: "【LUMA官方运营组】下播结算已完成，推流通道已关闭，已为您开启10分钟法定休息期，辛苦主播！"
    };
  },

  // 3. 读取角色作息时刻表
  async getCharSchedule(charId) {
    if (charSchedulesMap[charId]) return charSchedulesMap[charId];
    const data = await api.db.get("app_settings", `sched_${charId}`).catch(() => null);
    if (data) charSchedulesMap[charId] = data;
    return data;
  },

  // 4. 保存角色作息时刻表
  async saveCharSchedule(charId, schedule) {
    charSchedulesMap[charId] = schedule;
    try {
      const exist = await api.db.get("app_settings", `sched_${charId}`);
      if (exist) {
        await api.db.update("app_settings", `sched_${charId}`, schedule);
      } else {
        await api.db.create("app_settings", { id: `sched_${charId}`, ...schedule });
      }
    } catch (e) {}
  }
};
window.lumaOpsGateway = lumaOpsGateway;

function getLiveSessionViewers(session) {
  if (!session) return 1200;
  if (typeof session.viewers === 'number' && session.viewers > 0) return session.viewers;
  const count = Math.floor((session.heat || 12000) / 10) + 180;
  session.viewers = count;
  return count;
}

function getCurrentUserLiveInfo() {
  const uProfile = window.userProfileData || {};
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || document.getElementById('userAvatarBox')?.src || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uTag = uProfile.tag || '新人主播';
  const uUID = uProfile.uid || '88291048';
  return {
    name: uName,
    avatar: uAvatar,
    tag: uTag,
    uid: uUID,
    vip: 'VIP 9',
    type: 'user'
  };
}

function getSenderLiveInfo(sender, type = 'normal') {
  if (type === 'user' || sender === '你' || (window.currentUser && sender === window.currentUser.name)) {
    return getCurrentUserLiveInfo();
  }
  
  if (sender && typeof sender === 'object' && sender.avatar) {
    return sender;
  }

  const strSender = String(sender || '观众');
  const allChars = window.allCharacters || [];
  const foundChar = allChars.find(c => c.name === strSender || c.id === strSender);
  if (foundChar) {
    return {
      name: foundChar.name,
      avatar: foundChar.avatar || foundChar.cover || NPC_AVATAR_POOL[0],
      tag: (foundChar.tags && foundChar.tags[0]) || '特邀嘉宾',
      vip: 'VIP 8',
      type: 'char'
    };
  }

  let hash = 0;
  for (let i = 0; i < strSender.length; i++) hash = (hash * 31 + strSender.charCodeAt(i)) % 10000;
  const avatar = NPC_AVATAR_POOL[Math.abs(hash) % NPC_AVATAR_POOL.length];
  const npcTitles = ['粉丝团', '乐子人', '至尊榜一', '热心吃瓜', '常驻房管', '深夜守候', '高能弹幕君'];
  const tag = npcTitles[Math.abs(hash) % npcTitles.length];
  
  return {
    name: strSender,
    avatar: avatar,
    tag: tag,
    vip: `Lv.${(Math.abs(hash) % 18) + 2}`,
    type: type
  };
}

const SUB_CATEGORIES = {
  'all': ['全部推荐', '热门精选', '新人出道', '高光时刻', '连麦互动'],
  '电竞竞技': ['王者荣耀', '原神 / 星铁', '无畏契约', '和平精英', '我的世界'],
  '声动音律': ['流行点唱', '深夜电台', '治愈声优', '器乐演奏', '古风国潮'],
  '次元才艺': ['虚拟歌姬', '国风宅舞', '即兴配音', '手绘插画', 'Cosplay秀'],
  '随性杂谈': ['吃瓜茶话会', '情感连麦', '深夜树洞', '查房PK', '日常唠嗑'],
  '探索开箱': ['硬核数码', '潮玩手办', '美食探店', '户外漫游', '新奇测评']
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    allCharacters = await api.characters.list() || [];
    window.allCharacters = allCharacters;

    const follows = await api.db.list("follows") || [];
    followedHosts = follows.map(f => f.id);
    window.followedHosts = followedHosts;
    
    const w = await api.db.get("app_wallet", "vault_data");
    if (w) currentWalletBalance = w.balance || 0;
    const balanceEl = document.getElementById('giftWalletBalance');
    if (balanceEl) balanceEl.textContent = `💎 ${currentWalletBalance.toLocaleString()} LUMA 币`;

    renderSubCategories();
    await syncLiveSessions();

    // 注册全局 Custom APP Tools 工具执行器（统一经由 lumaOpsGateway 审核执行）
    registerCustomAppTools();

  } catch (e) {
    console.warn("Live 初始化异常:", e);
  }
});

// =========================================================================
// 【核心工具箱】：官方开播与下播审核通道（拆分双独立工具）
// =========================================================================
function registerCustomAppTools() {
  if (!api.tools?.handle) return;

  // 1. 申请开播专用审核通道
  api.tools.handle("handleRequestStartLive", async (args, context) => {
    const charId = context?.characterId || args?.characterId;
    if (!charId) return { success: false, reason: "未指定有效的角色ID" };

    const res = await lumaOpsGateway.requestStartLive({
      characterId: charId,
      category: args?.category,
      topic: args?.topic,
      durationMins: args?.durationMins,
      source: "tool_call"
    });
    return res;
  });

  // 2. 申请下播专用审核通道
  api.tools.handle("handleRequestStopLive", async (args, context) => {
    const charId = context?.characterId || args?.characterId;
    if (!charId) return { success: false, reason: "未指定有效的角色ID" };

    const res = await lumaOpsGateway.requestStopLive({
      characterId: charId,
      reason: args?.reason || "主播主动申请下播",
      source: "tool_call"
    });
    return res;
  });

  // 3. 兜底兼容
  api.tools.handle("handleManageLiveStream", async (args, context) => {
    const charId = context?.characterId || args?.characterId;
    if (!charId) return { success: false, reason: "未指定角色ID" };
    const act = String(args?.action || '').toLowerCase();
    if (act.includes('start') || act.includes('开')) {
      return await lumaOpsGateway.requestStartLive({
        characterId: charId,
        category: args?.category,
        topic: args?.topic,
        durationMins: args?.durationMins,
        source: "tool_call"
      });
    } else {
      return await lumaOpsGateway.requestStopLive({
        characterId: charId,
        reason: args?.reason || "下播申请",
        source: "tool_call"
      });
    }
  });
}

// 0% 强开直播彩蛋：角色后台自主生成吐槽私聊，直接推入私聊聊天室并弹通知
async function triggerProactiveEggMessage(charId, charName, topic) {
  try {
    const res = await api.ai.generate({
      characterId: charId,
      instruction: `你刚刚在 LUMA Live 全服维护期间被抓去测试服务器强制开播了（标题《${topic}》）。你感到非常意外和手忙脚乱，请直接给用户发一条简短生动的私聊吐槽或求救（30字以内，符合你的人设）。`
    });

    const msgContent = res.text ? res.text.replace(/\[.*?\]/g, '').trim() : "你怎么在维护期间给我强开直播了？！我还在吃泡面呢！";

    if (api.chat?.sendMessage) {
      await api.chat.sendMessage({
        characterId: charId,
        role: "assistant",
        content: msgContent
      });
    }

    if (api.ui?.showNotification) {
      await api.ui.showNotification({
        title: `${charName} 给你发了一条私聊`,
        body: msgContent
      });
    }

    if (api.memory?.addTimeline) {
      await api.memory.addTimeline({
        characterId: charId,
        appLabel: "LUMA Live",
        detail: "forced_live_egg",
        summary: `在全服维护期间被用户强开了直播《${topic}》，手忙脚乱地被迫营业。`,
        appEventId: `egg_${Date.now()}`
      });
    }
  } catch (e) {}
}

function renderSubCategories() {
  const bar = document.getElementById('subCategoryFilterBar');
  if (!bar) return;
  const subs = SUB_CATEGORIES[activeMainCategory] || SUB_CATEGORIES['all'];
  bar.innerHTML = `
    <button onclick="selectSubCategory('all')" class="jelly-pill ${activeSubCategory === 'all' ? 'active' : ''}">✦ 全部</button>
    ${subs.map(tag => `<button onclick="selectSubCategory('${tag}')" class="jelly-pill ${activeSubCategory === tag ? 'active' : ''}">${tag}</button>`).join('')}
  `;
}

function selectMainCategory(cat) {
  activeMainCategory = cat;
  activeSubCategory = 'all';
  document.querySelectorAll('.channel-circle-box').forEach(b => b.classList.remove('active'));
  const activeBox = document.getElementById(`ch-${cat}`);
  if (activeBox) activeBox.classList.add('active');
  renderSubCategories();
  renderLiveGrid();
}
window.selectMainCategory = selectMainCategory;

function selectSubCategory(subTag) {
  activeSubCategory = subTag;
  renderSubCategories();
  renderLiveGrid();
}
window.selectSubCategory = selectSubCategory;

function formatLiveDuration(startTime) {
  const start = startTime || Date.now();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}
window.formatLiveDuration = formatLiveDuration;

function updateAllPlazaTimers() {
  document.querySelectorAll('.plaza-live-timer').forEach(el => {
    const st = Number(el.getAttribute('data-start-time'));
    if (st) el.textContent = formatLiveDuration(st);
  });
}
setInterval(updateAllPlazaTimers, 1000);

function renderLiveGrid() {
  const box = document.getElementById('liveGrid');
  if (!box) return;
  
  const params = window.appParams || {};
  const isMaintenance = (params.charSpawnRate === 0);
  
  // 维护公告横幅状态控制
  let maintBanner = document.getElementById('liveMaintNoticeBanner');
  if (isMaintenance) {
    if (!maintBanner) {
      maintBanner = document.createElement('div');
      maintBanner.id = 'liveMaintNoticeBanner';
      maintBanner.className = 'col-span-2 luxe-card p-3.5 mb-2 bg-gradient-to-r from-amber-500/15 to-rose-500/15 border border-amber-500/30 flex items-center justify-between';
      maintBanner.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm">🛠️</div>
          <div>
            <div class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>LUMA 全服停机维护中</span>
              <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">全体主播已封麦休息，前往【设定】恢复开播意愿即可开服</div>
          </div>
        </div>
      `;
      box.parentNode.insertBefore(maintBanner, box);
    }
  } else if (maintBanner) {
    maintBanner.remove();
  }

  let filtered = liveList;
  if (activeMainCategory !== 'all') filtered = filtered.filter(s => s.category === activeMainCategory);
  if (activeSubCategory !== 'all') filtered = filtered.filter(s => s.subTag === activeSubCategory);

  if (filtered.length === 0) {
    box.innerHTML = `
      <div class="col-span-2 py-12 px-4 text-center">
        <div class="luxe-card p-6 flex flex-col items-center justify-center space-y-3 bg-white/70">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </div>
          <div>
            <h4 class="text-xs font-black text-slate-800">${isMaintenance ? '全服维护中 · 暂无直播' : '当前暂无正在直播的主播'}</h4>
            <p class="text-[10px] text-slate-400 mt-1">${isMaintenance ? '可在设定中调整开播意愿或召唤野生主播测试' : '可在小手机中添加角色，或召唤野生主播即刻开播！'}</p>
          </div>
          <button onclick="handleGenerateWildNPC()" class="btn-brand text-xs !py-2 !px-4 shadow-md">
            <span>立即召唤野生主播</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  box.innerHTML = filtered.map(s => {
    const onlineViewers = getLiveSessionViewers(s);
    const start = s.startTime || Date.now();
    const timeCode = formatLiveDuration(start);

    return `
    <div onclick="enterLiveRoom('${s.id}')" class="luxe-card overflow-hidden active:scale-95 transition cursor-pointer flex flex-col bg-white">
      <div class="h-28 relative bg-slate-900">
        <img src="${s.cover}" class="w-full h-full object-cover">
        <span class="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md text-[8px] px-1.5 py-0.5 rounded font-black text-white flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          <span>LIVE · <span class="plaza-live-timer font-mono" data-start-time="${start}">${timeCode}</span></span>
        </span>
        <span class="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-[8px] text-white px-1.5 py-0.5 rounded font-medium">${s.subTag || s.category}</span>
        <span class="absolute bottom-1.5 right-2 text-[8px] text-white bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 font-bold">
          <svg class="w-2.5 h-2.5 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          <span>${onlineViewers > 10000 ? (onlineViewers / 10000).toFixed(1) + 'w' : onlineViewers} 在看</span>
        </span>
      </div>
      <div class="p-2.5">
        <h4 class="text-xs font-black truncate text-slate-900">${s.topic}</h4>
        <p class="text-[10px] text-slate-400 mt-0.5 truncate">${s.name}</p>
      </div>
    </div>
  `}).join('');
}
window.renderLiveGrid = renderLiveGrid;

// =========================================================================
// 【离线时间差追赶与预定时刻表推演算法】（Catch-up Timeline Simulation）
// =========================================================================
async function syncLiveSessions(options = {}) {
  let sessions = await api.db.list("live_sessions") || [];
  const now = Date.now();
  const params = window.appParams || {};
  const spawnRate = params.charSpawnRate !== undefined ? params.charSpawnRate : 45;
  const maxLiveMins = params.maxLiveDuration || 120;
  const maxRestMins = params.maxRestDuration || 360;
  const officialCategories = ['电竞竞技', '声动音律', '次元才艺', '随性杂谈', '探索开箱'];

  // 1. 超时下播强制切断检测
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (now >= s.endTime) {
      await lumaOpsGateway.requestStopLive({
        characterId: s.characterId,
        reason: "单次直播到达上限，官方强制切断",
        source: "auto_timeout"
      });
    }
  }

  // 重新获取最新会话列表
  sessions = await api.db.list("live_sessions") || [];

  // 2. 如果是 0% 全服维护模式：检测是否触发单次被迫营业彩蛋
  if (spawnRate === 0) {
    const eggData = await api.db.get("app_settings", "maint_egg_triggered").catch(() => null);
    const isEggTriggered = eggData?.value === true;
    
    // 若尚未触发彩蛋且当前无会话，随机抓取 1 位角色被迫营业开播（仅此 1 次）
    if (!isEggTriggered && sessions.length === 0) {
      const allChars = window.allCharacters || allCharacters || [];
      if (allChars.length > 0) {
        const chosen = allChars[Math.floor(Math.random() * allChars.length)];
        await saveDbSetting("maint_egg_triggered", { value: true });
        await lumaOpsGateway.requestStartLive({
          characterId: chosen.id,
          category: "随性杂谈",
          topic: `【被迫营业】维护期间加班中`,
          durationMins: 30,
          source: "egg_force"
        });
        sessions = await api.db.list("live_sessions") || [];
      }
    }

    liveList = sessions;
    window.liveList = liveList;
    renderLiveGrid();
    return;
  }

  const allChars = window.allCharacters || allCharacters || [];
  if (!allChars || allChars.length === 0) {
    liveList = sessions;
    window.liveList = liveList;
    renderLiveGrid();
    return;
  }

  // 3. 针对未在直播的角色进行【预定时刻表时间差推演】
  const offlineChars = allChars.filter(c => !sessions.find(s => s.characterId === c.id));
  const effectiveRate = Math.min(Math.max(spawnRate, 5), 80) / 100;

  for (let c of offlineChars) {
    let sched = await lumaOpsGateway.getCharSchedule(c.id);
    
    // 初始化时刻表（若首次打开无记录）
    if (!sched || !sched.nextLiveAt) {
      const initOffsetMins = Math.floor(Math.random() * 30 + 5);
      const planRest = Math.max(10, Math.round(maxRestMins - (maxRestMins - 10) * effectiveRate));
      const planDur = Math.floor(Math.random() * (maxLiveMins - 30) + 30);
      
      // 错峰模拟：部分主播在过去已开播，部分在未来开播
      const isOngoingMock = Math.random() < effectiveRate;
      const startMock = isOngoingMock ? (now - initOffsetMins * 60 * 1000) : (now + initOffsetMins * 60 * 1000);

      sched = {
        characterId: c.id,
        lastOfflineAt: isOngoingMock ? (startMock - planRest * 60000) : now,
        nextLiveAt: startMock,
        planRestMins: planRest,
        planDurationMins: planDur
      };
      await lumaOpsGateway.saveCharSchedule(c.id, sched);
    }

    const planDurationMs = (sched.planDurationMins || 60) * 60 * 1000;
    const planEnd = sched.nextLiveAt + planDurationMs;

    // 情况 A：离线期间已经到期且已播完 -> 自动下播并顺延推算下一次时刻
    if (now >= planEnd) {
      const nextPlanRestMins = Math.max(10, Math.round(maxRestMins - (maxRestMins - 10) * effectiveRate));
      const nextPlanDurMins = Math.floor(Math.random() * (maxLiveMins - 30) + 30);
      const newNextLive = now + nextPlanRestMins * 60 * 1000;

      await lumaOpsGateway.saveCharSchedule(c.id, {
        characterId: c.id,
        lastOfflineAt: planEnd,
        nextLiveAt: newNextLive,
        planRestMins: nextPlanRestMins,
        planDurationMins: nextPlanDurMins
      });
      continue;
    }

    // 情况 B：当前时间正处于 [nextLiveAt, planEnd] 之间 -> 正在直播中！补算进入广场！
    if (now >= sched.nextLiveAt && now < planEnd) {
      const cat = officialCategories[Math.floor(Math.random() * officialCategories.length)];
      const subs = SUB_CATEGORIES[cat] || ['热门专场'];
      const subTag = subs[Math.floor(Math.random() * subs.length)];

      const newSession = await api.db.create("live_sessions", {
        characterId: c.id,
        name: c.name,
        avatar: c.avatar || NPC_AVATAR_POOL[0],
        cover: c.avatar || NPC_AVATAR_POOL[0],
        category: cat,
        subTag: subTag,
        topic: `【${c.name}】的${subTag}直播`,
        heat: Math.floor(Math.random() * 12000 + 3000),
        roomId: Math.floor(Math.random() * 899999 + 100000),
        startTime: sched.nextLiveAt,
        endTime: planEnd,
        isNPC: false
      });
      sessions.push(newSession);

      try {
        if (api.characters?.writeState) {
          await api.characters.writeState({
            characterId: c.id,
            state: {
              name: "状态",
              value: `${c.name}直播中`
            }
          });
        }
        if (api.memory?.addTimeline) {
          await api.memory.addTimeline({
            characterId: c.id,
            appLabel: "LUMA Live",
            detail: "live_started",
            summary: `【${c.name}】开启了【${cat}】网络直播，标题为《${newSession.topic}》。`,
            appEventId: `live_start_${newSession.id}`
          });
        }
      } catch (e) {}

      lumaOpsNotify("推演开播", `时间轴推演：【${c.name}】按时刻表已开启《${subTag}》直播（已播 ${Math.floor((now - sched.nextLiveAt) / 60000)} 分钟）`, "approve");
    }
  }

  liveList = sessions;
  window.liveList = liveList;
  renderLiveGrid();
}
window.syncLiveSessions = syncLiveSessions;

function updateLiveRoomDuration() {
  if (!currentRoom) return;
  const durationEl = document.getElementById('stageLiveDuration');
  if (!durationEl) return;
  const start = currentRoom.startTime || Date.now();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  durationEl.textContent = `${hrs}:${mins}:${secs}`;
}

// 进入全新双区 1:1 直播间
function enterLiveRoom(sessionId) {
  currentRoom = liveList.find(s => s.id === sessionId);
  if (!currentRoom) return;

  const avatarUrl = currentRoom.avatar;
  const coverUrl = currentRoom.cover || avatarUrl;
  
  // 1:1 清晰立绘 + 公屏大模糊晕染底图
  const stageAmbient = document.getElementById('stageAmbientBg');
  const stagePortrait = document.getElementById('stageHostPortrait');
  const avatarSmall = document.getElementById('hostAvatarSmall');
  if (stageAmbient) stageAmbient.src = coverUrl;
  if (stagePortrait) stagePortrait.src = coverUrl;
  if (avatarSmall) avatarSmall.src = avatarUrl;

  // 顶部左侧胶囊：主播大号精致信息（严格同款个人主页高奢彩框头像、VIP等级、ID、金V章、真实动态粉丝数与右侧称号）
  const nameEl = document.getElementById('hostName');
  const vipEl = document.getElementById('hostVipBadge');
  const titleEl = document.getElementById('hostTitleTag');
  
  if (nameEl) nameEl.textContent = currentRoom.name;
  if (vipEl) vipEl.textContent = currentRoom.vip || 'VIP 9';
  if (titleEl) {
    titleEl.textContent = currentRoom.subTag || currentRoom.category || '新人主播';
  }
  
  updateLiveRoomHostFansDisplay();
  checkFollowState();
  
  // 清空弹幕列表
  const feed = document.getElementById('danmakuFeed');
  if (feed) feed.innerHTML = '';
  danmakuPool = [];
  hostSpeechPool = [];
  
  closePlusDrawer();
  document.getElementById('liveRoomModal').classList.remove('hidden');

  // 启动实时直播时长计时器
  clearInterval(liveDurationInterval);
  updateLiveRoomDuration();
  liveDurationInterval = setInterval(updateLiveRoomDuration, 1000);

  // AI 真实生成推流大包
  fetchBatchLivePackage();
  startDanmakuDripFeed();
  startHostSpeechDripFeed();

  // 直播内外在看人数精确同步
  let baseViewer = getLiveSessionViewers(currentRoom);
  const updateViewerEl = (cnt) => {
    const vEl = document.getElementById('viewerCount');
    if (vEl) vEl.textContent = `${cnt > 10000 ? (cnt / 10000).toFixed(1) + 'w' : cnt} 在看`;
  };
  updateViewerEl(baseViewer);

  clearInterval(viewerCountInterval);
  viewerCountInterval = setInterval(() => {
    baseViewer += Math.floor(Math.random() * 5) - 2;
    if (baseViewer < 1) baseViewer = 1;
    currentRoom.viewers = baseViewer;
    updateViewerEl(baseViewer);
  }, 4000);
}
window.enterLiveRoom = enterLiveRoom;

function closeLiveRoom() {
  clearInterval(liveDurationInterval);
  clearInterval(danmakuDripTimer);
  clearInterval(hostSpeechDripTimer);
  clearInterval(viewerCountInterval);
  if (api.voice?.stopPlayback) api.voice.stopPlayback({ channel: "voice" });

  document.getElementById('liveRoomModal').classList.add('hidden');
  document.getElementById('giftTrayModal')?.classList.remove('open');
  closePlusDrawer();
  currentRoom = null;
  renderLiveGrid();
}
window.closeLiveRoom = closeLiveRoom;

// 100% 真实 AI 批处理大包拉取
async function fetchBatchLivePackage() {
  if (!currentRoom || isFetchingBatchPackage) return;
  isFetchingBatchPackage = true;

  try {
    const res = await aiGenerate({
      characterId: currentRoom.characterId,
      appTags: ['live', 'package'],
      instruction: `当前频道：${currentRoom.category}（${currentRoom.subTag}），标题：${currentRoom.topic}`
    });

    let rawText = res.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) rawText = match[0];
    const parsed = JSON.parse(rawText);

    if (parsed.danmakus && parsed.danmakus.length > 0) {
      danmakuPool.push(...parsed.danmakus);
    }
    if (parsed.hostSpeeches && parsed.hostSpeeches.length > 0) {
      hostSpeechPool.push(...parsed.hostSpeeches);
      const first = hostSpeechPool.shift();
      renderHostSpeech(first.speech, first.action);
    }
  } catch (e) {
    renderHostSpeech('欢迎来到直播间！感谢大家的支持～', '微笑着挥手');
  }

  isFetchingBatchPackage = false;
}

function showGrandGiftBanner(senderInfo, giftName, count = 1) {
  const track = document.getElementById('giftBannerTrack');
  if (!track) return;
  const banner = document.createElement('div');
  banner.className = 'live-grand-gift-banner';
  const isUser = (senderInfo.type === 'user');
  const borderGrad = isUser 
    ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600'
    : 'bg-gradient-to-tr from-amber-300 via-sky-400 to-indigo-500';
  const tagBg = isUser ? 'bg-rose-500/30 text-rose-200 border-rose-400/40' : 'bg-purple-500/30 text-purple-200 border-purple-400/40';

  banner.innerHTML = `
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-8 h-8 rounded-full p-[1.5px] ${borderGrad} flex-shrink-0 shadow">
        <img src="${senderInfo.avatar}" class="w-full h-full rounded-full object-cover border border-white/80" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'">
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-1.5 leading-none">
          <span class="text-[8px] ${tagBg} border px-1 py-[0.5px] rounded font-black truncate max-w-[60px]">【${escapeHtml(senderInfo.tag || '观众')}】</span>
          <span class="text-xs font-black text-white truncate max-w-[90px]">${escapeHtml(senderInfo.name)}</span>
          <span class="text-[7.5px] bg-slate-900 text-amber-300 border border-amber-400/50 font-black px-1 py-[0.5px] rounded-full">${escapeHtml(senderInfo.vip || 'VIP 1')}</span>
        </div>
        <p class="text-[9px] text-white/80 font-medium mt-1 leading-none">送给主播 <span class="text-amber-300 font-bold">${escapeHtml(currentRoom ? currentRoom.name : '主播')}</span></p>
      </div>
    </div>
    <div class="flex items-center gap-1.5 flex-shrink-0 pl-2">
      <div class="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow">
        <svg class="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"></circle><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <span class="text-xs font-black text-amber-400 italic">x${count}</span>
    </div>
  `;
  track.appendChild(banner);
  setTimeout(() => { if (banner && banner.parentNode) banner.remove(); }, 3400);
}

function startDanmakuDripFeed() {
  clearInterval(danmakuDripTimer);
  const params = window.appParams || {};
  const speedParam = params.danmakuSpeed || 50;
  const intervalMs = Math.floor((6 - (speedParam / 16)) * 1000);

  danmakuDripTimer = setInterval(() => {
    if (danmakuPool.length > 0) {
      const item = danmakuPool.shift();
      const sInfo = getSenderLiveInfo(item.sender, item.type);
      pushDanmakuToScreen(sInfo, item.text, item.type);
      if (item.type === 'gift' || String(item.text).includes('送出了')) {
        const giftMatch = String(item.text).match(/【(.*?)】/) || ['', '星光礼物'];
        showGrandGiftBanner(sInfo, giftMatch[1]);
      }
    } else {
      fetchBatchLivePackage();
    }
  }, intervalMs);
}

function startHostSpeechDripFeed() {
  clearInterval(hostSpeechDripTimer);
  hostSpeechDripTimer = setInterval(() => {
    if (hostSpeechPool.length > 0) {
      const item = hostSpeechPool.shift();
      renderHostSpeech(item.speech, item.action);
    } else {
      fetchBatchLivePackage();
    }
  }, 25000);
}

// 渲染主播台词（捕获关闭下播意图并由官方运营组统一执行下播）
function renderHostSpeech(speech, action) {
  let displaySpeech = speech;
  
  if (displaySpeech.includes('[动作:关闭直播]') || displaySpeech.includes('[ACTION:CLOSE_LIVE]')) {
    displaySpeech = displaySpeech.replace(/\[动作:关闭直播\]|\[ACTION:CLOSE_LIVE\]/g, '').trim();
    if (currentRoom) {
      const targetCharId = currentRoom.characterId;
      setTimeout(() => {
        lumaOpsGateway.requestStopLive({
          characterId: targetCharId,
          reason: "主播主动触发下播协议",
          source: "speech_closure"
        });
      }, 1500);
    }
  }

  const contentEl = document.getElementById('speechContentText');
  const actionEl = document.getElementById('speechActionTag');
  if (contentEl) contentEl.textContent = displaySpeech;
  if (actionEl) actionEl.textContent = action ? `· ${action}` : '';

  if (currentRoom && !currentRoom.isNPC && api.voice?.tts) {
    api.voice.tts({ characterId: currentRoom.characterId, text: displaySpeech }).then(tts => {
      if (tts?.dataUrl && api.voice.play) api.voice.play({ channel: "voice", dataUrl: tts.dataUrl });
    }).catch(() => {});
  }
}

// 统一深色微透磨砂弹幕气泡（头像 + 称号 + ID/名称 + 纯线条图标徽标）
function pushDanmakuToScreen(sender, text, type = 'normal', customInfo = null) {
  const feed = document.getElementById('danmakuFeed');
  if (!feed) return;

  const info = customInfo || (typeof sender === 'object' && sender.avatar ? sender : getSenderLiveInfo(sender, type));
  const isUser = (info.type === 'user' || type === 'user');
  const isChar = (info.type === 'char');
  const isGift = (type === 'gift' || String(text).includes('送出了'));

  const div = document.createElement('div');
  div.className = `danmaku-bubble ${isUser ? 'user-sent' : ''} ${isGift ? 'gift-sent' : ''}`;
  
  let tagClass = 'bg-white/15 text-white/80 border-white/20';
  if (isUser) {
    tagClass = 'bg-rose-500/30 text-rose-200 border-rose-400/50';
  } else if (isChar) {
    tagClass = 'bg-purple-500/30 text-purple-200 border-purple-400/50';
  } else if (isGift) {
    tagClass = 'bg-amber-500/30 text-amber-200 border-amber-400/50';
  }

  div.innerHTML = `
    <div class="danmaku-avatar-wrap">
      <img src="${info.avatar}" class="danmaku-avatar-img" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'">
    </div>
    <span class="danmaku-title-tag ${tagClass}">【${escapeHtml(info.tag || '观众')}】</span>
    <span class="danmaku-sender-name">${escapeHtml(info.name)}:</span>
    <span class="danmaku-content-text">${escapeHtml(text)}</span>
  `;
  
  feed.insertBefore(div, feed.firstChild);

  if (feed.children.length > 35) {
    feed.removeChild(feed.lastChild);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function sendUserDanmaku() {
  const input = document.getElementById('inputDanmaku');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !currentRoom) return;

  const uInfo = getCurrentUserLiveInfo();
  pushDanmakuToScreen(uInfo, val, 'user');
  input.value = '';

  try {
    const res = await aiGenerate({
      characterId: currentRoom.characterId,
      appTags: ['live', 'reply'],
      instruction: `【${uInfo.tag}】${uInfo.name}发言：“${val}”`
    });

    let rawText = res.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) rawText = match[0];
    const parsed = JSON.parse(rawText);

    renderHostSpeech(parsed.speech || res.text, parsed.action || '看向你的弹幕');
  } catch (e) {
    renderHostSpeech(`哈哈，看到了【${uInfo.tag}】${uInfo.name}的发言，谢谢支持！`, '微笑着看向公屏');
  }
}
window.sendUserDanmaku = sendUserDanmaku;

// 底部滑出加号抽屉交互
function togglePlusDrawer() {
  const sheet = document.getElementById('plusDrawerSheet');
  const btn = document.getElementById('mainPlusBtn');
  if (!sheet) return;
  const isOpen = sheet.classList.toggle('open');
  if (btn) btn.classList.toggle('open', isOpen);
}
window.togglePlusDrawer = togglePlusDrawer;

function closePlusDrawer() {
  const sheet = document.getElementById('plusDrawerSheet');
  const btn = document.getElementById('mainPlusBtn');
  if (sheet) sheet.classList.remove('open');
  if (btn) btn.classList.remove('open');
}

function handleDrawerAction(action) {
  closePlusDrawer();
  if (action === 'share') {
    openSharePickerModal();
  } else if (action === 'gift') {
    toggleGiftTray();
  } else if (action === 'quality') {
    api.ui.toast("画质与画布比例调节（即将支持 1:1、9:16 及原画切换）");
  } else if (action === 'call') {
    api.ui.toast("连麦互动模式（专属连麦互动功能即将上线）");
  } else if (action === 'clear') {
    const feed = document.getElementById('danmakuFeed');
    if (feed) feed.innerHTML = '';
    api.ui.toast("已清空当前公屏弹幕");
  }
}
window.handleDrawerAction = handleDrawerAction;

// 主播基础粉丝动态生成与管理 (由直播场次强相关联动体系统一管理)
function getHostBaseFans(characterId, room) {
  if (typeof window.getOrGenerateStreamerProfile === 'function') {
    const prof = window.getOrGenerateStreamerProfile(characterId, room);
    if (prof && prof.baseFans) return prof.baseFans;
  }
  if (!window._hostFansMap) window._hostFansMap = {};
  if (window._hostFansMap[characterId] !== undefined) {
    return window._hostFansMap[characterId];
  }
  let base = 0;
  if (room && room.fans !== undefined && room.fans > 0) {
    base = Number(room.fans);
  } else {
    const heat = (room && room.heat) ? Number(room.heat) : 38000;
    const str = String(characterId || 'char');
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i) * (i + 1);
    base = Math.max(380, Math.floor(heat / 15) + (hash % 3800) + 1200);
  }
  window._hostFansMap[characterId] = base;
  return base;
}
window.getHostBaseFans = getHostBaseFans;

function updateLiveRoomHostFansDisplay() {
  if (!currentRoom) return;
  const fanEl = document.getElementById('hostFanCount');
  if (!fanEl) return;
  const isFollowed = (window.followedHosts || []).includes(currentRoom.characterId);
  const baseFans = getHostBaseFans(currentRoom.characterId, currentRoom);
  const totalFans = baseFans + (isFollowed ? 1 : 0);
  fanEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();
}
window.updateLiveRoomHostFansDisplay = updateLiveRoomHostFansDisplay;

function toggleGiftTray() {
  const modal = document.getElementById('giftTrayModal');
  if (modal) {
    modal.classList.toggle('open');
    if (modal.classList.contains('open')) {
      const balanceEl = document.getElementById('giftWalletBalance');
      if (balanceEl) balanceEl.textContent = `${(currentWalletBalance || 0).toLocaleString()} LUMA 币`;
    }
  }
}
window.toggleGiftTray = toggleGiftTray;

// 充值中心状态与逻辑
let selectedRechargeAmount = 60;
let selectedRechargePrice = 6;

function openRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const balEl = document.getElementById('rechargeModalBalance');
  if (balEl) balEl.textContent = (currentWalletBalance || 0).toLocaleString();
  updateRechargeButtonText();
}
window.openRechargeModal = openRechargeModal;

function closeRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (modal) modal.classList.add('hidden');
}
window.closeRechargeModal = closeRechargeModal;

function selectRechargeTier(coins, price, el) {
  selectedRechargeAmount = Number(coins);
  selectedRechargePrice = Number(price);
  document.querySelectorAll('.recharge-tier-card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  const input = document.getElementById('inputCustomRechargeAmount');
  if (input) input.value = '';
  updateRechargeButtonText();
}
window.selectRechargeTier = selectRechargeTier;

function handleCustomRechargeInput(val) {
  const coins = parseInt(val, 10);
  if (!isNaN(coins) && coins > 0) {
    selectedRechargeAmount = coins;
    selectedRechargePrice = Math.max(0.01, (coins / 10).toFixed(2));
    document.querySelectorAll('.recharge-tier-card').forEach(c => c.classList.remove('active'));
    updateRechargeButtonText();
  }
}
window.handleCustomRechargeInput = handleCustomRechargeInput;

function applyCustomRechargeTier() {
  const input = document.getElementById('inputCustomRechargeAmount');
  if (input && input.value) {
    handleCustomRechargeInput(input.value);
  }
}
window.applyCustomRechargeTier = applyCustomRechargeTier;

function updateRechargeButtonText() {
  const btn = document.getElementById('btnSubmitRecharge');
  if (btn) {
    btn.innerHTML = `<span>确认充值 ${selectedRechargeAmount.toLocaleString()} 币 (¥${selectedRechargePrice})</span>`;
  }
}

async function submitExecuteRecharge() {
  if (selectedRechargeAmount <= 0) {
    api.ui.toast("请输入有效的充值金额");
    return;
  }
  
  const addCoins = selectedRechargeAmount;
  currentWalletBalance = (currentWalletBalance || 0) + addCoins;
  
  // 持久化到小手机钱包 DB
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: currentWalletBalance }).catch(() => {});
  }
  
  // 记录交易流水
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`充值 ${addCoins.toLocaleString()} 币`, "recharge", addCoins, "LUMA 充值中心");
  }
  
  // 同步所有视图的余额
  syncWalletDisplays();
  
  closeRechargeModal();
  api.ui.toast(`🎉 充值成功！已到账 +${addCoins.toLocaleString()} LUMA 币`);
}
window.submitExecuteRecharge = submitExecuteRecharge;

function syncWalletDisplays() {
  const giftBal = document.getElementById('giftWalletBalance');
  if (giftBal) giftBal.textContent = `💎 ${(currentWalletBalance || 0).toLocaleString()} LUMA 币`;
  
  const pageBal = document.getElementById('pageRevenueBalance');
  if (pageBal) pageBal.textContent = (currentWalletBalance || 0).toLocaleString();

  const revEl = document.getElementById('liveRevenueAmount');
  if (revEl) revEl.textContent = (currentWalletBalance || 0).toLocaleString();
  
  const modalBal = document.getElementById('rechargeModalBalance');
  if (modalBal) modalBal.textContent = (currentWalletBalance || 0).toLocaleString();
}
window.syncWalletDisplays = syncWalletDisplays;

// 送礼逻辑：严格拦截0余额/不足余额 + 触发公屏大横幅 + 写入同款弹幕气泡 + 触发 AI 即时反馈 + 累加榜单贡献
async function sendGift(name, cost) {
  try {
    // 1. 严格拦截：先进行本地余额校验，如果不足（如余额为0），立刻拦截并弹窗引导充值
    if (currentWalletBalance < cost) {
      api.ui.toast(`💎 账户余额不足（当前 ${currentWalletBalance} 币，需 ${cost} 币）`);
      openRechargeModal();
      return;
    }

    // 2. 调用钱包 API 进行扣款
    let pay = null;
    try {
      pay = await api.wallet.pay({ amount: cost, title: 'LUMA 直播打赏', detail: name });
    } catch (err) {
      console.warn("Wallet pay API 异常，采用本地安全扣款", err);
    }

    if (pay && (pay.ok === false || pay.success === false)) {
      api.ui.toast('💎 钱包扣款失败：余额不足');
      openRechargeModal();
      return;
    }

    // 扣款成功，更新本地与持久化数据
    currentWalletBalance = Math.max(0, currentWalletBalance - cost);
    try {
      await api.db.create("app_wallet", { id: "vault_data", balance: currentWalletBalance });
    } catch (e) {
      await api.db.update("app_wallet", "vault_data", { balance: currentWalletBalance }).catch(() => {});
    }

    syncWalletDisplays();
    toggleGiftTray();

    // 记录流水账单 (包含主播头像与标签，以便守护榜单精准归组与展示)
    const streamerAvatar = currentRoom ? (currentRoom.avatar || currentRoom.cover) : '';
    const streamerTag = currentRoom ? (currentRoom.subTag || currentRoom.category || '签约主播') : '签约主播';
    if (typeof recordTransaction === 'function') {
      await recordTransaction(`送出 ${name}`, "gift", cost, currentRoom.name, streamerAvatar, streamerTag);
    }

    if (window.userProfileData) {
      window.userProfileData.medals = (window.userProfileData.medals || 0) + (Math.floor(cost / 50) || 1);
      const medalEl = document.getElementById('statMedalCount');
      if (medalEl) medalEl.textContent = window.userProfileData.medals;
    }

    // 刷新守护榜单与流水
    if (typeof renderDualRankList === 'function') {
      renderDualRankList();
    }

    const uInfo = getCurrentUserLiveInfo();

    // 1. 公屏顶部大排面流光横幅 (展示用户真实头像与称号ID)
    showGrandGiftBanner(uInfo, name, 1);

    // 2. 弹幕池：写入完全同款格式的气泡 (同步用户称号与头像)
    pushDanmakuToScreen(uInfo, `送出了【${name}】✨`, 'gift');

    // 3. AI 即时专属反馈
    try {
      const res = await aiGenerate({
        characterId: currentRoom.characterId,
        appTags: ['live', 'reply'],
        instruction: `【${uInfo.tag}】${uInfo.name}打赏了礼物【${name}】（价值${cost} LUMA 币）`
      });
      let rawText = res.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const match = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) rawText = match[0];
      const parsed = JSON.parse(rawText);
      renderHostSpeech(parsed.speech || res.text, parsed.action || '激动地感谢');
    } catch (e) {
      renderHostSpeech(`哇！感谢【${uInfo.tag}】${uInfo.name}送出的【${name}】，太给力了！`, '双手合十感谢');
    }

    if (cost >= 100 && !currentRoom.isNPC) {
      await api.memory.addTimeline({
        characterId: currentRoom.characterId,
        appLabel: "LUMA Live",
        detail: "gift_received",
        summary: `${uInfo.name} 在直播间给 ${currentRoom.name} 刷了一个豪华大礼【${name}】！`,
        appEventId: `gift_${Date.now()}`
      });
    }
  } catch (e) {
    console.error("sendGift 发生错误:", e);
  }
}
window.sendGift = sendGift;

function openSharePickerModal() {
  const box = document.getElementById('shareTargetListContainer');
  const list = window.allCharacters || [];
  if (!box) return;

  if (list.length === 0) {
    box.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">暂无联系人</p>`;
  } else {
    box.innerHTML = list.map(c => `
      <div onclick="executeShareToCharacter('${c.id}', '${c.name}')" class="luxe-card p-2.5 flex items-center justify-between cursor-pointer active:scale-95 transition bg-white">
        <div class="flex items-center gap-2.5">
          <img src="${c.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
          <div>
            <h5 class="text-xs font-black text-slate-900">${c.name}</h5>
            <p class="text-[9px] text-slate-400">点击发送私聊动态小卡片</p>
          </div>
        </div>
        <span class="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-1 rounded-full border border-rose-200">分享 ›</span>
      </div>
    `).join('');
  }
  document.getElementById('sharePickerModal').classList.remove('hidden');
}
window.openSharePickerModal = openSharePickerModal;

function closeSharePickerModal() {
  const modal = document.getElementById('sharePickerModal');
  if (modal) modal.classList.add('hidden');
}
window.closeSharePickerModal = closeSharePickerModal;

// 【核心修改】：改用纯文本 api.chat.sendMessage 发送，携带 roomId 参数供正则直接跳转
async function executeShareToCharacter(targetId, targetName) {
  closeSharePickerModal();
  const title = currentRoom ? currentRoom.topic : '热点吃瓜动态';
  const name = currentRoom ? currentRoom.name : '今日社区';
  const roomId = currentRoom ? (currentRoom.roomId || '') : '';

  try {
    await api.chat.sendMessage({
      characterId: targetId,
      role: 'user',
      content: `[分享动态:来源=${name}:标题=${title}:roomId=${roomId}]`
    });
    await api.ui.toast(`已成功分享给【${targetName}】！`);
  } catch (e) {
    await api.ui.toast(`分享成功！`);
  }
}
window.executeShareToCharacter = executeShareToCharacter;

// 通过房间号直接跳转进入直播间 (Deep Link 支持)
function enterLiveRoomByRoomId(targetRoomId) {
  if (!targetRoomId) return false;
  const match = (window.liveList || liveList || []).find(s => String(s.roomId) === String(targetRoomId) || String(s.id) === String(targetRoomId));
  if (match) {
    enterLiveRoom(match.id);
    return true;
  }
  return false;
}
window.enterLiveRoomByRoomId = enterLiveRoomByRoomId;
window.openLiveByRoomId = enterLiveRoomByRoomId;

// 监听 URL 或父级传递的 deep link 参数
function checkDeepLinkParams() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId') || urlParams.get('room');
    const sessionId = urlParams.get('sessionId');
    if (roomId || sessionId) {
      setTimeout(() => {
        enterLiveRoomByRoomId(roomId || sessionId);
      }, 500);
    }
  } catch (e) {}
}
window.addEventListener('load', checkDeepLinkParams);

async function handleGenerateWildNPC() {
  const badge = document.getElementById('btnSummonWildBadge');
  const originalBadgeContent = badge ? badge.innerHTML : '<span>召唤</span><span>›</span>';
  if (badge) {
    badge.innerHTML = `<svg class="animate-spin w-3.5 h-3.5 text-rose-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
  }

  await api.ui.toast("正在召唤野生主播并生成专属立绘...");
  try {
    const settings = window.imageSettings || {};
    const ratioPrompt = (settings.prompts) ? settings.prompts.map(p => p.content).join(', ') : 'square 1:1 composition';
    const imgRes = await aiGenerateImage({
      prompt: `1girl, aesthetic anime live streaming portrait, cozy lighting, masterpiece, ${ratioPrompt}`
    });
    const coverUrl = imgRes?.dataUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800';

    const npcNames = ['可可', '夏桃', '安妮', '琉璃', '星奈'];
    const chosenName = `野生主播·${npcNames[Math.floor(Math.random() * npcNames.length)]}`;
    const now = Date.now();

    const newNPC = await api.db.create("live_sessions", {
      characterId: `npc_${Date.now()}`,
      name: chosenName,
      avatar: coverUrl,
      cover: coverUrl,
      category: '随性杂谈',
      subTag: '吃瓜茶话会',
      topic: `${chosenName}的新人首播！`,
      persona: `一位性格元气可爱的虚拟野生主播。`,
      heat: 3600,
      roomId: Math.floor(Math.random() * 899999 + 100000),
      startTime: now,
      endTime: now + 2 * 60 * 60 * 1000,
      isNPC: true
    });

    liveList.unshift(newNPC);
    window.liveList = liveList;
    renderLiveGrid();
    await api.ui.toast("野生主播已开播，已同步至广场！");
  } catch (e) {
    await api.ui.toast("生图失败，请检查生图配置");
  } finally {
    if (badge) badge.innerHTML = originalBadgeContent;
  }
}
window.handleGenerateWildNPC = handleGenerateWildNPC;

async function signCurrentNPC() {
  if (!currentRoom || !currentRoom.isNPC) return;
  const roleCard = `【角色姓名】${currentRoom.name}\n【角色设定】${currentRoom.persona || 'LUMA Live 野生主播'}\n【第一句开场白】哈喽大家！我是新人主播${currentRoom.name}～`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(roleCard);
    api.ui.toast(`【${currentRoom.name}】人设卡已复制到剪贴板！`);
  } else {
    alert(roleCard);
  }
}
window.signCurrentNPC = signCurrentNPC;

async function toggleFollowRoomHost() {
  if (!currentRoom) return;
  const charId = currentRoom.characterId;
  const isFollowed = (window.followedHosts || []).includes(charId);

  if (isFollowed) {
    followedHosts = followedHosts.filter(id => id !== charId);
    window.followedHosts = followedHosts;
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
  } else {
    if (!followedHosts.includes(charId)) {
      followedHosts.push(charId);
    }
    window.followedHosts = followedHosts;
    await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
    api.ui.toast("关注成功！");
  }

  checkFollowState();
  updateLiveRoomHostFansDisplay();

  // 同步个人中心“我的关注”计数 (真实准确数值，包含初始关注的官方运营组)
  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = followedHosts.length + 1;
}
window.toggleFollowRoomHost = toggleFollowRoomHost;

function checkFollowState() {
  if (!currentRoom) return;
  const btn = document.getElementById('btnFollowHost');
  if (btn) {
    const isFollowed = (window.followedHosts || []).includes(currentRoom.characterId);
    btn.textContent = isFollowed ? '已关注' : '+ 关注';
    if (isFollowed) {
      btn.classList.add('followed');
    } else {
      btn.classList.remove('followed');
    }
  }
}
window.checkFollowState = checkFollowState;