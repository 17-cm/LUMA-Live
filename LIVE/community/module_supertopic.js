// =========================================================================
// 【模块二·社区子文档2·主播超话系统 v2.0】LIVE/社区/module_supertopic.js
// 以「超话 / #」为符号重构精致全息界面（深空玻璃视觉），保留全部原有功能：
//   动态 | 签到打卡 | 打榜应援 | 贡献榜 | 关注 | 切换超话左拉抽屉
// 数据接口与业务逻辑保持原样：贡献三渠道(送礼1:1·签到+100·打榜)统一计入贡献矩阵。
// =========================================================================
var api = window.api || {};
let currentActiveSuperTopicCharId = null;
let currentSuperTopicTab = 'posts';
let selectedSupportGiftId = 'gift_flower';
let superTopicVirtualScrollerInstance = null;

// -------------------------------------------------------------------------
// 工具函数
// -------------------------------------------------------------------------
function getCharContribution(charId) {
  try { return (window.getCharContributionScore && window.getCharContributionScore(charId)) || 0; } catch (e) { return 0; }
}
function getMyWalletBalance() {
  try { return Number(window.currentWalletBalance) || 0; } catch (e) {}
  return 0;
}
function getCheckIn(col) {
  try {
    if (window.LumaCheckinManager && typeof window.LumaCheckinManager.getCheckinInfo === 'function') {
      return window.LumaCheckinManager.getCheckinInfo('user', col);
    }
  } catch (e) {}
  try { return window.getSuperTopicCheckInInfo(col); } catch (e) {}
  return { isCheckedToday: false, streakDays: 0, totalDays: 0, totalExp: 0, supportCoin: 0, level: 1 };
}
function getCharById(id) {
  const chars = window.getAvailableCharsList();
  return chars.find(c => String(c.id) === String(id)) || null;
}
function getActiveChar() {
  return window.getAvailableCharsList().find(c => String(c.id) === String(currentActiveSuperTopicCharId))
    || window.getAvailableCharsList()[0] || null;
}
function topicPostsFor(char) {
  return (window.weiboPosts || []).filter(p =>
    (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name))
  );
}
function getAvatarFor(name, seed) {
  try { return window.getAvatar ? window.getAvatar(name, seed || 'first') : ''; } catch (e) { return ''; }
}
function currentUserName() {
  return (window.currentUser && window.currentUser.name) || '玩家';
}
function currentUserAvatar() {
  return (window.currentUser && window.currentUser.avatar) || getAvatarFor(currentUserName(), 'first');
}
// 由超话 id 派生稳定双色主调，让每个超话拥有专属视觉
function topicHues(id) {
  const palettes = [
    ['#ff2a6d', '#22d3ee'],
    ['#f97316', '#f43f5e'],
    ['#a855f7', '#f0abfc'],
    ['#2dd4bf', '#60a5fa'],
    ['#f5b301', '#ff6b9d'],
    ['#7c3aed', '#ff2a6d'],
    ['#3b82f6', '#22d3ee'],
    ['#ec4899', '#fbbf24']
  ];
  const s = String(id || '');
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return palettes[n % palettes.length];
}
function postTime(post) {
  if (post.time) return post.time;
  if (post.createdAt) {
    try {
      if (window.formatDynamicTime) {
        return window.formatDynamicTime(post.createdAt) + ' · 来自 ' + (window.getFloatClientTag ? window.getFloatClientTag(true) : '小手机');
      }
    } catch (e) {}
  }
  return '刚刚';
}

// -------------------------------------------------------------------------
// 超话右上角「···」菜单
// -------------------------------------------------------------------------
function toggleSuperTopicMenu() {
  const popup = document.getElementById('superTopicMenuPopup');
  if (popup) popup.classList.toggle('hidden');
}
window.toggleSuperTopicMenu = toggleSuperTopicMenu;

