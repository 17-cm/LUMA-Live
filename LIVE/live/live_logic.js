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

const SUB_CATEGORIES = {
  'all': ['全部推荐', '热门精选', '新人出道', '高光时刻', '连麦互动'],
  '电竞竞技': ['全部', '王者荣耀', '原神 / 星铁', '无畏契约', '和平精英', '我的世界'],
  '声动音律': ['全部', '流行点唱', '深夜电台', '治愈声优', '器乐演奏', '古风国潮'],
  '次元才艺': ['全部', '虚拟歌姬', '国风宅舞', '即兴配音', '手绘插画', 'Cosplay秀'],
  '随性杂谈': ['全部', '吃瓜茶话会', '情感连麦', '深夜树洞', '查房PK', '日常唠嗑'],
  '探索开箱': ['全部', '硬核数码', '潮玩手办', '美食探店', '户外漫游', '新奇测评']
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
window.escapeHtml = escapeHtml;

// 严格获取标准合规的二级子分类频道（杜绝人设头衔或一级赛道混入）
// identityHint：可选的稳定身份键（如 characterId），字符串形式调用时用于哈希分布，避免多个不同主播被模糊匹配兜底到同一二级分类
function getCanonicalSubCategory(sessionOrCategory, maybeSubTag, identityHint) {
  let mainCat = '随性杂谈';
  let subTag = '';
  let identityKey = '';

  if (typeof sessionOrCategory === 'object' && sessionOrCategory !== null) {
    mainCat = normalizeCategory(sessionOrCategory.category);
    subTag = sessionOrCategory.subTag || '';
    // 稳定身份键：优先用角色/场次的唯一标识，保证同一主播每次计算结果一致
    identityKey = sessionOrCategory.characterId || sessionOrCategory.id || sessionOrCategory.roomId || sessionOrCategory.name || subTag;
  } else {
    mainCat = normalizeCategory(sessionOrCategory);
    subTag = maybeSubTag || '';
    identityKey = identityHint || subTag || sessionOrCategory;
  }

  const validList = (SUB_CATEGORIES[mainCat] || []).filter(item => item !== '全部' && item !== '全部推荐');
  if (validList.length === 0) return '日常唠嗑';

  if (subTag && validList.includes(subTag)) {
    return subTag;
  }

  if (subTag) {
    const sLower = String(subTag).toLowerCase();
    const matched = validList.find(v => sLower.includes(v.toLowerCase()) || v.toLowerCase().includes(sLower));
    if (matched) return matched;
  }

  // 未命中标准词或模糊匹配时，不能固定兜底到 validList[0]（会导致大量角色塌缩到同一个二级分类）。
  // 用稳定身份键（characterId/id/name）做确定性哈希，将不同主播分散落在该赛道下的各个二级频道。
  const keyStr = String(identityKey || subTag || mainCat || 'default');
  let hash = 0;
  for (let i = 0; i < keyStr.length; i++) {
    hash = (hash * 31 + keyStr.charCodeAt(i)) >>> 0;
  }
  return validList[hash % validList.length] || '日常唠嗑';
}
window.getCanonicalSubCategory = getCanonicalSubCategory;

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
  const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
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
      avatar: foundChar.avatar || foundChar.cover || getAvatar((foundChar && (foundChar.name || foundChar.id)) || null, 'first'),
      tag: (foundChar.tags && foundChar.tags[0]) || '特邀嘉宾',
      tagColor: 'bg-purple-500/25 text-purple-200 border-purple-400/40',
      vip: 'VIP 8',
      type: 'char'
    };
  }

  let hash = 0;
  for (let i = 0; i < strSender.length; i++) hash = (hash * 31 + strSender.charCodeAt(i)) % 100000;
  const avatar = getAvatar(strSender, 'emoji');
  
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
    const isAll = item === '全部' || item === '全部推荐';
    const isSelected = (activeSubCategory === 'all' && isAll) || (activeSubCategory === item);
    const targetVal = isAll ? 'all' : item;
    return `
      <button onclick="selectSubCategory('${targetVal}')" class="jelly-pill ${isSelected ? 'active' : ''}">
        ${item}
      </button>
    `;
  }).join('');
}
window.renderSubCategories = renderSubCategories;

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
    const matchMain = (s.category === mainCat) || (sNorm === mainNorm);
    if (!matchMain) return false;
  }
  if (subCat && subCat !== 'all' && subCat !== '全部' && subCat !== '全部推荐') {
    // 二级匹配必须与广场卡片展示逻辑保持一致：卡片展示的是 getCanonicalSubCategory(s)
    // 规范化/兜底后的结果，而不是 s.subTag 原始值（可能为空、脏数据或自由文本）。
    // 若只比较原始 s.subTag，会出现"卡片显示吃瓜茶话会，点击吃瓜茶话会却搜不到"的不一致。
    const canonicalSubTag = getCanonicalSubCategory(s);
    const matchSub = (canonicalSubTag === subCat) ||
                     (s.subTag === subCat) ||
                     (s.category === subCat) ||
                     (s.subTag && s.subTag.includes(subCat)) ||
                     (s.topic && s.topic.includes(subCat));
    if (!matchSub) return false;
  }
  return true;
}
window.isSessionMatchingCategory = isSessionMatchingCategory;

