// =========================================================================
// 【模块三·个人信息与资产】LIVE/profile.js
// 包含：个人资料同步与编辑、关注列表管理、双列守护排行榜、钱包流水、充值中心
// =========================================================================

var api = window.api || {};

let currentUser = {
  name: '玩家',
  avatar: getAvatar('玩家', 'first')
};
window.currentUser = currentUser;

let userProfileData = {
  uid: '88291048',
  ip: 'LUMA',
  tag: '新人主播',
  bio: '保持好奇，在赛博世界里做最真实的自己。',
  fans: 128,
  likes: 1240,
  medals: 3
};
window.userProfileData = userProfileData;

let revenueBalance = 0;
let transactionLedger = [];
let currentRankTab = 'fans';

let selectedRechargeAmount = 600;
let selectedRechargePrice = 6;

// 1. 同步个人资料与关注统计 (仅统计已关注的主播/用户，超话频道不计入人物关注列表)
function syncFollowCountDisplay() {
  const followed = Array.isArray(window.followedHosts) ? window.followedHosts : [];
  // LUMA 官方运营组固定占 1 个关注项，其余均来自真实关注记录
  const count = followed.length + 1;
  const statEl = document.getElementById('statFollowCount');
  if (statEl) statEl.textContent = String(count);
}
window.syncFollowCountDisplay = syncFollowCountDisplay;

async function syncUserProfile() {
  try {
    const u = await api.user.getProfile();
    if (u) {
      currentUser.name = u.name || '玩家';
      currentUser.avatar = u.avatar || u.avatarUrl || u.icon || getAvatar((u && u.name) || currentUser.name || null, 'first');
      const nameEl = document.getElementById('userName');
      const avatarBox = document.getElementById('userAvatarBox');
      if (nameEl) nameEl.textContent = currentUser.name;
      if (avatarBox && currentUser.avatar) avatarBox.src = currentUser.avatar;
    }
  } catch (e) {}

  // 1. 同步个人粉丝数量
  const myFans = window.LumaFansManager ? window.LumaFansManager.getFans('user') : (userProfileData.fans || 128);
  userProfileData.fans = myFans;
  const statFanEl = document.getElementById('statFanCount');
  if (statFanEl) {
    statFanEl.textContent = window.LumaDataHub ? window.LumaDataHub.formatNumber(myFans) : myFans;
  }

  // 2. 同步点赞与勋章数
  const statLikeEl = document.getElementById('statLikeCount');
  if (statLikeEl) statLikeEl.textContent = (userProfileData.likes || 1240).toLocaleString();

  const statMedalEl = document.getElementById('statMedalCount');
  if (statMedalEl) statMedalEl.textContent = userProfileData.medals || 3;

  // 3. 同步佩戴头衔/称号
  if (window.LumaTitlesManager) {
    const activeTitle = window.LumaTitlesManager.getActiveTitle('user');
    if (activeTitle) {
      userProfileData.tag = activeTitle.name;
      const tagEl = document.getElementById('displayUserTag');
      if (tagEl) tagEl.textContent = activeTitle.name;
    }
  }

  syncFollowCountDisplay();
  renderDualRankList();
}
window.syncUserProfile = syncUserProfile;

// 2. 个人资料编辑弹窗
function openEditProfileModal() {
  const uidInput = document.getElementById('editInputUID');
  const ipInput = document.getElementById('editInputIP');
  const tagInput = document.getElementById('editInputTag');
  const bioInput = document.getElementById('editInputBio');

  if (uidInput) uidInput.value = userProfileData.uid || '88291048';
  if (ipInput) ipInput.value = userProfileData.ip || 'LUMA';
  if (tagInput) tagInput.value = userProfileData.tag || '新人主播';
  if (bioInput) bioInput.value = userProfileData.bio || '';

  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.remove('hidden');
}
window.openEditProfileModal = openEditProfileModal;

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.add('hidden');
}
window.closeEditProfileModal = closeEditProfileModal;

async function saveUserProfileEdits() {
  userProfileData.uid = document.getElementById('editInputUID')?.value.trim() || '88291048';
  userProfileData.ip = document.getElementById('editInputIP')?.value.trim() || 'LUMA';
  userProfileData.tag = document.getElementById('editInputTag')?.value.trim() || '新人主播';
  userProfileData.bio = document.getElementById('editInputBio')?.value.trim() || '';

  const uidEl = document.getElementById('displayUserUID');
  const ipEl = document.getElementById('displayUserIP');
  const tagEl = document.getElementById('displayUserTag');
  const bioEl = document.getElementById('userBioText');

  if (uidEl) uidEl.textContent = userProfileData.uid;
  if (ipEl) ipEl.textContent = userProfileData.ip;
  if (tagEl) tagEl.textContent = userProfileData.tag;
  if (bioEl) bioEl.textContent = `“${userProfileData.bio}”`;

  closeEditProfileModal();

  try {
    await api.db.create("app_profile", { id: "user_profile", ...userProfileData });
  } catch (e) {
    await api.db.update("app_profile", "user_profile", userProfileData).catch(() => {});
  }
  api.ui.toast("个人资料已保存！");
}
window.saveUserProfileEdits = saveUserProfileEdits;