document.addEventListener('click', function(e) {
  const popup = document.getElementById('superTopicMenuPopup');
  if (!popup || popup.classList.contains('hidden')) return;
  if (!e.target.closest('#superTopicMenuPopup') && !e.target.closest('[onclick*="toggleSuperTopicMenu"]')) {
    popup.classList.add('hidden');
  }
});

// -------------------------------------------------------------------------
// 主视图渲染：Hero 封面 + 数据带 + 分段导航 + 内容面板
// -------------------------------------------------------------------------
function renderSuperTopicView(charId = null) {
  const container = document.getElementById('communitySuperTopicContent');
  if (!container) return;
  if (superTopicVirtualScrollerInstance) { superTopicVirtualScrollerInstance.destroy(); superTopicVirtualScrollerInstance = null; }

  const chars = window.getAvailableCharsList();
  if (chars.length === 0) return;
  let char = chars.find(c => String(c.id) === String(charId));
  if (!char) char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];
  currentActiveSuperTopicCharId = char.id;

  const isFollowed = (window.followedSuperTopics || []).includes(String(char.id));
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char) : (char.fans || 0);
  const contribution = getCharContribution(char.id);
  const topicPosts = topicPostsFor(char);
  const todayDiscuss = topicPosts.length + 18;
  const heatValue = (fansCount * 3 + contribution).toLocaleString();
  const [a, b] = topicHues(char.id);

  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}超话#`;

  container.innerHTML = `
    <!-- 1. 全息封面 Hero -->
    <section class="st2-hero" style="--st2-a:${a};--st2-b:${b}">
      <div class="st2-hero-top">
        <div class="st2-kickers">
          <span class="st2-kicker is-hot"># 明星超话 #</span>
          <span class="st2-kicker">${char.category || '官方超话'}</span>
        </div>
        <div class="st2-hero-act">
          <button onclick="handleSuperTopicFollow('${char.name.replace(/'/g, "\\'")}')" class="st2-follow ${isFollowed ? 'is-followed' : ''}">
            ${isFollowed
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> 已关注'
              : '+ 关注'}
          </button>
        </div>
      </div>
      <div class="st2-hero-foot">
        <button class="st2-avatar" onclick="toggleSuperTopicDrawer()" title="切换超话">
          <img src="${char.avatar}" alt="超话头像">
          <span class="st2-switch-chip"># 切换</span>
        </button>
        <div class="st2-id">
          <div class="st2-id-name">
            <h2>#${char.name}超话#</h2>
            <span class="st2-goldv"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>
          </div>
          <div class="st2-id-sub">
            <span class="dot"></span>
            <b>主持人</b>
            <span class="t">@${char.name}后援会 · 官方认证</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. 数据关注带 -->
    <section class="st2-ribbon">
      <div class="st2-ribbon-item">
        <span class="st2-ribbon-n is-cyan">${fansCount.toLocaleString()}</span>
        <span class="st2-ribbon-l">粉丝</span>
      </div>
      <div class="st2-ribbon-item">
        <span class="st2-ribbon-n">${todayDiscuss}</span>
        <span class="st2-ribbon-l">今日讨论</span>
      </div>
      <div class="st2-ribbon-item">
        <span class="st2-ribbon-n is-rose">${contribution.toLocaleString()}</span>
        <span class="st2-ribbon-l">我的贡献</span>
      </div>
      <div class="st2-ribbon-item">
        <span class="st2-ribbon-n is-gold">${heatValue}</span>
        <span class="st2-ribbon-l">超话热度</span>
      </div>
    </section>

    <!-- 3. 分段导航胶囊 -->
    <nav class="st2-tabs">
      ${['posts', 'checkin', 'support', 'contribute'].map(k => {
        const cfg = {
          posts: { label: '动态', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
          checkin: { label: '签到', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="9 16 11 18 15 14"></polyline></svg>' },
          support: { label: '打榜', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"></path></svg>' },
          contribute: { label: '贡献榜', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path></svg>' }
        }[k];
        return `<button id="spTabBtn_${k}" onclick="switchSuperTopicTab('${k}')" class="st2-tab ${currentSuperTopicTab === k ? 'active' : ''}">${cfg.ic}<span>${cfg.label}</span></button>`;
      }).join('')}
    </nav>

    <!-- 4. 内容面板挂载点 -->
    <div id="superTopicPanel" class="st2-panel"></div>
  `;

  renderSuperTopicTab();
}
window.renderSuperTopicView = renderSuperTopicView;

