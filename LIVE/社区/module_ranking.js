// =========================================================================
// 【模块二·社区子文档4·社区全服排行榜系统】LIVE/社区/module_ranking.js
// 包含：
// 1. 三大排行榜：粉丝热度榜、至尊守护/贡献总榜、劳模工时榜
// 2. 金/银/铜立体颁奖台与 4~10 详细排名
// 3. 用户与全主播实时动态分数计算与打榜联动
// =========================================================================

var api = window.api || {};
let currentCommunityRankTab = 'fans'; // 'fans' | 'guard' | 'diligent'

function switchCommunityRankTab(tabType) {
  currentCommunityRankTab = tabType;
  renderCommunityRanking(tabType);
}
window.switchCommunityRankTab = switchCommunityRankTab;

function renderCommunityRanking(tabType = 'fans') {
  const container = document.getElementById('communityRankingListContainer');
  if (!container) return;

  const btnFans = document.getElementById('btnRankTabFans');
  const btnGuard = document.getElementById('btnRankTabGuard');
  const btnDiligent = document.getElementById('btnRankTabDiligent');

  [btnFans, btnGuard, btnDiligent].forEach(b => b && b.classList.remove('active', 'border-rose-600', 'text-rose-600', 'font-black'));
  if (tabType === 'fans' && btnFans) btnFans.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');
  if (tabType === 'guard' && btnGuard) btnGuard.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');
  if (tabType === 'diligent' && btnDiligent) btnDiligent.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');

  const chars = window.getAvailableCharsList();
  const uProfile = window.userProfileData || {};
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uWallet = window.currentWalletBalance || 18800;

  let rankedItems = [];

  if (tabType === 'fans') {
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.tag || '人气主播',
      score: c.fans,
      scoreLabel: '粉丝'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: uProfile.tag || '新人主播',
      score: uProfile.fanCount || 520,
      scoreLabel: '粉丝',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  } else if (tabType === 'guard') {
    // 守护榜：基础分数 + 真实打榜贡献累计
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: '全服打投',
      score: Math.floor(c.fans * 2.8 + 5000) + window.getCharContributionScore(c.id),
      scoreLabel: '贡献值'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: '至尊榜一',
      score: (uWallet * 3) + parseInt(localStorage.getItem('luma_total_user_contribution') || '12000', 10),
      scoreLabel: '贡献值',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  } else {
    rankedItems = chars.map((c, idx) => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.isLive ? '🔴 正在连播' : '常驻主播',
      score: Math.floor(120 - idx * 12 + (c.isLive ? 40 : 0)),
      scoreLabel: '活跃工时'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: '开播体验官',
      score: 35,
      scoreLabel: '活跃工时',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  }

  const top1 = rankedItems[0] || null;
  const top2 = rankedItems[1] || null;
  const top3 = rankedItems[2] || null;
  const rest = rankedItems.slice(3);

  const podiumHtml = `
    <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
      ${top2 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-slate-300 shadow-md">
              <img src="${top2.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥈</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top2.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top2.score.toLocaleString()} ${top2.scoreLabel}</span>
          <div class="podium-step-2 w-full mt-2 flex items-center justify-center font-black text-slate-400 text-sm">2</div>
        </div>
      ` : '<div></div>'}

      ${top1 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-15 h-15 rounded-full p-0.5 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 shadow-lg">
              <img src="${top1.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-3 -right-1 text-base animate-bounce">👑</span>
          </div>
          <span class="text-xs font-black text-amber-600 truncate max-w-[95px]">${top1.name}</span>
          <span class="text-[9px] font-bold text-slate-500 mt-0.5">${top1.score.toLocaleString()} ${top1.scoreLabel}</span>
          <div class="podium-step-1 w-full mt-2 flex items-center justify-center font-black text-amber-500 text-lg">1</div>
        </div>
      ` : '<div></div>'}

      ${top3 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-amber-700/40 shadow-md">
              <img src="${top3.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥉</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top3.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top3.score.toLocaleString()} ${top3.scoreLabel}</span>
          <div class="podium-step-3 w-full mt-2 flex items-center justify-center font-black text-amber-700 text-sm">3</div>
        </div>
      ` : '<div></div>'}
    </div>
  `;

  const listHtml = rest.map((item, idx) => `
    <div class="luxe-card p-3 flex items-center justify-between bg-white ${item.isUser ? 'border-rose-300 bg-rose-50/50' : ''}">
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-5 text-center text-xs font-black text-slate-400">${idx + 4}</span>
        <img src="${item.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5>
            <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${item.badge}</span>
          </div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="text-xs font-black text-rose-600">${item.score.toLocaleString()}</span>
        <p class="text-[8px] text-slate-400">${item.scoreLabel}</p>
      </div>
    </div>
  `).join('');

  container.innerHTML = podiumHtml + `<div class="space-y-2 pt-2">${listHtml}</div>`;
}
window.renderCommunityRanking = renderCommunityRanking;
