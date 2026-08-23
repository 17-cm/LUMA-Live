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
// 【5. 钱包与流水 · 黑金卡风格重设计】
//
// ⚠️ 安全区合规说明：
//   本页面所有可见内容均位于 --ai-phone-app-safe-top (默认88px) 之下。
//   顶部仅保留一根浅灰色装饰线（safe-line），线上方无任何 UI 元素。
//   底部内容预留 safe-bottom (默认24px) 的滚动空间。
//   设计原则：安全线 = 装饰性分隔，实际内容再往下偏移约 8px。
// =========================================================================

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
  const safeBottomVal = style.getPropertyValue('--ai-phone-app-safe-bottom').trim() || '24px';

  // 安全线位置：比实际 safe-top 再往下偏一点作为装饰
  const safeLineTop = `calc(${safeTopVal} + 6px)`;

  container.innerHTML = `
    <!-- ═══ 钱包页面容器（白底）═══ -->
    <style>
      /* ---- 钱包专属样式（scoped via ID prefix）---- */
      #walletPageView {
        background: #ffffff !important;
        position: relative;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* 安全区装饰线 */
      .wl-safe-line {
        position: absolute;
        left: 0; right: 0;
        top: ${safeLineTop};
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(180,180,190,0.5), transparent);
        z-index: 20;
        pointer-events: none;
      }

      /* 顶部导航区（返回键 + 标题，在安全线下方） */
      .wl-nav-area {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 10px;
        padding-top: calc(${safeLineTop} + 14px);
        z-index: 15;
      }

      .wl-back-btn {
        width: 34px; height: 34px;
        border-radius: 50%;
        background: #f7f8fa;
        border: 1px solid #e8eaef;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .wl-back-btn:active { transform: scale(0.9); background: #eeeef2; }

      .wl-title-group { text-align: center; flex: 1; }
      .wl-title-main { font-size: 14px; font-weight: 900; color: #1a1a2e; letter-spacing: 0.5px; line-height: 1.2; }
      .wl-title-sub { font-size: 9px; color: #b0b4c0; font-weight: 700; letter-spacing: 2px; margin-top: 2px; }

      /* ===== 黑金银行卡（LUMA 币余额）===== */
      .wl-gold-card-wrap { padding: 0 16px; margin-top: 6px; }

      .wl-gold-card {
        position: relative;
        border-radius: 18px;
        overflow: hidden;
        min-height: 160px;
        /* 暗金属底色 — 借鉴拟态玻璃素材的 bar-metal-base 手法 */
        background:
          linear-gradient(135deg, #1c1c24 0%, #12121a 40%, #0a0a10 100%);
        box-shadow:
          0 4px 12px rgba(0,0,0,0.35),
          0 12px 32px rgba(0,0,0,0.25),
          inset 0 1px 1px rgba(255,255,255,0.06);
      }

      /* 卡片顶部高光渐变 */
      .wl-gold-card::before {
        content: '';
        position: absolute;
        top: 0; left: 6%; right: 6%;
        height: 55%;
        border-radius: 18px 18px 50% 50% / 18px 18px 30% 30%;
        background: linear-gradient(180deg, rgba(212,185,140,0.12) 0%, rgba(212,185,140,0.02) 100%);
        pointer-events: none;
      }

      /* 金色细边框流动效果 — 借鉴素材 border-line-outer 的 mask 技巧 */
      .wl-card-border {
        position: absolute;
        inset: 1px;
        border-radius: 17px;
        padding: 1px;
        background: linear-gradient(
          120deg,
          rgba(200,175,120,0) 0%,
          rgba(218,195,150,0.45) 20%,
          rgba(235,210,165,0.65) 40%,
          rgba(245,225,185,0.75) 55%,
          rgba(235,210,165,0.65) 70%,
          rgba(218,195,150,0.45) 85%,
          rgba(200,175,120,0) 100%
        );
        background-size: 220% 100%;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: wlFlowBorder 7s ease-in-out infinite;
        pointer-events: none;
      }

      @keyframes wlFlowBorder {
        0% { background-position: 220% 0; }
        100% { background-position: -220% 0; }
      }

      /* 内部玻璃质感层 */
      .wl-card-inner {
        position: relative;
        z-index: 3;
        padding: 22px 20px 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .wl-card-header { display: flex; align-items: center; justify-content: space-between; }
      .wl-card-label { font-size: 11px; color: rgba(212,185,140,0.85); font-weight: 700; letter-spacing: 1px; }
      .wl-card-chip-icon {
        width: 36px; height: 26px;
        border-radius: 4px;
        background: linear-gradient(135deg, rgba(212,185,140,0.25), rgba(212,185,140,0.08));
        border: 1px solid rgba(212,185,140,0.2);
        display: flex; align-items: center; justify-content: center;
      }
      .wl-card-chip-icon svg { width: 22px; height: 16px; opacity: 0.6; fill: none; stroke: #d4b98c; stroke-width: 1.3; }

      .wl-balance-row { margin-top: 4px; }
      .wl-balance-amount {
        font-size: 38px;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -1px;
        line-height: 1.05;
        text-shadow: 0 2px 8px rgba(0,0,0,0.4);
      }
      .wl-balance-unit { font-size: 13px; color: rgba(212,185,140,0.75); font-weight: 600; margin-left: 6px; }

      .wl-card-footer {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 8px;
      }
      .wl-card-type {
        font-size: 17px;
        font-weight: 800;
        color: rgba(212,185,140,0.7);
        letter-spacing: 3px;
        text-transform: uppercase;
      }
      .wl-card-no { font-size: 10px; color: rgba(255,255,255,0.25); font-family: monospace; letter-spacing: 2px; }

      /* ===== 余额信息条（宿主虚拟货币）===== */
      .wl-host-balance-bar {
        margin: 14px 16px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-radius: 14px;
        background: linear-gradient(135deg, #fafbfd 0%, #f4f5f8 100%);
        border: 1px solid #eaecef;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }
      .wl-host-info { display: flex; align-items: center; gap: 10px; }
      .wl-host-icon {
        width: 36px; height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #e8ecf2, #dce0e8);
        display: flex; align-items: center; justify-content: center;
      }
      .wl-host-icon svg { width: 20px; height: 20px; stroke: #6b7280; stroke-width: 1.8; fill: none; }
      .wl-host-labels .name { font-size: 13px; font-weight: 800; color: #374151; }
      .wl-host-labels .sub { font-size: 10px; color: #9ca3af; font-weight: 500; margin-top: 1px; }
      .wl-host-amount { text-align: right; }
      .wl-host-val { font-size: 18px; font-weight: 900; color: #1f2937; }
      .wl-hint { font-size: 9px; color: #9ca3af; margin-top: 2px; }

      /* ===== 操作按钮行（提现 / 充值）===== */
      .wl-action-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 16px 16px 0;
      }
      .wl-action-btn {
        position: relative;
        border-radius: 14px;
        padding: 16px 12px;
        text-align: center;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.25s ease;
        border: none;
      }
      .wl-action-btn:active { transform: scale(0.97); }

      /* 提现按钮 — 深色调 */
      .wl-btn-cashout {
        background: linear-gradient(145deg, #1e1e28, #14141c);
        box-shadow: 0 4px 14px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.06);
      }
      .wl-btn-cashout:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.3); }

      /* 充值按钮 — 金色调 */
      .wl-btn-recharge {
        background: linear-gradient(145deg, #2a2420, #1e1a16);
        box-shadow: 0 4px 14px rgba(180,150,90,0.15), inset 0 1px 1px rgba(255,255,255,0.07);
      }
      .wl-btn-recharge:hover { box-shadow: 0 6px 20px rgba(180,150,90,0.25); }

      .wl-action-icon { width: 32px; height: 32px; margin: 0 auto 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .wl-btn-cashout .wl-action-icon { background: rgba(255,255,255,0.08); }
      .wl-btn-recharge .wl-action-icon { background: rgba(212,185,140,0.12); }
      .wl-action-icon svg { width: 18px; height: 18px; stroke-width: 1.8; fill: none; }
      .wl-btn-cashout .wl-action-icon svg { stroke: #d4b98c; }
      .wl-btn-recharge .wl-action-icon svg { stroke: #e8d5a8; }

      .wl-action-name { font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
      .wl-action-desc { font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 4px; font-weight: 500; }

      /* ===== 流水区域 ===== */
      .wl-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 16px 10px;
      }
      .wl-section-title { font-size: 14px; font-weight: 900; color: #1a1a2e; }
      .wl-section-badge {
        font-size: 9px;
        color: #9ca3af;
        background: #f3f4f6;
        padding: 3px 10px;
        border-radius: 20px;
        font-weight: 600;
      }

      .wl-ledger-list { padding: 0 16px 80px; display: flex; flex-direction: column; gap: 8px; }

      /* 流水单条 */
      .wl-tx-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-radius: 14px;
        background: #fafbfd;
        border: 1px solid #f0f1f3;
        transition: all 0.2s ease;
      }
      .wl-tx-item:active { background: #f5f6f8; }

      .wl-tx-left { display: flex; align-items: center; gap: 12px; }
      .wl-tx-icon {
        width: 38px; height: 38px;
        border-radius: 11px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
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

      .wl-tx-text .title { font-size: 13px; font-weight: 800; color: #1f2937; }
      .wl-tx-text .meta { font-size: 10px; color: #9ca3af; margin-top: 2px; font-weight: 500; }

      .wl-tx-amount { font-size: 14px; font-weight: 900; flex-shrink: 0; }
      .wl-tx-amount.positive { color: #059669; }
      .wl-tx-amount.negative { color: #dc2626; }
      .wl-tx-amount.warning { color: #d97706; }

      /* 空状态 */
      .wl-empty-state {
        text-align: center;
        padding: 40px 20px 60px;
      }
      .wl-empty-icon {
        width: 56px; height: 56px;
        margin: 0 auto 12px;
        border-radius: 50%;
        background: #f3f4f6;
        display: flex; align-items: center; justify-content: center;
      }
      .wl-empty-icon svg { width: 26px; height: 26px; stroke: #d1d5db; stroke-width: 1.5; fill: none; }
      .wl-empty-text { font-size: 13px; font-weight: 700; color: #9ca3af; }
      .wl-empty-sub { font-size: 11px; color: #d1d5db; margin-top: 4px; }
    </style>

    <!-- 安全区装饰线 -->
    <div class="wl-safe-line"></div>

    <!-- 导航栏 -->
    <div class="wl-nav-area">
      <div class="wl-back-btn" onclick="closeWalletPageView()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </div>
      <div class="wl-title-group">
        <div class="wl-title-main">我的钱包</div>
        <div class="wl-title-sub">LUMA WALLET</div>
      </div>
      <div style="width:34px"></div>
    </div>

    <!-- 黑金卡 — LUMA 币余额 -->
    <div class="wl-gold-card-wrap">
      <div class="wl-gold-card">
        <div class="wl-card-border"></div>
        <div class="wl-card-inner">
          <div class="wl-card-header">
            <span class="wl-card-label">LUMA 币资产</span>
            <div class="wl-card-chip-icon">
              <svg viewBox="0 0 24 16"><rect x="2" y="3" width="20" height="10" rx="2"/><line x1="6" y1="7" x2="18" y2="7"/><line x1="6" y1="10" x2="12" y2="10"/></svg>
            </div>
          </div>
          <div class="wl-balance-row">
            <span class="wl-balance-amount" id="pageRevenueBalance">0</span>
            <span class="wl-balance-unit">LUMA 币</span>
          </div>
          <div class="wl-card-footer">
            <span class="wl-card-type">GOLD CARD</span>
            <span class="wl-card-no">**** **** **** LUMA</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 宿主虚拟货币余额 -->
    <div class="wl-host-balance-bar">
      <div class="wl-host-info">
        <div class="wl-host-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h6M9 14h6"/></svg>
        </div>
        <div class="wl-host-labels">
          <div class="name">余额</div>
          <div class="sub">宿主虚拟货币</div>
        </div>
      </div>
      <div class="wl-host-amount">
        <div class="wl-host-val" id="wlHostBalance">0.00</div>
        <div class="wl-hint">1 : 10 LUMA</div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="wl-action-row">
      <div class="wl-action-btn wl-btn-cashout" onclick="handleCashOutAll()">
        <div class="wl-action-icon">
          <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </div>
        <div class="wl-action-name">提现</div>
        <div class="wl-action-desc">LUMA → 余额</div>
      </div>
      <div class="wl-action-btn wl-btn-recharge" onclick="openRechargeModal()">
        <div class="wl-action-icon">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </div>
        <div class="wl-action-name">充值</div>
        <div class="wl-action-desc">余额 → LUMA</div>
      </div>
    </div>

    <!-- 流水标题 -->
    <div class="wl-section-header">
      <span class="wl-section-title">交易流水</span>
      <span class="wl-section-badge" id="wlTxCount">0 笔记录</span>
    </div>

    <!-- 流水列表容器 -->
    <div class="wl-ledger-list" id="transactionLedgerContainer"></div>
  `;
}

