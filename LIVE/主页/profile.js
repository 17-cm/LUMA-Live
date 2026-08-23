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
  const myFans = window.LumaFansManager ? window.LumaFansManager.getFans('user') : (userProfileData.fans || 128);
  userProfileData.fans = myFans;
  const statFanEl = document.getElementById('statFanCount');
  if (statFanEl) {
    statFanEl.textContent = window.LumaDataHub ? window.LumaDataHub.formatNumber(myFans) : myFans;
  }
  const statLikeEl = document.getElementById('statLikeCount');
  if (statLikeEl) statLikeEl.textContent = (userProfileData.likes || 1240).toLocaleString();
  const statMedalEl = document.getElementById('statMedalCount');
  if (statMedalEl) statMedalEl.textContent = userProfileData.medals || 3;
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
function openFollowListPageView() {
  const container = document.getElementById('followListContentContainer');
  if (!container) return;
  const followedIds = window.followedHosts || [];
  const chars = window.allCharacters || [];
  const lives = window.liveList || [];
  const follows = followedIds.map(id => {
    const fromChars = chars.find(c => c.id === id || c.characterId === id);
    if (fromChars) return fromChars;
    const fromLives = lives.find(l => l.characterId === id || l.id === id);
    if (fromLives) return {
      id: fromLives.characterId || fromLives.id,
      name: fromLives.name,
      avatar: fromLives.avatar || fromLives.cover,
      tags: [fromLives.category, fromLives.subTag].filter(Boolean)
    };
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
      aggregatedList = window.LumaGuardManager.getTopFansSpentOnMe().map(item => ({
        targetName: item.fromName || '主播',
        avatar: item.fromAvatar || window.LumaGuardManager.getAvatarById(item.fromId),
        tag: item.tag || '👑 铁杆打赏',
        totalAmount: item.totalAmount || 0,
        giftCount: item.giftCount || 1,
        lastTime: item.lastTime || '活跃'
      }));
    } else {
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
// 货币体系：LUMA币(内部) / 宿主余额(系统) / 汇率1:10
// 提现 = LUMA币减少 + 宿主扣款(正数) / 充值 = 宿主扣款 + LUMA币增加
// =========================================================================
let _cachedHostBalance = null;
let _cachedHostBalanceTime = 0;
const HOST_BALANCE_CACHE_MS = 10000;
async function getHostWalletBalance() {
  if (_cachedHostBalance !== null && (Date.now() - _cachedHostBalanceTime) < HOST_BALANCE_CACHE_MS) {
    return _cachedHostBalance;
  }
  try {
    const wallet = await api.wallet.get();
    const bal = wallet?.accounts?.[0]?.balance ?? 0;
    _cachedHostBalance = typeof bal === 'number' ? bal : parseFloat(bal) || 0;
    _cachedHostBalanceTime = Date.now();
    return _cachedHostBalance;
  } catch (e) {
    console.warn('[Wallet] 获取宿主余额失败:', e.message);
    return _cachedHostBalance ?? 0;
  }
}
async function refreshHostBalanceDisplay() {
  _cachedHostBalance = null;
  const bal = await getHostWalletBalance();
  const el = document.getElementById('wlHostBalance');
  if (el) el.textContent = bal.toFixed(2);
}
function renderWalletUI() {
  const container = document.getElementById('walletPageView');
  if (!container) return;
  const style = getComputedStyle(document.documentElement);
  const safeTopVal = style.getPropertyValue('--ai-phone-app-safe-top').trim() || '88px';
  const safeLineTop = `calc(${safeTopVal} + 6px)`;
  container.innerHTML = `
    <style>
      #walletPageView { background: #f6f7f9 !important; position: relative; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .wl-safe-line { position: absolute; left: 0; right: 0; top: ${safeLineTop}; height: 1px; background: linear-gradient(90deg, transparent, rgba(200,200,210,0.12), transparent); z-index: 20; pointer-events: none; }
      .wl-nav { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 8px; padding-top: calc(${safeLineTop} + 12px); position: relative; z-index: 15; }
      .wl-back { width: 36px; height: 36px; border-radius: 50%; background: #fff; border: 1px solid #e8eaef; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
      .wl-back:active { transform: scale(0.88); background: #f0f2f5; }
      .wl-back svg { width: 18px; height: 18px; stroke: #4a4f5a; stroke-width: 2; fill: none; }
      .wl-nav-title { text-align: center; flex: 1; }
      .wl-nav-title h3 { font-size: 16px; font-weight: 700; color: #1a1d23; letter-spacing: .3px; margin: 0; }
      .wl-nav-title span { font-size: 9px; color: #8b909b; font-weight: 500; letter-spacing: 2px; display: block; margin-top: 2px; }
      .wl-nav-right { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
      .wl-nav-right svg { width: 18px; height: 18px; stroke: #8b909b; stroke-width: 1.8; fill: none; }
      .wl-body { padding: 6px 16px 100px; }
      .wl-asset-card { position: relative; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, #18181b 0%, #09090b 100%); border: 1px solid rgba(245, 158, 11, 0.25); box-shadow: 0 16px 36px -6px rgba(0,0,0,.4), inset 0 1px 1px rgba(255,255,255,.2); padding: 20px; }
      .wl-asset-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg, rgba(245,158,11,.3), rgba(245,158,11,.6), rgba(245,158,11,.3)); }
      .wl-asset-card::after { content:''; position:absolute; top:-25%; right:-8%; width:150px; height:150px; background: radial-gradient(circle, rgba(212,185,140,.14), transparent 65%); pointer-events: none; }
      .wl-ac-head { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; }
      .wl-ac-label { display: flex; align-items: center; gap: 7px; }
      .wl-ac-label .dot { width: 5px; height: 5px; border-radius: 50%; background: #d4b98c; }
      .wl-ac-label span { font-size: 11px; font-weight: 600; color: rgba(212,185,140,.75); letter-spacing: .5px; }
      .wl-ac-eye { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #8b909b; cursor: pointer; transition: color .2s; background: none; border: none; }
      .wl-ac-eye:active { color: #b0b4bc; }
      .wl-ac-eye svg { width: 16px; height: 16px; stroke-width: 1.8; fill: none; }
      .wl-ac-amount { margin-top: 14px; position: relative; z-index: 2; }
      .wl-ac-k { font-size: 10px; font-weight: 500; color: rgba(255,255,255,.35); letter-spacing: .5px; }
      .wl-ac-row { display: flex; align-items: baseline; gap: 3px; margin-top: 6px; }
      .wl-ac-cur { font-size: 16px; font-weight: 700; color: rgba(212,185,140,.8); }
      .wl-ac-val { font-size: 34px; font-weight: 800; color: #fff; letter-spacing: -1px; line-height: 1; }
      .wl-ac-val.hidden { filter: blur(8px); user-select: none; }
      .wl-ac-unit { font-size: 10px; font-weight: 500; color: rgba(255,255,255,.3); margin-left: 3px; }
      .wl-ac-divider { height: 1px; background: rgba(255,255,255,.07); margin: 16px -20px 14px; }
      .wl-ac-stats { display: flex; position: relative; z-index: 2; }
      .wl-ac-stat { flex: 1; }
      .wl-ac-stat + .wl-ac-stat { border-left: 1px solid rgba(255,255,255,.07); padding-left: 14px; margin-left: 14px; }
      .wl-ac-stat-k { font-size: 10px; font-weight: 500; color: rgba(255,255,255,.35); letter-spacing: .3px; }
      .wl-ac-stat-v { font-size: 17px; font-weight: 700; margin-top: 4px; display: flex; align-items: baseline; gap: 2px; }
      .wl-ac-stat-v .s { font-size: 9px; font-weight: 500; color: rgba(255,255,255,.3); }
      .wl-ac-stat-v.amber { color: #d4b98c; }
      .wl-ac-stat-v.rose { color: #e8a0b0; }
      .wl-ac-stat-sub { font-size: 9px; color: rgba(255,255,255,.25); margin-top: 2px; font-weight: 500; }
      .wl-quick { display: flex; gap: 10px; margin-top: 14px; }
      .wl-quick-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 14px 4px; border-radius: 16px; background: #fff; border: 1px solid #e8eaef; cursor: pointer; transition: transform .15s, box-shadow .2s; }
      .wl-quick-item:active { transform: scale(.95); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
      .wl-qi-ic { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
      .wl-qi-ic svg { width: 19px; height: 19px; stroke-width: 1.8; fill: none; stroke: currentColor; }
      .wl-qi-ic.rose { background: #fdf0f3; color: #e85a7a; }
      .wl-qi-ic.amber { background: #fdf6e9; color: #d4a24e; }
      .wl-qi-ic.violet { background: #f3f0fb; color: #8b7bc9; }
      .wl-qi-ic.green { background: #eef7f2; color: #5ba88a; }
      .wl-qi-label { font-size: 12px; font-weight: 600; color: #4a4f5a; }
      .wl-sec-head { display: flex; align-items: center; justify-content: space-between; margin: 22px 2px 10px; }
      .wl-sec-title { font-size: 14px; font-weight: 700; color: #1a1d23; }
      .wl-sec-badge { font-size: 10px; color: #8b909b; background: rgba(0,0,0,.04); padding: 3px 10px; border-radius: 20px; font-weight: 600; }
      .wl-ledger { display: flex; flex-direction: column; gap: 8px; }
      .wl-tx { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-radius: 14px; background: #fff; border: 1px solid #eef0f4; transition: background .15s; }
      .wl-tx:active { background: #f8f9fb; }
      .wl-tx-left { display: flex; align-items: center; gap: 11px; }
      .wl-tx-icon { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .wl-tx-icon svg { width: 17px; height: 17px; stroke-width: 1.8; fill: none; }
      .wl-tx-icon.income { background: #eef7f2; }
      .wl-tx-icon.income svg { stroke: #5ba88a; }
      .wl-tx-icon.cashout { background: #f3f0fb; }
      .wl-tx-icon.cashout svg { stroke: #8b7bc9; }
      .wl-tx-icon.recharge { background: #fdf6e9; }
      .wl-tx-icon.recharge svg { stroke: #d4a24e; }
      .wl-tx-icon.expense { background: #fdf0f3; }
      .wl-tx-icon.expense svg { stroke: #e85a7a; }
      .wl-tx-info .tx-title { font-size: 13px; font-weight: 600; color: #1a1d23; }
      .wl-tx-info .tx-meta { font-size: 10px; color: #8b909b; margin-top: 2px; font-weight: 500; }
      .wl-tx-amount { font-size: 14px; font-weight: 700; flex-shrink: 0; letter-spacing: -.01em; }
      .wl-tx-amount.pos { color: #5ba88a; }
      .wl-tx-amount.neg { color: #1a1d23; }
      .wl-tx-amount.warn { color: #8b7bc9; }
      .wl-empty { text-align: center; padding: 40px 20px 50px; }
      .wl-empty-icon { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 50%; background: rgba(0,0,0,.03); display: flex; align-items: center; justify-content: center; }
      .wl-empty-icon svg { width: 24px; height: 24px; stroke: #c8ccd4; stroke-width: 1.5; fill: none; }
      .wl-empty-text { font-size: 13px; font-weight: 600; color: #8b909b; }
      .wl-empty-sub { font-size: 11px; color: #c0c4cc; margin-top: 4px; }
      .wl-modal-input { width: 140px; font-size: 30px; font-weight: 800; text-align: center; background: none; border: 0; outline: none; color: #1a1d23; letter-spacing: -.02em; }
      .wl-modal-input::placeholder { color: #d0d4dc; font-weight: 500; }
      .wl-wd-tier.active { border-color: #18181b !important; background: #18181b !important; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
      .wl-wd-tier.active > div:first-child { color: #d4b98c !important; }
      .wl-wd-tier.active > div:last-child { color: rgba(212,185,140,.6) !important; }
    </style>
    <div class="wl-safe-line"></div>
    <div class="wl-nav">
      <div class="wl-back" onclick="closeWalletPageView()"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></div>
      <div class="wl-nav-title"><h3>我的钱包</h3><span>LUMA WALLET</span></div>
      <div class="wl-nav-right"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
    </div>
    <div class="wl-body">
      <div class="wl-asset-card">
        <div class="wl-ac-head">
          <div class="wl-ac-label"><span class="dot"></span><span>总资产 (元)</span></div>
          <button class="wl-ac-eye" id="toggleWalletEye" aria-label="显示/隐藏"><svg id="walletEyeIcon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
        <div class="wl-ac-amount">
          <div class="wl-ac-k">账户余额</div>
          <div class="wl-ac-row"><span class="wl-ac-cur">¥</span><span class="wl-ac-val" id="wlHostBalance">0.00</span><span class="wl-ac-unit">CNY</span></div>
        </div>
        <div class="wl-ac-divider"></div>
        <div class="wl-ac-stats">
          <div class="wl-ac-stat"><div class="wl-ac-stat-k">可提现余额</div><div class="wl-ac-stat-v amber" id="pageRevenueBalance">0<span class="s"> 币</span></div><div class="wl-ac-stat-sub">LUMA 币</div></div>
          <div class="wl-ac-stat"><div class="wl-ac-stat-k">累计收益</div><div class="wl-ac-stat-v rose" id="wlRevenueTotal">0<span class="s"> 币</span></div><div class="wl-ac-stat-sub">直播收益</div></div>
        </div>
      </div>
      <div class="wl-quick">
        <div class="wl-quick-item" onclick="openRechargeModal()"><div class="wl-qi-ic rose"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><span class="wl-qi-label">充值</span></div>
        <div class="wl-quick-item" onclick="openWithdrawModal()"><div class="wl-qi-ic amber"><svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></div><span class="wl-qi-label">提现</span></div>
        <div class="wl-quick-item" onclick="api.ui.toast && api.ui.toast('转账功能开发中')"><div class="wl-qi-ic violet"><svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div><span class="wl-qi-label">转账</span></div>
        <div class="wl-quick-item" onclick="api.ui.toast && api.ui.toast('我的银行卡')"><div class="wl-qi-ic green"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><span class="wl-qi-label">银行卡</span></div>
      </div>
      <div class="wl-sec-head"><span class="wl-sec-title">交易流水</span><span class="wl-sec-badge" id="wlTxCount">0 笔记录</span></div>
      <div class="wl-ledger" id="transactionLedgerContainer"></div>
    </div>
    <div id="withdrawModal" class="hidden center-modal-backdrop" onclick="if(event.target===this)closeWithdrawModal()">
      <div class="center-modal-card p-5" style="max-width:380px;">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div><div class="text-base font-black text-slate-900">提现到余额</div><div class="text-[10px] text-slate-400 mt-0.5 font-medium">LUMA 币兑换宿主余额</div></div>
          <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer" onclick="closeWithdrawModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b909b" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
        </div>
        <div class="flex items-center justify-between bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100"><span class="text-xs text-slate-500 font-semibold">当前 LUMA 币</span><span class="text-lg font-black text-slate-900" id="withdrawLumaBal">0</span></div>
        <div class="text-[11px] text-slate-500 font-semibold mb-2">选择提现数量</div>
        <div class="grid grid-cols-2 gap-2 mb-3" id="withdrawQuickGrid">
          <div class="wl-wd-tier cursor-pointer rounded-xl border-2 border-slate-100 bg-white p-3 text-center transition active:scale-95" data-amount="100" onclick="selectWithdrawTier(100, this)"><div class="text-base font-black text-slate-900">100</div><div class="text-[9px] text-slate-400 mt-0.5">币 · ¥10</div></div>
          <div class="wl-wd-tier cursor-pointer rounded-xl border-2 border-slate-100 bg-white p-3 text-center transition active:scale-95" data-amount="500" onclick="selectWithdrawTier(500, this)"><div class="text-base font-black text-slate-900">500</div><div class="text-[9px] text-slate-400 mt-0.5">币 · ¥50</div></div>
          <div class="wl-wd-tier cursor-pointer rounded-xl border-2 border-slate-100 bg-white p-3 text-center transition active:scale-95" data-amount="1000" onclick="selectWithdrawTier(1000, this)"><div class="text-base font-black text-slate-900">1000</div><div class="text-[9px] text-slate-400 mt-0.5">币 · ¥100</div></div>
          <div class="wl-wd-tier cursor-pointer rounded-xl border-2 border-slate-100 bg-white p-3 text-center transition active:scale-95" data-amount="all" onclick="selectWithdrawTier('all', this)"><div class="text-base font-black text-slate-900">全部</div><div class="text-[9px] text-slate-400 mt-0.5">一键提现</div></div>
        </div>
        <div class="text-[11px] text-slate-500 font-semibold mb-2">自定义数量</div>
        <div class="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100 flex items-center gap-2"><input type="number" class="flex-1 bg-transparent border-0 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" id="withdrawCustomInput" placeholder="输入自定义数量" min="1" step="1" oninput="onWithdrawCustomInput(this.value)"><span class="text-xs text-slate-400 font-semibold">币</span></div>
        <div class="text-center text-[10px] text-slate-400 mb-4 py-2 bg-amber-50/60 rounded-lg">汇率：10 LUMA 币 = 1 元 · 实际到账 <b id="withdrawPreview" class="text-amber-600 font-bold">0.00</b> 元</div>
        <button class="w-full h-11 rounded-xl text-sm font-bold bg-slate-900 text-amber-400 border-0 cursor-pointer transition active:scale-95 disabled:opacity-40" id="withdrawConfirmBtn" onclick="confirmWithdraw()">确认提现</button>
        <div class="text-[10px] text-slate-300 text-center mt-3 leading-relaxed">提现将扣除 LUMA 币，操作不可撤销<br>提现免手续费</div>
      </div>
    </div>
    <div id="withdrawJokeModal" class="hidden center-modal-backdrop" onclick="if(event.target===this)closeWithdrawJokeModal()">
      <div class="center-modal-card p-6 text-center" style="max-width:320px;">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e85a7a" stroke-width="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div>
        <div class="text-base font-black text-slate-900 leading-relaxed mb-1">好吧~骗你的~</div>
        <div class="text-base font-black text-rose-500 leading-relaxed mb-1">还是扣款！</div>
        <div class="text-sm text-slate-500 font-medium mt-2 mb-5">你花了一笔冤枉钱！</div>
        <button class="w-full h-11 rounded-xl text-sm font-bold bg-slate-900 text-white border-0 cursor-pointer transition active:scale-95" onclick="closeWithdrawJokeModal()">知道了</button>
      </div>
    </div>
  `;
  const eyeBtn = document.getElementById('toggleWalletEye');
  const eyeIcon = document.getElementById('walletEyeIcon');
  const hostVal = document.getElementById('wlHostBalance');
  if (eyeBtn && eyeIcon && hostVal) {
    let _hidden = false;
    const _eyeOpen = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    const _eyeClose = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    eyeBtn.onclick = () => {
      _hidden = !_hidden;
      hostVal.classList.toggle('hidden', _hidden);
      eyeIcon.innerHTML = _hidden ? _eyeClose : _eyeOpen;
    };
  }
}
async function openWalletPageView() {
  renderWalletUI();
  const lumaBal = window.currentWalletBalance || revenueBalance || 0;
  const pageRev = document.getElementById('pageRevenueBalance');
  if (pageRev) pageRev.textContent = lumaBal.toLocaleString();
  const lumaEl = document.getElementById('wlLumaBalance');
  if (lumaEl) lumaEl.textContent = lumaBal.toLocaleString();
  refreshHostBalanceDisplay();
  const revEl = document.getElementById('wlRevenueTotal');
  if (revEl) {
    const earned = window.lumaEarnedRevenue || 0;
    revEl.innerHTML = earned.toLocaleString() + '<span class="s"> 币</span>';
  }
  renderTransactionLedger();
  if (window.PageStack) {
    window.PageStack.open('walletPageView');
  } else {
    const page = document.getElementById('walletPageView');
    if (page) page.classList.remove('hidden');
  }
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
function renderTransactionLedger() {
  const box = document.getElementById('transactionLedgerContainer');
  if (!box) return;
  if (!transactionLedger || transactionLedger.length === 0) {
    box.innerHTML = `
      <div class="wl-empty">
        <div class="wl-empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg></div>
        <div class="wl-empty-text">暂无流水记录</div>
        <div class="wl-empty-sub">充值或提现后记录将显示在这里</div>
      </div>
    `;
    const badge = document.getElementById('wlTxCount');
    if (badge) badge.textContent = '0 笔记录';
    return;
  }
  const iconMap = {
    income: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
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
          <div class="wl-tx-info"><div class="tx-title">${item.title || '未知交易'}</div><div class="tx-meta">${item.time || ''} ${item.targetName ? '· ' + item.targetName : ''}</div></div>
        </div>
        <div class="wl-tx-amount ${amtCls}">${sign}${(item.amount || 0).toLocaleString()} LUMA</div>
      </div>
    `;
  }).join('');
  const badge = document.getElementById('wlTxCount');
  if (badge) badge.textContent = `${transactionLedger.length} 笔记录`;
}
// ═══════════ 提现功能 ═══════════
let _selectedWithdrawAmount = 0;
function selectWithdrawTier(amount, el) {
  if (amount === 'all') {
    _selectedWithdrawAmount = window.currentWalletBalance || 0;
  } else {
    _selectedWithdrawAmount = amount;
  }
  document.querySelectorAll('.wl-wd-tier').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const customInput = document.getElementById('withdrawCustomInput');
  if (customInput) customInput.value = '';
  updateWithdrawPreview(_selectedWithdrawAmount);
}
function onWithdrawCustomInput(val) {
  const num = parseInt(val) || 0;
  if (num > 0) {
    _selectedWithdrawAmount = num;
    document.querySelectorAll('.wl-wd-tier').forEach(t => t.classList.remove('active'));
    updateWithdrawPreview(num);
  } else {
    _selectedWithdrawAmount = 0;
    updateWithdrawPreview(0);
  }
}
function updateWithdrawPreview(amount) {
  const preview = document.getElementById('withdrawPreview');
  if (preview) preview.textContent = (amount / 10).toFixed(2);
  const btn = document.getElementById('withdrawConfirmBtn');
  if (btn) btn.disabled = (amount <= 0);
}
function openWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  if (!modal) return;
  const balEl = document.getElementById('withdrawLumaBal');
  if (balEl) balEl.textContent = (window.currentWalletBalance || 0).toLocaleString();
  _selectedWithdrawAmount = 0;
  document.querySelectorAll('.wl-wd-tier').forEach(t => t.classList.remove('active'));
  const customInput = document.getElementById('withdrawCustomInput');
  if (customInput) customInput.value = '';
  updateWithdrawPreview(0);
  modal.classList.remove('hidden');
}
window.openWithdrawModal = openWithdrawModal;
function closeWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  if (modal) modal.classList.add('hidden');
}
window.closeWithdrawModal = closeWithdrawModal;
function closeWithdrawJokeModal() {
  const modal = document.getElementById('withdrawJokeModal');
  if (modal) modal.classList.add('hidden');
}
window.closeWithdrawJokeModal = closeWithdrawJokeModal;
async function confirmWithdraw() {
  const amount = _selectedWithdrawAmount || 0;
  if (amount <= 0) {
    api.ui.toast("请选择提现数量");
    return;
  }
  const currentLuma = window.currentWalletBalance || 0;
  if (amount > currentLuma) {
    api.ui.toast("LUMA 币余额不足");
    return;
  }
  const hostAmount = amount / 10;
  const btn = document.getElementById('withdrawConfirmBtn');
  if (btn) { btn.textContent = '处理中...'; btn.disabled = true; }
  window.currentWalletBalance = currentLuma - amount;
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }
  try {
    const wallet = await api.wallet.get();
    const accountId = wallet?.accounts?.[0]?.id;
    if (accountId) {
      await api.wallet.pay({
        amount: hostAmount,
        accountId: accountId,
        title: 'LUMA 提现',
        detail: `提现 ${amount.toLocaleString()} LUMA 币`,
        category: '提现',
        relatedOrderId: `withdraw_${Date.now()}`
      });
    }
    _cachedHostBalance = null;
  } catch (e) {
    console.warn('[Wallet] 提现扣款失败:', e.message);
  }
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`提现 ${amount.toLocaleString()} LUMA 币`, "cashout", amount, "余额");
  }
  closeWithdrawModal();
  const lumaEl = document.getElementById('pageRevenueBalance');
  if (lumaEl) lumaEl.textContent = window.currentWalletBalance.toLocaleString();
  const lumaBalEl = document.getElementById('wlLumaBalance');
  if (lumaBalEl) lumaBalEl.textContent = window.currentWalletBalance.toLocaleString();
  refreshHostBalanceDisplay();
  if (typeof window.syncWalletDisplays === 'function') window.syncWalletDisplays();
  if (btn) { btn.textContent = '确认提现'; btn.disabled = false; }
  const jokeModal = document.getElementById('withdrawJokeModal');
  if (jokeModal) jokeModal.classList.remove('hidden');
}
window.confirmWithdraw = confirmWithdraw;
async function handleCashOutAll() {
  openWithdrawModal();
}
window.handleCashOutAll = handleCashOutAll;
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
  const hostCost = addCoins / 10;
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
  window.currentWalletBalance = (window.currentWalletBalance || 0) + addCoins;
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`充值 ${addCoins.toLocaleString()} LUMA 币`, "recharge", addCoins, "LUMA 充值中心");
  }
  syncWalletDisplays();
  closeRechargeModal();
  const walletPage = document.getElementById('walletPageView');
  if (walletPage && !walletPage.classList.contains('hidden')) {
    const pageRev = document.getElementById('pageRevenueBalance');
    if (pageRev) pageRev.textContent = window.currentWalletBalance.toLocaleString();
    const lumaBalEl = document.getElementById('wlLumaBalance');
    if (lumaBalEl) lumaBalEl.textContent = window.currentWalletBalance.toLocaleString();
    refreshHostBalanceDisplay();
    renderTransactionLedger();
  }
  api.ui.toast(`充值成功！-${hostCost.toFixed(2)} 余额 → +${addCoins.toLocaleString()} LUMA 币`);
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
if (window.PageStack) {
  window.PageStack.register('followListPageView', { animationType: 'slide-right' });
  window.PageStack.register('walletPageView', { animationType: 'slide-right' });
}
function showSafeAreaGuides(containerId) {
  hideSafeAreaGuides();
  const container = document.getElementById(containerId);
  if (!container) return;
  const style = getComputedStyle(document.documentElement);
  const safeTop = style.getPropertyValue('--ai-phone-app-safe-top').trim() || '88px';
  const topLine = document.createElement('div');
  topLine.id = '__safe_guide_top';
  topLine.style.cssText = `position:absolute;top:${safeTop};left:0;right:0;height:1px;background:rgba(200,200,210,0.12);z-index:9999;pointer-events:none`;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
    container.dataset.__safeOldPos = 'static';
  }
  container.appendChild(topLine);
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