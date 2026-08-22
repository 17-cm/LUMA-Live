// =========================================================================
// 【模块一·直播广场与直播间】LIVE/live.js
// 包含：直播广场渲染、赛道分类与时刻同步、1:1沉浸式直播间、弹幕台词流、送礼特效、野生NPC、主播微博主页
// =========================================================================

var api = window.api || {};

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
let plazaDurationInterval = null;
let isFetchingBatchPackage = false;
let viewerCountInterval = null;
let currentWalletBalance = 0;

let guestbookData = {};
window.guestbookData = guestbookData;

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

const SUB_CATEGORIES = {
  'all': ['全部推荐', '热门精选', '新人出道', '高光时刻', '连麦互动'],
  '电竞竞技': ['王者荣耀', '原神 / 星铁', '无畏契约', '和平精英', '我的世界'],
  '声动音律': ['流行点唱', '深夜电台', '治愈声优', '器乐演奏', '古风国潮'],
  '次元才艺': ['虚拟歌姬', '国风宅舞', '即兴配音', '手绘插画', 'Cosplay秀'],
  '随性杂谈': ['吃瓜茶话会', '情感连麦', '深夜树洞', '查房PK', '日常唠嗑'],
  '探索开箱': ['硬核数码', '潮玩手办', '美食探店', '户外漫游', '新奇测评']
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
window.escapeHtml = escapeHtml;

function getLiveSessionViewers(session) {
  if (!session) return 1200;
  if (typeof session.viewers === 'number' && session.viewers > 0) return session.viewers;
  const count = Math.floor((session.heat || 12000) / 10) + 180;
  session.viewers = count;
  return count;
}
window.getLiveSessionViewers = getLiveSessionViewers;

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
window.getCurrentUserLiveInfo = getCurrentUserLiveInfo;

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
      tagColor: 'bg-purple-500/25 text-purple-200 border-purple-400/40',
      vip: 'VIP 8',
      type: 'char'
    };
  }

  let hash = 0;
  for (let i = 0; i < strSender.length; i++) hash = (hash * 31 + strSender.charCodeAt(i)) % 100000;
  const avatar = NPC_AVATAR_POOL[Math.abs(hash) % NPC_AVATAR_POOL.length];
  
  // 随机弹幕观众称号系统：仅约 25% 概率获得随机称号，其余 75% 无称号
  const hasTitle = (Math.abs(hash * 13) % 100) < 25;
  let tag = '';
  let tagColor = 'bg-white/10 text-white/70 border-white/15';

  if (hasTitle) {
    const npcTitles = ['粉丝团', '乐子人', '榜一大哥', '热心吃瓜', '常驻房管', '深夜守候', '高能弹幕君', '纯爱战神', '深海潜水', '魔法使'];
    tag = npcTitles[Math.abs(hash) % npcTitles.length];
    const colorThemes = [
      'bg-amber-500/15 text-amber-300 border-amber-400/30',
      'bg-rose-500/15 text-rose-300 border-rose-400/30',
      'bg-purple-500/15 text-purple-300 border-purple-400/30',
      'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
      'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
    ];
    tagColor = colorThemes[Math.abs(hash * 7) % colorThemes.length];
  }
  
  return {
    name: strSender,
    avatar: avatar,
    tag: tag,
    tagColor: tagColor,
    vip: `Lv.${(Math.abs(hash) % 18) + 2}`,
    type: type
  };
}
window.getSenderLiveInfo = getSenderLiveInfo;

// =========================================================================
// 1. 直播广场渲染与时间戳同步
// =========================================================================
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
window.updateAllPlazaTimers = updateAllPlazaTimers;
if (!plazaDurationInterval) {
  plazaDurationInterval = setInterval(updateAllPlazaTimers, 1000);
}