/**
 * 打开钱包页面
 * 先渲染 UI，再更新数据，最后显示页面 + 安全区定位线
 */
function openWalletPageView() {
  // 1. 渲染钱包界面 DOM
  renderWalletUI();

  // 2. 更新数据
  const pageRev = document.getElementById('pageRevenueBalance');
  if (pageRev) pageRev.textContent = (window.currentWalletBalance || revenueBalance || 0).toLocaleString();

  // 计算并显示宿主虚拟货币余额（LUMA币 ÷ 10）
  const lumaBal = window.currentWalletBalance || revenueBalance || 0;
  const hostBalEl = document.getElementById('wlHostBalance');
  if (hostBalEl) hostBalEl.textContent = (lumaBal / 10).toFixed(2);

  // 3. 渲染流水
  renderTransactionLedger();

  // 4. 显示页面
  if (window.PageStack) {
    window.PageStack.open('walletPageView');
  } else {
    const page = document.getElementById('walletPageView');
    if (page) page.classList.remove('hidden');
  }

  // 5. 安全区定位线（调试用，纯黑线无黄标）
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
      <div class="wl-empty-state">
        <div class="wl-empty-icon">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>
        </div>
        <div class="wl-empty-text">暂无流水记录</div>
        <div class="wl-empty-sub">充值或提现后记录将显示在这里</div>
      </div>
    `;
    // 更新计数 badge
    const badge = document.getElementById('wlTxCount');
    if (badge) badge.textContent = '0 笔记录';
    return;
  }

  // 图标映射
  const iconMap = {
    income:  '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    recharge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    cashout: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    expense: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
  };

  box.innerHTML = transactionLedger.map(item => {
    const type = item.type || 'expense';
    const isPositive = (type === 'income' || type === 'recharge');
    const amountClass = isPositive ? 'positive' : (type === 'cashout' ? 'warning' : 'negative');
    const sign = isPositive ? '+' : '-';
    return `
      <div class="wl-tx-item">
        <div class="wl-tx-left">
          <div class="wl-tx-icon ${type}">
            ${iconMap[type] || iconMap.expense}
          </div>
          <div class="wl-tx-text">
            <div class="title">${item.title || '未知交易'}</div>
            <div class="meta">${item.time || ''} ${item.targetName ? '· ' + item.targetName : ''}</div>
          </div>
        </div>
        <div class="wl-tx-amount ${amountClass}">${sign}${(item.amount || 0).toLocaleString()} LUMA</div>
      </div>
    `;
  }).join('');

  // 更新计数 badge
  const badge = document.getElementById('wlTxCount');
  if (badge) badge.textContent = `${transactionLedger.length} 笔记录`;
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