// -------------------------------------------------------------------------
// 分段导航切换
// -------------------------------------------------------------------------
function switchSuperTopicTab(tabKey) {
  if (currentSuperTopicTab !== tabKey) currentSuperTopicTab = tabKey;

  ['posts', 'checkin', 'support', 'contribute'].forEach(k => {
    const btn = document.getElementById(`spTabBtn_${k}`);
    if (!btn) return;
    btn.classList.toggle('active', k === tabKey);
  });

  renderSuperTopicTab();
}
window.switchSuperTopicTab = switchSuperTopicTab;
// 兼容旧接口名
window.switchSuperTopicSubTab = switchSuperTopicTab;

function renderSuperTopicTab() {
  const char = getActiveChar();
  if (!char) return;
  if (currentSuperTopicTab === 'posts') renderSuperTopicPostsTab(char.id);
  else if (currentSuperTopicTab === 'checkin') renderSuperTopicCheckinTab(char);
  else if (currentSuperTopicTab === 'support') renderSuperTopicSupportTab(char);
  else if (currentSuperTopicTab === 'contribute') renderSuperTopicContributeTab(char);
}

// -------------------------------------------------------------------------
// 动态 Tab
// -------------------------------------------------------------------------
function renderSuperTopicPostsTab(charId) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(charId)) || chars[0];
  let posts = topicPostsFor(char);
  if (posts.length === 0) {
    posts = [{
      id: `topic_post_${char.id}`,
      author: { name: `${char.name}后援会会长`, avatar: char.avatar, badge: '超话大咖', verified: true },
      createdAt: Date.now(),
      tag: `#${char.name}超话#`,
      mention: `@${char.name}`,
      content: `欢迎来到【${char.name}】粉丝专属超话！每天签到打卡、为主播送礼或花钱打榜应援，均可登上超话守护贡献总榜！`,
      image: char.avatar,
      stats: { reposts: 180, comments: 24, likes: 680, isLiked: false, isDownloaded: false },
      commentTree: []
    }];
  }

  panel.innerHTML = `
    <div class="st2-sec">
      <h4><span class="sharp">#</span>超话动态</h4>
      <span class="note">TOTAL ${posts.length}</span>
    </div>

    ${posts.map(post => `
      <article class="st2-post" onclick="openTrendDetail('${post.id}')">
        <div class="st2-post-hd">
          <img class="st2-post-av" src="${post.author.avatar}" alt="">
          <div class="st2-post-au">
            <div class="st2-post-name">
              <h5>${post.author.name}</h5>
              ${post.author.badge ? `<i>${post.author.badge}</i>` : ''}
            </div>
            <div class="st2-post-meta">${postTime(post)}</div>
          </div>
          <span class="st2-post-tag">#${char.name}超话#</span>
        </div>
        <p class="st2-post-body">
          <span class="hash">#${char.name}超话#</span> ${post.content}
        </p>
        ${post.image ? `
        <div class="st2-post-media">
          <img src="${post.image}" loading="lazy" alt="超话动态配图">
        </div>` : ''}
        <div class="st2-post-ft" onclick="event.stopPropagation()">
          <button onclick="handlePostAction('${post.id}','repost')" class="st2-act">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            ${post.stats.reposts}
          </button>
          <button onclick="openTrendDetail('${post.id}')" class="st2-act">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            ${post.stats.comments}
          </button>
          <button onclick="handlePostAction('${post.id}','like')" class="st2-act ${post.stats.isLiked ? 'is-liked' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
            ${post.stats.likes}
          </button>
        </div>
      </article>
    `).join('')}

    <div class="st2-composer" onclick="openCreatePostModal('#${char.name}超话#', '@${char.name}')">
      <span class="ph">说点什么，为主播 #${char.name}# 打 call…</span>
      <span class="send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </span>
    </div>
  `;
}
window.renderSuperTopicPostsTab = renderSuperTopicPostsTab;