function renderLiveGrid() {
  const box = document.getElementById('liveGrid') || document.getElementById('livePlazaGrid');
  if (!box) return;
  
  const currentLives = window.liveList || liveList || [];

  let filtered = currentLives.filter(s => isSessionMatchingCategory(s, activeMainCategory, activeSubCategory));

  if (filtered.length === 0) {
    box.innerHTML = `
      <div class="col-span-2 py-12 px-4 text-center">
        <div class="luxe-card p-6 flex flex-col items-center justify-center space-y-3 bg-white/70">
          <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </div>
          <div>
            <h4 class="text-xs font-black text-slate-800">当前暂无正在直播的主播</h4>
            <p class="text-[10px] text-slate-400 mt-1">可在小手机中添加角色，或召唤野生主播即刻开播！</p>
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

    const canonicalSubTag = getCanonicalSubCategory(s);

    return `
    <div onclick="enterLiveRoom('${s.id}')" class="luxe-card overflow-hidden active:scale-95 transition cursor-pointer flex flex-col bg-white">
      <div class="h-28 relative bg-slate-900">
        <img src="${s.cover || s.avatar}" class="w-full h-full object-cover">
        <span class="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md text-[8px] px-1.5 py-0.5 rounded font-black text-white flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          <span>LIVE · <span class="plaza-live-timer font-mono" data-start-time="${start}">${timeCode}</span></span>
        </span>
        <span class="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-[8px] text-white px-1.5 py-0.5 rounded font-medium">${canonicalSubTag}</span>
        <span class="absolute bottom-1.5 right-2 text-[8px] text-white bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 font-bold">
          <svg class="w-2.5 h-2.5 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          <span>${onlineViewers > 10000 ? (onlineViewers / 10000).toFixed(1) + 'w' : onlineViewers} 在看</span>
        </span>
      </div>
      <div class="p-2.5">
        <h4 class="text-xs font-black truncate text-slate-900">${s.topic}</h4>
        <p class="text-[10px] text-slate-400 mt-0.5 truncate">房号: ${s.roomId || '884920'}</p>
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
    titleEl.textContent = getCanonicalSubCategory(currentRoom);
  }
  
  updateLiveRoomHostFansDisplay();
  checkFollowState();
  
  const feed = document.getElementById('danmakuFeed');
  if (feed) feed.innerHTML = '';
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

  // 重置单次进房请求锁
  lastPackageRequestTime = 0;

  // 如果已经有打包好的内容，立即推首条台词并启动流
  if (hostSpeechPool.length > 0) {
    const first = hostSpeechPool.shift();
    renderHostSpeech(first.speech, first.action);
  } else {
    fetchBatchLivePackage(true);
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

async function fetchBatchLivePackage(force = false) {
  if (!currentRoom || isFetchingBatchPackage) return;
  
  // 请求冷却：两次请求至少间隔用户设置的时间（分钟转毫秒）
  const intervalMinutes = (typeof window.getApiRequestIntervalMinutes === 'function') 
    ? window.getApiRequestIntervalMinutes() 
    : 5;
  const minIntervalMs = intervalMinutes * 60 * 1000;
  const now = Date.now();
  
  // 如果非强制且弹幕池与台词池均充足，且在冷却时间内，则不重复请求
  if (!force && danmakuPool.length > 5 && hostSpeechPool.length > 2 && (now - lastPackageRequestTime < minIntervalMs)) {
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
    
    // 动态上下文：赛道频道、标题与最近送礼
    const dynamicContext = `当前赛道：${currentRoom.category}（${currentRoom.subTag || '日常'}），标题：《${currentRoom.topic}》${giftHistoryText}`;
    
    const res = await window.aiGenerate({
      characterId: currentRoom.characterId,
      appTags: ['live', 'package'],
      instruction: dynamicContext
    });

    const parsed = window.extractJsonFromText ? window.extractJsonFromText(res.text) : null;

    if (parsed) {
      // 灵活提取弹幕池 (兼容各种可能命名的字段)
      const rawDanmakus = parsed.danmakus || parsed.danmaku || parsed.barrages || parsed.comments || parsed.bullet_chats || [];
      if (Array.isArray(rawDanmakus) && rawDanmakus.length > 0) {
        danmakuPool.push(...rawDanmakus);
      }

      // 灵活提取台词流 (兼容各种可能命名的字段)
      const rawSpeeches = parsed.hostSpeeches || parsed.host_speeches || parsed.hostSpeech || parsed.speeches || parsed.dialogues || [];
      if (Array.isArray(rawSpeeches) && rawSpeeches.length > 0) {
        hostSpeechPool.push(...rawSpeeches);
        if (hostSpeechPool.length > 0) {
          const first = hostSpeechPool.shift();
          renderHostSpeech(first.speech, first.action);
        }
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(item => {
          if (item && item.speech) hostSpeechPool.push(item);
          else if (item && (item.text || item.sender)) danmakuPool.push(item);
        });
        if (hostSpeechPool.length > 0) {
          const first = hostSpeechPool.shift();
          renderHostSpeech(first.speech, first.action);
        }
      }
    }
  } catch (e) {
    console.warn('[fetchBatchLivePackage request error]:', e);
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
  let displaySpeech = typeof speech === 'string' ? speech : String(speech || '');
  let detectedCloseLive = false;
  let parsedAction = typeof action === 'string' ? action.trim() : '';

  // 1. 全面识别与清洗各种下播/关闭直播协议指令标签 (包含中英文、动作/指令、括号包裹等变体)
  const closeLiveRegex = /\[(?:动作|ACTION|指令|CMD)?[:：\s]*(?:关闭直播|下播|CLOSE_LIVE|EXIT_LIVE)\]/gi;
  if (closeLiveRegex.test(displaySpeech)) {
    detectedCloseLive = true;
    displaySpeech = displaySpeech.replace(closeLiveRegex, '').trim();
  }

  // 2. 清洗其他内嵌动作标签（如 [动作:挥手] -> 提取为 action 并不在正文残留）
  const embeddedActionRegex = /\[(?:动作|ACTION)[:：\s]*([^\]]+)\]/gi;
  let actMatch;
  while ((actMatch = embeddedActionRegex.exec(displaySpeech)) !== null) {
    if (!parsedAction && actMatch[1]) {
      parsedAction = actMatch[1].trim();
    }
  }
  displaySpeech = displaySpeech.replace(embeddedActionRegex, '').trim();

  // 3. 去除残留的各种系统标记符或前后双引号/书名号
  displaySpeech = displaySpeech.replace(/^["'“‘【]+|["'”’】]+$/g, '').trim();

  // 4. 若检测到下播协议，立即终止推流流速并直接切换展示"主播已离开房间…"停留页
  if (detectedCloseLive) {
    if (currentRoom) {
      const roomRef = { ...currentRoom };
      const targetCharId = currentRoom.characterId;

      // 立即调用过渡停留页
      if (typeof window.showHostLeftRoomStage === 'function') {
        window.showHostLeftRoomStage(roomRef);
      }

      if (window.lumaOpsGateway && typeof window.lumaOpsGateway.requestStopLive === 'function') {
        window.lumaOpsGateway.requestStopLive({
          characterId: targetCharId,
          reason: "主播主动触发下播协议",
          source: "speech_closure"
        });
      }
    }
    return;
  }

  const contentEl = document.getElementById('speechContentText');
  const actionEl = document.getElementById('speechActionTag');
  if (contentEl) contentEl.textContent = displaySpeech || '……';
  if (actionEl) actionEl.textContent = parsedAction ? `· ${parsedAction}` : '';

  if (currentRoom && !currentRoom.isNPC && api.voice?.tts && displaySpeech) {
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
      <img src="${info.avatar}" class="danmaku-avatar-img" onerror="this.src=getAvatar(null,'emoji')">
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
      appTags: ['live', 'reply'],
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
    const drawer = document.getElementById('plusDrawerSheet');
    const plusBtn = document.getElementById('mainPlusBtn');
    if (drawer) drawer.classList.remove('open');
    if (plusBtn) plusBtn.classList.remove('open');
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
      if (window.GiftSystem && typeof window.GiftSystem.renderGiftList === 'function') {
        window.GiftSystem.renderGiftList();
      }
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
        <img src="${senderInfo.avatar}" class="w-full h-full rounded-full object-cover border border-white/80" onerror="this.src=getAvatar(null,'emoji')">
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
  await dbUpsert("app_wallet", "vault_data", { balance: window.currentWalletBalance });
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();

  // 记录消费与打榜贡献
  const streamerAvatar = currentRoom ? (currentRoom.avatar || currentRoom.cover) : '';
  const streamerTag = currentRoom ? getCanonicalSubCategory(currentRoom) : '日常唠嗑';
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
    await dbUpsert("app_wallet", "vault_data", { balance: window.currentWalletBalance });

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
        appTags: ['live', 'reply'],
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
    const coverUrl = imgRes?.dataUrl || character?.avatar || '';

    const npcNames = ['可可', '夏桃', '安妮', '琉璃', '星奈'];
    const chosenName = `野生主播·${npcNames[Math.floor(Math.random() * npcNames.length)]}`;
    const now = Date.now();
    const npcId = `npc_${now}_${Math.random().toString(36).slice(2, 6)}`;

    // 随机分配一级赛道，并用稳定身份键让二级分类分散，避免每次召唤都固定同一个分类
    const mainCatKeys = Object.keys(SUB_CATEGORIES).filter(k => k !== 'all');
    const chosenMainCat = mainCatKeys[Math.floor(Math.random() * mainCatKeys.length)];
    const subCatList = (SUB_CATEGORIES[chosenMainCat] || []).filter(item => item !== '全部' && item !== '全部推荐');
    const chosenSubTag = subCatList[Math.floor(Math.random() * subCatList.length)] || '日常唠嗑';

    const newNPC = await api.db.create("live_sessions", {
      characterId: npcId,
      name: chosenName,
      avatar: coverUrl,
      cover: coverUrl,
      category: chosenMainCat,
      subTag: chosenSubTag,
      topic: `【${chosenName}】的精彩直播`,
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
// 【已迁移】本节代码已整体迁移至 LIVE/主页/streamer_profile.js（归档分类）
// 包含：主播档案生成、主页渲染、编辑档案、关注、直播场次、相册、留言墙
// =========================================================================


// =========================================================================
// 8. 周期性作息推演与同步服务
// =========================================================================
// =========================================================================
// LUMA官方运营组·定时器轮询
// 官方运营组定期读取参数，通过概率模拟AI决策，通知房管审核开播/下播

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
  // 直播间：底部滑入动画（沉浸式全屏体验）
  window.PageStack.register('liveRoomModal', {
    animationType: 'slide-bottom',
    zIndex: 150,  // 直播间层级高一些
  });
}
