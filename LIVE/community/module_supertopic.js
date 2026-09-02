// =========================================================================
// 【模块二·社区子文档2·主播超话系统 v2.0】LIVE/社区/module_supertopic.js
// 浅色杂志感版：暖白底 + 玻璃拟态 + 玫瑰金/紫罗兰品牌电压 + Playfair 衬线 Display。
// 沿用 LUMA 主页语言：.luxe-card 玻璃面板 + btn-brand 玫瑰金 + 系统 sans body。
// 保留全部原有功能：动态 | 签到 | 打榜 | 贡献榜 | 关注 | 左拉切换抽屉
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
// 由超话 id 派生稳定浅色主调（极简版：仅一个非常浅的暖灰底色，0.04 alpha）
function topicHues(id) {
  const s = String(id || '');
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  // 8 套极浅暖灰底色 (每个都几乎接近白, 差异化靠极轻的 hue)
  const tints = [
    'rgba(255, 42, 109, 0.04)',
    'rgba(232, 93, 117, 0.04)',
    'rgba(121, 40, 202, 0.04)',
    'rgba(217, 119, 6, 0.04)',
    'rgba(5, 150, 105, 0.04)',
    'rgba(29, 78, 216, 0.04)',
    'rgba(190, 24, 93, 0.04)',
    'rgba(124, 45, 18, 0.04)'
  ];
  return tints[n % tints.length];
}
// 顶部一句话：幽默搞笑随机短句（每次进超话都不同，逗你一乐）
const SUPERTOPIC_ONE_LINERS = [
  '本超话由摸鱼办公室冠名播出',
  '这里的贡献值，比你的发际线还坚挺',
  '今日份快乐由 #一键三联# 提供',
  '不看会亏，看了会瘦（假的）',
  '欢迎来到：熬夜冠军粉丝故乡',
  '评论区比正片还能整活的秘密基地',
  '点签到的人，钱包和良心都会变厚',
  '主人留下的不只是热爱，还有钱包',
  '主播说：钱是王八蛋，但你得给',
  '只有真心，才配得上今晚的火箭',
  '你的每份贡献，都是主播的续命粮',
  '不出意外的话，这应该是劝你打call',
  '够有钱才叫榜一，够搞笑才叫家人',
  '把爱留在超话，把币花在今天',
  '嘘，别让上面那行小字把你劝退'
];
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
  const oneLiner = SUPERTOPIC_ONE_LINERS[Math.floor(Math.random() * SUPERTOPIC_ONE_LINERS.length)];

  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}超话#`;

  const tabCfg = {
    posts: { label: '动态', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>', sub: 'POSTS' },
    checkin: { label: '签到', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="9 16 11 18 15 14"></polyline></svg>', sub: 'DAILY' },
    support: { label: '打榜', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"></path></svg>', sub: 'CHEER' },
    contribute: { label: '贡献榜', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path></svg>', sub: 'RANK' }
  };

  container.innerHTML = `
    <div class="st2s-layout">
      <!-- 左侧侧边栏 · 56px 宽 -->
      <aside class="st2s-side">
        <button onclick="closeCommunitySubPage()" class="st2s-side-btn" title="返回">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button onclick="toggleSuperTopicDrawer()" class="st2s-side-btn" title="切换超话">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="st2s-side-divider"></div>
        ${['posts', 'checkin', 'support', 'contribute'].map(k => {
          const c = tabCfg[k];
          return `<button id="spTabBtn_${k}" onclick="switchSuperTopicTab('${k}')" class="st2s-side-tab ${currentSuperTopicTab === k ? 'on' : ''}" title="${c.label}">
            ${c.ic}
            <span class="st2s-side-tab-lb">${c.label}</span>
          </button>`;
        }).join('')}
      </aside>

      <!-- 右侧主区 -->
      <div class="st2s-main">
        <!-- 拉高的顶部状态 (132px) -->
        <section class="st2s-hero">
          <button class="st2s-av" onclick="toggleSuperTopicDrawer()" title="切换超话">
            <img src="${char.avatar}" alt="">
            ${char.isLive ? '<span class="st2s-live"></span>' : ''}
          </button>
          <div class="st2s-hero-meta">
            <h2>#${char.name}超话#<span class="st2s-verified" title="官方"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span></h2>
            <p>${char.category || '明星超话'} · 主持人 @${char.name}后援会</p>
            <div class="st2s-hero-stats">
              <div><b>${fansCount.toLocaleString()}</b><span>粉丝</span></div>
              <div><b>${todayDiscuss}</b><span>今日讨论</span></div>
              <div><b>${contribution.toLocaleString()}</b><span>我的贡献</span></div>
              <div><b>${heatValue}</b><span>超话热度</span></div>
            </div>
          </div>
          <button onclick="handleSuperTopicFollow('${char.name.replace(/'/g, "\\'")}')" class="st2s-follow ${isFollowed ? 'is-on' : ''}">
            ${isFollowed ? '已关注' : '+ 关注'}
          </button>
        </section>

        <!-- meta · 短句行 + 当前 tab 标签 (在主区顶) -->
        <div class="st2s-meta-strip">
          <span class="st2s-meta-oneliner">${oneLiner}</span>
          <span class="st2s-meta-tab">${tabCfg[currentSuperTopicTab].sub} · ${tabCfg[currentSuperTopicTab].label}</span>
        </div>

        <!-- 内容面板 -->
        <div id="superTopicPanel" class="st2s-panel" data-tab="${currentSuperTopicTab}"></div>
      </div>
    </div>
  `;

  renderSuperTopicTab();
}
window.renderSuperTopicView = renderSuperTopicView;

// -------------------------------------------------------------------------
// 分段导航切换 (侧边栏 tab)
// -------------------------------------------------------------------------
function switchSuperTopicTab(tabKey) {
  if (currentSuperTopicTab !== tabKey) {
    currentSuperTopicTab = tabKey;
    // 同步顶部 meta-strip 的 tab 文字
    const stripTab = document.querySelector('.st2s-meta-tab');
    if (stripTab) {
      const cfg = {
        posts: 'POSTS · 动态',
        checkin: 'DAILY · 签到',
        support: 'CHEER · 打榜',
        contribute: 'RANK · 贡献榜'
      }[tabKey];
      stripTab.textContent = cfg || '';
    }
  }

  ['posts', 'checkin', 'support', 'contribute'].forEach(k => {
    const btn = document.getElementById(`spTabBtn_${k}`);
    if (!btn) return;
    btn.classList.toggle('on', k === tabKey);
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
    <div class="st2s-sec">
      <h4>超话动态</h4>
      <span class="note">${posts.length} 条 · 加载更多</span>
    </div>

    <div class="st2s-feed">
      ${posts.map(post => `
        <article class="st2s-feed-item" onclick="openTrendDetail('${post.id}')">
          <img class="st2s-feed-av" src="${post.author.avatar}" alt="">
          <div class="st2s-feed-body">
            <div class="st2s-feed-head">
              <div class="st2s-feed-name">
                <b>${post.author.name}</b>
                ${post.author.badge ? `<span class="st2s-feed-bd">${post.author.badge}</span>` : ''}
              </div>
              <span class="st2s-feed-time">${postTime(post)}</span>
            </div>
            <p class="st2s-feed-text">
              <span class="hash">#${char.name}超话#</span> ${post.content}
            </p>
            <div class="st2s-feed-meta" onclick="event.stopPropagation()">
              <button onclick="handlePostAction('${post.id}','repost')" class="st2s-feed-act">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                <span>${post.stats.reposts}</span>
              </button>
              <button onclick="openTrendDetail('${post.id}')" class="st2s-feed-act">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>${post.stats.comments}</span>
              </button>
              <button onclick="handlePostAction('${post.id}','like')" class="st2s-feed-act ${post.stats.isLiked ? 'is-on' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                <span>${post.stats.likes}</span>
              </button>
            </div>
          </div>
        </article>
      `).join('')}
    </div>

    <div class="st2s-composer" onclick="openCreatePostModal('#${char.name}超话#', '@${char.name}')">
      <span class="ph">说点什么, 为主播 <b>#${char.name}#</b> 打 call…</span>
      <span class="send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
    let cls = 'st2s-week-d';
    if (i < dayOfWeek) cls += ' is-past';
    else if (i === dayOfWeek) {
      cls += ' is-now';
      if (checkIn.isCheckedToday) cls += ' is-done';
    }
    calendar += `<div class="${cls}"><span>${weekDays[i]}</span></div>`;
  }

  const rankList = (window.LumaCheckinManager && typeof window.LumaCheckinManager.getTopicCheckInRankList === 'function')
    ? window.LumaCheckinManager.getTopicCheckInRankList(char.id).slice(0, 5) : [];

  panel.innerHTML = `
    <!-- 签到主卡 · 极简白底 1px 描边 -->
    <section class="st2s-card">
      <div class="st2s-row-flex">
        <div class="st2s-t">
          <h4>#${char.name}# 每日签到</h4>
          <p>一天一次 · 签到即得贡献 <b>+100</b></p>
        </div>
        <button onclick="handleSuperTopicCheckIn('${char.id}','${char.name.replace(/'/g, "\\'")}')" class="st2s-btn ${checkIn.isCheckedToday ? 'is-on' : ''}">
          ${checkIn.isCheckedToday ? `已签 ${checkIn.streakDays || 0} 天` : '立即签到'}
        </button>
      </div>

      <div class="st2s-week">${calendar}</div>

      <div class="st2s-stat">
        <div>
          <b>${checkIn.streakDays || 0} 天</b>
          <span>连续签到</span>
        </div>
        <div>
          <b>${checkIn.totalDays || 0} 天</b>
          <span>累计</span>
        </div>
        <div>
          <b>Lv.${checkIn.level || 1}</b>
          <span>超话等级</span>
        </div>
      </div>
    </section>

    <!-- 签到排行榜 -->
    <div class="st2s-sec">
      <h4>连续签到榜 TOP</h4>
      <span class="note">按连签天数</span>
    </div>
    <div class="st2s-card st2s-list">
      ${rankList.length ? rankList.map((item, idx) => `
        <div class="st2s-row ${item.isUser ? 'me' : ''}">
          <span class="rk ${idx === 0 ? 'top1' : (idx === 1 ? 'top2' : (idx === 2 ? 'top3' : ''))}">${idx + 1}</span>
          <img src="${item.avatar}" alt="">
          <div class="who">
            <b>${item.name}</b>
            <p>Lv.${item.level || 1} · ${item.badge || '签到打卡'}</p>
          </div>
          <div class="val"><b>${item.days} 天</b><span>连签</span></div>
        </div>
      `).join('') : `<div class="st2s-empty"><p>暂时还没有人签到, 快来抢首签!</p></div>`}
    </div>
  `;
}
window.renderSuperTopicCheckinTab = renderSuperTopicCheckinTab;

// -------------------------------------------------------------------------
// 打榜/应援 Tab（消耗 LUMA币 → 1:1 增长贡献值）
// -------------------------------------------------------------------------
function renderSuperTopicSupportTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const supportCoin = getMyWalletBalance();
  const contribution = getCharContribution(char.id);
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char) : (char.fans || 0);

  panel.innerHTML = `
    <!-- 打榜主卡 · 极简白底 1px 描边, 无紫色块 -->
    <section class="st2s-card">
      <div class="st2s-row-flex">
        <div class="st2s-t">
          <h4>应援打榜中心</h4>
          <p>LUMA币 <b>${supportCoin.toLocaleString()}</b> · 1 币 = 1 贡献</p>
        </div>
      </div>
      <p class="st2s-quote">为主播 <b>#${char.name}#</b> 应援, 花多少币就涨多少贡献值, 助推超话热度。</p>
      <div class="st2s-stat">
        <div>
          <b>${contribution.toLocaleString()}</b>
          <span>我的贡献</span>
        </div>
        <div>
          <b>${(fansCount * 3 + contribution).toLocaleString()}</b>
          <span>超话热度</span>
        </div>
      </div>
    </section>

    <div class="st2s-sec">
      <h4>选择应援周边</h4>
      <span class="note">TAP TO SELECT</span>
    </div>

    <div class="st2s-gift-grid">
      ${(window.SUPPORT_GIFTS || []).map(g => `
        <div class="st2s-gift ${selectedSupportGiftId === g.id ? 'sel' : ''}" onclick="selectSupportGiftDirect('${g.id}','${char.id}')">
          <span class="g-ic">${g.icon}</span>
          <b>${g.name}</b>
          <span class="g-desc">${g.desc}</span>
          <div class="g-btm">
            <span class="g-exp">+${g.price}</span>
            <span class="g-price">${g.price} 币</span>
          </div>
        </div>
      `).join('')}
    </div>

    <button onclick="executeSupportGift()" class="st2s-cta">立即应援打榜</button>
    <p class="st2s-hint">LUMA币不足? 去钱包充值, 或直播间互动赚币</p>
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

  // 真实数据：统一贡献矩阵中所有「别人 → 该角色（含我自己）」的贡献记录
  // 三大渠道统一累计：直播间送礼 1:1 + 每日签到 +100 + 超话打榜 1:1
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
          giftCount: Number(item.giftCount) || 0,
          badge: isUser
            ? (score >= 30000 ? '超话神豪' : (score > 0 ? '核心应援官' : '暂未贡献'))
            : '忠实粉丝',
          isUser: isUser
        };
      });
    } catch (e) {}
  }

  // 头部：该超话收到的贡献总值
  let totalReceived = 0;
  if (window.LumaGuardManager && typeof window.LumaGuardManager.getTargetReceivedTotal === 'function') {
    try { totalReceived = Number(window.LumaGuardManager.getTargetReceivedTotal(char.id)) || 0; } catch (e) {}
  }

  if (supporters.length === 0) {
    panel.innerHTML = `
      <div class="st2s-card st2s-empty">
        <h5>#${char.name}# 暂无贡献记录</h5>
        <p>去「送礼 / 签到 / 打榜」为主播贡献, 即可上榜</p>
        <button class="st2s-btn" onclick="switchSuperTopicTab('support')">去应援</button>
      </div>
    `;
    return;
  }

  supporters.sort((a, b) => b.score - a.score);
  const rankCls = ['top1', 'top2', 'top3'];
  const medal = ['👑', '🥈', '🥉'];

  panel.innerHTML = `
    <!-- 榜单头部 · 极简: 1 个统计 + 1 行小字 -->
    <div class="st2s-sec">
      <h4>${char.name} · 贡献总榜</h4>
      <span class="note">REAL MATRIX</span>
    </div>
    <div class="st2s-card st2s-list">
      <div class="st2s-total-row">
        <b>${totalReceived.toLocaleString()}</b>
        <span>累计贡献值 · 共 ${supporters.length} 人上榜</span>
      </div>

      ${supporters.map((item, idx) => `
        <div class="st2s-row ${item.isUser ? 'me' : ''}">
          <span class="rk ${idx < 3 ? rankCls[idx] : ''}">${idx < 3 ? medal[idx] : idx + 1}</span>
          <img src="${item.avatar}" alt="">
          <div class="who">
            <b>${item.name}</b>
            <p>${item.badge} · ${item.giftCount} 次</p>
          </div>
          <div class="val"><b>${item.score.toLocaleString()}</b><span>贡献值</span></div>
        </div>
      `).join('')}
    </div>

    <p class="st2s-hint">累计贡献 = 直播间送礼 1:1 + 每日签到 +100 + 超话打榜 1:1</p>
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
    api.ui.toast(`🎉 签到成功！贡献 +100 · 已连续签到第 ${data.streakDays || 1} 天！`);
  }
  if (window.LumaDataHub) { try { window.LumaDataHub.emit('checkin', { targetKey: topicId, storeData: data }); } catch (e) {} }
  if (typeof window.notifyCommunityDataChanged === 'function') { try { window.notifyCommunityDataChanged('checkin', { targetKey: topicId }); } catch (e) {} }

  // 若正在超话视图，刷新当前面板
  renderSuperTopicTab();
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

// -------------------------------------------------------------------------
// 打榜执行（消耗 LUMA币 → 1:1 增长贡献值，与直播间送礼同一钱包）
// -------------------------------------------------------------------------
function executeSupportGift() {
  const char = getActiveChar();
  if (!char) return;
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  if (!gift) return;

  const cost = Math.max(0, Math.floor(Number(gift.price) || 0));
  if (cost <= 0) {
    if (api && api.ui) api.ui.toast('该应援物价格异常，请重新选择');
    return;
  }

  const balance = Math.max(0, Number(window.currentWalletBalance) || 0);
  if (balance < cost) {
    if (api && api.ui) api.ui.toast(`💎 LUMA币不足（现有 ${balance}，需 ${cost}）`);
    if (typeof window.openRechargeModal === 'function') { try { window.openRechargeModal(); } catch (e) {} }
    return;
  }

  // 扣款：优先走宿主钱包 api.wallet.pay，失败不阻断（与直播间送礼同款策略）
  const payPromise = (window.api && window.api.wallet && typeof window.api.wallet.pay === 'function')
    ? window.api.wallet.pay({ amount: cost, title: 'LUMA超话打榜', detail: `${gift.name}` }).catch(() => {})
    : Promise.resolve();

  Promise.resolve(payPromise).then(() => {
    // 扣减钱包余额并落盘宿主 db（真机重进不丢）
    window.currentWalletBalance = Math.max(0, balance - cost);
    if (typeof window.dbUpsert === 'function') {
      try { window.dbUpsert("app_wallet", "vault_data", { balance: window.currentWalletBalance }); } catch (e) {}
    }
    if (typeof window.syncWalletDisplays === 'function') { try { window.syncWalletDisplays(); } catch (e) {} }

    // 1:1 转化：花 cost 币 → 贡献 +cost（走统一贡献矩阵，真机持久化）
    let nextContribution = 0;
    try { nextContribution = window.addCharContributionScore(char.id, cost) || 0; } catch (e) {}

    if (api && api.ui) {
      api.ui.toast(`🎉 打榜成功！为主播【${char.name}】送出「${gift.name}」，贡献 +${cost}，剩余 ${window.currentWalletBalance} 币`);
    }
    if (typeof window.notifyCommunityDataChanged === 'function') { try { window.notifyCommunityDataChanged('support', { charId: char.id, addAmount: cost, next: nextContribution }); } catch (e) {} }
    if (window.LumaDataHub) { try { window.LumaDataHub.emit('contribution', { charId: char.id, addAmount: cost, next: nextContribution }); } catch (e) {} }

    if (currentSuperTopicTab === 'support') renderSuperTopicSupportTab(char);
    else renderSuperTopicTab();
  });
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
  const supportCoin = getMyWalletBalance();

  const charNameEl = document.getElementById('supportModalCharName');
  const userBalanceEl = document.getElementById('supportModalUserBalance');
  const grid = document.getElementById('supportItemsGrid');
  if (charNameEl) charNameEl.textContent = char.name;
  if (userBalanceEl) userBalanceEl.textContent = `${supportCoin.toLocaleString()} LUMA币`;
  if (grid) {
    grid.innerHTML = (window.SUPPORT_GIFTS || []).map(g => `
      <div onclick="selectSupportGift('${g.id}')" class="bg-slate-50 p-2.5 rounded-xl border transition active:scale-95 cursor-pointer text-center ${selectedSupportGiftId === g.id ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40' : 'border-slate-200/70'}" id="supportGiftItem_${g.id}">
        <div class="text-xl">${g.icon}</div>
        <div class="text-xs font-black text-slate-900 mt-1">${g.name}</div>
        <div class="text-[10px] text-rose-600 font-bold mt-0.5">+${g.price} 贡献</div>
        <div class="text-[8px] text-amber-500">${g.price} LUMA币</div>
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
  if (btn && gift) btn.innerHTML = `<span>确认应援 (消耗 ${gift.price} LUMA币 · +${gift.price}贡献)</span>`;
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
  const adding = idx === -1;
  if (adding) {
    window.followedSuperTopics.push(topicId);
    if (api && api.ui) api.ui.toast(`已成功关注【${hostName}】超话！`);
  } else {
    window.followedSuperTopics.splice(idx, 1);
    if (api && api.ui) api.ui.toast(`已取消关注【${hostName}】超话`);
  }
  // 超话关注是帖子级别，与主播关注(followedHosts)互不写入
  try { localStorage.setItem('luma_followed_supertopics', JSON.stringify(window.followedSuperTopics)); } catch (e) {}
  if (typeof dbUpsert === 'function') {
    try { dbUpsert("luma_supertopic_follows", 'user', { topics: window.followedSuperTopics }); } catch (e) {}
  }
  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  // 粉丝数据源全应用统一：刷新所有粉丝展示
  if (window.LumaFansManager && typeof window.LumaFansManager.syncAllFansDisplays === 'function') {
    try { window.LumaFansManager.syncAllFansDisplays(topicId); } catch (e) {}
  }
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