// 3. 关注列表页面
function openFollowListPageView() {
  const container = document.getElementById('followListContentContainer');
  if (!container) return;
  
  const followedIds = window.followedHosts || [];
  const chars = window.allCharacters || [];
  const lives = window.liveList || [];
  
  // 查找已关注的所有主播信息（包含当前在线和下播的主播）
  const follows = followedIds.map(id => {
    // 优先从角色库找
    const fromChars = chars.find(c => c.id === id || c.characterId === id);
    if (fromChars) return fromChars;
    // 其次从直播列表中找
    const fromLives = lives.find(l => l.characterId === id || l.id === id);
    if (fromLives) return {
      id: fromLives.characterId || fromLives.id,
      name: fromLives.name,
      avatar: fromLives.avatar || fromLives.cover,
      tags: [fromLives.category, fromLives.subTag].filter(Boolean)
    };
    // 兜底虚拟信息
    return {
      id: id,
      name: `主播_${String(id).slice(-4)}`,
      avatar: getAvatar(null, 'emoji'),
      tags: ['签约主播']
    };
  });

  let html = `
    <div class="luxe-card p-3.5 flex items-center justify-between bg-white">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-rose-500 flex-shrink-0">
          <div class="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-xs font-black">LUMA</div>
        </div>
        <div>
          <h4 class="text-xs font-black text-slate-900">LUMA 官方运营组</h4>
          <p class="text-[9px] text-slate-400 mt-0.5">官方特邀认证 · 24小时值班</p>
        </div>
      </div>
      <span class="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">已关注</span>
    </div>
  `;

  if (follows.length === 0) {
    html += `
      <div class="py-10 text-center text-slate-400 text-xs">
        <p class="font-bold">暂无关注的主播</p>
        <p class="text-[10px] text-slate-300 mt-1">前往直播广场关注心仪主播吧</p>
      </div>
    `;
  } else {
    html += follows.map(c => {
      const isOnline = (window.liveList || []).some(l => (l.characterId === c.id || l.id === c.id) && l.isLive !== false);
      const fansCount = window.getHostBaseFans ? window.getHostBaseFans(c.id, c) : 1280;
      const formattedFans = fansCount >= 10000 ? (fansCount / 10000).toFixed(1) + '万' : fansCount.toLocaleString();
      return `
        <div class="luxe-card p-3.5 flex items-center justify-between bg-white">
          <div class="flex items-center gap-3 cursor-pointer" onclick="openStreamerSpace('${c.id}')">
            <div class="relative flex-shrink-0">
              <img src="${c.avatar}" class="w-11 h-11 rounded-full object-cover border-2 ${isOnline ? 'border-rose-500' : 'border-slate-200'}">
              ${isOnline ? '<span class="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full leading-tight">直播中</span>' : ''}
            </div>
            <div>
              <h4 class="text-xs font-black text-slate-900">${c.name}</h4>
              <p class="text-[9px] ${isOnline ? 'text-rose-600 font-bold' : 'text-slate-400'} mt-0.5">${formattedFans} 粉丝 · ${isOnline ? '正在直播' : '已下播休息'}</p>
            </div>
          </div>
          <button onclick="toggleFollowRoomHostById('${c.id}')" class="btn-action text-[10px] !py-1 !px-2.5 text-slate-500">取消关注</button>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = html;
  if (window.PageStack) {
    window.PageStack.open('followListPageView');
  } else {
    const page = document.getElementById('followListPageView');
    if (page) page.classList.remove('hidden');
  }
}
window.openFollowListPageView = openFollowListPageView;

function closeFollowListPageView() {
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    const page = document.getElementById('followListPageView');
    if (page) page.classList.add('hidden');
  }
}
window.closeFollowListPageView = closeFollowListPageView;

async function toggleFollowRoomHostById(charId) {
  if (window.followedHosts.includes(charId)) {
    window.followedHosts = window.followedHosts.filter(id => id !== charId);
    await api.db.delete("follows", charId).catch(() => {});
    api.ui.toast("已取消关注");
    openFollowListPageView();
    
    const statEl = document.getElementById('statFollowCount');
    if (statEl) statEl.textContent = window.followedHosts.length + 1;

    if (typeof checkFollowState === 'function') checkFollowState();
    if (typeof updateLiveRoomHostFansDisplay === 'function') updateLiveRoomHostFansDisplay();
  }
}
window.toggleFollowRoomHostById = toggleFollowRoomHostById;

// 4. 双列排行榜
function switchRankTab(type) {
  currentRankTab = type;
  const btnFans = document.getElementById('btnRankFans');
  const btnMy = document.getElementById('btnRankMy');

  if (type === 'fans') {
    if (btnFans) btnFans.className = 'text-xs font-black text-rose-600 border-b-2 border-rose-600 pb-1';
    if (btnMy) btnMy.className = 'text-xs font-bold text-slate-400 pb-1';
  } else {
    if (btnMy) btnMy.className = 'text-xs font-black text-rose-600 border-b-2 border-rose-600 pb-1';
    if (btnFans) btnFans.className = 'text-xs font-bold text-slate-400 pb-1';
  }
  renderDualRankList();
}
window.switchRankTab = switchRankTab;

function renderDualRankList() {
  const box = document.getElementById('dualRankListContainer');
  if (!box) return;

  let aggregatedList = [];

  if (window.LumaGuardManager) {
    if (currentRankTab === 'fans') {
      // 粉丝榜：只计算 Char 谁为我消费得最多
      aggregatedList = window.LumaGuardManager.getTopFansSpentOnMe().map(item => ({
        targetName: item.fromName || '主播',
        avatar: item.fromAvatar || window.LumaGuardManager.getAvatarById(item.fromId),
        tag: item.tag || '👑 铁杆打赏',
        totalAmount: item.totalAmount || 0,
        giftCount: item.giftCount || 1,
        lastTime: item.lastTime || '活跃'
      }));
    } else {
      // 我的守护榜：我为谁消费得最多
      aggregatedList = window.LumaGuardManager.getTopCharsISpentOn().map(item => ({
        targetName: item.toName || '主播',
        avatar: item.toAvatar || window.LumaGuardManager.getAvatarById(item.toId),
        tag: item.tag || '💖 守护主播',
        totalAmount: item.totalAmount || 0,
        giftCount: item.giftCount || 1,
        lastTime: item.lastTime || '活跃'
      }));
    }
  }

  if (aggregatedList.length === 0) {
    box.innerHTML = `
      <div class="py-8 text-center text-slate-400 text-xs">
        <div class="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
          <svg class="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
        <p class="font-bold">暂无${currentRankTab === 'fans' ? '粉丝打赏' : '守护主播'}数据</p>
        <p class="text-[10px] text-slate-400 mt-1">进入直播间赠送心仪礼物或在超话打榜，即可实时累加并登顶榜单！</p>
      </div>
    `;
    return;
  }

  const medals = [
    { label: '金牌守护', color: 'text-amber-500', bg: 'border-amber-200/80 bg-gradient-to-r from-amber-50/60 to-white', badge: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black', rankTag: 'Top 1 · 榜一' },
    { label: '银牌守护', color: 'text-slate-500', bg: 'border-slate-200/80 bg-gradient-to-r from-slate-50/60 to-white', badge: 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 font-bold', rankTag: 'Top 2 · 榜二' },
    { label: '铜牌守护', color: 'text-amber-700', bg: 'border-orange-200/80 bg-gradient-to-r from-orange-50/60 to-white', badge: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold', rankTag: 'Top 3 · 榜三' }
  ];

  box.innerHTML = aggregatedList.map((item, idx) => {
    const isTop3 = idx < 3;
    const m = isTop3 ? medals[idx] : null;
    const rankNum = idx + 1;

    return `
      <div class="luxe-card p-3 flex items-center justify-between ${m ? m.bg : 'bg-white'} border transition-all duration-200 hover:shadow-md">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs shadow-sm ${m ? m.badge : 'bg-slate-100 text-slate-600 font-bold'}">
            ${rankNum}
          </div>

          <div class="relative flex-shrink-0">
            <img src="${item.avatar}" class="w-10 h-10 rounded-full object-cover border-2 ${idx===0 ? 'border-amber-400 shadow-sm shadow-amber-200' : idx===1 ? 'border-slate-300' : idx===2 ? 'border-amber-600' : 'border-slate-200'}">
            ${idx === 0 ? '<span class="absolute -top-1.5 -right-1 text-xs">👑</span>' : ''}
          </div>

          <div>
            <div class="flex items-center gap-1.5">
              <h5 class="text-xs font-black text-slate-900">${item.targetName}</h5>
              <span class="text-[8px] px-1.5 py-0.2 rounded-full ${idx===0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'} font-bold">${item.tag}</span>
            </div>
            <p class="text-[9px] text-slate-500 mt-0.5">
              累计贡献：<span class="font-black text-rose-600">${item.totalAmount.toLocaleString()} 币</span>
              <span class="text-slate-300 mx-1">|</span>
              共送出 <span class="font-bold text-slate-700">${item.giftCount}</span> 次礼物
            </p>
          </div>
        </div>

        <div class="text-right flex-shrink-0">
          <span class="text-[10px] ${m ? m.color + ' font-black' : 'text-slate-400 font-bold'} block">
            ${m ? m.label : `No.${rankNum}`}
          </span>
          <span class="text-[8px] text-slate-400 block mt-0.5">${item.lastTime || '活跃'}</span>
        </div>
      </div>
    `;
  }).join('');
}
window.renderDualRankList = renderDualRankList;

// =========================================================================
// 【5. 钱包与流水 · 全面重设计】
//
// ⚠️ 安全区合规说明：
//   本页面所有可见内容均位于 --ai-phone-app-safe-top (默认88px) 之下。
//   顶部仅保留一根浅灰色装饰线（safe-line），线上方无任何 UI 元素。
//   底部内容预留 safe-bottom (默认24px) 的滚动空间。
//   设计原则：安全线 = 装饰性分隔，实际内容再往下偏移约 8px。
//
// 💰 货币体系：
//   LUMA 币 = APP 内部货币（window.currentWalletBalance，存 api.db）
//   宿主余额 = 小手机系统货币（AiPhone.wallet.get() → accounts[0].balance）
//   汇率：1 宿主货币 = 10 LUMA 币
//   提现 = LUMA 币 → 宿主余额（LUMA 减少，宿主增加）
//   充值 = 宿主余额 → LUMA 币（AiPhone.wallet.pay 扣款，LUMA 增加）
// =========================================================================

// ── 宿主余额缓存（避免频繁调 SDK）──
let _cachedHostBalance = null;
let _cachedHostBalanceTime = 0;
const HOST_BALANCE_CACHE_MS = 10000; // 10秒缓存

/**
 * 获取宿主钱包余额（真实调用 AiPhone.wallet.get()）
 * @returns {Promise<number>} 宿主货币余额
 */
async function getHostWalletBalance() {
  // 缓存有效直接返回
  if (_cachedHostBalance !== null && (Date.now() - _cachedHostBalanceTime) < HOST_BALANCE_CACHE_MS) {
    return _cachedHostBalance;
  }
  try {
    const wallet = await api.wallet.get();
    // wallet.accounts 是数组，取第一个账户的 balance
    const bal = wallet?.accounts?.[0]?.balance ?? 0;
    _cachedHostBalance = typeof bal === 'number' ? bal : parseFloat(bal) || 0;
    _cachedHostBalanceTime = Date.now();
    return _cachedHostBalance;
  } catch (e) {
    console.warn('[Wallet] 获取宿主余额失败:', e.message);
    return _cachedHostBalance ?? 0;
  }
}

/**
 * 刷新宿主余额显示（强制重新拉取）
 */
async function refreshHostBalanceDisplay() {
  _cachedHostBalance = null; // 清除缓存
  const bal = await getHostWalletBalance();
  const el = document.getElementById('wlHostBalance');
  if (el) el.textContent = bal.toFixed(2);
}

/**
 * 渲染完整的钱包页面 DOM（注入到 #walletPageView 容器内）
 * 不修改 index.html，所有 HTML 由 JS 动态生成
 */
function renderWalletUI() {
  const container = document.getElementById('walletPageView');
  if (!container) return;

  // ── 读取安全区 CSS 变量值 ──
  const style = getComputedStyle(document.documentElement);
  const safeTopVal = style.getPropertyValue('--ai-phone-app-safe-top').trim() || '88px';

  // 安全线位置：比实际 safe-top 再往下偏一点作为装饰
  const safeLineTop = `calc(${safeTopVal} + 6px)`;

  container.innerHTML = `
    <style>
      /* ═══════════ 钱包页面 · 全面重设计 ═══════════ */
      #walletPageView {
        background: #f5f6fa !important;
        position: relative;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* 安全区装饰线 */
      .wl-safe-line {
        position: absolute; left: 0; right: 0;
        top: ${safeLineTop}; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(180,180,190,0.4), transparent);
        z-index: 20; pointer-events: none;
      }

      /* ── 顶部导航 ── */
      .wl-nav {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 18px 8px;
        padding-top: calc(${safeLineTop} + 12px);
        position: relative; z-index: 15;
      }
      .wl-back {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.9); border: 1px solid rgba(0,0,0,0.06);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .2s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      }
      .wl-back:active { transform: scale(0.88); background: #f0f0f4; }
      .wl-nav-title { text-align: center; flex: 1; }
      .wl-nav-title h3 { font-size: 16px; font-weight: 900; color: #1a1a2e; letter-spacing: 0.5px; margin: 0; }
      .wl-nav-title span { font-size: 9px; color: #a0a4b0; font-weight: 600; letter-spacing: 2.5px; }

      /* ═══════════ 总资产卡片（黑金银行卡风格）═══════════ */
      .wl-card-section { padding: 8px 18px 0; }

      .wl-gold-card {
        position: relative; border-radius: 20px; overflow: hidden;
        min-height: 190px;
        background: linear-gradient(145deg, #1a1a26 0%, #12121c 35%, #0c0c14 70%, #08080e 100%);
        box-shadow:
          0 8px 32px rgba(0,0,0,0.35),
          0 2px 8px rgba(0,0,0,0.2),
          inset 0 1px 1px rgba(255,255,255,0.05);
      }

      /* 卡片顶部高光 */
      .wl-gold-card::before {
        content: ''; position: absolute;
        top: 0; left: 4%; right: 4%; height: 60%;
        border-radius: 20px 20px 50% 50% / 20px 20px 35% 35%;
        background: linear-gradient(180deg, rgba(212,185,140,0.10) 0%, rgba(212,185,140,0.01) 100%);
        pointer-events: none;
      }

      /* 金色流动边框 */
      .wl-card-border {
        position: absolute; inset: 1px; border-radius: 19px; padding: 1px;
        background: linear-gradient(120deg,
          rgba(200,175,120,0) 0%, rgba(218,195,150,0.35) 20%,
          rgba(235,210,165,0.55) 40%, rgba(245,225,185,0.65) 55%,
          rgba(235,210,165,0.55) 70%, rgba(218,195,150,0.35) 85%,
          rgba(200,175,120,0) 100%);
        background-size: 220% 100%;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        animation: wlFlowBorder 8s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes wlFlowBorder {
        0% { background-position: 220% 0; }
        100% { background-position: -220% 0; }
      }

      /* 卡片内部内容 */
      .wl-card-body {
        position: relative; z-index: 3;
        padding: 24px 22px 20px;
        display: flex; flex-direction: column; height: 100%;
        min-height: 190px;
      }

      /* 卡片顶部行 */
      .wl-card-top { display: flex; align-items: center; justify-content: space-between; }
      .wl-card-brand { display: flex; align-items: center; gap: 8px; }
      .wl-card-logo {
        width: 32px; height: 32px; border-radius: 8px;
        background: linear-gradient(135deg, rgba(212,185,140,0.2), rgba(212,185,140,0.05));
        border: 1px solid rgba(212,185,140,0.15);
        display: flex; align-items: center; justify-content: center;
      }
      .wl-card-logo svg { width: 18px; height: 18px; stroke: #d4b98c; stroke-width: 1.5; fill: none; }
      .wl-card-brand-name { font-size: 12px; color: rgba(212,185,140,0.8); font-weight: 700; letter-spacing: 1.5px; }
      .wl-card-chip {
        width: 40px; height: 30px; border-radius: 5px;
        background: linear-gradient(135deg, rgba(212,185,140,0.25), rgba(212,185,140,0.08));
        border: 1px solid rgba(212,185,140,0.2);
        display: flex; align-items: center; justify-content: center;
      }
      .wl-card-chip svg { width: 26px; height: 20px; stroke: #d4b98c; stroke-width: 1.2; fill: none; opacity: 0.5; }

      /* 余额主体 */
      .wl-card-balance { margin-top: 18px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
      .wl-balance-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 600; letter-spacing: 1px; margin-bottom: 6px; }
      .wl-balance-num {
        font-size: 42px; font-weight: 900; color: #fff;
        letter-spacing: -1.5px; line-height: 1;
        text-shadow: 0 2px 12px rgba(0,0,0,0.5);
      }
      .wl-balance-currency { font-size: 14px; color: rgba(212,185,140,0.7); font-weight: 700; margin-left: 8px; }

      /* 卡片底部行 */
      .wl-card-bottom {
        display: flex; align-items: flex-end; justify-content: space-between;
        margin-top: auto; padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .wl-card-type { font-size: 16px; font-weight: 800; color: rgba(212,185,140,0.6); letter-spacing: 4px; text-transform: uppercase; }
      .wl-card-no { font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Courier New', monospace; letter-spacing: 2px; }

      /* ═══════════ 双余额信息栏 ═══════════ */
      .wl-dual-balance {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        margin: 16px 18px 0;
      }
      .wl-bal-item {
        padding: 16px; border-radius: 16px;
        background: #fff; border: 1px solid rgba(0,0,0,0.05);
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        display: flex; flex-direction: column; gap: 8px;
      }
      .wl-bal-item-header { display: flex; align-items: center; gap: 8px; }
      .wl-bal-icon {
        width: 32px; height: 32px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
      }
      .wl-bal-icon.luma { background: linear-gradient(135deg, #1a1a26, #2a2a3a); }
      .wl-bal-icon.host { background: linear-gradient(135deg, #f0f4ff, #e0e8ff); }
      .wl-bal-icon svg { width: 18px; height: 18px; fill: none; stroke-width: 1.8; }
      .wl-bal-icon.luma svg { stroke: #d4b98c; }
      .wl-bal-icon.host svg { stroke: #4a6cf7; }
      .wl-bal-name { font-size: 12px; font-weight: 800; color: #374151; }
      .wl-bal-value { font-size: 22px; font-weight: 900; color: #111827; letter-spacing: -0.5px; }
      .wl-bal-unit { font-size: 10px; color: #9ca3af; font-weight: 600; margin-top: 2px; }
      .wl-bal-rate { font-size: 9px; color: #b0b6c0; font-weight: 500; margin-top: 1px; }

      /* ═══════════ 操作按钮行 ═══════════ */
      .wl-actions {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        margin: 16px 18px 0;
      }
      .wl-action-btn {
        position: relative; border-radius: 16px; padding: 18px 14px;
        text-align: center; cursor: pointer; border: none;
        overflow: hidden; transition: all .25s ease;
      }
      .wl-action-btn:active { transform: scale(0.96); }

      .wl-btn-out {
        background: linear-gradient(145deg, #1e1e2a, #14141e);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.06);
      }
      .wl-btn-in {
        background: linear-gradient(145deg, #2a2420, #1e1a16);
        box-shadow: 0 4px 16px rgba(180,150,90,0.15), inset 0 1px 1px rgba(255,255,255,0.07);
      }

      .wl-action-icon-wrap {
        width: 36px; height: 36px; margin: 0 auto 10px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
      }
      .wl-btn-out .wl-action-icon-wrap { background: rgba(255,255,255,0.08); }
      .wl-btn-in .wl-action-icon-wrap { background: rgba(212,185,140,0.12); }
      .wl-action-icon-wrap svg { width: 20px; height: 20px; stroke-width: 1.8; fill: none; }
      .wl-btn-out .wl-action-icon-wrap svg { stroke: #d4b98c; }
      .wl-btn-in .wl-action-icon-wrap svg { stroke: #e8d5a8; }

      .wl-action-name { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
      .wl-action-sub { font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 4px; font-weight: 500; }

      /* ═══════════ 流水区域 ═══════════ */
      .wl-section-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 22px 18px 10px;
      }
      .wl-section-head h4 { font-size: 15px; font-weight: 900; color: #1a1a2e; margin: 0; }
      .wl-section-badge {
        font-size: 9px; color: #9ca3af; background: rgba(0,0,0,0.04);
        padding: 3px 10px; border-radius: 20px; font-weight: 600;
      }

      .wl-ledger { padding: 0 18px 100px; display: flex; flex-direction: column; gap: 8px; }

      .wl-tx {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-radius: 14px;
        background: #fff; border: 1px solid rgba(0,0,0,0.04);
        transition: all .2s;
      }
      .wl-tx:active { background: #f8f9fb; }

      .wl-tx-left { display: flex; align-items: center; gap: 12px; }
      .wl-tx-icon {
        width: 38px; height: 38px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .wl-tx-icon.income { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
      .wl-tx-icon.cashout { background: linear-gradient(135deg, #fffbeb, #fef3c7); }
      .wl-tx-icon.recharge { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
      .wl-tx-icon.expense { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
      .wl-tx-icon svg { width: 18px; height: 18px; stroke-width: 2; fill: none; }
      .wl-tx-icon.income svg { stroke: #059669; }
      .wl-tx-icon.cashout svg { stroke: #d97706; }
      .wl-tx-icon.recharge svg { stroke: #2563eb; }
      .wl-tx-icon.expense svg { stroke: #dc2626; }

      .wl-tx-info .tx-title { font-size: 13px; font-weight: 800; color: #1f2937; }
      .wl-tx-info .tx-meta { font-size: 10px; color: #9ca3af; margin-top: 2px; font-weight: 500; }

      .wl-tx-amount { font-size: 14px; font-weight: 900; flex-shrink: 0; }
      .wl-tx-amount.pos { color: #059669; }
      .wl-tx-amount.neg { color: #dc2626; }
      .wl-tx-amount.warn { color: #d97706; }

      .wl-empty {
        text-align: center; padding: 48px 20px 60px;
      }
      .wl-empty-icon {
        width: 56px; height: 56px; margin: 0 auto 14px;
        border-radius: 50%; background: rgba(0,0,0,0.03);
        display: flex; align-items: center; justify-content: center;
      }
      .wl-empty-icon svg { width: 26px; height: 26px; stroke: #d1d5db; stroke-width: 1.5; fill: none; }
      .wl-empty-text { font-size: 13px; font-weight: 700; color: #9ca3af; }
      .wl-empty-sub { font-size: 11px; color: #d1d5db; margin-top: 4px; }

      /* ═══════════ 提现弹窗 ═══════════ */
      .wl-modal-mask {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        z-index: 200; display: flex; align-items: flex-end; justify-content: center;
        backdrop-filter: blur(4px);
      }
      .wl-modal {
        width: 100%; max-width: 420px;
        background: #fff; border-radius: 24px 24px 0 0;
        padding: 24px 22px 40px;
        animation: wlSlideUp .3s ease;
      }
      @keyframes wlSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .wl-modal-handle {
        width: 40px; height: 4px; border-radius: 2px;
        background: #e0e0e6; margin: 0 auto 20px;
      }
      .wl-modal-title { font-size: 18px; font-weight: 900; color: #1a1a2e; text-align: center; margin-bottom: 6px; }
      .wl-modal-sub { font-size: 12px; color: #9ca3af; text-align: center; margin-bottom: 24px; }

      .wl-modal-bal-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-radius: 12px;
        background: #f8f9fb; margin-bottom: 20px;
      }
      .wl-modal-bal-label { font-size: 12px; color: #6b7280; font-weight: 600; }
      .wl-modal-bal-val { font-size: 18px; font-weight: 900; color: #111827; }

      .wl-modal-input-wrap {
        position: relative; margin-bottom: 20px;
      }
      .wl-modal-input-wrap::before {
        content: '¥'; position: absolute; left: 16px; top: 50%;
        transform: translateY(-50%);
        font-size: 20px; font-weight: 900; color: #9ca3af;
      }
      .wl-modal-input {
        width: 100%; padding: 16px 16px 16px 40px;
        border: 2px solid #e5e7eb; border-radius: 14px;
        font-size: 20px; font-weight: 900; color: #111827;
        outline: none; transition: border-color .2s;
        background: #fff;
      }
      .wl-modal-input:focus { border-color: #d4b98c; }
      .wl-modal-input::placeholder { color: #d1d5db; font-weight: 500; }

      .wl-modal-rate {
        text-align: center; font-size: 11px; color: #9ca3af;
        margin-bottom: 20px; padding: 8px;
        background: rgba(212,185,140,0.08); border-radius: 8px;
      }

      .wl-modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .wl-modal-btn {
        padding: 14px; border-radius: 14px; border: none;
        font-size: 14px; font-weight: 800; cursor: pointer;
        transition: all .2s;
      }
      .wl-modal-btn:active { transform: scale(0.96); }
      .wl-modal-btn.cancel { background: #f3f4f6; color: #6b7280; }
      .wl-modal-btn.confirm {
        background: linear-gradient(145deg, #1e1e2a, #14141e);
        color: #d4b98c;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .wl-modal-hint { font-size: 10px; color: #d1d5db; text-align: center; margin-top: 12px; }
    </style>

    <!-- 安全区装饰线 -->
    <div class="wl-safe-line"></div>

    <!-- 导航栏 -->
    <div class="wl-nav">
      <div class="wl-back" onclick="closeWalletPageView()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </div>
      <div class="wl-nav-title">
        <h3>我的钱包</h3>
        <span>LUMA WALLET</span>
      </div>
      <div style="width:36px"></div>
    </div>

    <!-- 黑金总资产卡 -->
    <div class="wl-card-section">
      <div class="wl-gold-card">
        <div class="wl-card-border"></div>
        <div class="wl-card-body">
          <div class="wl-card-top">
            <div class="wl-card-brand">
              <div class="wl-card-logo">
                <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <span class="wl-card-brand-name">LUMA</span>
            </div>
            <div class="wl-card-chip">
              <svg viewBox="0 0 24 16"><rect x="2" y="3" width="20" height="10" rx="2"/><line x1="6" y1="7" x2="18" y2="7"/><line x1="6" y1="10" x2="12" y2="10"/></svg>
            </div>
          </div>
          <div class="wl-card-balance">
            <div class="wl-balance-label">LUMA 币资产</div>
            <div>
              <span class="wl-balance-num" id="pageRevenueBalance">0</span>
              <span class="wl-balance-currency">LUMA</span>
            </div>
          </div>
          <div class="wl-card-bottom">
            <span class="wl-card-type">Gold Card</span>
            <span class="wl-card-no">**** **** **** LUMA</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 双余额栏 -->
    <div class="wl-dual-balance">
      <div class="wl-bal-item">
        <div class="wl-bal-item-header">
          <div class="wl-bal-icon luma">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h6M9 14h6"/></svg>
          </div>
          <span class="wl-bal-name">LUMA 币</span>
        </div>
        <div class="wl-bal-value" id="wlLumaBalance">0</div>
        <div class="wl-bal-unit">直播收益 · 充值余额</div>
      </div>
      <div class="wl-bal-item">
        <div class="wl-bal-item-header">
          <div class="wl-bal-icon host">
            <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>
          </div>
          <span class="wl-bal-name">余额</span>
        </div>
        <div class="wl-bal-value" id="wlHostBalance">0.00</div>
        <div class="wl-bal-rate">1 : 10 LUMA</div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="wl-actions">
      <div class="wl-action-btn wl-btn-out" onclick="openWithdrawModal()">
        <div class="wl-action-icon-wrap">
          <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </div>
        <div class="wl-action-name">提现</div>
        <div class="wl-action-sub">LUMA → 余额</div>
      </div>
      <div class="wl-action-btn wl-btn-in" onclick="openRechargeModal()">
        <div class="wl-action-icon-wrap">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </div>
        <div class="wl-action-name">充值</div>
        <div class="wl-action-sub">余额 → LUMA</div>
      </div>
    </div>

    <!-- 流水标题 -->
    <div class="wl-section-head">
      <h4>交易流水</h4>
      <span class="wl-section-badge" id="wlTxCount">0 笔记录</span>
    </div>

    <!-- 流水列表 -->
    <div class="wl-ledger" id="transactionLedgerContainer"></div>

    <!-- 提现弹窗（默认隐藏） -->
    <div id="withdrawModal" class="wl-modal-mask" style="display:none" onclick="if(event.target===this)closeWithdrawModal()">
      <div class="wl-modal">
        <div class="wl-modal-handle"></div>
        <div class="wl-modal-title">提现到余额</div>
        <div class="wl-modal-sub">将 LUMA 币提现为宿主虚拟货币</div>

        <div class="wl-modal-bal-row">
          <span class="wl-modal-bal-label">当前 LUMA 币</span>
          <span class="wl-modal-bal-val" id="withdrawLumaBal">0</span>
        </div>

        <div class="wl-modal-input-wrap">
          <input type="number" class="wl-modal-input" id="withdrawAmountInput"
                 placeholder="输入提现金额" min="1" step="1">
        </div>

        <div class="wl-modal-rate">
          汇率：1 余额 = 10 LUMA 币 · 实际到账 <span id="withdrawPreview">0.00</span> 余额
        </div>

        <div class="wl-modal-actions">
          <button class="wl-modal-btn cancel" onclick="closeWithdrawModal()">取消</button>
          <button class="wl-modal-btn confirm" onclick="confirmWithdraw()">确认提现</button>
        </div>

        <div class="wl-modal-hint">提现将扣除 LUMA 币并增加宿主余额，操作不可撤销</div>
      </div>
    </div>
  `;
}

/**
 * 打开钱包页面
 * 先渲染 UI，再更新数据，最后显示页面 + 安全区定位线
 */
async function openWalletPageView() {
  // 1. 渲染钱包界面 DOM
  renderWalletUI();

  // 2. 更新 LUMA 币余额
  const lumaBal = window.currentWalletBalance || revenueBalance || 0;
  const pageRev = document.getElementById('pageRevenueBalance');
  if (pageRev) pageRev.textContent = lumaBal.toLocaleString();
  const lumaEl = document.getElementById('wlLumaBalance');
  if (lumaEl) lumaEl.textContent = lumaBal.toLocaleString();

  // 3. 异步获取宿主余额并显示
  refreshHostBalanceDisplay();

  // 4. 渲染流水
  renderTransactionLedger();

  // 5. 显示页面
  if (window.PageStack) {
    window.PageStack.open('walletPageView');
  } else {
    const page = document.getElementById('walletPageView');
    if (page) page.classList.remove('hidden');
  }

  // 6. 安全区定位线（调试用，纯黑线无黄标）
  showSafeAreaGuides('walletPageView');
}
window.openWalletPageView = openWalletPageView;

function closeWalletPageView() {
  hideSafeAreaGuides();
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    const page = document.getElementById('walletPageView');
    if (page) page.classList.add('hidden');
  }
}
window.closeWalletPageView = closeWalletPageView;

/**
 * 渲染交易流水列表（新版样式）
 */
function renderTransactionLedger() {
  const box = document.getElementById('transactionLedgerContainer');
  if (!box) return;

  if (!transactionLedger || transactionLedger.length === 0) {
    box.innerHTML = `
      <div class="wl-empty">
        <div class="wl-empty-icon">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>
        </div>
        <div class="wl-empty-text">暂无流水记录</div>
        <div class="wl-empty-sub">充值或提现后记录将显示在这里</div>
      </div>
    `;
    const badge = document.getElementById('wlTxCount');
    if (badge) badge.textContent = '0 笔记录';
    return;
  }

  const iconMap = {
    income:  '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    recharge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    cashout: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    expense: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
  };

  box.innerHTML = transactionLedger.map(item => {
    const type = item.type || 'expense';
    const isPos = (type === 'income' || type === 'recharge');
    const amtCls = isPos ? 'pos' : (type === 'cashout' ? 'warn' : 'neg');
    const sign = isPos ? '+' : '-';
    return `
      <div class="wl-tx">
        <div class="wl-tx-left">
          <div class="wl-tx-icon ${type}">${iconMap[type] || iconMap.expense}</div>
          <div class="wl-tx-info">
            <div class="tx-title">${item.title || '未知交易'}</div>
            <div class="tx-meta">${item.time || ''} ${item.targetName ? '· ' + item.targetName : ''}</div>
          </div>
        </div>
        <div class="wl-tx-amount ${amtCls}">${sign}${(item.amount || 0).toLocaleString()} LUMA</div>
      </div>
    `;
  }).join('');

  const badge = document.getElementById('wlTxCount');
  if (badge) badge.textContent = `${transactionLedger.length} 笔记录`;
}

// ═══════════ 提现功能 ═══════════

function openWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  if (!modal) return;
  // 更新弹窗里的 LUMA 币余额显示
  const balEl = document.getElementById('withdrawLumaBal');
  if (balEl) balEl.textContent = (window.currentWalletBalance || 0).toLocaleString();
  // 清空输入
  const input = document.getElementById('withdrawAmountInput');
  if (input) input.value = '';
  const preview = document.getElementById('withdrawPreview');
  if (preview) preview.textContent = '0.00';
  modal.style.display = 'flex';

  // 监听输入实时计算到账金额
  if (input) {
    input.oninput = function() {
      const val = parseInt(this.value) || 0;
      const preview = document.getElementById('withdrawPreview');
      if (preview) preview.textContent = (val / 10).toFixed(2);
    };
  }
}
window.openWithdrawModal = openWithdrawModal;

function closeWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  if (modal) modal.style.display = 'none';
}
window.closeWithdrawModal = closeWithdrawModal;

async function confirmWithdraw() {
  const input = document.getElementById('withdrawAmountInput');
  const amount = parseInt(input?.value) || 0;

  if (amount <= 0) {
    api.ui.toast("请输入有效的提现金额");
    return;
  }

  const currentLuma = window.currentWalletBalance || 0;
  if (amount > currentLuma) {
    api.ui.toast("LUMA 币余额不足");
    return;
  }

  // 计算到账金额（10:1）
  const hostAmount = amount / 10;

  // 扣除 LUMA 币
  window.currentWalletBalance = currentLuma - amount;
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }

  // 增加宿主余额（通过 SDK）
  try {
    // 先获取当前宿主余额
    const wallet = await api.wallet.get();
    const currentHostBal = wallet?.accounts?.[0]?.balance ?? 0;
    // 注意：SDK 的 wallet.pay 是扣款，没有直接的"加钱"API
    // 提现到宿主余额 = 宿主余额增加，这需要宿主端支持
    // 目前 SDK 只有 wallet.pay（扣款），没有 wallet.deposit（存款）
    // 所以提现在 APP 端只做 LUMA 币扣除 + 记录流水
    // 宿主余额的增加需要宿主端配合（或用户手动确认）
    console.log(`[Wallet] 提现请求: ${amount} LUMA → ${hostAmount} 宿主余额`);
    console.log(`[Wallet] 宿主当前余额: ${currentHostBal}`);
  } catch (e) {
    console.warn('[Wallet] 获取宿主钱包信息失败:', e.message);
  }

  // 记录流水
  await recordTransaction(`提现 ${amount.toLocaleString()} LUMA 币`, "cashout", amount, "余额");

  // 关闭弹窗
  closeWithdrawModal();

  // 刷新钱包界面数据
  const lumaEl = document.getElementById('pageRevenueBalance');
  if (lumaEl) lumaEl.textContent = window.currentWalletBalance.toLocaleString();
  const lumaBalEl = document.getElementById('wlLumaBalance');
  if (lumaBalEl) lumaBalEl.textContent = window.currentWalletBalance.toLocaleString();

  // 刷新宿主余额显示
  refreshHostBalanceDisplay();

  // 同步其他余额显示
  if (typeof window.syncWalletDisplays === 'function') window.syncWalletDisplays();

  api.ui.toast(`✅ 成功提现 ${amount.toLocaleString()} LUMA 币 → ${hostAmount.toFixed(2)} 余额`);
}
window.confirmWithdraw = confirmWithdraw;

// ═══════════ 旧版提现（兼容保留） ═══════════

async function handleCashOutAll() {
  // 直接打开提现弹窗，默认填全部余额
  openWithdrawModal();
  const input = document.getElementById('withdrawAmountInput');
  if (input) {
    input.value = window.currentWalletBalance || 0;
    input.dispatchEvent(new Event('input'));
  }
}
window.handleCashOutAll = handleCashOutAll;

// 6. 充值中心模态窗
function openRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (modal) modal.classList.remove('hidden');
  syncWalletDisplays();
  selectRechargeTier(600, 6);
}
window.openRechargeModal = openRechargeModal;

function closeRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (modal) modal.classList.add('hidden');
}
window.closeRechargeModal = closeRechargeModal;

function selectRechargeTier(amount, price) {
  selectedRechargeAmount = amount;
  selectedRechargePrice = price;
  
  document.querySelectorAll('.recharge-tier-card').forEach(c => c.classList.remove('active'));
  const targetCard = document.getElementById(`rechargeTier_${amount}`);
  if (targetCard) targetCard.classList.add('active');

  const customInput = document.getElementById('inputCustomRechargeAmount');
  if (customInput) customInput.value = '';

  updateRechargeButtonText();
}
window.selectRechargeTier = selectRechargeTier;

function handleCustomRechargeInput(val) {
  const num = parseInt(val) || 0;
  if (num > 0) {
    selectedRechargeAmount = num;
    selectedRechargePrice = (num / 100).toFixed(2);
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
  // 充值 = 宿主余额扣款 → LUMA 币增加
  // 汇率：1 宿主货币 = 10 LUMA 币
  const hostCost = addCoins / 10;

  // 1. 先调用宿主钱包扣款
  try {
    const wallet = await api.wallet.get();
    const accountId = wallet?.accounts?.[0]?.id;
    if (!accountId) {
      api.ui.toast("未找到可用的付款账户");
      return;
    }
    const payResult = await api.wallet.pay({
      amount: hostCost,
      accountId: accountId,
      title: 'LUMA 充值',
      detail: `充值 ${addCoins.toLocaleString()} LUMA 币`,
      category: '充值',
      relatedOrderId: `recharge_${Date.now()}`
    });
    if (!payResult?.ok) {
      api.ui.toast(payResult?.error || "宿主余额不足，充值失败");
      return;
    }
  } catch (e) {
    console.warn('[Wallet] 宿主扣款失败:', e.message);
    api.ui.toast("充值失败：" + e.message);
    return;
  }

  // 2. 扣款成功，增加 LUMA 币
  window.currentWalletBalance = (window.currentWalletBalance || 0) + addCoins;
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }

  // 3. 记录流水
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`充值 ${addCoins.toLocaleString()} LUMA 币`, "recharge", addCoins, "LUMA 充值中心");
  }

  // 4. 刷新界面
  syncWalletDisplays();
  closeRechargeModal();

  // 5. 刷新钱包页面数据（如果钱包页面打开着）
  const walletPage = document.getElementById('walletPageView');
  if (walletPage && !walletPage.classList.contains('hidden')) {
    const pageRev = document.getElementById('pageRevenueBalance');
    if (pageRev) pageRev.textContent = window.currentWalletBalance.toLocaleString();
    const lumaBalEl = document.getElementById('wlLumaBalance');
    if (lumaBalEl) lumaBalEl.textContent = window.currentWalletBalance.toLocaleString();
    refreshHostBalanceDisplay();
    renderTransactionLedger();
  }

  api.ui.toast(`🎉 充值成功！-${hostCost.toFixed(2)} 余额 → +${addCoins.toLocaleString()} LUMA 币`);
}
window.submitExecuteRecharge = submitExecuteRecharge;

function syncWalletDisplays() {
  const bal = window.currentWalletBalance || 0;
  const giftBal = document.getElementById('giftWalletBalance');
  if (giftBal) giftBal.textContent = `💎 ${bal.toLocaleString()} LUMA 币`;
  
  const pageBal = document.getElementById('pageRevenueBalance');
  if (pageBal) pageBal.textContent = bal.toLocaleString();

  const revEl = document.getElementById('liveRevenueAmount');
  if (revEl) revEl.textContent = bal.toLocaleString();
  
  const modalBal = document.getElementById('rechargeModalBalance');
  if (modalBal) modalBal.textContent = bal.toLocaleString();
}
window.syncWalletDisplays = syncWalletDisplays;


// =========================================================================
// 【统一页面栈注册】关注列表 + 钱包
// =========================================================================
if (window.PageStack) {
  window.PageStack.register('followListPageView', {
    animationType: 'slide-right',
  });
  window.PageStack.register('walletPageView', {
    animationType: 'slide-right',
  });
}


// =========================================================================
// 安全区定位线（调试工具）
// 只显示纯色细线，无标签文字
// =========================================================================
function showSafeAreaGuides(containerId) {
  hideSafeAreaGuides();
  const container = document.getElementById(containerId);
  if (!container) return;

  const style = getComputedStyle(document.documentElement);
  const safeTop = style.getPropertyValue('--ai-phone-app-safe-top').trim() || '88px';
  const safeBottom = style.getPropertyValue('--ai-phone-app-safe-bottom').trim() || '24px';

  // 顶部安全区线（纯黑色细线，无标签）
  const topLine = document.createElement('div');
  topLine.id = '__safe_guide_top';
  topLine.style.cssText = `position:absolute;top:${safeTop};left:0;right:0;height:1px;background:#000;z-index:9999;pointer-events:none`;

  // 底部安全区线（纯黑色细线，无标签）
  const bottomLine = document.createElement('div');
  bottomLine.id = '__safe_guide_bottom';
  bottomLine.style.cssText = `position:absolute;bottom:${safeBottom};left:0;right:0;height:1px;background:#000;z-index:9999;pointer-events:none`;

  // 容器需要 relative 定位才能让 absolute 生效
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
    container.dataset.__safeOldPos = 'static';
  }

  container.appendChild(topLine);
  container.appendChild(bottomLine);

  console.log(`[SafeArea] safe-top=${safeTop}, safe-bottom=${safeBottom}`);
}

function hideSafeAreaGuides() {
  document.querySelectorAll('[id^="__safe_guide_"]').forEach(el => el.remove());
  document.querySelectorAll('span').forEach(s => {
    if (s.textContent?.includes('safe-top:') || s.textContent?.includes('safe-bottom:')) s.remove();
  });
  document.querySelectorAll('[data-__safe-old-pos]').forEach(el => {
    el.style.position = '';
    delete el.dataset.__safeOldPos;
  });
}
window.showSafeAreaGuides = showSafeAreaGuides;
window.hideSafeAreaGuides = hideSafeAreaGuides;
