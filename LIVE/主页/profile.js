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

// 5. 钱包与流水
function openWalletPageView() {
  const pageRev = document.getElementById('pageRevenueBalance');
  if (pageRev) pageRev.textContent = revenueBalance.toLocaleString();
  renderTransactionLedger();
  if (window.PageStack) {
    window.PageStack.open('walletPageView');
  } else {
    const page = document.getElementById('walletPageView');
    if (page) page.classList.remove('hidden');
  }
}
window.openWalletPageView = openWalletPageView;

function closeWalletPageView() {
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

  if (transactionLedger.length === 0) {
    box.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">暂无流水记录</p>`;
    return;
  }

  box.innerHTML = transactionLedger.map(item => `
    <div class="luxe-card p-3 flex items-center justify-between bg-white">
      <div>
        <h5 class="text-xs font-black text-slate-900">${item.title}</h5>
        <p class="text-[9px] text-slate-400 mt-0.5">${item.time} · 对方: ${item.targetName}</p>
      </div>
      <span class="text-xs font-black ${item.type === 'income' || item.type === 'recharge' ? 'text-emerald-600' : item.type === 'cashout' ? 'text-amber-600' : 'text-rose-600'}">
        ${item.type === 'income' || item.type === 'recharge' ? '+' : '-'}${item.amount.toLocaleString()} LUMA 币
      </span>
    </div>
  `).join('');
}

async function recordTransaction(title, type, amount, targetName, targetAvatar, targetTag) {
  const record = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: title,
    type: type,
    amount: amount,
    targetName: targetName || '系统',
    targetAvatar: targetAvatar || '',
    targetTag: targetTag || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  transactionLedger.unshift(record);
  try {
    await api.db.create("app_ledger", record);
  } catch (e) {}

  const page = document.getElementById('walletPageView');
  if (page && !page.classList.contains('hidden')) {
    renderTransactionLedger();
  }
}
window.recordTransaction = recordTransaction;

async function handleCashOutAll() {
  if (revenueBalance <= 0) {
    api.ui.toast("暂无待提现收益");
    return;
  }

  const rev = revenueBalance;
  revenueBalance = 0;
  const rev1 = document.getElementById('liveRevenueAmount');
  const rev2 = document.getElementById('pageRevenueBalance');
  if (rev1) rev1.textContent = '0';
  if (rev2) rev2.textContent = '0';

  await recordTransaction("全额提现至小手机钱包", "cashout", rev, "小手机主系统");

  await api.db.create("app_wallet", { id: "vault_data", balance: 0 }).catch(() => {
    api.db.update("app_wallet", "vault_data", { balance: 0 }).catch(() => {});
  });

  api.ui.toast(`成功提现 ${rev} LUMA 币至小手机主钱包！`);
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
  window.currentWalletBalance = (window.currentWalletBalance || 0) + addCoins;
  
  try {
    await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance });
  } catch (e) {
    await api.db.update("app_wallet", "vault_data", { balance: window.currentWalletBalance }).catch(() => {});
  }
  
  if (typeof recordTransaction === 'function') {
    await recordTransaction(`充值 ${addCoins.toLocaleString()} 币`, "recharge", addCoins, "LUMA 充值中心");
  }
  
  syncWalletDisplays();
  closeRechargeModal();
  api.ui.toast(`🎉 充值成功！已到账 +${addCoins.toLocaleString()} LUMA 币`);
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