// -------------------------------------------------------------------------
// 签到 Tab（一天一次，贡献值+100、应援币+100，真实连续天数）
// -------------------------------------------------------------------------
function renderSuperTopicCheckinTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const checkIn = getCheckIn(char.id);
  const contribution = getCharContribution(char.id);
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  let calendar = '';
  for (let i = 0; i < 7; i++) {
    let cls = 'st2-week-d';
    let mark = '<span class="mark"></span>';
    if (i < dayOfWeek) { cls += ' is-past'; mark = '<span class="mark">✓</span>'; }
    else if (i === dayOfWeek) {
      cls += ' is-now';
      mark = '<span class="mark">今</span>';
      if (checkIn.isCheckedToday) { cls += ' is-done'; }
    }
    calendar += `<div class="${cls}"><span>${weekDays[i]}</span>${mark}</div>`;
  }

  const rankList = (window.LumaCheckinManager && typeof window.LumaCheckinManager.getTopicCheckInRankList === 'function')
    ? window.LumaCheckinManager.getTopicCheckInRankList(char.id).slice(0, 5) : [];

  panel.innerHTML = `
    <!-- 签到主卡 -->
    <section class="st2-sign">
      <div class="st2-sign-hd">
        <div class="st2-sign-l">
          <span class="st2-sign-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </span>
          <div>
            <h4>#${char.name}# 每日签到</h4>
            <p>一天一次 · 签到即得 贡献 +100</p>
          </div>
        </div>
        <button onclick="handleSuperTopicCheckIn('${char.id}','${char.name.replace(/'/g, "\\'")}')" class="st2-sign-btn ${checkIn.isCheckedToday ? 'is-done' : ''}">
          ${checkIn.isCheckedToday ? `已签 ${checkIn.streakDays || 0} 天` : '立即签到'}
        </button>
      </div>

      <div class="st2-week">${calendar}</div>

      <div class="st2-sign-stat">
        <div>
          <b>${checkIn.streakDays || 0} 天</b>
          <span>连续签到</span>
        </div>
        <div>
          <b class="gold">${checkIn.totalDays || 0} 天</b>
          <span>累计已签到</span>
        </div>
        <div>
          <b class="violet">Lv.${checkIn.level || 1}</b>
          <span>超话等级</span>
        </div>
      </div>
      <p style="text-align:center;margin-top:10px;font-size:9.5px;color:rgba(223,247,238,.6);font-weight:700;">
        累计贡献 <b style="color:#8ff3cd;">${contribution.toLocaleString()}</b>
        <span style="opacity:.5;"> · 已签 ${checkIn.totalDays || 0} 天</span>
      </p>
    </section>

    <!-- 签到排行榜 -->
    <section class="st2-card" style="padding:12px 11px;">
      <div class="st2-sec">
        <h4><span class="sharp">#</span>连续签到榜 TOP</h4>
        <span class="note">按连签天数排序</span>
      </div>
      <div style="margin-top:8px;">
        ${rankList.length ? rankList.map((item, idx) => `
          <div class="st2-row ${item.isUser ? 'me' : ''}">
            <span class="rk ${idx === 0 ? 'top' : ''}">${idx + 1}</span>
            <img src="${item.avatar}" alt="">
            <div class="who">
              <h6>${item.name}</h6>
              <p>Lv.${item.level || 1} · ${item.badge || '签到打卡'}</p>
            </div>
            <div class="val"><b>${item.days} 天</b><span>连签</span></div>
          </div>
        `).join('') : `<div class="st2-empty" style="padding:16px 0;"><p style="color:rgba(223,247,238,.5);">暂时还没有人签到，快来抢首签！</p></div>`}
      </div>
    </section>
  `;
}
window.renderSuperTopicCheckinTab = renderSuperTopicCheckinTab;

