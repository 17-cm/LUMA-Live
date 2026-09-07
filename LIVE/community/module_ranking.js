// =========================================================================
// 【模块二·社区子文档4·社区全服排行榜系统】LIVE/社区/module_ranking.js
// 包含：
// 1. 三大排行榜：粉丝热度榜、至尊守护/贡献总榜、劳模工时榜
// 2. 金/银/铜立体颁奖台与 4~10 详细排名
// 3. 用户与全主播实时动态分数计算与打榜联动
//
// 视图几何（头像尺寸、领奖台高度、圆）全部由 style.css 的 .lr-* 负责，
// 这里只出结构，不再用 Tailwind 的 w-*/h-* 刻度写死尺寸 —— 刻度写错时
// 容器会静默拿不到宽高，竖版头像就会被 rounded-full 切成椭圆。
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
  const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
  const uWallet = window.currentWalletBalance || 18800;

  let rankedItems = [];

  if (tabType === 'fans' && window.LumaFansManager) {
    // 粉丝人气榜：严格按照 Char 和 User 的粉丝数量降序排列
    const list = window.LumaFansManager.getAllEntitiesPopularityList();
    rankedItems = list.map(item => ({
      name: item.name,
      avatar: item.avatar,
      badge: item.tag || '人气主播',
      score: item.fans,
      scoreLabel: '粉丝',
      isUser: item.isUser
    }));
  } else if (tabType === 'guard' && window.LumaGuardManager) {
    // 全服守护榜：直播间送礼 + 超话打榜应援消费总体排行
    rankedItems = window.LumaGuardManager.getAllCommunityGuardRankingList();
  } else if (tabType === 'fans') {
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.tag || '人气主播',
      score: (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
        ? window.LumaFansManager.getFans(c.id, c) : (c.fans || 0),
      scoreLabel: '粉丝'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: uProfile.tag || '新人主播',
      score: (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
        ? window.LumaFansManager.getFans('user') : (uProfile.fans || 0),
      scoreLabel: '粉丝',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  } else if (tabType === 'guard') {
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: '全服打投',
      score: window.getCharContributionScore(c.id),
      scoreLabel: '收到贡献'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: '至尊榜一',
      score: (window.LumaGuardManager && typeof window.LumaGuardManager.getTargetReceivedTotal === 'function')
        ? window.LumaGuardManager.getTargetReceivedTotal('user') : 0,
      scoreLabel: '收到贡献',
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

  // 三条数据源的字段形状略有差异（fans / score，tag / badge），这里收敛成
  // 视图唯一依赖的结构：score 保证可计算，avatar 保证有兜底。
  // 数据层习惯把玩家那条写成「某某 (你)」，这里剥掉后缀、改由 .lr-you 徽标标记，
  // 免得名字里挂着一段括号，将来又和徽标重复。
  const items = rankedItems.map(it => {
    const isUser = !!it.isUser;
    const raw = String(it.name || '匿名');
    const slim = raw.replace(/\s*[（(]\s*你\s*[)）]\s*$/, '');
    return {
      name: (isUser && slim) ? slim : raw,
      avatar: it.avatar || getAvatar(it.name || null, 'first'),
      badge: it.badge || it.tag || '',
      score: Number(it.score) || 0,
      scoreLabel: it.scoreLabel || '热度',
      isUser: isUser
    };
  }).sort((a, b) => b.score - a.score);

  if (!items.length) {
    container.innerHTML = '<div class="lr-none">本榜暂时还没有人上榜</div>';
    return;
  }

  // 头像 URL 与昵称都可能来自外部数据，进模板前统一转义
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
  const num = (v) => (Number(v) || 0).toLocaleString();
  const youTag = (item) => (item.isUser ? '<span class="lr-you">你</span>' : '');

  // 领奖台三列。DOM 按名次 1→2→3 排，视觉上的 2·1·3 由 CSS order 负责。
  const PODIUM = [
    { rank: 1, cls: 'lr-pod-1', av: 'lr-av-1', mark: '<span class="lr-crown">👑</span>' },
    { rank: 2, cls: 'lr-pod-2', av: 'lr-av-2', mark: '<span class="lr-medal">🥈</span>' },
    { rank: 3, cls: 'lr-pod-3', av: 'lr-av-3', mark: '<span class="lr-medal">🥉</span>' }
  ];

  const podiumHtml = `
    <div class="lr-podium">
      ${PODIUM.map(cfg => {
        const item = items[cfg.rank - 1];
        if (!item) {
          return `
            <div class="lr-pod ${cfg.cls}">
              <div class="lr-stage">
                <div class="lr-vacant">虚位</div>
                <span class="lr-name">等待上榜</span>
              </div>
              <div class="lr-base">${cfg.rank}</div>
            </div>
          `;
        }
        return `
          <div class="lr-pod ${cfg.cls}">
            <div class="lr-stage">
              <div class="lr-av ${cfg.av}">
                <img src="${esc(item.avatar)}" alt="">
                ${cfg.mark}
              </div>
              <div class="lr-idline">
                <span class="lr-name">${esc(item.name)}</span>
                ${youTag(item)}
              </div>
              <span class="lr-val">${num(item.score)} · ${esc(item.scoreLabel)}</span>
            </div>
            <div class="lr-base">${cfg.rank}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const rest = items.slice(3);
  const listHtml = rest.length ? `
    <div class="lr-divider">4 名之后</div>
    <div class="lr-list">
      ${rest.map((item, idx) => `
        <div class="lr-row${item.isUser ? ' me' : ''}">
          <span class="lr-idx">${idx + 4}</span>
          <div class="lr-av lr-av-sm"><img src="${esc(item.avatar)}" alt=""></div>
          <div class="lr-who">
            <div class="lr-idline">
              <span class="lr-name">${esc(item.name)}</span>
              ${youTag(item)}
            </div>
            ${item.badge ? `<span class="lr-badge">${esc(item.badge)}</span>` : ''}
          </div>
          <div class="lr-score">
            <b>${num(item.score)}</b>
            <span>${esc(item.scoreLabel)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  container.innerHTML = podiumHtml + listHtml;
}
window.renderCommunityRanking = renderCommunityRanking;