function selectMainCategory(cat) {
  activeMainCategory = cat;
  activeSubCategory = 'all';
  document.querySelectorAll('.channel-circle-box, .channel-item').forEach(b => b.classList.remove('active'));
  const activeBox = document.getElementById(`ch-${cat}`) || document.getElementById(`cat-btn-${cat}`);
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

function renderSubCategories() {
  const bar = document.getElementById('subCategoryBar') || document.getElementById('subCategoryFilterBar');
  if (!bar) return;
  const list = SUB_CATEGORIES[activeMainCategory] || ['全部推荐'];

  bar.innerHTML = list.map(item => {
    const isSelected = (activeSubCategory === 'all' && (item.startsWith('全部') || item === '全部推荐')) || activeSubCategory === item;
    return `
      <button onclick="selectSubCategory('${item.startsWith('全部') ? 'all' : item}')" class="jelly-pill ${isSelected ? 'active' : ''}">
        ${item}
      </button>
    `;
  }).join('');
}
window.renderSubCategories = renderSubCategories;
window.renderSubCategoryBar = renderSubCategories;

function normalizeCategory(cat) {
  if (!cat) return '随性杂谈';
  const c = String(cat).toLowerCase();
  if (c.includes('电竞') || c.includes('竞技') || c.includes('游戏') || c.includes('王者') || c.includes('原神') || c.includes('星铁') || c.includes('无畏') || c.includes('和平') || c.includes('吃鸡') || c.includes('moba') || c.includes('fps')) return '电竞竞技';
  if (c.includes('音乐') || c.includes('声动') || c.includes('音律') || c.includes('歌') || c.includes('唱') || c.includes('电台') || c.includes('声优') || c.includes('音频') || c.includes('乐器') || c.includes('治愈')) return '声动音律';
  if (c.includes('次元') || c.includes('才艺') || c.includes('动漫') || c.includes('二次元') || c.includes('宅舞') || c.includes('cos') || c.includes('绘画') || c.includes('插画') || c.includes('配音') || c.includes('虚拟')) return '次元才艺';
  if (c.includes('探索') || c.includes('开箱') || c.includes('测评') || c.includes('数码') || c.includes('科技') || c.includes('户外') || c.includes('探店') || c.includes('旅行') || c.includes('美食')) return '探索开箱';
  return '随性杂谈';
}
window.normalizeCategory = normalizeCategory;

function isSessionMatchingCategory(s, mainCat, subCat) {
  if (mainCat && mainCat !== 'all') {
    const sNorm = normalizeCategory(s.category);
    const mainNorm = normalizeCategory(mainCat);
    const matchMain = (s.category === mainCat) || 
                      (sNorm === mainNorm) || 
                      (s.subTag && s.subTag.includes(mainCat)) || 
                      (s.topic && s.topic.includes(mainCat));
    if (!matchMain) return false;
  }
  if (subCat && subCat !== 'all' && !subCat.startsWith('全部')) {
    const matchSub = (s.subTag === subCat) || 
                     (s.category === subCat) || 
                     (s.topic && s.topic.includes(subCat)) ||
                     (s.subTag && s.subTag.includes(subCat));
    if (!matchSub) return false;
  }
  return true;
}
window.isSessionMatchingCategory = isSessionMatchingCategory;

function renderLiveGrid() {
  const box = document.getElementById('liveGrid') || document.getElementById('livePlazaGrid');
  if (!box) return;
  
  const currentLives = window.liveList || liveList || [];
  const params = window.appParams || {};
  const isMaintenance = (params.charSpawnRate === 0);

  let filtered = currentLives.filter(s => isSessionMatchingCategory(s, activeMainCategory, activeSubCategory));

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
        <img src="${s.cover || s.avatar}" class="w-full h-full object-cover">
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
// 2. 1:1 沉浸式直播间逻辑
// =========================================================================
function updateLiveRoomDuration() {
  if (!currentRoom) return;
  const durationEl = document.getElementById('stageLiveDuration');
  if (!durationEl) return;
  const start = currentRoom.startTime || Date.now();
  durationEl.textContent = formatLiveDuration(start);
}

function enterLiveRoomDirectly(sessionId) {
  const lives = window.liveList || liveList || [];
  currentRoom = lives.find(s => s.id === sessionId || String(s.roomId) === String(sessionId));
  if (!currentRoom) return;
  window.currentRoom = currentRoom;

  const avatarUrl = currentRoom.avatar;
  const coverUrl = currentRoom.cover || avatarUrl;
  
  const stageAmbient = document.getElementById('stageAmbientBg');
  const stagePortrait = document.getElementById('stageHostPortrait');
  const avatarSmall = document.getElementById('hostAvatarSmall');
  if (stageAmbient) stageAmbient.src = coverUrl;
  if (stagePortrait) stagePortrait.src = coverUrl;
  if (avatarSmall) avatarSmall.src = avatarUrl;

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
  
  const feed = document.getElementById('danmakuFeed');
  if (feed) feed.innerHTML = '';
  // 如果过渡阶段已经打包填充了 danmakuPool/hostSpeechPool，保留它们，不要暴力清空导致重复等待
  if (!window.danmakuPool || window.danmakuPool.length === 0) {
    danmakuPool = [];
  }
  if (!window.hostSpeechPool || window.hostSpeechPool.length === 0) {
    hostSpeechPool = [];
  }
  
  closePlusDrawer();
  if (window.PageStack) {
    window.PageStack.open('liveRoomModal');
  } else {
    const roomModal = document.getElementById('liveRoomModal');
    if (roomModal) roomModal.classList.remove('hidden');
  }

  clearInterval(liveDurationInterval);
  updateLiveRoomDuration();
  liveDurationInterval = setInterval(updateLiveRoomDuration, 1000);

  // 如果已经有打包好的内容，立即推首条台词并启动流，不用再阻塞请求
  if (hostSpeechPool.length > 0) {
    const first = hostSpeechPool.shift();
    renderHostSpeech(first.speech, first.action);
  } else {
    fetchBatchLivePackage();
  }
  
  // 进房第 0 秒立即弹出 2 条欢迎/互动弹幕，让直播间瞬间活起来
  if (danmakuPool.length > 0) {
    const firstDanmaku = danmakuPool.shift();
    const sInfo1 = getSenderLiveInfo(firstDanmaku.sender, firstDanmaku.type);
    pushDanmakuToScreen(sInfo1, firstDanmaku.text, firstDanmaku.type);
    if (danmakuPool.length > 0) {
      setTimeout(() => {
        if (!currentRoom) return;
        const secondDanmaku = danmakuPool.shift();
        const sInfo2 = getSenderLiveInfo(secondDanmaku.sender, secondDanmaku.type);
        pushDanmakuToScreen(sInfo2, secondDanmaku.text, secondDanmaku.type);
      }, 200);
    }
  }

  startDanmakuDripFeed();
  startHostSpeechDripFeed();

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
window.enterLiveRoomDirectly = enterLiveRoomDirectly;

function enterLiveRoom(sessionId) {
  const lives = window.liveList || liveList || [];
  const targetSession = lives.find(s => s.id === sessionId || String(s.roomId) === String(sessionId));
  if (!targetSession) return;

  if (typeof window.launchRoomConnectingStage === 'function') {
    window.launchRoomConnectingStage(targetSession, () => {
      enterLiveRoomDirectly(sessionId);
    });
  } else {
    enterLiveRoomDirectly(sessionId);
  }
}
window.enterLiveRoom = enterLiveRoom;
window.openLiveRoom = enterLiveRoom;

function closeLiveRoom() {
  clearInterval(liveDurationInterval);
  clearInterval(danmakuDripTimer);
  clearInterval(hostSpeechDripTimer);
  clearInterval(viewerCountInterval);
  if (api.voice?.stopPlayback) api.voice.stopPlayback({ channel: "voice" });

  document.getElementById('giftTrayModal')?.classList.remove('open');
  closePlusDrawer();
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    const roomModal = document.getElementById('liveRoomModal');
    if (roomModal) roomModal.classList.add('hidden');
  }
  currentRoom = null;
  window.currentRoom = null;
  renderLiveGrid();
}
window.closeLiveRoom = closeLiveRoom;

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

// checkDeepLinkParams 增强版本定义在文件末尾，这里只保留 load 事件监听
window.addEventListener('load', () => {
  if (typeof checkDeepLinkParams === 'function') checkDeepLinkParams();
});

function updateLiveRoomHostFansDisplay() {
  if (!currentRoom) return;
  const fanEl = document.getElementById('hostFanCount');
  if (!fanEl) return;
  const isFollowed = (window.followedHosts || []).includes(currentRoom.characterId);
  const baseFans = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(currentRoom.characterId, currentRoom)
    : getHostBaseFans(currentRoom.characterId, currentRoom);
  const totalFans = baseFans + (isFollowed ? 1 : 0);
  fanEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();
}
window.updateLiveRoomHostFansDisplay = updateLiveRoomHostFansDisplay;

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

async function toggleFollowRoomHost() {
  if (!currentRoom) return;
  const charId = currentRoom.characterId;
  // 确保 followedHosts 是数组
  if (!Array.isArray(window.followedHosts)) window.followedHosts = [];
  const isFollowed = window.followedHosts.includes(charId);

  if (isFollowed) {
    window.followedHosts = window.followedHosts.filter(id => id !== charId);
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
  } else {
    if (!window.followedHosts.includes(charId)) {
      window.followedHosts.push(charId);
    }
    await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
    api.ui.toast("关注成功！");
  }

  checkFollowState();
  updateLiveRoomHostFansDisplay();

  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = window.followedHosts.length + 1;
}
window.toggleFollowRoomHost = toggleFollowRoomHost;

// =========================================================================
// 3. 弹幕与主播台词流控系统
// =========================================================================
// 上次打包请求时间（用于请求冷却）
let lastPackageRequestTime = 0;

async function fetchBatchLivePackage() {
  if (!currentRoom || isFetchingBatchPackage) return;
  
  // 请求冷却：两次请求至少间隔用户设置的时间（分钟转毫秒）
  const intervalMinutes = (typeof window.getApiRequestIntervalMinutes === 'function') 
    ? window.getApiRequestIntervalMinutes() 
    : 5;
  const minIntervalMs = intervalMinutes * 60 * 1000;
  const now = Date.now();
  if (now - lastPackageRequestTime < minIntervalMs) {
    return; // 冷却中，不请求
  }
  lastPackageRequestTime = now;
  
  isFetchingBatchPackage = true;

  try {
    // 从当前直播间读取最近的送礼记录（不写全局记忆，避免串台）
    let giftHistoryText = '';
    if (currentRoom && currentRoom.giftHistory && currentRoom.giftHistory.length > 0) {
      const recentGifts = currentRoom.giftHistory.slice(-5); // 最近5条
      giftHistoryText = '\n最近观众送礼记录：' + recentGifts.map(g => `${g.giftName}x${g.count}`).join('、') + '，请在台词里自然地感谢这些送礼。';
    }
    
    // 从预设里读取打包 prompt，代码只保留动态内容（频道、标题、送礼记录）
    const packagePrompt = (typeof window.getLivePackagePrompt === 'function') 
      ? window.getLivePackagePrompt() 
      : '请生成观众弹幕（danmakus数组）和主播互动台词（hostSpeeches数组，每条包含speech和action字段）。返回JSON格式。';
    
    const res = await window.aiGenerate({
      characterId: currentRoom.characterId,
      appTags: ['luma', 'stream', 'content'],
      instruction: `当前频道：${currentRoom.category}（${currentRoom.subTag}），标题：${currentRoom.topic}。${packagePrompt}${giftHistoryText}`
    });

    const parsed = window.extractJsonFromText(res.text);

    if (parsed && parsed.danmakus && parsed.danmakus.length > 0) {
      danmakuPool.push(...parsed.danmakus);
    }
    if (parsed && parsed.hostSpeeches && parsed.hostSpeeches.length > 0) {
      hostSpeechPool.push(...parsed.hostSpeeches);
      const first = hostSpeechPool.shift();
      renderHostSpeech(first.speech, first.action);
    }
  } catch (e) {
    renderHostSpeech('欢迎来到直播间！感谢大家的支持～', '微笑着挥手');
  }

  isFetchingBatchPackage = false;
}
window.fetchBatchLivePackage = fetchBatchLivePackage;

function startDanmakuDripFeed() {
  clearInterval(danmakuDripTimer);
  // 弹幕滴入间隔固定 4.5 秒，更接近真实直播节奏，减少消耗速度
  const intervalMs = 4500;

  danmakuDripTimer = setInterval(() => {
    if (danmakuPool.length > 0) {
      const item = danmakuPool.shift();
      const sInfo = getSenderLiveInfo(item.sender, item.type);
      pushDanmakuToScreen(sInfo, item.text, item.type);
      if (item.type === 'gift' || String(item.text).includes('送出了') || String(item.text).includes('送了')) {
        const giftMatch = String(item.text).match(/【(.*?)】/) || ['', '星光礼物'];
        const countMatch = String(item.text).match(/送[了出]\s*(\d+)\s*个/) || ['', '1'];
        const giftCount = Number(countMatch[1]) || 1;
        showGrandGiftBanner(sInfo, giftMatch[1], giftCount);
        
        // 仅 char 赠送顶级礼物时触发全屏特效（随机观众不触发全屏特效）
        if (sInfo.type === 'char' && LUXURY_GIFT_MAP[giftMatch[1]]) {
          triggerGiftFullScreenFx(giftMatch[1]);
        }
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
  }, 50000);
}

function renderHostSpeech(speech, action) {
  let displaySpeech = speech;
  
  if (displaySpeech.includes('[动作:关闭直播]') || displaySpeech.includes('[ACTION:CLOSE_LIVE]')) {
    displaySpeech = displaySpeech.replace(/\[动作:关闭直播\]|\[ACTION:CLOSE_LIVE\]/g, '').trim();
    if (currentRoom && window.lumaOpsGateway) {
      const targetCharId = currentRoom.characterId;
      setTimeout(() => {
        window.lumaOpsGateway.requestStopLive({
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
window.renderHostSpeech = renderHostSpeech;

function pushDanmakuToScreen(sender, text, type = 'normal', customInfo = null) {
  const feed = document.getElementById('danmakuFeed');
  if (!feed) return;

  const info = customInfo || (typeof sender === 'object' && sender.avatar ? sender : getSenderLiveInfo(sender, type));
  const isUser = (info.type === 'user' || type === 'user');
  const isChar = (info.type === 'char');
  const isGift = (type === 'gift' || String(text).includes('送出了') || String(text).includes('送了'));

  const div = document.createElement('div');
  div.className = `danmaku-bubble ${isUser ? 'user-sent' : ''} ${isGift ? 'gift-sent' : ''}`;
  
  let tagHtml = '';
  if (info.tag) {
    let tagClass = info.tagColor || 'bg-white/15 text-white/80 border-white/20';
    if (isUser) {
      tagClass = 'bg-rose-500/25 text-rose-200 border-rose-400/40';
    } else if (isChar) {
      tagClass = 'bg-purple-500/25 text-purple-200 border-purple-400/40';
    } else if (isGift) {
      tagClass = 'bg-amber-500/25 text-amber-200 border-amber-400/40';
    }
    tagHtml = `<span class="danmaku-title-tag ${tagClass}">${escapeHtml(info.tag)}</span>`;
  }

  div.innerHTML = `
    <div class="danmaku-avatar-wrap">
      <img src="${info.avatar}" class="danmaku-avatar-img" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'">
    </div>
    ${tagHtml}
    <span class="danmaku-sender-name">${escapeHtml(info.name)}:</span>
    <span class="danmaku-content-text">${escapeHtml(text)}</span>
  `;
  
  feed.insertBefore(div, feed.firstChild);

  if (feed.children.length > 35) {
    feed.removeChild(feed.lastChild);
  }
}
window.pushDanmakuToScreen = pushDanmakuToScreen;

async function sendUserDanmaku() {
  const input = document.getElementById('inputDanmaku') || document.getElementById('inputLiveDanmaku');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !currentRoom) return;

  const uInfo = getCurrentUserLiveInfo();
  pushDanmakuToScreen(uInfo, val, 'user');
  input.value = '';

  try {
    const res = await window.aiGenerate({
      characterId: currentRoom.characterId,
      appTags: ['luma', 'stream', 'interaction'],
      instruction: `【${uInfo.tag}】${uInfo.name}发言：“${val}”`
    });

    const parsed = window.extractJsonFromText(res.text);
    if (parsed) {
      renderHostSpeech(parsed.speech || res.text, parsed.action || '看向你的弹幕');
    } else {
      renderHostSpeech(res.text, '看向公屏');
    }
  } catch (e) {
    renderHostSpeech(`哈哈，看到了【${uInfo.tag}】${uInfo.name}的发言，谢谢支持！`, '微笑着看向公屏');
  }
}
window.sendUserDanmaku = sendUserDanmaku;

// =========================================================================
// 4. 加号抽屉与礼物全套交互
// =========================================================================
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
window.closePlusDrawer = closePlusDrawer;

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

function toggleGiftTray() {
  const modal = document.getElementById('giftTrayModal');
  if (modal) {
    modal.classList.toggle('open');
    if (modal.classList.contains('open')) {
      const balanceEl = document.getElementById('giftWalletBalance');
      if (balanceEl) balanceEl.textContent = `💎 ${(window.currentWalletBalance || 0).toLocaleString()} LUMA 币`;
    }
  }
}
window.toggleGiftTray = toggleGiftTray;

let selectedGiftQuantity = 1;

function selectGiftQuantity(qty) {
  selectedGiftQuantity = Number(qty) || 1;
  const validQtys = [1, 10, 52, 99, 1314];
  validQtys.forEach(q => {
    const btn = document.getElementById(`gift-qty-${q}`);
    if (btn) {
      if (q === selectedGiftQuantity) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
}
window.selectGiftQuantity = selectGiftQuantity;

// 6大顶级礼物名单与特效映射
const LUXURY_GIFT_MAP = {
  '梦幻嘉年华': { id: 'carnival', num: 1 },
  '星际飞船': { id: 'starship', num: 2 },
  '水晶城堡': { id: 'castle', num: 3 },
  '深海星辰': { id: 'whale', num: 4 },
  '宇宙之心': { id: 'cosmic', num: 5 },
  '天使之翼': { id: 'wings', num: 6 }
};

function triggerGiftFullScreenFx(giftName) {
  const params = window.appParams || {};
  if (params.giftFullScreenEffect === false) return; // 开关关闭时不触发
  const fxCfg = LUXURY_GIFT_MAP[giftName];
  if (!fxCfg) return;

  const layer = document.getElementById('liveFullscreenFxLayer');
  if (!layer) return;

  layer.classList.remove('hidden');
  layer.innerHTML = '';

  let fxHtml = '';
  if (fxCfg.id === 'carnival') {
    // 1. 梦幻嘉年华：金色璀璨摩天轮 + 缤纷气球雨 + 礼花
    fxHtml = `
      <div class="fx-carnival-stage">
        <div class="fx-carnival-wheel">
          <svg class="w-full h-full" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="85" stroke="url(#goldGrad)" stroke-width="5" stroke-dasharray="8 4"/>
            <circle cx="100" cy="100" r="55" stroke="#f43f5e" stroke-width="3" opacity="0.8"/>
            <circle cx="100" cy="100" r="18" fill="url(#goldGrad)"/>
            <line x1="100" y1="15" x2="100" y2="185" stroke="#fbbf24" stroke-width="3"/>
            <line x1="15" y1="100" x2="185" y2="100" stroke="#fbbf24" stroke-width="3"/>
            <line x1="40" y1="40" x2="160" y2="160" stroke="#f43f5e" stroke-width="3"/>
            <line x1="160" y1="40" x2="40" y2="160" stroke="#f43f5e" stroke-width="3"/>
            <circle cx="100" cy="15" r="10" fill="#f43f5e"/>
            <circle cx="100" cy="185" r="10" fill="#f43f5e"/>
            <circle cx="15" cy="100" r="10" fill="#fbbf24"/>
            <circle cx="185" cy="100" r="10" fill="#fbbf24"/>
            <circle cx="40" cy="40" r="10" fill="#38bdf8"/>
            <circle cx="160" cy="160" r="10" fill="#38bdf8"/>
            <circle cx="160" cy="40" r="10" fill="#a855f7"/>
            <circle cx="40" cy="160" r="10" fill="#a855f7"/>
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fef08a"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#f43f5e"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-black text-xs tracking-widest uppercase shadow-2xl border border-white/50 animate-bounce">
          ✨ 梦幻嘉年华 盛大开幕 ✨
        </div>
        <span class="fx-balloon text-3xl" style="left: 15%; animation-delay: 0.1s;">🎈</span>
        <span class="fx-balloon text-2xl" style="left: 30%; animation-delay: 0.4s;">💖</span>
        <span class="fx-balloon text-4xl" style="left: 60%; animation-delay: 0.2s;">🎈</span>
        <span class="fx-balloon text-3xl" style="left: 80%; animation-delay: 0.5s;">🎉</span>
        <span class="fx-balloon text-2xl" style="left: 45%; animation-delay: 0.7s;">✨</span>
      </div>
    `;
  } else if (fxCfg.id === 'starship') {
    // 2. 星际飞船：赛博时空跃迁 + 极速穿梭舰
    fxHtml = `
      <div class="fx-starship-stage">
        <div class="fx-starship-ship flex flex-col items-center">
          <svg class="w-48 h-48" viewBox="0 0 200 200" fill="none">
            <path d="M100 10 L140 120 L100 105 L60 120 Z" fill="url(#shipBodyGrad)" stroke="#38bdf8" stroke-width="2"/>
            <path d="M60 120 L30 150 L65 140 Z" fill="#0284c7"/>
            <path d="M140 120 L170 150 L135 140 Z" fill="#0284c7"/>
            <circle cx="100" cy="70" r="8" fill="#38bdf8"/>
            <line x1="100" y1="105" x2="100" y2="170" stroke="#f43f5e" stroke-width="4" stroke-linecap="round"/>
            <defs>
              <linearGradient id="shipBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="50%" stop-color="#6366f1"/>
                <stop offset="100%" stop-color="#0f172a"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="px-5 py-1.5 rounded-full bg-cyan-500/30 backdrop-blur-md border border-cyan-300 text-cyan-200 font-black text-xs tracking-wider shadow-lg">
            🚀 星际跃迁·巡航启航
          </div>
        </div>
      </div>
    `;
  } else if (fxCfg.id === 'castle') {
    // 3. 水晶城堡：冰雪极光水晶宫殿
    fxHtml = `
      <div class="fx-castle-stage">
        <div class="fx-castle-main flex flex-col items-center">
          <svg class="w-48 h-48" viewBox="0 0 200 200" fill="none">
            <polygon points="100,20 125,70 75,70" fill="url(#castleGrad)" stroke="#f472b6" stroke-width="2"/>
            <polygon points="50,60 70,100 30,100" fill="url(#castleGrad)" stroke="#c084fc" stroke-width="2"/>
            <polygon points="150,60 170,100 130,100" fill="url(#castleGrad)" stroke="#c084fc" stroke-width="2"/>
            <rect x="40" y="100" width="120" height="70" rx="6" fill="url(#castleGrad)" stroke="#e879f9" stroke-width="2"/>
            <path d="M85 170 C85 140 115 140 115 170 Z" fill="#ffffff" opacity="0.9"/>
            <defs>
              <linearGradient id="castleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f472b6"/>
                <stop offset="50%" stop-color="#a855f7"/>
                <stop offset="100%" stop-color="#3b82f6"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="px-5 py-1.5 rounded-full bg-purple-500/30 backdrop-blur-md border border-purple-300 text-purple-100 font-black text-xs tracking-wider shadow-lg">
            🏰 梦幻水晶城堡 降临
          </div>
        </div>
      </div>
    `;
  } else if (fxCfg.id === 'whale') {
    // 4. 深海星辰：夜光荧光巨鲸漫游
    fxHtml = `
      <div class="fx-whale-stage">
        <div class="fx-whale-main flex flex-col items-center">
          <svg class="w-56 h-36" viewBox="0 0 240 140" fill="none">
            <path d="M20 70 C40 20, 160 10, 200 60 C220 50, 235 40, 230 70 C235 100, 220 90, 200 80 C160 130, 40 120, 20 70 Z" fill="url(#whaleGrad)" stroke="#38bdf8" stroke-width="2.5"/>
            <circle cx="55" cy="65" r="4" fill="#ffffff"/>
            <path d="M90 75 C100 95, 120 95, 110 75" fill="#38bdf8" opacity="0.6"/>
            <defs>
              <linearGradient id="whaleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0284c7"/>
                <stop offset="50%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#818cf8"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="px-4 py-1 rounded-full bg-sky-500/30 backdrop-blur-md border border-sky-300 text-sky-100 font-black text-[11px] tracking-wider shadow-md">
            🌊 深海星辰·巨鲸巡游
          </div>
        </div>
      </div>
    `;
  } else if (fxCfg.id === 'cosmic') {
    // 5. 宇宙之心：缤纷黑洞与旋涡星系
    fxHtml = `
      <div class="fx-cosmic-stage">
        <div class="fx-galaxy-spiral flex flex-col items-center justify-center">
          <svg class="w-56 h-56" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="30" fill="#000000" stroke="#f43f5e" stroke-width="4"/>
            <circle cx="100" cy="100" r="50" stroke="url(#cosmicRing1)" stroke-width="3" stroke-dasharray="16 8"/>
            <circle cx="100" cy="100" r="75" stroke="url(#cosmicRing2)" stroke-width="3.5" stroke-dasharray="24 12"/>
            <circle cx="45" cy="70" r="8" fill="#fbbf24"/>
            <circle cx="160" cy="130" r="10" fill="#38bdf8"/>
            <circle cx="80" cy="170" r="6" fill="#a855f7"/>
            <defs>
              <linearGradient id="cosmicRing1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ec4899"/>
                <stop offset="100%" stop-color="#8b5cf6"/>
              </linearGradient>
              <linearGradient id="cosmicRing2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="absolute bottom-24 px-5 py-1.5 rounded-full bg-gradient-to-r from-rose-500 via-purple-600 to-amber-400 text-white font-black text-xs tracking-wider shadow-2xl border border-white/40">
          🌌 宇宙之心·星芒闪耀
        </div>
      </div>
    `;
  } else if (fxCfg.id === 'wings') {
    // 6. 天使之翼：神圣金羽之翼
    fxHtml = `
      <div class="fx-wings-stage">
        <div class="fx-wings-main flex flex-col items-center">
          <svg class="w-60 h-44" viewBox="0 0 240 160" fill="none">
            <path d="M120 90 C90 30, 20 20, 10 70 C30 80, 50 110, 80 120 C100 125, 115 110, 120 90 Z" fill="url(#wingsGrad)" stroke="#fbbf24" stroke-width="2.5"/>
            <path d="M120 90 C150 30, 220 20, 230 70 C210 80, 190 110, 160 120 C140 125, 125 110, 120 90 Z" fill="url(#wingsGrad)" stroke="#fbbf24" stroke-width="2.5"/>
            <circle cx="120" cy="90" r="12" fill="#fbbf24" filter="drop-shadow(0 0 10px #ffffff)"/>
            <defs>
              <linearGradient id="wingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="50%" stop-color="#fef08a"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="mt-2 px-5 py-1.5 rounded-full bg-amber-400/30 backdrop-blur-md border border-amber-300 text-amber-200 font-black text-xs tracking-wider shadow-xl">
            🪽 天使之翼·圣洁守护
          </div>
        </div>
      </div>
    `;
  }

  layer.innerHTML = fxHtml;
  setTimeout(() => {
    if (layer) {
      layer.classList.add('hidden');
      layer.innerHTML = '';
    }
  }, 3900);
}
window.triggerGiftFullScreenFx = triggerGiftFullScreenFx;

// 连击状态控制核心
let liveComboSession = {
  active: false,
  giftName: '',
  unitCost: 0,
  unitQty: 1,
  totalCount: 0,
  comboCount: 1,
  timer: null,
  bannerEl: null
};

function showGrandGiftBanner(senderInfo, giftName, count = 1, isComboUpdate = false) {
  const track = document.getElementById('giftBannerTrack');
  if (!track) return;

  const isUser = (senderInfo.type === 'user');
  const isChar = (senderInfo.type === 'char');
  const streamerName = currentRoom ? currentRoom.name : '主播';

  // 如果处于连送状态且已有横幅，直接原地更新数量与抖动
  if (isComboUpdate && liveComboSession.bannerEl && liveComboSession.bannerEl.parentNode) {
    const banner = liveComboSession.bannerEl;
    const textDesc = banner.querySelector('.gift-banner-desc');
    const countEl = banner.querySelector('.gift-banner-count');
    if (textDesc) {
      textDesc.innerHTML = `<span class="text-amber-300 font-black">【${escapeHtml(senderInfo.name)}】</span> 送了 <span class="text-rose-300 font-black">${count}</span> 个 <span class="text-amber-300 font-black">【${escapeHtml(giftName)}】</span> 给 <span class="text-amber-200 font-bold">${escapeHtml(streamerName)}</span>`;
    }
    if (countEl) {
      countEl.textContent = `x${count}`;
      countEl.classList.remove('animate-ping');
      void countEl.offsetWidth;
      countEl.classList.add('animate-ping');
      setTimeout(() => countEl.classList.remove('animate-ping'), 300);
    }
    banner.classList.remove('combo-bounce-active');
    void banner.offsetWidth;
    banner.classList.add('combo-bounce-active');
    return banner;
  }

  // 否则创建全新横幅
  const banner = document.createElement('div');
  banner.className = 'live-grand-gift-banner';
  const borderGrad = isUser 
    ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600'
    : 'bg-gradient-to-tr from-amber-300 via-sky-400 to-indigo-500';
  const tagBg = isUser ? 'bg-rose-500/30 text-rose-200 border-rose-400/40' : (isChar ? 'bg-purple-500/30 text-purple-200 border-purple-400/40' : 'bg-white/10 text-white/70 border-white/15');

  let tagSpan = '';
  if (senderInfo.tag) {
    tagSpan = `<span class="text-[7.5px] ${tagBg} border px-1 py-[0.5px] rounded font-black truncate max-w-[60px] leading-none">${escapeHtml(senderInfo.tag)}</span>`;
  }

  banner.innerHTML = `
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-8 h-8 rounded-full p-[1.5px] ${borderGrad} flex-shrink-0 shadow">
        <img src="${senderInfo.avatar}" class="w-full h-full rounded-full object-cover border border-white/80" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'">
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-1.5 leading-none">
          ${tagSpan}
          <span class="text-xs font-black text-white truncate max-w-[85px]">${escapeHtml(senderInfo.name)}</span>
          <span class="text-[7.5px] bg-slate-900 text-amber-300 border border-amber-400/50 font-black px-1 py-[0.5px] rounded-full leading-none">${escapeHtml(senderInfo.vip || 'Lv.1')}</span>
        </div>
        <p class="gift-banner-desc text-[9px] text-white/90 font-medium mt-1 leading-tight truncate">
          送了 <span class="text-rose-300 font-bold">${count}</span> 个 <span class="text-amber-300 font-bold">【${escapeHtml(giftName)}】</span> 给 <span class="text-amber-200 font-bold">${escapeHtml(streamerName)}</span>
        </p>
      </div>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0 pl-2">
      <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-slate-950 shadow">
        <svg class="w-3.5 h-3.5 stroke-slate-950 stroke-[2.2] fill-none" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <span class="gift-banner-count text-sm font-black text-amber-300 italic drop-shadow">x${count}</span>
    </div>
  `;
  
  track.appendChild(banner);
  if (isUser) {
    liveComboSession.bannerEl = banner;
  }

  setTimeout(() => {
    if (banner && banner.parentNode && !liveComboSession.active) {
      banner.remove();
    }
  }, 3800);

  return banner;
}
window.showGrandGiftBanner = showGrandGiftBanner;

function startComboTimer() {
  clearTimeout(liveComboSession.timer);
  const circleBtn = document.getElementById('liveComboCircleBtn');
  const progressCircle = document.getElementById('comboProgressCircle');
  const counterNum = document.getElementById('comboCounterNumber');

  if (circleBtn) {
    circleBtn.classList.add('active');
    circleBtn.classList.add('bounce');
    setTimeout(() => circleBtn.classList.remove('bounce'), 200);
  }
  if (counterNum) {
    counterNum.textContent = `x${liveComboSession.comboCount}`;
  }

  // 进度条 2.8 秒倒计时动画
  if (progressCircle) {
    progressCircle.style.transition = 'none';
    progressCircle.style.strokeDashoffset = '0';
    void progressCircle.offsetWidth;
    progressCircle.style.transition = 'stroke-dashoffset 2.8s linear';
    progressCircle.style.strokeDashoffset = '175.9';
  }

  liveComboSession.timer = setTimeout(() => {
    endComboSession();
  }, 2800);
}

function endComboSession() {
  liveComboSession.active = false;
  const circleBtn = document.getElementById('liveComboCircleBtn');
  if (circleBtn) circleBtn.classList.remove('active');
  if (liveComboSession.bannerEl && liveComboSession.bannerEl.parentNode) {
    setTimeout(() => {
      if (liveComboSession.bannerEl && liveComboSession.bannerEl.parentNode) {
        liveComboSession.bannerEl.remove();
      }
      liveComboSession.bannerEl = null;
    }, 1200);
  }
}

async function handleComboCircleClick() {
  if (!liveComboSession.active || !currentRoom) return;
  const totalCost = liveComboSession.unitCost * liveComboSession.unitQty;
  const curBal = window.currentWalletBalance || 0;

  if (curBal < totalCost) {
    api.ui.toast(`💎 账户余额不足（需 ${totalCost} 币）`);
    if (typeof openRechargeModal === 'function') openRechargeModal();
    endComboSession();
    return;
  }

  // 扣款与记录
  window.currentWalletBalance = Math.max(0, curBal - totalCost);
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();

  // 记录消费与打榜贡献
  const streamerAvatar = currentRoom ? (currentRoom.avatar || currentRoom.cover) : '';
  const streamerTag = currentRoom ? (currentRoom.subTag || currentRoom.category || '签约主播') : '签约主播';
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`连送 ${liveComboSession.giftName} x${liveComboSession.unitQty}`, "gift", totalCost, currentRoom.name, streamerAvatar, streamerTag);
  }
  if (currentRoom && typeof window.addCharContributionScore === 'function') {
    const charKey = currentRoom.characterId || currentRoom.id || currentRoom.name;
    window.addCharContributionScore(charKey, totalCost);
  }

  // 累加连击
  liveComboSession.comboCount++;
  liveComboSession.totalCount += liveComboSession.unitQty;

  const uInfo = getCurrentUserLiveInfo();
  // 连送只更新公屏横幅数量，不刷屏多条独立弹幕
  showGrandGiftBanner(uInfo, liveComboSession.giftName, liveComboSession.totalCount, true);

  // 触发顶级全屏特效
  if (LUXURY_GIFT_MAP[liveComboSession.giftName]) {
    triggerGiftFullScreenFx(liveComboSession.giftName);
  }

  // 刷新连击倒计时
  startComboTimer();
}
window.handleComboCircleClick = handleComboCircleClick;

async function sendGift(name, cost) {
  try {
    const qty = selectedGiftQuantity || 1;
    const totalCost = cost * qty;
    const curBal = window.currentWalletBalance || 0;
    if (curBal < totalCost) {
      api.ui.toast(`💎 账户余额不足（当前 ${curBal} 币，需 ${totalCost} 币）`);
      if (typeof openRechargeModal === 'function') openRechargeModal();
      return;
    }

    let pay = null;
    try {
      pay = await api.wallet.pay({ amount: totalCost, title: 'LUMA 直播打赏', detail: `${name} x${qty}` });
    } catch (err) {}

    if (pay && (pay.ok === false || pay.success === false)) {
      api.ui.toast('💎 钱包扣款失败：余额不足');
      if (typeof openRechargeModal === 'function') openRechargeModal();
      return;
    }

    window.currentWalletBalance = Math.max(0, curBal - totalCost);
    try {
      await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
    } catch (e) {
      await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
    }

    if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
    toggleGiftTray();

    const streamerAvatar = currentRoom ? (currentRoom.avatar || currentRoom.cover) : '';
    const streamerTag = currentRoom ? (currentRoom.subTag || currentRoom.category || '签约主播') : '签约主播';
    if (typeof recordTransaction === 'function') {
      await recordTransaction(`送出 ${name} x${qty}`, "gift", totalCost, currentRoom.name, streamerAvatar, streamerTag);
    }

    if (window.userProfileData) {
      window.userProfileData.medals = (window.userProfileData.medals || 0) + (Math.floor(totalCost / 50) || 1);
      const medalEl = document.getElementById('statMedalCount');
      if (medalEl) medalEl.textContent = window.userProfileData.medals;
    }

    if (typeof renderDualRankList === 'function') {
      renderDualRankList();
    }

    // 同步到全局超话与全网贡献榜
    if (currentRoom && typeof window.addCharContributionScore === 'function') {
      const charKey = currentRoom.characterId || currentRoom.id || currentRoom.name;
      window.addCharContributionScore(charKey, totalCost);
    }

    const uInfo = getCurrentUserLiveInfo();
    const streamerName = currentRoom ? currentRoom.name : '主播';

    // 初始化连送状态
    liveComboSession.active = true;
    liveComboSession.giftName = name;
    liveComboSession.unitCost = cost;
    liveComboSession.unitQty = qty;
    liveComboSession.totalCount = qty;
    liveComboSession.comboCount = 1;

    showGrandGiftBanner(uInfo, name, qty);
    pushDanmakuToScreen(uInfo, `送了 ${qty} 个【${name}】给【${streamerName}】✨`, 'gift');

    // 启动连击倒计时圆圈
    startComboTimer();

    // 如果是后6个豪华礼物，触发全屏特效
    if (LUXURY_GIFT_MAP[name]) {
      triggerGiftFullScreenFx(name);
    }

    try {
      const res = await window.aiGenerate({
        characterId: currentRoom.characterId,
        appTags: ['luma', 'stream', 'interaction'],
        instruction: `【${uInfo.tag}】${uInfo.name}送了 ${qty} 个【${name}】（总价值 ${totalCost} LUMA 币）给主播`
      });
      const parsed = window.extractJsonFromText(res.text);
      if (parsed) {
        renderHostSpeech(parsed.speech || res.text, parsed.action || '激动地感谢');
      } else {
        renderHostSpeech(`哇！感谢【${uInfo.tag}】${uInfo.name}送出的 ${qty} 个【${name}】，太给力了！`, '双手合十感谢');
      }
    } catch (e) {
      renderHostSpeech(`哇！感谢【${uInfo.tag}】${uInfo.name}送出的 ${qty} 个【${name}】，太给力了！`, '双手合十感谢');
    }

    if (totalCost >= 100 && currentRoom && !currentRoom.isNPC) {
      await api.memory.addTimeline({
        characterId: currentRoom.characterId,
        appLabel: "LUMA Live",
        detail: "gift_received",
        summary: `${uInfo.name} 在直播间给 ${currentRoom.name} 刷了礼物【${name}】x${qty}！`,
        appEventId: `gift_${Date.now()}`
      });
    }
  } catch (e) {
    console.error("sendGift 发生错误:", e);
  }
}
window.sendGift = sendGift;

// =========================================================================
// 5. 分享直播间
// =========================================================================
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
  const modal = document.getElementById('sharePickerModal');
  if (modal) modal.classList.remove('hidden');
}
window.openSharePickerModal = openSharePickerModal;

function closeSharePickerModal() {
  const modal = document.getElementById('sharePickerModal');
  if (modal) modal.classList.add('hidden');
}
window.closeSharePickerModal = closeSharePickerModal;

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
    api.ui.toast(`已成功分享给【${targetName}】！`);
  } catch (e) {
    api.ui.toast(`分享成功！`);
  }
}
window.executeShareToCharacter = executeShareToCharacter;

// =========================================================================
// 6. 野生 NPC 召唤与公会签约
// =========================================================================
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
    const imgRes = await window.aiGenerateImage({
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

    window.liveList.unshift(newNPC);
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

// =========================================================================
// 7. 主播个人空间（微博风格）
// =========================================================================
let streamerProfilesMap = {};
let currentViewingProfile = null;
let activeSpTab = 'posts';

const STREAMER_PERSONA_PRESETS = [
  {
    keywords: ['歌', '音乐', '唱', '音', '曲', '乐'],
    bio: '心怀旷野，在直播间弹琴唱歌给你听。商务合作/演出请私信联系经纪人~ 🎧',
    category: '音乐主唱',
    tags: ['#原创音乐人', '#治愈系弹唱', '#深夜电台', '#声优大V'],
    fanClub: '星光守护团',
    posts: [
      { text: '练琴练到现在，今晚准备给你们唱首新歌，记得带好耳机哦~ 🌙', likes: 1240, comments: 88, forwards: 15, time: '2小时前' },
      { text: '感谢今天直播间所有守护榜的大哥和宝子们！破百万人气啦，爱你们！🎸✨', likes: 3560, comments: 230, forwards: 42, time: '昨天 23:40' },
      { text: '买到了心心念念的复古吉他，手感绝了，下次开播给你们展示！', likes: 980, comments: 45, forwards: 8, time: '3天前' }
    ]
  },
  {
    keywords: ['电竞', '游', '玩', '战', '王者', '吃鸡', '原神', '二次元', '宅'],
    bio: '峡谷百星野王 / 技术流游戏少女。每天固定晚8点带粉上分，不鸽！🎮',
    category: '电竞高玩',
    tags: ['#王者百星', '#硬核技术流', '#单排冲国服', '#下饭日常'],
    fanClub: '极客特战队',
    posts: [
      { text: '今天单排20连胜！谁说女生打野带不起节奏的，出来挨夸！🔥', likes: 2890, comments: 194, forwards: 35, time: '3小时前' },
      { text: '下播吃夜宵啦！今天直播间谁送的至尊摩天轮，私信我领专属水友车队车票~ 🚗', likes: 4120, comments: 310, forwards: 58, time: '昨天 01:15' },
      { text: '新赛季战令皮肤好帅，今晚8点直播间抽5个宝子送！', likes: 1650, comments: 120, forwards: 22, time: '2天前' }
    ]
  },
  {
    keywords: ['搞笑', '脱口秀', '话痨', '聊', '幽默', '逗'],
    bio: '全网最严肃的搞笑主播。进来聊天不要喝水，呛到了我不赔！🍉',
    category: '娱乐脱口秀',
    tags: ['#搞笑博主', '#人间清醒', '#连麦整活', '#段子手'],
    fanClub: '快乐制造局',
    posts: [
      { text: '今天出门被粉丝认出来了，TA第一句话居然是：“主播你怎么比直播间矮？”，我当场裂开！', likes: 5890, comments: 620, forwards: 140, time: '1小时前' },
      { text: '今晚连麦PK，家人们准备好灯牌，输了的要去大街上深情唱《孤勇者》！', likes: 3200, comments: 280, forwards: 76, time: '昨天 19:20' }
    ]
  },
  {
    keywords: ['舞', '才艺', '美', '仙', '古风', '雅'],
    bio: '一袭清欢，舞动人间烟火。LUMA年度舞蹈赛道十佳主播。✨',
    category: '舞蹈艺术',
    tags: ['#国风舞蹈', '#古典舞', '#仙气飘飘', '#年度十佳'],
    fanClub: '青鸾阁',
    posts: [
      { text: '新排的古风水袖舞《青玉案》，大家今晚直播间想看哪一套汉服呢？🌸', likes: 4520, comments: 360, forwards: 89, time: '4小时前' },
      { text: '晨练打卡，保持最好的体态见你们。早安大家！', likes: 2100, comments: 95, forwards: 12, time: '昨天 08:30' }
    ]
  },
  {
    keywords: ['默认', '主播'],
    bio: '记录真实生活，与你分享每一次开播的温柔与心动。💛',
    category: '签约大V',
    tags: ['#生活日常', '#治愈互动', '#签约主播', '#真诚分享'],
    fanClub: '星光守护团',
    posts: [
      { text: '今天天气特别好，出门抓拍了几张风景，晚上开播跟你们慢慢聊~ 📷', likes: 1580, comments: 92, forwards: 18, time: '2小时前' },
      { text: '感谢每一次相遇与陪伴，直播间有你们在真的很温暖。', likes: 3890, comments: 240, forwards: 60, time: '前天 22:10' }
    ]
  }
];

function getOrGenerateStreamerProfile(characterId, characterObj) {
  if (!characterId) return null;
  if (streamerProfilesMap[characterId]) {
    return streamerProfilesMap[characterId];
  }
  const idStr = String(characterId || 'char_01');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) hash += idStr.charCodeAt(i) * (i + 13);
  
  const totalShows = (characterObj && characterObj.totalShows) ? Number(characterObj.totalShows) : (38 + (hash % 290));
  const avgFansPerShow = 360 + (hash % 420);
  const baseFans = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(characterId, characterObj)
    : (totalShows * avgFansPerShow + 2400 + (hash % 5000));
  const followCount = 28 + (hash % 150);
  const likesCount = Math.floor(baseFans * (3.8 + (hash % 5) * 0.8));
  
  const ipList = ['广东', '上海', '北京', '浙江', '四川', '江苏', '山东', '湖北', '东京', '首尔'];
  const ipLocation = ipList[hash % ipList.length];
  const joinDays = Math.max(30, Math.floor(totalShows * 1.6 + (hash % 60)));
  
  const charName = characterObj?.name || '主播';
  const charDesc = characterObj?.description || characterObj?.persona || characterObj?.category || '';
  const fullText = `${charName} ${charDesc}`;
  
  let matchedPreset = STREAMER_PERSONA_PRESETS[STREAMER_PERSONA_PRESETS.length - 1];
  for (let p of STREAMER_PERSONA_PRESETS) {
    if (p.keywords.some(k => fullText.includes(k))) {
      matchedPreset = p;
      break;
    }
  }
  
  const bio = (characterObj && characterObj.bio) ? characterObj.bio : matchedPreset.bio;
  const category = (characterObj && (characterObj.subTag || characterObj.category)) ? (characterObj.subTag || characterObj.category) : matchedPreset.category;
  const tags = matchedPreset.tags;
  const fanClubName = matchedPreset.fanClub;
  const verifyTitle = `LUMA 平台年度认证大V主播 · ${category}`;
  
  const posts = matchedPreset.posts.map((item, idx) => ({
    id: `post_${characterId}_${idx}`,
    text: item.text,
    likes: item.likes,
    comments: item.comments,
    forwards: item.forwards,
    time: item.time,
    userLikes: false
  }));
  
  const showsHistory = [];
  const titlesPool = [
    `深夜治愈弹唱会 · 唱给每一个未眠的你`,
    `冲国服巅峰赛！带粉车队极速发车`,
    `聊天互动碎碎念 · 聊聊最近发生的好玩事`,
    `开箱测评与好物分享专场`,
    `粉丝专属连麦PK！输了有惩罚哦`,
    `早安元气电台 · 开启美好的一天`
  ];
  for (let i = 0; i < Math.min(8, totalShows); i++) {
    const showNum = totalShows - i;
    const durMins = 90 + ((hash + i * 27) % 150);
    const h = Math.floor(durMins / 60);
    const m = durMins % 60;
    showsHistory.push({
      showNumber: showNum,
      title: `第 ${showNum} 场 · ${titlesPool[(hash + i) % titlesPool.length]}`,
      duration: `${h}小时${m}分`,
      heat: ((hash * 13 + i * 1500) % 65000 + 25000).toLocaleString(),
      newFans: `+${300 + ((hash + i * 17) % 450)} 粉丝`,
      timeAgo: `${i === 0 ? '刚刚' : (i === 1 ? '昨天' : `${i + 1}天前`)}`
    });
  }
  
  const cover = characterObj?.cover || '';
  const avatar = characterObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
  const gallery = [cover, avatar, cover, avatar, cover, avatar];
  
  const profile = {
    characterId,
    name: charName,
    avatar,
    cover,
    vip: characterObj?.vip || `VIP ${8 + (hash % 3)}`,
    totalShows,
    baseFans,
    avgFansPerShow,
    followCount,
    likesCount,
    bio,
    category,
    tags,
    fanClubName,
    verifyTitle,
    ipLocation,
    joinDays,
    posts,
    showsHistory,
    gallery
  };
  
  streamerProfilesMap[characterId] = profile;
  return profile;
}
window.getOrGenerateStreamerProfile = getOrGenerateStreamerProfile;

function getHostBaseFans(characterId, room) {
  const prof = getOrGenerateStreamerProfile(characterId, room);
  return prof ? prof.baseFans : 12800;
}
window.getHostBaseFans = getHostBaseFans;

function incrementStreamerLiveShow(characterId) {
  const profile = getOrGenerateStreamerProfile(characterId);
  if (profile) {
    profile.totalShows += 1;
    const newGain = Math.floor(profile.avgFansPerShow * (0.8 + Math.random() * 0.4));
    profile.baseFans += newGain;
    profile.likesCount += Math.floor(newGain * 4.5);
    profile.showsHistory.unshift({
      showNumber: profile.totalShows,
      title: `第 ${profile.totalShows} 场 · 精彩互动专场`,
      duration: '1小时45分',
      heat: (45000 + Math.floor(Math.random() * 20000)).toLocaleString(),
      newFans: `+${newGain} 粉丝`,
      timeAgo: '刚刚'
    });
    if (currentViewingProfile && currentViewingProfile.characterId === characterId) {
      renderStreamerProfileToUI(profile);
    }
    updateLiveRoomHostFansDisplay();
  }
}
window.incrementStreamerLiveShow = incrementStreamerLiveShow;

async function openStreamerProfilePage(id) {
  let charObj = (window.allCharacters || []).find(c => c.id === id) || (window.liveList || []).find(s => s.characterId === id || s.id === id);
  if (!charObj && id) {
    charObj = { id, name: '主播', avatar: '' };
  }
  if (!charObj) return;

  const profile = getOrGenerateStreamerProfile(charObj.id || charObj.characterId || id, charObj);
  if (!profile) return;

  // 从本地数据库读取用户自定义封面
  try {
    const savedCover = await api.db.get('streamer_covers', profile.characterId).catch(() => null);
    if (savedCover && savedCover.cover) {
      profile.cover = savedCover.cover;
    }
  } catch (e) {}

  currentViewingProfile = profile;
  renderStreamerProfileToUI(profile);

  // 使用统一页面栈管理器打开个人主页
  if (window.PageStack) {
    window.PageStack.open('streamerProfilePageView');
  } else {
    // 降级：直接操作 DOM
    const page = document.getElementById('streamerProfilePageView');
    if (page) page.classList.add('open');
  }
}
window.openStreamerProfilePage = openStreamerProfilePage;
window.openStreamerSpace = openStreamerProfilePage;

function closeStreamerProfilePage() {
  // 使用统一页面栈管理器返回
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    // 降级：直接操作 DOM
    const page = document.getElementById('streamerProfilePageView');
    if (page) page.classList.remove('open');
    currentViewingProfile = null;
  }
}
window.closeStreamerProfilePage = closeStreamerProfilePage;
window.closeStreamerSpace = closeStreamerProfilePage;

function renderStreamerProfileToUI(p) {
  const coverEl = document.getElementById('spCoverImg');
  const avatarEl = document.getElementById('spAvatar');
  if (coverEl) {
    if (p.cover) {
      coverEl.src = p.cover;
      coverEl.style.display = 'block';
    } else {
      coverEl.removeAttribute('src');
      coverEl.style.display = 'none';
    }
  }
  if (avatarEl) avatarEl.src = p.avatar;

  const nameEl = document.getElementById('spName');
  const vipEl = document.getElementById('spVipTag');
  const catEl = document.getElementById('spCategoryBadge');
  const verifyEl = document.getElementById('spVerifyTitle');
  if (nameEl) nameEl.textContent = p.name;
  if (vipEl) vipEl.textContent = p.vip;
  if (catEl) catEl.textContent = p.category;
  if (verifyEl) verifyEl.textContent = p.verifyTitle;

  const isFollowed = (window.followedHosts || []).includes(p.characterId);
  const totalFans = p.baseFans + (isFollowed ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  const showsEl = document.getElementById('spLiveShowsCount');
  const followEl = document.getElementById('spFollowCount');
  const likesEl = document.getElementById('spLikesCount');

  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();
  if (showsEl) showsEl.textContent = `${p.totalShows} 场`;
  if (followEl) followEl.textContent = p.followCount;
  if (likesEl) likesEl.textContent = p.likesCount >= 10000 ? (p.likesCount / 10000).toFixed(1) + '万' : p.likesCount.toLocaleString();

  const bioEl = document.getElementById('spBioText');
  const ipEl = document.getElementById('spIpLocation');
  const joinEl = document.getElementById('spJoinDays');
  const clubEl = document.getElementById('spFanClubName');
  if (bioEl) bioEl.textContent = p.bio;
  if (ipEl) ipEl.textContent = `IP属地: ${p.ipLocation}`;
  if (joinEl) joinEl.textContent = `入驻 ${p.joinDays} 天`;
  if (clubEl) clubEl.textContent = `粉丝团: ${p.fanClubName}`;

  const tagsBox = document.getElementById('spTagsContainer');
  if (tagsBox) {
    tagsBox.innerHTML = (p.tags || []).map(t => `<span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">${t}</span>`).join('');
  }

  updateSpFollowBtnState();

  const isLive = (window.liveList || []).some(l => (l.characterId === p.characterId || l.id === p.characterId) && l.isLive !== false);
  const goLiveBtn = document.getElementById('spBtnGoLiveRoom');
  if (goLiveBtn) {
    if (isLive) goLiveBtn.classList.remove('hidden');
    else goLiveBtn.classList.add('hidden');
  }

  switchSpTab(activeSpTab);
}

// 本地上传个人主页封面
function handleStreamerCoverUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    if (api.ui?.toast) api.ui.toast('请选择图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    if (currentViewingProfile) {
      currentViewingProfile.cover = dataUrl;
      const coverEl = document.getElementById('spCoverImg');
      if (coverEl) {
        coverEl.src = dataUrl;
        coverEl.style.display = 'block';
      }
      // 持久化到本地数据库
      const charId = currentViewingProfile.characterId;
      api.db.create('streamer_covers', { id: charId, cover: dataUrl, time: Date.now() }).catch(() => {
        api.db.update('streamer_covers', charId, { cover: dataUrl, time: Date.now() }).catch(() => {});
      });
      if (api.ui?.toast) api.ui.toast('封面已更新');
    }
  };
  reader.readAsDataURL(file);
  // 清空 input，允许重复选同一张图
  e.target.value = '';
}
window.handleStreamerCoverUpload = handleStreamerCoverUpload;

function updateSpFollowBtnState() {
  if (!currentViewingProfile) return;
  const isFollowed = (window.followedHosts || []).includes(currentViewingProfile.characterId);
  const btn = document.getElementById('spBtnFollow');
  const txt = document.getElementById('spFollowBtnText');
  if (btn && txt) {
    if (isFollowed) {
      btn.className = "px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 active:scale-95 transition flex items-center gap-1";
      txt.textContent = "已关注";
      const icon = btn.querySelector('svg');
      if (icon) icon.classList.add('hidden');
    } else {
      btn.className = "px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm active:scale-95 transition flex items-center gap-1";
      txt.textContent = "关注";
      const icon = btn.querySelector('svg');
      if (icon) icon.classList.remove('hidden');
    }
  }
}

async function spToggleFollow() {
  if (!currentViewingProfile) return;
  const charId = currentViewingProfile.characterId;
  const isFollowed = (window.followedHosts || []).includes(charId);

  if (isFollowed) {
    window.followedHosts = (window.followedHosts || []).filter(id => id !== charId);
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
  } else {
    if (!window.followedHosts.includes(charId)) {
      window.followedHosts.push(charId);
    }
    await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
    api.ui.toast("关注成功！");
  }

  updateSpFollowBtnState();
  updateLiveRoomHostFansDisplay();

  const totalFans = currentViewingProfile.baseFans + ((window.followedHosts || []).includes(charId) ? 1 : 0);
  const fansEl = document.getElementById('spFansCount');
  if (fansEl) fansEl.textContent = totalFans >= 10000 ? (totalFans / 10000).toFixed(1) + '万' : totalFans.toLocaleString();

  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = window.followedHosts.length + 1;
}
window.spToggleFollow = spToggleFollow;

function switchSpTab(tab) {
  activeSpTab = tab;
  const tabs = ['posts', 'shows', 'gallery', 'guestbook'];
  tabs.forEach(t => {
    const tabEl = document.getElementById(`spTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panelEl = document.getElementById(`spPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (tabEl) {
      if (t === tab) tabEl.classList.add('active');
      else tabEl.classList.remove('active');
    }
    if (panelEl) {
      if (t === tab) panelEl.classList.remove('hidden');
      else panelEl.classList.add('hidden');
    }
  });

  if (!currentViewingProfile) return;

  if (tab === 'posts') renderSpPosts();
  else if (tab === 'shows') renderSpShows();
  else if (tab === 'gallery') renderSpGallery();
  else if (tab === 'guestbook') renderSpGuestbook();
}
window.switchSpTab = switchSpTab;

function renderSpPosts() {
  const box = document.getElementById('spPanelPosts');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;
  
  box.innerHTML = p.posts.map(post => `
    <div class="weibo-post-card">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2.5">
          <img src="${p.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-100">
          <div>
            <div class="flex items-center gap-1">
              <span class="text-xs font-black text-slate-900">${p.name}</span>
              <span class="w-3 h-3 rounded-full bg-amber-400 text-slate-950 font-black text-[7px] flex items-center justify-center">V</span>
            </div>
            <span class="text-[9px] text-slate-400 font-medium">${post.time} · 来自 iPhone 16 Pro</span>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-800 leading-relaxed font-normal">${post.text}</p>

      <div class="flex items-center justify-between border-t border-slate-100 mt-3 pt-2.5">
        <div class="weibo-action-btn" onclick="api.ui.toast('转发功能已模拟')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span>${post.forwards}</span>
        </div>
        <div class="weibo-action-btn" onclick="api.ui.toast('评论区已展开')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>${post.comments}</span>
        </div>
        <div class="weibo-action-btn ${post.userLikes ? 'liked' : ''}" onclick="spLikePost('${post.id}')">
          <svg class="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          <span>${post.likes}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function spLikePost(postId) {
  if (!currentViewingProfile) return;
  const post = currentViewingProfile.posts.find(p => p.id === postId);
  if (!post) return;
  post.userLikes = !post.userLikes;
  post.likes += post.userLikes ? 1 : -1;
  renderSpPosts();
}
window.spLikePost = spLikePost;

function renderSpShows() {
  const box = document.getElementById('spPanelShows');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;

  box.innerHTML = `
    <div class="bg-gradient-to-r from-rose-500 to-pink-500 p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between mb-3">
      <div>
        <span class="text-[10px] text-white/80 font-bold">历史开播总览</span>
        <div class="text-base font-black mt-0.5">累计直播 ${p.totalShows} 场</div>
      </div>
      <div class="text-right">
        <span class="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">场均增粉 +${p.avgFansPerShow}</span>
      </div>
    </div>
    <div class="space-y-2.5">
      ${p.showsHistory.map(s => `
        <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <h4 class="text-xs font-bold text-slate-900">${s.title}</h4>
            <div class="flex items-center gap-2 text-[10px] text-slate-400">
              <span>时长: ${s.duration}</span>
              <span>·</span>
              <span>人气: ${s.heat}</span>
              <span>·</span>
              <span class="text-rose-500 font-bold">${s.newFans}</span>
            </div>
          </div>
          <span class="text-[9px] text-slate-400 font-medium">${s.timeAgo}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSpGallery() {
  const box = document.getElementById('spPanelGallery');
  if (!box || !currentViewingProfile) return;
  const p = currentViewingProfile;
  
  box.innerHTML = `
    <div class="gallery-grid-3">
      ${p.gallery.filter(img => img).map(img => `
        <img src="${img}" onclick="api.ui.toast('已查看高清大图')" class="rounded-xl shadow-xs">
      `).join('')}
    </div>
  `;
}

function renderSpGuestbook() {
  const box = document.getElementById('spaceGuestbookList');
  if (!box || !currentViewingProfile) return;
  const list = guestbookData[currentViewingProfile.characterId] || [];
  box.innerHTML = list.length === 0 ? '<p class="text-[11px] text-slate-400 py-3 text-center">暂无留言，快来给主播抢个沙发吧~</p>' : list.map(m => `
    <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs space-y-1.5">
      <div class="flex justify-between text-[10px]">
        <span class="font-bold text-slate-900">${m.user}</span>
        <span class="text-slate-400">${m.time || '刚刚'}</span>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed">${m.text}</p>
      ${m.reply ? `<div class="mt-2 p-2 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-800"><strong>主播回复：</strong>${m.reply}</div>` : ''}
    </div>
  `).join('');
}

async function submitGuestbookComment() {
  const input = document.getElementById('inputSpaceComment');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !currentViewingProfile) return;

  const hostId = currentViewingProfile.characterId;
  if (!guestbookData[hostId]) guestbookData[hostId] = [];
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const item = {
    id: `gb_${Date.now()}`,
    hostId: hostId,
    user: uName,
    text: val,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reply: null
  };
  guestbookData[hostId].unshift(item);
  input.value = '';

  const rate = ((window.appParams && window.appParams.guestbookRate !== undefined) ? window.appParams.guestbookRate : 75) / 100;
  if (Math.random() < rate) {
    try {
      const res = await window.aiGenerate({
        characterId: hostId,
        instruction: `粉丝【${uName}】在你的主页留言：“${val}”。请以你的角色人设简短温馨回复一句。`
      });
      item.reply = res.text;
    } catch (e) {}
  }
  renderSpGuestbook();
  try { await api.db.create("guestbook", item); } catch (e) {}
}
window.submitGuestbookComment = submitGuestbookComment;

function spEnterLiveRoom() {
  if (!currentViewingProfile) return;
  const live = (window.liveList || []).find(l => l.characterId === currentViewingProfile.characterId || l.id === currentViewingProfile.characterId);
  if (live) {
    closeStreamerProfilePage();
    enterLiveRoom(live.id);
  } else {
    api.ui.toast("主播当前不在直播中");
  }
}
window.spEnterLiveRoom = spEnterLiveRoom;

function spOpenPrivateChat() {
  if (!currentViewingProfile) return;
  api.ui.toast(`已向【${currentViewingProfile.name}】发送私信招呼`);
}
window.spOpenPrivateChat = spOpenPrivateChat;

function shareCurrentStreamerProfile() {
  if (!currentViewingProfile) return;
  api.ui.toast(`已生成【${currentViewingProfile.name}】的专属主页分享卡片`);
}
window.shareCurrentStreamerProfile = shareCurrentStreamerProfile;

function openCurrentHostProfile() {
  if (window.currentRoom) {
    openStreamerProfilePage(window.currentRoom.characterId || window.currentRoom.id);
  }
}
window.openCurrentHostProfile = openCurrentHostProfile;

// =========================================================================
// 8. 周期性作息推演与同步服务
// =========================================================================
async function syncLiveSessions(options = {}) {
  let sessions = await api.db.list("live_sessions") || [];
  const now = Date.now();
  const params = window.appParams || {};
  const spawnRate = params.charSpawnRate !== undefined ? params.charSpawnRate : 45;
  const maxLiveMins = params.maxLiveDuration || 120;
  const maxRestMins = params.maxRestDuration || 360;
  const officialCategories = ['电竞竞技', '声动音律', '次元才艺', '随性杂谈', '探索开箱'];

  // 超时下播强制切断检测
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (now >= s.endTime) {
      if (window.lumaOpsGateway) {
        await window.lumaOpsGateway.requestStopLive({
          characterId: s.characterId,
          reason: "单次直播到达上限，官方强制切断",
          source: "auto_timeout"
        });
      }
    }
  }

  sessions = await api.db.list("live_sessions") || [];

  const allChars = window.allCharacters || [];

  if (spawnRate === 0) {
    const eggData = await api.db.get("app_settings", "maint_egg_triggered").catch(() => null);
    const isEggTriggered = eggData?.value === true;
    
    if (!isEggTriggered && sessions.length === 0 && allChars.length > 0) {
      const chosen = allChars[Math.floor(Math.random() * allChars.length)];
      await api.db.create("app_settings", { id: "maint_egg_triggered", value: true }).catch(() => {});
      if (window.lumaOpsGateway) {
        await window.lumaOpsGateway.requestStartLive({
          characterId: chosen.id,
          category: "随性杂谈",
          topic: `【被迫营业】维护期间加班中`,
          durationMins: 30,
          source: "egg_force"
        });
      }
      sessions = await api.db.list("live_sessions") || [];
    }

    liveList = sessions;
    window.liveList = liveList;
    renderLiveGrid();
    return;
  }

  if (options.allowSpawn === false || !allChars || allChars.length === 0) {
    liveList = sessions;
    window.liveList = liveList;
    renderLiveGrid();
    return;
  }

  const offlineChars = allChars.filter(c => !sessions.find(s => s.characterId === c.id));
  const effectiveRate = Math.min(Math.max(spawnRate, 5), 80) / 100;

  for (let c of offlineChars) {
    let sched = (window.lumaOpsGateway && typeof window.lumaOpsGateway.getCharSchedule === 'function') 
      ? await window.lumaOpsGateway.getCharSchedule(c.id) 
      : (window.charSchedulesMap ? window.charSchedulesMap[c.id] : null);
    
    if (!sched || !sched.nextLiveAt) {
      const initOffsetMins = Math.floor(Math.random() * 30 + 5);
      const planRest = Math.max(10, Math.round(maxRestMins - (maxRestMins - 10) * effectiveRate));
      const planDur = Math.floor(Math.random() * (maxLiveMins - 30) + 30);
      
      const isOngoingMock = Math.random() < effectiveRate;
      const startMock = isOngoingMock ? (now - initOffsetMins * 60 * 1000) : (now + initOffsetMins * 60 * 1000);

      sched = {
        characterId: c.id,
        lastOfflineAt: isOngoingMock ? (startMock - planRest * 60000) : now,
        nextLiveAt: startMock,
        planRestMins: planRest,
        planDurationMins: planDur
      };
      if (window.lumaOpsGateway && typeof window.lumaOpsGateway.saveCharSchedule === 'function') {
        await window.lumaOpsGateway.saveCharSchedule(c.id, sched);
      }
    }

    const planDurationMs = (sched.planDurationMins || 60) * 60 * 1000;
    const planEnd = sched.nextLiveAt + planDurationMs;

    if (now >= planEnd) {
      const nextPlanRestMins = Math.max(10, Math.round(maxRestMins - (maxRestMins - 10) * effectiveRate));
      const nextPlanDurMins = Math.floor(Math.random() * (maxLiveMins - 30) + 30);
      const newNextLive = now + nextPlanRestMins * 60 * 1000;

      if (window.lumaOpsGateway && typeof window.lumaOpsGateway.saveCharSchedule === 'function') {
        await window.lumaOpsGateway.saveCharSchedule(c.id, {
          characterId: c.id,
          lastOfflineAt: planEnd,
          nextLiveAt: newNextLive,
          planRestMins: nextPlanRestMins,
          planDurationMins: nextPlanDurMins
        });
      }
      continue;
    }

    if (now >= sched.nextLiveAt && now < planEnd) {
      const cat = officialCategories[Math.floor(Math.random() * officialCategories.length)];
      const subs = SUB_CATEGORIES[cat] || ['热门专场'];
      const subTag = subs[Math.floor(Math.random() * subs.length)];

      const newSession = await api.db.create("live_sessions", {
        characterId: c.id,
        name: c.name,
        avatar: c.avatar || NPC_AVATAR_POOL[0],
        cover: c.cover || c.avatar || NPC_AVATAR_POOL[0],
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
    }
  }

  liveList = sessions;
  window.liveList = liveList;
  renderLiveGrid();
}
window.syncLiveSessions = syncLiveSessions;

// =========================================================================
// 9. 分享直达与深层链接解析 (Deep Linking)
// =========================================================================
function checkDeepLinkParams() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));

    const roomId = urlParams.get('roomId') || urlParams.get('room') || urlParams.get('sessionId') || hashParams.get('roomId') || hashParams.get('room');
    const streamerId = urlParams.get('streamerId') || urlParams.get('charId') || urlParams.get('characterId') || hashParams.get('streamerId') || hashParams.get('charId');
    const tab = urlParams.get('tab') || hashParams.get('tab');

    if (tab && typeof switchTab === 'function') {
      switchTab(tab);
    }

    if (roomId) {
      const lives = window.liveList || liveList || [];
      const targetRoom = lives.find(s => String(s.id) === String(roomId) || String(s.roomId) === String(roomId) || String(s.characterId) === String(roomId));
      if (targetRoom) {
        enterLiveRoom(targetRoom.id);
        return;
      }
    }

    if (streamerId) {
      openStreamerProfilePage(streamerId);
    }
  } catch (e) {
    console.warn("DeepLink 解析异常:", e);
  }
}
window.checkDeepLinkParams = checkDeepLinkParams;
window.addEventListener('hashchange', checkDeepLinkParams);



// =========================================================================
// 【统一页面栈注册】个人主页
// =========================================================================
if (window.PageStack) {
  window.PageStack.register('streamerProfilePageView', {
    element: document.getElementById('streamerProfilePageView'),
    openClass: 'open',
    hiddenClass: null,  // 个人主页用 transform 定位，不用 hidden 类
    onClose: () => {
      currentViewingProfile = null;
    },
  });
  // 直播间：底部滑入动画（沉浸式全屏体验）
  window.PageStack.register('liveRoomModal', {
    animationType: 'slide-bottom',
    zIndex: 150,  // 直播间层级高一些
  });
}