// -------------------------------------------------------------------------
// 打榜/应援 Tab（消耗应援币 → 增长贡献值）
// -------------------------------------------------------------------------
function renderSuperTopicSupportTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const supportCoin = getMyWalletBalance(char.id);
  const contribution = getCharContribution(char.id);
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char) : (char.fans || 0);

  panel.innerHTML = `
    <section class="st2-support-hero">
      <div class="sup-hd">
        <span class="st2-kicker is-hot"># 周边应援中心</span>
        <span class="bal">应援币 ${supportCoin.toLocaleString()}</span>
      </div>
      <h4>为主播 #${char.name}# 应援打榜</h4>
      <p>每日签到领取应援币，购买应援物 1:1 转化为专属贡献值，助推超话热度。</p>
      <div class="sup-stats">
        <div><span>我贡献的应援值</span><b>${contribution.toLocaleString()}</b></div>
        <div><span>超话总热度</span><b style="color:#ffcf5c;">${(fansCount * 3 + contribution).toLocaleString()}</b></div>
      </div>
    </section>

    <div class="st2-sec">
      <h4><span class="sharp">#</span>选择应援周边</h4>
      <span class="note">TAP TO SELECT</span>
    </div>

    <div class="st2-gift-grid">
      ${(window.SUPPORT_GIFTS || []).map(g => `
        <div class="st2-gift ${selectedSupportGiftId === g.id ? 'sel' : ''}" onclick="selectSupportGiftDirect('${g.id}','${char.id}')">
          <span class="g-ic">${g.icon}</span>
          <h6>${g.name}</h6>
          <span class="g-desc">${g.desc}</span>
          <div class="g-btm">
            <span class="g-exp">+${g.exp} 贡献</span>
            <span class="g-price">${g.price} 币</span>
          </div>
        </div>
      `).join('')}
    </div>

    <button onclick="executeSupportGift()" class="st2-cta">立即应援打榜</button>
    <p class="st2-hint">应援币不足？去「签到」每日打卡即可领取 +100</p>
  `;
}
window.renderSuperTopicSupportTab = renderSuperTopicSupportTab;

function selectSupportGiftDirect(giftId, charId) {
  selectedSupportGiftId = giftId;
  const char = getCharById(charId);
  if (char) renderSuperTopicSupportTab(char);
}
window.selectSupportGiftDirect = selectSupportGiftDirect;

