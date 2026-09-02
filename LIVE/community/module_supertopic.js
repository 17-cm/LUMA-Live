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
  const fromFeed = (window.weiboPosts || []).filter(p =>
    (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name))
  );
  const user = (window.__SUPERTOPIC_POSTS__ || {})[char.id] || [];
  return user.concat(fromFeed);
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
// 超话主视图：返回 / 切超话 / 9 个 sidebar tab + 拉高 hero + 内容面板
// -------------------------------------------------------------------------
const SUPERTOPIC_TAB_ORDER = ['posts', 'compose', 'rules', 'checkin', 'support', 'contribute', 'manage', 'report', 'refresh'];

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
    posts:      { label: '动态',     sub: 'POSTS', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
    compose:    { label: '发帖',     sub: 'POST',  ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>' },
    rules:      { label: '规则',     sub: 'RULES', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>' },
    checkin:    { label: '签到',     sub: 'DAILY', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="9 16 11 18 15 14"></polyline></svg>' },
    support:    { label: '打榜',     sub: 'CHEER', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"></path></svg>' },
    contribute: { label: '贡献榜',   sub: 'RANK',  ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path></svg>' },
    manage:     { label: '管理',     sub: 'MGMT',  ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>' },
    report:     { label: '举报',     sub: 'REPORT',ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>' },
    refresh:    { label: '刷新',     sub: 'RELOAD',ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>' }
  };
  const tabOrder = SUPERTOPIC_TAB_ORDER;

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
        ${tabOrder.map(k => {
          const c = tabCfg[k];
          const checkIn = getCheckIn(char.id);
          const userLevel = (checkIn && checkIn.level) || 1;
          const isLocked = (k === 'manage' && userLevel < 50);
          return `<button id="spTabBtn_${k}" onclick="switchSuperTopicTab('${k}')" class="st2s-side-tab ${currentSuperTopicTab === k ? 'on' : ''} ${isLocked ? 'is-locked' : ''}" title="${c.label}">
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
  // 详情页直接切回动态
  if (currentSuperTopicTab === 'post_detail') {
    currentSuperTopicTab = tabKey;
    closePostDetail();
  } else {
    currentSuperTopicTab = tabKey;
  }

  // 同步顶部 meta-strip 的 tab 文字
  const stripTab = document.querySelector('.st2s-meta-tab');
  if (stripTab) {
    const stripCfg = {
      posts: 'POSTS · 动态',
      compose: 'POST · 发帖',
      rules: 'RULES · 规则',
      checkin: 'DAILY · 签到',
      support: 'CHEER · 打榜',
      contribute: 'RANK · 贡献榜',
      manage: 'MGMT · 管理',
      report: 'REPORT · 举报',
      refresh: 'RELOAD · 刷新'
    }[tabKey];
    stripTab.textContent = stripCfg || '';
  }

  SUPERTOPIC_TAB_ORDER.forEach(k => {
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
  else if (currentSuperTopicTab === 'compose') renderSuperTopicComposeTab(char);
  else if (currentSuperTopicTab === 'rules') renderSuperTopicRulesTab(char);
  else if (currentSuperTopicTab === 'checkin') renderSuperTopicCheckinTab(char);
  else if (currentSuperTopicTab === 'support') renderSuperTopicSupportTab(char);
  else if (currentSuperTopicTab === 'contribute') renderSuperTopicContributeTab(char);
  else if (currentSuperTopicTab === 'manage') renderSuperTopicManageTab(char);
  else if (currentSuperTopicTab === 'report') renderSuperTopicReportTab(char);
  else if (currentSuperTopicTab === 'refresh') renderSuperTopicRefreshTab(char);
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
        <article class="st2s-feed-item" onclick="openSuperTopicPostDetail('${post.id}')">
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
              <button onclick="openSuperTopicPostDetail('${post.id}')" class="st2s-feed-act">
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

// -------------------------------------------------------------------------
// 发帖 Tab: 副 tag / @ / 正文 / 上传图 / 图片描述(给 AI) / 发送
// -------------------------------------------------------------------------
function renderSuperTopicComposeTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const user = getCurrentUser();
  const primaryTag = `#${char.name}超话#`;
  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>发新帖</h4>
      <span class="note">强制归属「${primaryTag}」</span>
    </div>
    <div class="st2s-compose">
      <div class="st2s-compose-row">
        <div class="st2s-compose-chip is-locked">
          <span class="lb">主 tag</span>
          <span class="val">${primaryTag}</span>
          <span class="lock" title="强制归属">· 固定</span>
        </div>
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">副 tag <span class="hint">(逗号分隔, 可空)</span></label>
        <input id="cpSubTag" class="st2s-compose-in" type="text" placeholder="例: #应援打卡#  #vlog#">
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">@ 提到 <span class="hint">(用 @ 触发, 可空)</span></label>
        <input id="cpMention" class="st2s-compose-in" type="text" placeholder="例: @${char.name}  @应援团">
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">正文 <span class="hint">(必填)</span></label>
        <textarea id="cpContent" class="st2s-compose-ta" rows="6" maxlength="500" placeholder="说点什么…"></textarea>
        <div class="st2s-compose-count"><span id="cpCount">0</span> / 500</div>
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">图片 <span class="hint">(可空, 1 张)</span></label>
        <div class="st2s-compose-up">
          <input id="cpImage" type="file" accept="image/*" class="hidden">
          <button onclick="document.getElementById('cpImage').click()" class="st2s-compose-up-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span id="cpImageLabel">选择图片</span>
          </button>
          <img id="cpPreview" class="st2s-compose-preview hidden" alt="">
          <button id="cpImageClear" class="st2s-compose-clr hidden" onclick="clearComposeImage()">移除</button>
        </div>
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">图片描述 <span class="hint">(给 AI 看, 不公开发布)</span></label>
        <input id="cpImageDesc" class="st2s-compose-in" type="text" placeholder="例: 直播截图, 表情惊讶, 背景舞台紫色灯光">
      </div>
      <div class="st2s-compose-ft">
        <button onclick="submitSuperTopicPost('${char.id}')" class="st2s-compose-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          发布
        </button>
      </div>
    </div>
  `;
  // 计数器
  const ta = document.getElementById('cpContent');
  if (ta) ta.addEventListener('input', () => {
    document.getElementById('cpCount').textContent = String(ta.value.length);
  });
  // 图片选择预览
  const img = document.getElementById('cpImage');
  if (img) img.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const prev = document.getElementById('cpPreview');
      const lbl = document.getElementById('cpImageLabel');
      const clr = document.getElementById('cpImageClear');
      if (prev) { prev.src = ev.target.result; prev.classList.remove('hidden'); }
      if (lbl) lbl.textContent = f.name;
      if (clr) clr.classList.remove('hidden');
    };
    reader.readAsDataURL(f);
  });
}
window.renderSuperTopicComposeTab = renderSuperTopicComposeTab;

function clearComposeImage() {
  const img = document.getElementById('cpImage');
  const prev = document.getElementById('cpPreview');
  const lbl = document.getElementById('cpImageLabel');
  const clr = document.getElementById('cpImageClear');
  if (img) img.value = '';
  if (prev) { prev.src = ''; prev.classList.add('hidden'); }
  if (lbl) lbl.textContent = '选择图片';
  if (clr) clr.classList.add('hidden');
}
window.clearComposeImage = clearComposeImage;

function submitSuperTopicPost(charId) {
  const char = (window.getAvailableCharsList() || []).find(c => String(c.id) === String(charId));
  if (!char) return;
  const content = (document.getElementById('cpContent') && document.getElementById('cpContent').value || '').trim();
  if (!content) { showToast('正文不能为空', 'warn'); return; }
  const subTag = (document.getElementById('cpSubTag') && document.getElementById('cpSubTag').value || '').trim();
  const mention = (document.getElementById('cpMention') && document.getElementById('cpMention').value || '').trim();
  const imageDesc = (document.getElementById('cpImageDesc') && document.getElementById('cpImageDesc').value || '').trim();
  const prev = document.getElementById('cpPreview');
  const image = (prev && !prev.classList.contains('hidden')) ? prev.src : '';
  const user = getCurrentUser();
  const primaryTag = `#${char.name}超话#`;
  const tagParts = [primaryTag];
  if (subTag) {
    subTag.split(/[\s,，]+/).filter(Boolean).forEach(t => {
      const t2 = t.startsWith('#') ? t : ('#' + t);
      tagParts.push(t2.endsWith('#') ? t2 : (t2 + '#'));
    });
  }
  const mentionParts = mention ? mention.split(/\s+/).filter(Boolean) : [];
  const post = {
    id: 'st_post_' + Date.now(),
    author: {
      name: user.name || '我',
      avatar: user.avatar || (char.avatar || ''),
      badge: user.badge || 'Lv.1 新粉',
      verified: false
    },
    createdAt: Date.now(),
    tag: tagParts.join(' '),
    mention: mentionParts.join(' '),
    content,
    image,
    imageDesc,
    stats: { reposts: 0, comments: 0, likes: 0, isLiked: false, isDownloaded: false },
    commentTree: []
  };
  const all = window.__SUPERTOPIC_POSTS__ = window.__SUPERTOPIC_POSTS__ || {};
  all[char.id] = all[char.id] || [];
  all[char.id].unshift(post);
  try { localStorage.setItem('st_user_posts', JSON.stringify(all)); } catch (_) {}
  showToast('发布成功', 'ok');
  currentSuperTopicTab = 'posts';
  renderSuperTopicTab();
}
window.submitSuperTopicPost = submitSuperTopicPost;

// 把发帖也加入 data_hub 持久化
function persistSuperTopicPost(post) {
  try {
    if (window.LumaDataHub && typeof window.LumaDataHub.put === 'function') {
      window.LumaDataHub.put('super_topic_posts', post.id, post);
    }
  } catch (_) {}
}
window.persistSuperTopicPost = persistSuperTopicPost;

// 启动时恢复用户帖子
(function restoreUserPosts() {
  try {
    const raw = localStorage.getItem('st_user_posts');
    if (!raw) return;
    const all = JSON.parse(raw);
    window.__SUPERTOPIC_POSTS__ = all;
  } catch (_) {}
})();

// -------------------------------------------------------------------------
// 规则 Tab
// -------------------------------------------------------------------------
const SUPERTOPIC_RULES = [
  { n: '01', t: '粉丝专属', d: '本超话仅对 #${name}# 的粉丝开放签到、打榜、发帖功能, 请先关注主播。' },
  { n: '02', t: '内容规范', d: '禁止发布: 色情、暴力、谣言、抄袭、人身攻击、引战、刷屏、广告外链等违规内容。' },
  { n: '03', t: '图片规范', d: '上传图片必须与 ${name} 本人相关(直播截图、舞台照、应援物料等), 严禁盗图。' },
  { n: '04', t: '发言礼貌', d: '请尊重其他粉丝、不同意见请理性讨论; 严禁@主播本人催更、催播、催互动。' },
  { n: '05', t: '原创激励', d: '原创图文 / 视频 / 二创 / 应援打榜贴, 视内容质量给予 50 - 200 贡献值奖励。' },
  { n: '06', t: '等级权限', d: 'Lv.1 - 9: 签到 / 浏览; Lv.10 - 49: 发帖 / 评论; Lv.50+: 管理 / 删帖 / 移出。' },
  { n: '07', t: '违规处理', d: '初犯: 警告 + 禁言 24h; 再犯: 永久禁言 + 移出超话; 严重者上报平台封号。' },
  { n: '08', t: '申诉通道', d: '如对处理有异议, 请通过侧栏「举报」旁的反馈通道联系 @${name}后援会会长。' }
];
function renderSuperTopicRulesTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const rules = SUPERTOPIC_RULES.map(r => ({
    n: r.n, t: r.t, d: r.d.replace(/\$\{name\}/g, char.name)
  }));
  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>超话守则</h4>
      <span class="note">8 条 · 适用于 #${char.name}超话#</span>
    </div>
    <div class="st2s-rules">
      ${rules.map(r => `
        <div class="st2s-rule">
          <div class="st2s-rule-no">${r.n}</div>
          <div class="st2s-rule-body">
            <div class="st2s-rule-t">${r.t}</div>
            <div class="st2s-rule-d">${r.d}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
window.renderSuperTopicRulesTab = renderSuperTopicRulesTab;

// -------------------------------------------------------------------------
// 举报 Tab
// -------------------------------------------------------------------------
const SUPERTOPIC_REPORT_REASONS = [
  { v: 'porn',   l: '色情 / 低俗内容' },
  { v: 'viol',   l: '暴力 / 血腥' },
  { v: 'rumor',  l: '谣言 / 虚假信息' },
  { v: 'attack', l: '人身攻击 / 引战' },
  { v: 'plag',   l: '抄袭 / 盗图' },
  { v: 'spam',   l: '广告 / 刷屏' },
  { v: 'leak',   l: '泄露隐私 / 个人信息' },
  { v: 'other',  l: '其他 (请说明)' }
];
function renderSuperTopicReportTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const reasonOpts = SUPERTOPIC_REPORT_REASONS.map(r =>
    `<option value="${r.v}">${r.l}</option>`
  ).join('');
  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>举报</h4>
      <span class="note">违规内容 / 违规用户, 我们将 24h 内处理</span>
    </div>
    <div class="st2s-form">
      <div class="st2s-form-row">
        <label class="st2s-form-lb">举报原因 <span class="req">*</span></label>
        <select id="rpReason" class="st2s-form-sel">${reasonOpts}</select>
      </div>
      <div class="st2s-form-row">
        <label class="st2s-form-lb">详细描述 <span class="req">*</span></label>
        <textarea id="rpDesc" class="st2s-form-ta" rows="5" maxlength="300" placeholder="请说明: 涉及用户 / 帖子 / 时间 / 证据截图描述…"></textarea>
        <div class="st2s-form-count"><span id="rpCount">0</span> / 300</div>
      </div>
      <div class="st2s-form-row">
        <label class="st2s-form-lb">联系方式 <span class="hint">(可空, 方便我们回访)</span></label>
        <input id="rpContact" class="st2s-form-in" type="text" placeholder="例: 站内信 ID / 邮箱">
      </div>
      <div class="st2s-form-ft">
        <button onclick="submitSuperTopicReport('${char.id}')" class="st2s-form-submit is-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          提交举报
        </button>
      </div>
    </div>
  `;
  const ta = document.getElementById('rpDesc');
  if (ta) ta.addEventListener('input', () => {
    document.getElementById('rpCount').textContent = String(ta.value.length);
  });
}
window.renderSuperTopicReportTab = renderSuperTopicReportTab;

function submitSuperTopicReport(charId) {
  const reason = (document.getElementById('rpReason') || {}).value;
  const desc = (document.getElementById('rpDesc') && document.getElementById('rpDesc').value || '').trim();
  const contact = (document.getElementById('rpContact') && document.getElementById('rpContact').value || '').trim();
  if (!reason) { showToast('请选择原因', 'warn'); return; }
  if (!desc) { showToast('请填写详细描述', 'warn'); return; }
  const record = {
    id: 'st_report_' + Date.now(),
    charId, reason, desc, contact,
    createdAt: Date.now(),
    status: 'pending'
  };
  try { window.LumaDataHub && window.LumaDataHub.put && window.LumaDataHub.put('super_topic_reports', record.id, record); } catch (_) {}
  showToast('举报已提交, 我们会尽快处理', 'ok');
  setTimeout(() => renderSuperTopicReportTab({ id: charId, name: '该' }), 600);
}
window.submitSuperTopicReport = submitSuperTopicReport;

// -------------------------------------------------------------------------
// 管理 Tab: Lv.50+ 解锁
// -------------------------------------------------------------------------
function renderSuperTopicManageTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const checkIn = getCheckIn(char.id);
  const userLevel = (checkIn && checkIn.level) || 1;
  const unlocked = userLevel >= 50;
  panel.innerHTML = unlocked ? `
    <div class="st2s-sec">
      <h4>超话管理</h4>
      <span class="note">Lv.${userLevel} · 已解锁管理权限</span>
    </div>
    <div class="st2s-manage">
      <div class="st2s-manage-card">
        <div class="st2s-manage-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 5-3.5 7.5-8.5 9-5-1.5-8.5-4-8.5-9V5l8.5-3 8.5 3z"/></svg>
        </div>
        <div>
          <div class="t">违规帖子</div>
          <div class="d">最近 7 天 0 条待审</div>
        </div>
        <span class="badge">0</span>
      </div>
      <div class="st2s-manage-card">
        <div class="st2s-manage-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-2-2"/></svg>
        </div>
        <div>
          <div class="t">用户管理</div>
          <div class="d">Lv.1 入门 → Lv.50 资深, 共 ${userLevel} 级</div>
        </div>
        <span class="badge">·</span>
      </div>
      <div class="st2s-manage-card">
        <div class="st2s-manage-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div class="t">数据看板</div>
          <div class="d">日活 / 帖子 / 签到 / 打榜</div>
        </div>
        <span class="badge">·</span>
      </div>
      <div class="st2s-manage-card">
        <div class="st2s-manage-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        </div>
        <div>
          <div class="t">超话设置</div>
          <div class="d">封面 / 简介 / 主持人</div>
        </div>
        <span class="badge">·</span>
      </div>
    </div>
  ` : `
    <div class="st2s-sec">
      <h4>超话管理</h4>
      <span class="note">Lv.${userLevel} / Lv.50 解锁</span>
    </div>
    <div class="st2s-manage-locked">
      <div class="st2s-manage-lock-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="st2s-manage-lock-t">管理权限未解锁</div>
      <div class="st2s-manage-lock-d">当前 Lv.${userLevel}, 达到 <b>Lv.50</b> 后可管理本超话: 删帖 / 移人 / 看数据。</div>
      <div class="st2s-manage-lock-tip">每日签到 / 发帖 / 打榜, 即可快速升级。</div>
      <button onclick="switchSuperTopicTab('checkin')" class="st2s-manage-lock-btn">去签到攒经验</button>
    </div>
  `;
}
window.renderSuperTopicManageTab = renderSuperTopicManageTab;

// -------------------------------------------------------------------------
// 刷新 Tab: 重新渲染当前超话动态
// -------------------------------------------------------------------------
function renderSuperTopicRefreshTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="st2s-refresh">
      <div class="st2s-refresh-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </div>
      <div class="st2s-refresh-t">刷新「#${char.name}超话#」动态</div>
      <div class="st2s-refresh-d">重新拉取最新帖子、签到、打榜数据。</div>
      <button onclick="doRefreshSuperTopic('${char.id}')" class="st2s-refresh-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        立即刷新
      </button>
      <div id="spRefreshResult" class="st2s-refresh-result"></div>
    </div>
  `;
}
window.renderSuperTopicRefreshTab = renderSuperTopicRefreshTab;

function doRefreshSuperTopic(charId) {
  const btn = document.querySelector('.st2s-refresh-btn');
  if (btn) btn.disabled = true;
  if (window.LumaDataHub && typeof window.LumaDataHub.flush === 'function') {
    try { window.LumaDataHub.flush(); } catch (_) {}
  }
  setTimeout(() => {
    if (btn) btn.disabled = false;
    const r = document.getElementById('spRefreshResult');
    if (r) {
      r.innerHTML = `<div class="ok">已刷新 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}</div>`;
    }
    showToast('刷新成功', 'ok');
    setTimeout(() => switchSuperTopicTab('posts'), 600);
  }, 800);
}
window.doRefreshSuperTopic = doRefreshSuperTopic;

// -------------------------------------------------------------------------
// 帖子详情 (同面板切换, 不入 PageStack)
// -------------------------------------------------------------------------
function openSuperTopicPostDetail(postId) {
  const char = getActiveChar();
  if (!char) return;
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const posts = topicPostsFor(char);
  const post = posts.find(p => String(p.id) === String(postId));
  if (!post) { showToast('帖子不存在', 'warn'); return; }
  currentSuperTopicTab = 'post_detail';
  panel.dataset.mode = 'detail';
  panel.innerHTML = renderSuperTopicPostDetail(post, char);
}
window.openSuperTopicPostDetail = openSuperTopicPostDetail;

function closePostDetail() {
  currentSuperTopicTab = 'posts';
  const panel = document.getElementById('superTopicPanel');
  if (panel) { panel.dataset.mode = 'list'; }
  renderSuperTopicTab();
}
window.closePostDetail = closePostDetail;

function renderSuperTopicPostDetail(post, char) {
  const hasImage = !!post.image;
  const comments = (post.commentTree && post.commentTree.length) ? post.commentTree : [];
  return `
    <div class="st2s-detail">
      <div class="st2s-detail-bar">
        <button onclick="closePostDetail()" class="st2s-detail-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
          返回动态
        </button>
        <span class="st2s-detail-meta">帖子详情 · ${postTime(post)}</span>
      </div>
      <article class="st2s-detail-card">
        <header class="st2s-detail-head">
          <img class="st2s-detail-av" src="${post.author.avatar || ''}" alt="">
          <div>
            <div class="st2s-detail-name">
              <b>${post.author.name}</b>
              ${post.author.badge ? `<span class="st2s-detail-bd">${post.author.badge}</span>` : ''}
            </div>
            <div class="st2s-detail-tag">${post.tag || ''} ${post.mention || ''}</div>
          </div>
        </header>
        <p class="st2s-detail-text">${post.content || ''}</p>
        ${hasImage ? `<div class="st2s-detail-img-wrap"><img class="st2s-detail-img" src="${post.image}" alt=""></div>` : ''}
        <div class="st2s-detail-bar2">
          <span>${new Date(post.createdAt || Date.now()).toLocaleString('zh-CN', { hour12: false })}</span>
        </div>
        <div class="st2s-detail-actions">
          <button onclick="handlePostAction('${post.id}','like')" class="st2s-detail-act ${post.stats.isLiked ? 'is-on' : ''}">
            <svg viewBox="0 0 24 24" fill="${post.stats.isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <span>${post.stats.likes || 0}</span>
          </button>
          <button onclick="handlePostAction('${post.id}','repost')" class="st2s-detail-act">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <span>${post.stats.reposts || 0}</span>
          </button>
          <button class="st2s-detail-act">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${post.stats.comments || 0}</span>
          </button>
          ${hasImage ? `<a href="${post.image}" download="${(post.author.name || 'image').replace(/[^\w一-龥]/g, '_')}_${post.id}.png" class="st2s-detail-act">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>下载</span>
          </a>` : ''}
        </div>
      </article>
      <div class="st2s-detail-comments">
        <h5>评论 <span>${comments.length}</span></h5>
        ${comments.length ? comments.map(c => `
          <div class="st2s-detail-cm">
            <img class="st2s-detail-cm-av" src="${c.avatar || ''}" alt="">
            <div>
              <div class="st2s-detail-cm-name">${c.name || '匿名'}</div>
              <div class="st2s-detail-cm-text">${c.text || ''}</div>
            </div>
          </div>
        `).join('') : '<div class="st2s-detail-cm-empty">还没有评论, 快来抢沙发</div>'}
      </div>
    </div>
  `;
}
window.renderSuperTopicPostDetail = renderSuperTopicPostDetail;