// -------------------------------------------------------------------------
// 贡献榜 Tab（真实贡献值）
// -------------------------------------------------------------------------
function renderSuperTopicContributeTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;

  // 真实数据：消费矩阵中所有「别人 → 该角色（含我自己）」的贡献记录
  let supporters = [];
  if (window.LumaGuardManager && typeof window.LumaGuardManager.getTopSupportersForChar === 'function') {
    try {
      supporters = window.LumaGuardManager.getTopSupportersForChar(char.id).map(item => {
        const isUser = String(item.fromId) === 'user';
        const score = Number(item.totalAmount) || 0;
        return {
          id: item.fromId,
          name: isUser ? `${(item.fromName || currentUserName())} (你)` : (item.fromName || '神秘粉丝'),
          avatar: item.fromAvatar || getAvatarFor(item.fromName, 'first'),
          score: score,
          badge: isUser
            ? (score >= 30000 ? '超话神豪' : (score > 0 ? '核心应援官' : '暂未贡献'))
            : '忠实粉丝',
          isUser: isUser
        };
      });
    } catch (e) {}
  }

  if (supporters.length === 0) {
    panel.innerHTML = `
      <div class="st2-card st2-empty">
        <div class="glyph">💎</div>
        <h5>#${char.name}# 暂无贡献记录</h5>
        <p>去「送礼 / 签到 / 打榜」为主播贡献，即可上榜</p>
        <button class="go" onclick="switchSuperTopicTab('support')">去应援</button>
      </div>
    `;
    return;
  }

  supporters.sort((a, b) => b.score - a.score);
  const top1 = supporters[0], top2 = supporters[1], top3 = supporters[2];
  const rest = supporters.slice(3);
  const podium = [
    { col: 'c1', rank: '1', item: top1, crown: '👑' },
    { col: 'c2', rank: '2', item: top2, crown: '🥈' },
    { col: 'c3', rank: '3', item: top3, crown: '🥉' }
  ].filter(p => p.item);

  panel.innerHTML = `
    <!-- 领奖台 Hero -->
    <section class="st2-podium">
      <div class="p-hd">
        <h4><span style="color:#ffcf5c;">#</span>${char.name} · 守护贡献榜</h4>
        <span>送礼 / 签到 / 打榜全计入</span>
      </div>
      <div class="st2-podium-grid">
        ${podium.map(p => `
          <div class="st2-pod-col ${p.col}">
            <div class="p-av"><img src="${p.item.avatar}" alt=""><em>${p.crown}</em></div>
            <div class="p-name">${p.item.name}</div>
            <div class="p-val">${p.item.score.toLocaleString()} 贡献</div>
            <div class="p-base">${p.rank}</div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- 其余榜单 -->
    <div class="st2-card" style="padding:10px 9px;${rest.length ? '' : 'display:none;'}">
      ${rest.map((item, idx) => `
        <div class="st2-row ${item.isUser ? 'me' : ''}">
          <span class="rk">${idx + 4}</span>
          <img src="${item.avatar}" alt="">
          <div class="who">
            <h6>${item.name}</h6>
            <p>${item.badge}</p>
          </div>
          <div class="val rose"><b>${item.score.toLocaleString()}</b><span>贡献值</span></div>
        </div>
      `).join('')}
    </div>

    <p class="st2-hint">累计贡献 = 直播间送礼 1:1 + 每日签到 +100 + 打榜应援</p>
  `;
}
window.renderSuperTopicContributeTab = renderSuperTopicContributeTab;

// -------------------------------------------------------------------------
// 签到执行（真正的持久化 + 贡献/应援币发放 + 真实天数）
// -------------------------------------------------------------------------
function handleSuperTopicCheckIn(charId, charName = '') {
  if (!window.LumaCheckinManager || typeof window.LumaCheckinManager.performCheckIn !== 'function') {
    if (api && api.ui) api.ui.toast('签到系统未就绪，请稍后再试');
    return;
  }
  const topicId = String(charId);
  const checkIn = getCheckIn(topicId);
  const name = charName || '该超话';

  if (checkIn.isCheckedToday) {
    if (api && api.ui) api.ui.toast(`今日已在【${name}】签到过，明天再来～`);
    return;
  }

  const res = window.LumaCheckinManager.performCheckIn('user', topicId);
  if (!res.success) {
    if (api && api.ui) api.ui.toast(`今日已在【${name}】签到过，明天再来～`);
    return;
  }
  const data = res.data || {};

  // 签到贡献 +100
  let nextContribution = 0;
  try { nextContribution = window.addCharContributionScore(topicId, 100) || 0; } catch (e) {}

  if (api && api.ui) {
    api.ui.toast(`🎉 签到成功！贡献 +100 · 应援币 +100 · 已连续签到第 ${data.streakDays || 1} 天！`);
  }
  if (window.LumaDataHub) { try { window.LumaDataHub.emit('checkin', { targetKey: topicId, storeData: data }); } catch (e) {} }
  if (typeof window.notifyCommunityDataChanged === 'function') { try { window.notifyCommunityDataChanged('checkin', { targetKey: topicId }); } catch (e) {} }

  // 若正在超话视图，刷新当前面板
  renderSuperTopicTab();
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

// -------------------------------------------------------------------------
// 打榜执行（消耗应援币 → 增长贡献）
// -------------------------------------------------------------------------
function executeSupportGift() {
  if (!window.LumaCheckinManager || typeof window.LumaCheckinManager.consumeSupportCoin !== 'function') {
    if (api && api.ui) api.ui.toast('打榜系统未就绪，请稍后再试');
    return;
  }
  const char = getActiveChar();
  if (!char) return;
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  if (!gift) return;

  const balance = getMyWalletBalance(char.id);
  if (balance < gift.price) {
    if (api && api.ui) api.ui.toast(`应援币不足（现有 ${balance}，需 ${gift.price}），每日签到可领取 +100`);
    return;
  }

  const res = window.LumaCheckinManager.consumeSupportCoin(char.id, gift.price);
  if (!res.ok) {
    if (api && api.ui) api.ui.toast(res.reason === 'insufficient' ? '应援币不足，每日签到可获取' : '操作失败，请重试');
    return;
  }

  // 消费应援币 → 增长贡献值
  let nextContribution = 0;
  try { nextContribution = window.addCharContributionScore(char.id, gift.exp) || 0; } catch (e) {}

  closeSuperTopicSupportModal();

  if (api && api.ui) {
    api.ui.toast(`🎉 应援成功！为主播【${char.name}】送出「${gift.name}」，贡献值 +${gift.exp}，剩余应援币 ${res.remaining}！`);
  }
  if (typeof window.notifyCommunityDataChanged === 'function') { try { window.notifyCommunityDataChanged('support', { charId: char.id }); } catch (e) {} }
  if (window.LumaDataHub) { try { window.LumaDataHub.emit('contribution', { charId: char.id, addAmount: gift.exp, next: nextContribution }); } catch (e) {} }

  if (currentSuperTopicTab === 'support') renderSuperTopicSupportTab(char);
  else renderSuperTopicTab();
}
window.executeSupportGift = executeSupportGift;

// -------------------------------------------------------------------------
// 打榜弹窗（可选入口，兼容保留）
// -------------------------------------------------------------------------
function openSuperTopicSupportModal() {
  const modal = document.getElementById('superTopicSupportModal');
  if (!modal) return;
  const char = getActiveChar();
  if (!char) return;
  const supportCoin = getMyWalletBalance(char.id);

  const charNameEl = document.getElementById('supportModalCharName');
  const userBalanceEl = document.getElementById('supportModalUserBalance');
  const grid = document.getElementById('supportItemsGrid');
  if (charNameEl) charNameEl.textContent = char.name;
  if (userBalanceEl) userBalanceEl.textContent = `${supportCoin.toLocaleString()} 应援币`;
  if (grid) {
    grid.innerHTML = (window.SUPPORT_GIFTS || []).map(g => `
      <div onclick="selectSupportGift('${g.id}')" class="bg-slate-50 p-2.5 rounded-xl border transition active:scale-95 cursor-pointer text-center ${selectedSupportGiftId === g.id ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40' : 'border-slate-200/70'}" id="supportGiftItem_${g.id}">
        <div class="text-xl">${g.icon}</div>
        <div class="text-xs font-black text-slate-900 mt-1">${g.name}</div>
        <div class="text-[10px] text-rose-600 font-bold mt-0.5">+${g.exp} 贡献</div>
        <div class="text-[8px] text-amber-500">${g.price} 应援币</div>
      </div>
    `).join('');
  }
  updateSupportButtonText();
  modal.classList.remove('hidden');
}
window.openSuperTopicSupportModal = openSuperTopicSupportModal;

function closeSuperTopicSupportModal() {
  const modal = document.getElementById('superTopicSupportModal');
  if (modal) modal.classList.add('hidden');
}
window.closeSuperTopicSupportModal = closeSuperTopicSupportModal;

function selectSupportGift(giftId) {
  selectedSupportGiftId = giftId;
  (window.SUPPORT_GIFTS || []).forEach(g => {
    const el = document.getElementById(`supportGiftItem_${g.id}`);
    if (el) {
      el.className = g.id === giftId
        ? 'bg-rose-50/40 p-2.5 rounded-xl border border-rose-500 ring-2 ring-rose-500/20 transition active:scale-95 cursor-pointer text-center'
        : 'bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 transition active:scale-95 cursor-pointer text-center';
    }
  });
  updateSupportButtonText();
}
window.selectSupportGift = selectSupportGift;

function updateSupportButtonText() {
  const btn = document.getElementById('btnExecuteSupport');
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  if (btn && gift) btn.innerHTML = `<span>确认应援 (消耗 ${gift.price} 应援币 · +${gift.exp}贡献)</span>`;
}

// -------------------------------------------------------------------------
// 关注超话
// -------------------------------------------------------------------------
function handleSuperTopicFollow(hostName) {
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.name) === String(hostName));
  if (!char) return;
  const topicId = String(char.id);
  if (!window.followedSuperTopics) window.followedSuperTopics = [];
  const idx = window.followedSuperTopics.indexOf(topicId);
  if (idx > -1) { window.followedSuperTopics.splice(idx, 1); if (api && api.ui) api.ui.toast(`已取消关注【${hostName}】超话`); }
  else { window.followedSuperTopics.push(topicId); if (api && api.ui) api.ui.toast(`已成功关注【${hostName}】超话！`); }
  try { localStorage.setItem('luma_followed_supertopics', JSON.stringify(window.followedSuperTopics)); } catch (e) {}
  if (typeof dbUpsert === 'function') { try { dbUpsert("luma_supertopic_follows", 'user', { topics: window.followedSuperTopics }); } catch (e) {} }
  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  renderSuperTopicView(currentActiveSuperTopicCharId);
}
window.handleSuperTopicFollow = handleSuperTopicFollow;

// -------------------------------------------------------------------------
// 切换超话抽屉（左拉）
// -------------------------------------------------------------------------
function toggleSuperTopicDrawer(forceState) {
  const backdrop = document.getElementById('superTopicDrawerBackdrop');
  const panel = document.getElementById('superTopicDrawerPanel');
  if (!panel || !backdrop) return;
  const isOpen = panel.classList.contains('open');
  const nextState = (typeof forceState === 'boolean') ? forceState : !isOpen;
  if (nextState) {
    renderSuperTopicDrawer();
    backdrop.classList.add('show');
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
    backdrop.classList.remove('show');
  }
}
window.toggleSuperTopicDrawer = toggleSuperTopicDrawer;

function closeSuperTopicDrawer() { toggleSuperTopicDrawer(false); }
window.closeSuperTopicDrawer = closeSuperTopicDrawer;

function renderSuperTopicDrawer() {
  const container = document.getElementById('superTopicDrawerCharList');
  if (!container) return;
  const chars = window.getAvailableCharsList();
  const totalEl = document.getElementById('superTopicDrawerTotal');
  if (totalEl) totalEl.textContent = chars.length;

  container.innerHTML = chars.map(c => {
    const isCurrent = (String(c.id) === String(currentActiveSuperTopicCharId));
    const contribution = getCharContribution(c.id);
    return `
      <button onclick="selectSuperTopicChar('${c.id}')" class="st2-drow ${isCurrent ? 'cur' : ''}">
        <span class="d-av">
          <img src="${c.avatar}" alt="">
          ${c.isLive ? '<span class="live"></span>' : ''}
        </span>
        <span class="d-tt">
          <h6>#${c.name}超话#</h6>
          <p>${c.category || '明星超话'} · 我的贡献 ${contribution.toLocaleString()}</p>
        </span>
        ${isCurrent ? '<span class="d-cur">当前</span>' : ''}
        <svg class="d-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
  }).join('');
}

function selectSuperTopicChar(charId) {
  closeSuperTopicDrawer();
  currentSuperTopicTab = 'posts';
  renderSuperTopicView(charId);
}
window.selectSuperTopicChar = selectSuperTopicChar;
