// =========================================================================
// 【模块二·社区子文档2·主播超话系统 v2.0】LIVE/社区/module_supertopic.js
// 浅色杂志感版：暖白底 + 玻璃拟态 + 玫瑰金/紫罗兰品牌电压 + Playfair 衬线 Display。
// 沿用 LUMA 主页语言：.luxe-card 玻璃面板 + btn-brand 玫瑰金 + 系统 sans body。
// 保留全部原有功能：动态 | 签到 | 打榜 | 贡献榜 | 关注 | 左拉切换抽屉
// 贡献三渠道(送礼1:1 / 签到 / 发帖 / 评论)统一计入贡献矩阵，具体产出见
// supertopic_privilege.js 的 ST2S_EARN，所有对外文案都从 st2sEarnSummary() 取。
// =========================================================================
var api = window.api || {};
let currentActiveSuperTopicCharId = null;
let currentSuperTopicTab = 'posts';
let superTopicDetailPostId = null;
// 详情页交互状态：展开中的楼层 id 集合 / 当前回复目标楼层 id
let st2sExpandedComments = new Set();
let st2sReplyTarget = null;
let st2sEditingPostId = null;      // 正在原地编辑的帖子
let st2sRulesEditing = false;        // 守则原地编辑模式
let selectedSupportGiftId = 'gift_flower';
let superTopicVirtualScrollerInstance = null;

// -------------------------------------------------------------------------
// 工具函数
// -------------------------------------------------------------------------
function showToast(msg, type) {
  console.log(`[Toast ${type}]`, msg);
  if (window.showMessage) window.showMessage(msg);
}
// 玩家身份缓存：发帖/评论一律使用当前真实玩家(主页已同步或宿主 SDK)，不再出现“游客用户”占位
let _hostUserCache = null;
async function syncHostUserProfile() {
  try {
    const sdk = window.AiPhone || window.api;
    if (sdk && sdk.user && typeof sdk.user.getProfile === 'function') {
      const u = await sdk.user.getProfile();
      if (u) {
        const name = u.name || u.nickname || '';
        const avatar = u.avatar || u.avatarUrl || u.icon || '';
        _hostUserCache = {
          id: u.id || 'user_001',
          name: name || '玩家',
          avatar: avatar || (typeof window.getAvatar === 'function' ? window.getAvatar(name || '玩家', 'first') : ''),
          badge: u.badge || '',
          verified: !!u.verified
        };
        return _hostUserCache;
      }
    }
  } catch (e) { console.warn('[SuperTopic] 获取玩家资料失败:', e); }
  return null;
}
function getCurrentUser() {
  const src = _hostUserCache || window.currentUser || null;
  if (src && src.name) {
    return {
      id: src.id || 'user_001',
      name: src.name,
      avatar: src.avatar || src.avatarUrl || (typeof window.getAvatar === 'function' ? window.getAvatar(src.name, 'first') : ''),
      badge: src.badge || '',
      verified: !!src.verified
    };
  }
  return {
    id: 'user_001',
    name: '玩家',
    avatar: (typeof window.getAvatar === 'function') ? window.getAvatar('玩家', 'first') : '',
    badge: '',
    verified: false
  };
}
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
  const user = st2sStore.postsOf(char.id);   // 含用户帖与 AI 生成帖，同一套入库
  // 管理员删过的帖子（含 weiboPosts 种子帖）靠墓碑过滤，重启也不会复活
  return user.concat(fromFeed).filter(p => !st2sIsDeletedPost(p.id));
}
// 供 supertopic_generate.js 跨文件调用：不挂 window 的话，
// 生成引擎里的 typeof 守卫会静默跳过 → 防重复列表失效、详情页刷新键报「帖子不存在」
window.topicPostsFor = topicPostsFor;

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
        return window.formatDynamicTime(post.createdAt);
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
  const lvInfo = st2sLevelInfo(char.id);
  const topicPosts = topicPostsFor(char);
  const todayDiscuss = topicPosts.length + 18;
  const heatValue = (fansCount * 3 + contribution).toLocaleString();
  const [a, b] = topicHues(char.id);
  const oneLiner = SUPERTOPIC_ONE_LINERS[Math.floor(Math.random() * SUPERTOPIC_ONE_LINERS.length)];

  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}超话#`;

  const tabCfg = {
    posts:      { label: '动态',     sub: 'POSTS', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
    compose:    { label: '发帖',     sub: 'POST',  ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' },
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
        <button onclick="toggleSuperTopicDrawer()" class="st2s-side-btn" title="切换超话">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="st2s-side-divider"></div>
        ${tabOrder.map(k => {
          const c = tabCfg[k];
          // 锁由权限表推导：发帖要 Lv.10，管理要 Lv.50
          const perm = (k === 'compose') ? 'post' : (k === 'manage') ? 'manage' : null;
          const need = perm ? ST2S_PERMS[perm].lv : 0;
          const isLocked = !!perm && lvInfo.level < need;
          const tip = isLocked ? `${c.label} · 需 Lv.${need}` : c.label;
          return `<button id="spTabBtn_${k}" onclick="switchSuperTopicTab('${k}')" class="st2s-side-tab ${currentSuperTopicTab === k ? 'on' : ''} ${isLocked ? 'is-locked' : ''}" title="${tip}">
            ${c.ic}
            <span class="st2s-side-tab-lb">${c.label}</span>
            ${isLocked ? `<span class="st2s-side-tab-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>` : ''}
          </button>`;
        }).join('')}
      </aside>

      <!-- 右侧主区 -->
      <div class="st2s-main">
        <!-- 拉高的顶部状态 (132px) -->
        <section class="st2s-hero">
          <div class="st2s-hero-top">
            <button class="st2s-av" onclick="toggleSuperTopicDrawer()" title="切换超话">
              <img src="${char.avatar}" alt="">
              ${char.isLive ? '<span class="st2s-live"></span>' : ''}
            </button>
            <div class="st2s-hero-meta">
              <h2>#${char.name}超话#<span class="st2s-verified" title="官方"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span><span class="st2s-lv ${isFollowed ? '' : 'is-off'}" title="${isFollowed ? '每 ' + lvInfo.perLevel.toLocaleString() + ' 贡献升 1 级' : '关注后开启等级'}">${isFollowed ? 'Lv.' + lvInfo.level : '未关注'}</span></h2>
              <p>${char.category || '明星超话'} · 主持人 @${char.name}后援会</p>
            </div>
            <button onclick="handleSuperTopicFollow('${char.name.replace(/'/g, "\\'")}')" class="st2s-follow ${isFollowed ? 'is-on' : ''}">
              ${isFollowed ? '已关注' : '+ 关注'}
            </button>
          </div>
          <div class="st2s-hero-stats">
            <div><span>粉丝</span><b>${fansCount.toLocaleString()}</b></div>
            <div><span>今日讨论</span><b>${todayDiscuss}</b></div>
            <div><span>我的贡献</span><b>${contribution.toLocaleString()}</b></div>
            <div><span>超话热度</span><b>${heatValue}</b></div>
          </div>
          ${isFollowed ? `
          <div class="st2s-lvbar">
            <span class="lb">Lv.${lvInfo.level}</span>
            <span class="track"><i style="width:${lvInfo.pct}%"></i></span>
            <span class="tip">再 ${lvInfo.need.toLocaleString()} 贡献升 Lv.${lvInfo.level + 1}</span>
          </div>` : `
          <div class="st2s-lvbar is-off">
            <span class="tip">关注本超话后开启等级与发言权限</span>
          </div>`}
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
  st2sRulesEditing = false;      // 离开就退出守则编辑态
  st2sEditingPostId = null;
  // 锁住的 tab 不切换，只提示门槛
  const chGuard = getActiveChar();
  if (chGuard) {
    const permMap = { compose: 'post', manage: 'manage' };
    if (permMap[tabKey] && !st2sGuard(chGuard.id, permMap[tabKey])) return;
  }
  superTopicDetailPostId = null;
  currentSuperTopicTab = tabKey;

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
  if (superTopicDetailPostId) {
    const posts = topicPostsFor(char);
    const post = posts.find(p => String(p.id) === String(superTopicDetailPostId));
    if (post) {
      paintSuperTopicDetail(post, char);   // 原来这里丢了返回值 → 详情页从未挂载
      return;
    }
    superTopicDetailPostId = null;
  }
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

// ── 会长公告（展示贴）────────────────────────────────────
// 不是帖子，不进 commentTree、不参与点赞，纯粹是超话开出来时的一张门面。
// 口吻：后援会会长写给第一个点进来的人。只讲玩法和氛围，
// 禁令与等级表在「规则」里，这里刻意不重复。
function st2sWelcomePanel(char) {
  const nm = String(char.name || '').replace(/'/g, "\\'");
  return `
  <div class="st2s-welcome">
    <div class="st2s-welcome-head">
      <span class="st2s-welcome-pin">置顶</span>
      <h3>写给刚点进来的你</h3>
      <p class="st2s-welcome-by">—— @${nm}后援会会长 · 本超话版务</p>
    </div>

    <div class="st2s-welcome-body">
      <p>你好，我是会长。这个超话从开服撑到今天，一直是我在打理。</p>
      <p>你现在看到的是一片空地。也说明 —— 第一个发帖的人，很可能就是你。</p>

      <div class="st2s-wl">
        <div class="k">这里都在聊什么</div>
        <div class="v">直播间的切片和名场面、舞台上下两种样子、看不懂的攻略和打得漂亮的一局、
          画的手写的剪的二创、蹲活动的搭子。也包括今天特别开心、或者特别不开心，
          只想找个懂的人说一句的那种帖子。这里都收。</div>
      </div>

      <div class="st2s-wl">
        <div class="k">怎么融进来最快</div>
        <div class="v">先点右上角<b>关注</b>，不关注是纯看的状态。然后<b>签到</b>，
          一天一次别断。第三件事才是重点：<b>别急着发第一帖，先去别人底下冒个泡</b>。
          评论是这里认识人最快的路，比发帖管用得多。</div>
      </div>

      <div class="st2s-wl">
        <div class="k">第一帖写什么好</div>
        <div class="v">不用憋大题目。今天他哪句话把你逗笑了，或者你为一个操作拍了一下桌子 ——
          就写那个。短没关系，越具体越有人回。
          写「签到第 47 天」是打卡，写「今天他声音听着有点哑」才是记录。</div>
      </div>

      <div class="st2s-wl">
        <div class="k">会长的一点私心</div>
        <div class="v">追星这件事，外人看着是数据，我们自己知道是日子。
          你在这里写下的东西，主要是写给半年后的自己看的。
          到时候翻回来，你会感谢当时肯动笔的你。</div>
      </div>

      <p class="st2s-welcome-end">就这样。想说话就说话，这里一直有人。</p>
    </div>

    <div class="st2s-welcome-ft">
      <button type="button" onclick="handleSuperTopicFollow('${nm}')">关注超话</button>
      <button type="button" class="is-primary" onclick="switchSuperTopicTab('checkin')">今天签到</button>
    </div>
  </div>`;
}
window.st2sWelcomePanel = st2sWelcomePanel;

function renderSuperTopicPostsTab(charId) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(charId)) || chars[0];
  const posts = topicPostsFor(char);

  // 空超话不再塞一条模板帖冒充内容 —— 那玩意儿既不能点也不能评论，
  // 只会让广场看起来像坏了。改成一张完整的会长公告面板，有帖即自动消失。
  if (posts.length === 0) {
    panel.innerHTML = st2sWelcomePanel(char);
    return;
  }

  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>超话动态</h4>
      <span class="note">${posts.length} 条 · 下拉加载更多</span>
    </div>

    <div class="st2s-feed">
      ${posts.map(post => {
        const author = post.author || {};
        const avatarSrc = (typeof window.getPostAuthorAvatar === 'function')
          ? window.getPostAuthorAvatar(post)
          : (author.avatar || (typeof window.getAvatar === 'function' ? window.getAvatar(author.name, 'emoji') : ''));
        const subTags = post.subTags || [];
        const deviceTag = postDeviceTag(post);
        // 广场列表不显示主 tag / @（只留一行正文），它们连同彩色样式一起放到详情页
        const subTagHtml = subTags.map(t => `<span class="sub">${t}</span>`).join('');
        const verifiedHtml = author.verified ? '<span class="st2s-feed-verified">V</span>' : '';
        return `
          <article class="st2s-feed-item" onclick="openSuperTopicPostDetail('${post.id}')">
            <div class="st2s-feed-av-wrap">
              ${avatarSrc
                ? `<img class="st2s-feed-av${author.isChar ? ' is-char' : ''}" src="${avatarSrc}" alt="">`
                : `<div class="st2s-feed-av st2s-feed-av-fallback${author.isChar ? ' is-char' : ''}">${(author.name || '?').charAt(0)}</div>`}
              ${verifiedHtml}
            </div>
            <div class="st2s-feed-body">
              <p class="st2s-feed-line"><span class="txt">${post.content || ''}</span></p>
              <div class="st2s-feed-meta">
                <span class="who">${author.name || ''}</span><span class="sep">·</span><span class="tm">${postTime(post)}</span><span class="sep">·</span><span class="dev">${deviceTag}</span>${subTagHtml}
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}
window.renderSuperTopicPostsTab = renderSuperTopicPostsTab;

// -------------------------------------------------------------------------
// 签到 Tab（一天一次，贡献值按 ST2S_EARN.checkin、应援币+100，真实连续天数）
// -------------------------------------------------------------------------
// 补签卡：数量与来源都留好接口，等聊天链路做完直接接上
function st2sCardPassCount(charId) {
  try {
    const m = (window.LumaCheckinManager && window.LumaCheckinManager.cardPass) || null;
    return (m && Number(m[String(charId)])) || 0;
  } catch (e) { return 0; }
}
function st2sUseCardPass(charId) {
  const n = st2sCardPassCount(charId);
  if (!n) { showToast('还没有补签卡 · 只能由角色在聊天中赠送', 'warn'); return; }
  showToast('补签功能待聊天链路开放后启用', 'warn');
}
window.st2sCardPassCount = st2sCardPassCount;
window.st2sUseCardPass = st2sUseCardPass;

function renderSuperTopicCheckinTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const checkIn = getCheckIn(char.id);
  const contribution = getCharContribution(char.id);
  const lv = st2sLevelInfo(char.id);
  const cards = st2sCardPassCount(char.id);
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
          <p>一天一次 · 签到即得贡献 <b>+${ST2S_EARN.checkin.toLocaleString()}</b></p>
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
          <b>Lv.${lv.level}</b>
          <span>超话等级</span>
        </div>
      </div>

      <!-- 补签卡：唯一来源是角色在聊天中赠送，聊天链路未开放前恒为 0 -->
      <div class="st2s-cardpass">
        <div class="st2s-cardpass-l">
          <b>补签卡 ${cards} 张</b>
          <span>唯一获取途径：${char.name} 本人在聊天中赠送, 收到后自动到账</span>
        </div>
        <button type="button" class="st2s-cardpass-btn" onclick="st2sUseCardPass('${char.id}')">使用</button>
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
  // 三大渠道统一累计：直播间送礼 1:1 + 每日签到(见 ST2S_EARN) + 超话打榜 1:1
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

    <p class="st2s-hint">累计贡献 = ${st2sEarnSummary()}</p>
  `;
}
window.renderSuperTopicContributeTab = renderSuperTopicContributeTab;

// -------------------------------------------------------------------------
// 签到执行（真正的持久化 + 贡献/应援币发放 + 真实天数）
// -------------------------------------------------------------------------
function handleSuperTopicCheckIn(charId, charName = '') {
  if (!st2sGuard(charId, 'checkin')) return;
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

  // 签到计入贡献（产出见 ST2S_EARN）
  const earned = st2sEarn(topicId, 'checkin');
  const nextContribution = getCharContribution(topicId);

  if (api && api.ui) {
    api.ui.toast(`🎉 签到成功！贡献 +${(ST2S_EARN.checkin).toLocaleString()} · 已连续签到第 ${data.streakDays || 1} 天！`);
  }
  if (window.LumaDataHub) { try { window.LumaDataHub.emit('checkin', { targetKey: topicId, storeData: data }); } catch (e) {} }
  if (typeof window.notifyCommunityDataChanged === 'function') { try { window.notifyCommunityDataChanged('checkin', { targetKey: topicId }); } catch (e) {} }

  // 升级了要连 hero 的等级条一起刷，只刷面板会看不到变化
  if (earned && earned.after > earned.before) renderSuperTopicView(currentActiveSuperTopicCharId);
  else renderSuperTopicTab();
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

// -------------------------------------------------------------------------
// 打榜执行（消耗 LUMA币 → 1:1 增长贡献值，与直播间送礼同一钱包）
// -------------------------------------------------------------------------
function executeSupportGift() {
  const char = getActiveChar();
  if (!char) return;
  if (!st2sGuard(char.id, 'support')) return;
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
        <label class="st2s-compose-lb">副 tag <span class="hint">(逗号分隔, 可空)</span></label>
        <input id="cpSubTag" class="st2s-compose-in" type="text" autocomplete="off">
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">@ 提到 <span class="hint">(可空)</span></label>
        <input id="cpMention" class="st2s-compose-in" type="text" autocomplete="off">
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">正文 <span class="hint">(必填)</span></label>
        <textarea id="cpContent" class="st2s-compose-ta" rows="6" maxlength="500" placeholder="说点什么…"></textarea>
        <div class="st2s-compose-count"><span id="cpCount">0</span> / 500</div>
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">图片描述 <span class="hint">(给 AI 看, 不公开发布)</span></label>
        <input id="cpImageDesc" class="st2s-compose-in" type="text" autocomplete="off">
      </div>
      <div class="st2s-compose-row">
        <label class="st2s-compose-lb">图片 <span class="hint">(可空, 1 张)</span></label>
        <div class="st2s-compose-up">
          <input id="cpImage" type="file" accept="image/*" class="hidden">
          <img id="cpPreview" class="st2s-compose-preview hidden" alt="">
          <span id="cpImageLabel" class="st2s-compose-fname hidden"></span>
          <button id="cpImageClear" class="st2s-compose-clr hidden" onclick="clearComposeImage()" type="button">移除</button>
        </div>
      </div>
      <div class="st2s-compose-ft">
        <button type="button" class="st2s-compose-up-btn" onclick="document.getElementById('cpImage').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>上传图片</span>
        </button>
        <button type="button" onclick="submitSuperTopicPost('${char.id}')" class="st2s-compose-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span>发布</span>
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
      if (lbl) { lbl.textContent = f.name; lbl.classList.remove('hidden'); }
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
  if (lbl) { lbl.textContent = ''; lbl.classList.add('hidden'); }
  if (clr) clr.classList.add('hidden');
}
window.clearComposeImage = clearComposeImage;

async function submitSuperTopicPost(charId) {
  const char = (window.getAvailableCharsList() || []).find(c => String(c.id) === String(charId));
  if (!char) return;
  if (!st2sGuard(charId, 'post')) return;
  const content = (document.getElementById('cpContent') && document.getElementById('cpContent').value || '').trim();
  if (!content) { showToast('正文不能为空', 'warn'); return; }
  const subTag = (document.getElementById('cpSubTag') && document.getElementById('cpSubTag').value || '').trim();
  const mention = (document.getElementById('cpMention') && document.getElementById('cpMention').value || '').trim();
  const imageDesc = (document.getElementById('cpImageDesc') && document.getElementById('cpImageDesc').value || '').trim();
  const prev = document.getElementById('cpPreview');
  const image = (prev && !prev.classList.contains('hidden')) ? prev.src : '';
  await syncHostUserProfile();
  const user = getCurrentUser();
  const primaryTag = `#${char.name}超话#`;
  const subTagParts = [];
  if (subTag) {
    subTag.split(/[\s,，]+/).filter(Boolean).forEach(t => {
      const t2 = t.startsWith('#') ? t : ('#' + t);
      subTagParts.push(t2.endsWith('#') ? t2 : (t2 + '#'));
    });
  }
  const mentionParts = mention ? mention.split(/\s+/).filter(Boolean).map(m => m.startsWith('@') ? m : ('@' + m)) : [];
  const postAvatar = user.avatar || (typeof window.getAvatar === 'function' ? window.getAvatar(user.name || '玩家', 'first') : (char.avatar || ''));
  const post = {
    id: 'st_post_' + Date.now(),
    charId: char.id,
    author: {
      name: user.name || '我',
      avatar: postAvatar,
      badge: user.badge || 'Lv.1 新粉',
      verified: false
    },
    createdAt: Date.now(),
    primaryTag,
    subTags: subTagParts,
    mentions: mentionParts,
    content,
    image,
    imageDesc,
    device: postDeviceTag({}),   // 发布瞬间定一次，之后不再变
    stats: { reposts: 0, comments: 0, likes: 0, isLiked: false, isDownloaded: false },
    commentTree: []
  };
  const all = window.__SUPERTOPIC_POSTS__ = window.__SUPERTOPIC_POSTS__ || {};
  all[char.id] = all[char.id] || [];
  all[char.id].unshift(post);
  // 原来这两行都是死代码：localStorage 在沙盒不可用，LumaDataHub 没有 put 方法
  st2sStore.save(post);
  st2sEarn(char.id, 'post');
  // 自己发的帖子不该一直空着：后台按本超话预设生成一轮回应，写完就地刷新详情。
  // 不 await —— 用户点完发布就该看到帖子，评论慢慢来。
  if (window.st2sGen) { try { window.st2sGen.respondToUserPost(post); } catch (e) {} }
  showToast('发布成功', 'ok');
  currentSuperTopicTab = 'posts';
  renderSuperTopicView(char.id);   // 贡献变了，等级条要一起刷
}
window.submitSuperTopicPost = submitSuperTopicPost;



// 用户帖与生成帖统一由 supertopic_store.js 从宿主 api.db 拉回，见 st2sStore.load()


// -------------------------------------------------------------------------
// 规则 Tab
// -------------------------------------------------------------------------
const SUPERTOPIC_RULES = [
  { n: '01', t: '粉丝专属', d: '未关注本超话时只能浏览动态与帖子详情, 不能点赞、评论、签到、应援或发帖; 点右上角「+ 关注」即可解锁发言。' },
  { n: '02', t: '内容规范', d: '禁止发布: 色情、暴力、谣言、抄袭、人身攻击、引战、刷屏、广告外链等违规内容。' },
  { n: '03', t: '图片规范', d: '上传图片必须与 ${name} 本人相关(直播截图、舞台照、应援物料等), 严禁盗图。' },
  { n: '04', t: '发言礼貌', d: '请尊重其他粉丝、不同意见请理性讨论; 严禁@主播本人催更、催播、催互动。' },
  { n: '05', t: '原创激励', d: '原创图文 / 视频 / 二创 / 应援打榜贴, 视内容质量给予 50 - 200 贡献值奖励。' },
  { n: '06', t: '等级权限', d: '每 ${perLv} 贡献升 1 级, 各超话独立计算。产出: ${earn}。Lv.1(关注即得): 点赞 / 评论 / 签到 / 应援; Lv.10: 发帖; Lv.20: 编辑自己的帖子; Lv.50: 超话管理(删除任意帖子与评论、修改本守则)。' },
  { n: '07', t: '违规处理', d: '初犯: 警告 + 禁言 24h; 再犯: 永久禁言 + 移出超话; 严重者上报平台封号。' },
  { n: '08', t: '申诉通道', d: '如对处理有异议, 请通过侧栏「举报」旁的反馈通道联系 @${name}后援会会长。' },
  { n: '09', t: '签到说明', d: '每日 00:00 重置, 断签会重新计数, 签到贡献 +${earnCheckin}。补签卡唯一获取途径是 ${name} 本人在聊天中赠送, 平台不对外发放, 收到后会自动出现在这里。' },
  { n: '10', t: '应援规范', d: '打榜送礼纯属自愿, 严禁任何形式的集资、垫付、攀比晒单; 未成年人请在监护人同意下参与。' },
  { n: '11', t: '发帖分类', d: '发帖请至少带一个副 tag 标明内容类型(如 #日常# #攻略# #二创#), 便于他人检索与版务归档。' },
  { n: '12', t: '转载注明', d: '搬运二创必须注明原作者与出处链接, 未授权商用素材一律删除; 三次违规取消发帖权限。' },
  { n: '13', t: '隐私保护', d: '严禁公开他人真实姓名、住址、行程、账号密码等隐私信息, 人肉行为直接永久移出并上报。' },
  { n: '14', t: '理性追星', d: '不围堵、不跟拍私人行程、不拨打工作电话; 主播下播后的时间属于主播自己。' },
  { n: '15', t: '版务生效', d: '本守则由 @${name}后援会制定并保留最终解释权, 修订后于本页面公示, 公示即生效。' }
];
// 原地编辑要把内容塞进 value / textarea，必须转义，否则正文里的引号会截断属性
function escHtml(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(t) {
  return escHtml(t).replace(/"/g, '&quot;');
}
// 守则正文里的占位符统一在此展开，改产出/门槛只需动一处
function st2sFillRule(text, char) {
  return String(text)
    .replace(/\$\{name\}/g, char ? char.name : '')
    .replace(/\$\{perLv\}/g, (window.CONTRIB_PER_LEVEL || 10000).toLocaleString())
    .replace(/\$\{earnCheckin\}/g, ST2S_EARN.checkin.toLocaleString())
    .replace(/\$\{earn\}/g, st2sEarnSummary());
}
function renderSuperTopicRulesTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const custom = st2sHasCustomRules(char.id);
  const editing = st2sRulesEditing && custom;
  const rules = st2sRulesFor(char.id, SUPERTOPIC_RULES).map(r => ({
    n: r.n, t: r.t, d: st2sFillRule(r.d, char)
  }));
  const canManage = st2sCan(char.id, 'manage').ok;
  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>超话守则</h4>
      <span class="note">${editing
        ? '编辑中 · 改完点空白处自动保存'
        : rules.length + ' 条 · 适用于 #' + char.name + '超话#' + (custom ? ' · 已由版务修订' : '')}</span>
      ${canManage ? `<button type="button" class="st2s-sec-act ${editing ? 'is-on' : ''}" title="${editing ? '完成编辑' : '修改守则'}" onclick="st2sToggleRulesEdit('${char.id}')">
        ${editing
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`}
      </button>` : ''}
    </div>
    <div class="st2s-rules ${editing ? 'is-editing' : ''}">
      ${rules.map((r, i) => editing ? `
        <div class="st2s-rule is-edit">
          <div class="st2s-rule-no">${r.n}</div>
          <div class="st2s-rule-body">
            <input class="st2s-rule-t-in" value="${escAttr(r.t)}" autocomplete="off"
                   onchange="st2sRuleField('${char.id}', ${i}, 't', this.value)">
            <textarea class="st2s-rule-d-in" rows="2"
                      onchange="st2sRuleField('${char.id}', ${i}, 'd', this.value)">${escHtml(r.d)}</textarea>
          </div>
          <button type="button" class="st2s-rule-del" title="删除这条" onclick="st2sRuleDel('${char.id}', ${i})">&times;</button>
        </div>` : `
        <div class="st2s-rule">
          <div class="st2s-rule-no">${r.n}</div>
          <div class="st2s-rule-body">
            <div class="st2s-rule-t">${r.t}</div>
            <div class="st2s-rule-d">${r.d}</div>
          </div>
        </div>`).join('')}
    </div>
    ${editing ? `
    <div class="st2s-rules-ft">
      <button type="button" onclick="st2sRuleAdd('${char.id}')">+ 新增一条</button>
      <button type="button" class="is-danger" onclick="st2sRuleRestoreDefault('${char.id}')">恢复默认守则</button>
    </div>` : ''}
  `;
}
window.renderSuperTopicRulesTab = renderSuperTopicRulesTab;

// ── 守则原地编辑（照热搜那套：切换后文字变输入框，失焦即存）──
function st2sToggleRulesEdit(charId) {
  const char = getCharById(charId);
  if (!char) return;
  if (st2sRulesEditing) { st2sRulesEditing = false; renderSuperTopicRulesTab(char); return; }
  if (!st2sGuard(charId, 'manage')) return;
  // 一旦开始编辑就接管为自定义守则，默认守则保持原样可随时回落
  if (!st2sHasCustomRules(charId)) {
    st2sSaveRules(charId, SUPERTOPIC_RULES.map(r => ({ n: r.n, t: r.t, d: st2sFillRule(r.d, char) })));
  }
  st2sRulesEditing = true;
  renderSuperTopicRulesTab(char);
}
function st2sRuleField(charId, idx, field, value) {
  const list = (st2sRulesFor(charId, SUPERTOPIC_RULES) || []).slice();
  if (!list[idx]) return;
  list[idx][field] = String(value || '').trim();
  st2sSaveRules(charId, list);
}
function st2sRuleAdd(charId) {
  const list = (st2sRulesFor(charId, SUPERTOPIC_RULES) || []).slice();
  list.push({ n: '', t: '新规则', d: '' });
  st2sSaveRules(charId, st2sRenumber(list));
  renderSuperTopicRulesTab(getCharById(charId));
  setTimeout(() => {
    const all = document.querySelectorAll('.st2s-rule-d-in');
    const last = all[all.length - 1];
    if (last) last.focus();
  }, 60);
}
function st2sRuleDel(charId, idx) {
  const list = (st2sRulesFor(charId, SUPERTOPIC_RULES) || []).slice();
  list.splice(idx, 1);
  st2sSaveRules(charId, st2sRenumber(list));
  renderSuperTopicRulesTab(getCharById(charId));
}
function st2sRuleRestoreDefault(charId) {
  st2sOpenModal({
    title: '恢复默认守则',
    body: '将丢弃本版务的全部修改，恢复为平台默认的 ' + SUPERTOPIC_RULES.length + ' 条守则。',
    ok: '恢复', onOk: function () {
      st2sSaveRules(charId, null);
      st2sRulesEditing = false;
      showToast('已恢复默认守则', 'ok');
      renderSuperTopicRulesTab(getCharById(charId));
    }
  });
}
// 从管理面板跳到规则页并直接进入编辑态
function st2sGoEditRules(charId) {
  if (!st2sGuard(charId, 'manage')) return;
  switchSuperTopicTab('rules');
  st2sToggleRulesEdit(charId);
}
function st2sRenumber(list) {
  return list.map((r, i) => ({ n: String(i + 1).padStart(2, '0'), t: r.t, d: r.d }));
}
window.st2sToggleRulesEdit = st2sToggleRulesEdit;
window.st2sGoEditRules = st2sGoEditRules;
window.st2sRuleField = st2sRuleField;
window.st2sRuleAdd = st2sRuleAdd;
window.st2sRuleDel = st2sRuleDel;
window.st2sRuleRestoreDefault = st2sRuleRestoreDefault;

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
  if (!st2sGuard(charId, 'report')) return;
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
  const lvInfo = st2sLevelInfo(char.id);
  const followed = st2sFollowed(char.id);
  const tombCount = st2sTombCount();

  // 权限阶梯：与 ST2S_PERMS 同源，面板只陈述规则，真正拦截在 st2sGuard
  const tiers = [
    { k: 'like',    t: '点赞',     d: '给他人帖子点赞' },
    { k: 'comment', t: '评论',     d: '发表评论与回复' },
    { k: 'checkin', t: '签到',     d: '每日签到, 贡献 +' + ST2S_EARN.checkin.toLocaleString() },
    { k: 'support', t: '应援',     d: '送礼打榜, 贡献按 1:1 累计' },
    { k: 'report',  t: '举报',     d: '举报违规内容' },
    { k: 'post',    t: '发帖',     d: '发布新帖' },
    { k: 'editOwn', t: '编辑',     d: '改自己帖子的正文 · 详情页小铅笔' },
    { k: 'manage',  t: '超话管理', d: '删任意帖子与评论 · 垃圾桶 / 改守则 · 铅笔' }
  ];
  const rowHtml = tiers.map(x => {
    const need = ST2S_PERMS[x.k].lv;
    const ok = followed && lvInfo.level >= need;
    const gate = !followed ? '需关注' : (need <= 1 ? '关注即得' : 'Lv.' + need);
    return `
      <div class="st2s-tier ${ok ? 'is-on' : ''}">
        <div class="st2s-tier-main">
          <div class="t">${x.t}</div>
          <div class="d">${x.d}</div>
        </div>
        <div class="st2s-tier-gate">
          ${ok ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
          <span>${gate}</span>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="st2s-sec">
      <h4>超话等级</h4>
      <span class="note">每 ${lvInfo.perLevel.toLocaleString()} 贡献升 1 级 · 各超话独立计算</span>
    </div>
    <div class="st2s-manage">
      <div class="st2s-lvcard">
        <div class="st2s-lvcard-top">
          <span class="big">${followed ? 'Lv.' + lvInfo.level : '未解锁'}</span>
          <span class="cur">${followed ? lvInfo.contrib.toLocaleString() + ' 贡献' : '关注本超话后开始累计'}</span>
        </div>
        ${followed ? `
        <div class="st2s-lvbar">
          <span class="lb">${lvInfo.level}</span>
          <span class="track"><i style="width:${lvInfo.pct}%"></i></span>
          <span class="tip">再 ${lvInfo.need.toLocaleString()} 升 Lv.${lvInfo.level + 1}</span>
        </div>` : ''}
      </div>

      <div class="st2s-sec is-inner">
        <h4>权限阶梯</h4>
        <span class="note">${tiers.filter(x => followed && lvInfo.level >= ST2S_PERMS[x.k].lv).length} / ${tiers.length} 已解锁</span>
      </div>
      ${rowHtml}

      ${followed && lvInfo.level >= ST2S_PERMS.manage.lv ? `
      <div class="st2s-sec is-inner">
        <h4>管理操作</h4>
        <span class="note">Lv.${ST2S_PERMS.manage.lv}+ 已解锁</span>
      </div>
      <div class="st2s-tier is-act" onclick="st2sGoEditRules('${char.id}')">
        <div class="st2s-tier-main">
          <div class="t">修改超话守则</div>
          <div class="d">编辑后对本超话所有访客生效</div>
        </div>
        <div class="st2s-tier-gate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div>
      </div>
      <div class="st2s-tier is-act ${tombCount ? '' : 'is-idle'}" onclick="st2sRestoreTrash()">
        <div class="st2s-tier-main">
          <div class="t">回收站</div>
          <div class="d">${tombCount ? '已删除 ' + tombCount + ' 项, 点此全部恢复' : '暂无已删除内容'}</div>
        </div>
        <div class="st2s-tier-gate"><span>${tombCount || '0'}</span></div>
      </div>` : ''}
    </div>
  `;
}
window.renderSuperTopicManageTab = renderSuperTopicManageTab;

// 回收站：墓碑计数与一键恢复（管理员误删还有回头路）
function st2sTombCount() {
  try { const t = st2sTombStats(); return t.posts + t.comments; } catch (e) { return 0; }
}
function st2sRestoreTrash() {
  if (!st2sTombCount()) { showToast('回收站是空的', 'warn'); return; }
  st2sOpenModal({
    title: '恢复已删除内容',
    body: '将恢复全部 ' + st2sTombCount() + ' 项被删除的帖子与评论。',
    ok: '恢复',
    onOk: function () {
      st2sRestoreAll();
      showToast('已恢复', 'ok');
      renderSuperTopicView(currentActiveSuperTopicCharId);
    }
  });
}
window.st2sRestoreTrash = st2sRestoreTrash;

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
      <div class="st2s-refresh-d">调用模型按超话预设生成 5~7 条新动态 —— 主 tag 由模型自己挑，会铺到<b>所有</b>超话而不只是这一个，再逐条铺开评论区。约需十几秒。</div>
      <button onclick="doRefreshSuperTopic('${char.id}')" class="st2s-refresh-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        立即刷新
      </button>
      <div id="spRefreshResult" class="st2s-refresh-result"></div>
    </div>
  `;
}
window.renderSuperTopicRefreshTab = renderSuperTopicRefreshTab;

async function doRefreshSuperTopic(charId) {
  const btn = document.querySelector('.st2s-refresh-btn');
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  const out = document.getElementById('spRefreshResult');
  if (out) out.innerHTML = '<div class="run">正在调用模型生成新动态，约需十几秒…</div>';
  try {
    await window.st2sGen.feed(charId);
    if (out) out.innerHTML = `<div class="ok">已生成 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}</div>`;
    setTimeout(() => switchSuperTopicTab('posts'), 700);
  } catch (e) {
    if (out) out.innerHTML = '<div class="err">生成失败，请检查模型配置后重试</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  }
}
window.doRefreshSuperTopic = doRefreshSuperTopic;

// 详情页评论区小刷新键：只给这一条帖子追加更多评论
async function st2sRefreshComments(postId) {
  // 不在这里碰 DOM：moreComments 首尾各重绘一次，按钮态由 cmtBusy 推导
  await window.st2sGen.moreComments(postId);
}
window.st2sRefreshComments = st2sRefreshComments;

// -------------------------------------------------------------------------
// 帖子详情 (同面板切换, 不入 PageStack)
// -------------------------------------------------------------------------
function openSuperTopicPostDetail(postId) {
  const char = getActiveChar();
  if (!char) return;
  const posts = topicPostsFor(char);
  const post = posts.find(p => String(p.id) === String(postId));
  if (!post) { showToast('帖子不存在', 'warn'); return; }
  superTopicDetailPostId = post.id;
  currentSuperTopicTab = 'posts';
  // 同步侧边栏高亮与顶部元条：详情来自动态，保持「动态」高亮
  SUPERTOPIC_TAB_ORDER.forEach(k => {
    const btn = document.getElementById(`spTabBtn_${k}`);
    if (btn) btn.classList.toggle('on', k === 'posts');
  });
  const stripTab = document.querySelector('.st2s-meta-tab');
  if (stripTab) stripTab.textContent = 'POSTS · 动态';
  renderSuperTopicTab();
}
window.openSuperTopicPostDetail = openSuperTopicPostDetail;

// ── 管理员 / 楼主动作（按键只在达标后渲染出来，这里再兜一层校验）──
function st2sRemovePost(postId) {
  const found = findSuperTopicPost(postId);
  if (!found || !st2sGuard(found.charId, 'manage')) return;
  st2sConfirmDelete('帖子', () => {
    st2sDeletePost(postId);
    showToast('已删除该帖子', 'ok');
    closePostDetail();
  });
}
function st2sRemoveComment(postId, key) {
  const found = findSuperTopicPost(postId);
  if (!found || !st2sGuard(found.charId, 'manage')) return;
  st2sConfirmDelete('评论', () => {
    st2sDeleteComment(key);
    showToast('已删除该评论', 'ok');
    rerenderSuperTopicDetail();
  });
}
function st2sEditPost(postId) {
  const found = findSuperTopicPost(postId);
  if (!found || !st2sGuard(found.charId, 'editOwn')) return;
  st2sEditingPostId = (st2sEditingPostId === postId) ? null : postId;
  rerenderSuperTopicDetail();
  if (st2sEditingPostId) {
    setTimeout(() => {
      const ta = document.getElementById('st2sEditTa');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 50);
  }
}
function st2sCancelEditPost() {
  st2sEditingPostId = null;
  rerenderSuperTopicDetail();
}
function st2sSaveEditPost(postId) {
  const ta = document.getElementById('st2sEditTa');
  const v = (ta && ta.value || '').trim();
  if (!v) { showToast('正文不能为空', 'warn'); return; }
  const found = findSuperTopicPost(postId);
  if (!found || !st2sGuard(found.charId, 'editOwn')) return;
  found.post.content = v;
  persistSuperTopicPost(found);
  st2sEditingPostId = null;
  showToast('已保存', 'ok');
  rerenderSuperTopicDetail();
}
window.st2sRemovePost = st2sRemovePost;
window.st2sEditPost = st2sEditPost;
window.st2sCancelEditPost = st2sCancelEditPost;
window.st2sSaveEditPost = st2sSaveEditPost;
window.st2sRemoveComment = st2sRemoveComment;

function closePostDetail() {
  if (typeof closeSuperTopicReplyModal === 'function') closeSuperTopicReplyModal();
  superTopicDetailPostId = null;
  renderSuperTopicTab();
}
window.closePostDetail = closePostDetail;

// ── 详情辅助：楼层 id / 计数 / 查找 / 重绘 ──────────────────
// 楼层 id 按位置生成 (f1, f1r2 …)，稳定且不含引号，可安全嵌进 onclick
function st2sAssignCommentIds(list, prefix) {
  (list || []).forEach((c, i) => {
    c.id = prefix + (i + 1);
    if (Array.isArray(c.replies)) st2sAssignCommentIds(c.replies, c.id + 'r');
  });
}
function st2sCountComments(list) {
  return (list || []).reduce((n, c) => n + 1 + st2sCountComments(c.replies), 0);
}
function st2sFindComment(list, id) {
  for (const c of (list || [])) {
    if (c.id === id) return c;
    const hit = st2sFindComment(c.replies, id);
    if (hit) return hit;
  }
  return null;
}
function paintSuperTopicDetail(post, char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel || !post) return;
  panel.dataset.tab = 'posts';
  panel.innerHTML = renderSuperTopicPostDetail(post, char);
}
function rerenderSuperTopicDetail() {
  if (!superTopicDetailPostId) return;
  const found = findSuperTopicPost(superTopicDetailPostId);
  const char = getActiveChar();
  if (found && char) paintSuperTopicDetail(found.post, char);
}
function st2sToggleReplies(cid) {
  if (st2sExpandedComments.has(cid)) st2sExpandedComments.delete(cid);
  else st2sExpandedComments.add(cid);
  rerenderSuperTopicDetail();
}
function st2sSetReplyTarget(cid) {
  st2sReplyTarget = cid;
  renderSuperTopicReplyModal();
}
window.st2sToggleReplies = st2sToggleReplies;
window.st2sSetReplyTarget = st2sSetReplyTarget;

// ── 回复二级弹窗 ────────────────────────────────────────────
function closeSuperTopicReplyModal(keepTarget) {
  const m = document.getElementById('st2sReplyModal');
  if (m) { if (m._st2sStopKb) m._st2sStopKb(); m.remove(); }
  if (!keepTarget) st2sReplyTarget = null;
}
function renderSuperTopicReplyModal() {
  closeSuperTopicReplyModal(true);
  const found = findSuperTopicPost(superTopicDetailPostId);
  if (!found) return;
  st2sAssignCommentIds(found.post.commentTree, 'f');
  const target = st2sFindComment(found.post.commentTree, st2sReplyTarget);
  if (!target) return;
  const tName = target.name || target.user || '匿名';
  const tText = target.text || target.content || '';
  const wrap = document.createElement('div');
  wrap.id = 'st2sReplyModal';
  wrap.className = 'st2s-modal';
  wrap.innerHTML = `
    <div class="st2s-modal-box" onclick="event.stopPropagation()">
      <div class="st2s-modal-head">
        <span>回复 <b>@${tName}</b></span>
        <button type="button" class="st2s-modal-x" onclick="closeSuperTopicReplyModal()" aria-label="关闭">&times;</button>
      </div>
      ${tText ? `<div class="st2s-modal-quote">${tText}</div>` : ''}
      <textarea id="st2sReplyText" class="st2s-modal-ta" maxlength="200"></textarea>
      <div class="st2s-modal-ft">
        <button type="button" class="st2s-modal-cancel" onclick="closeSuperTopicReplyModal()">取消</button>
        <button type="button" class="st2s-modal-ok" onclick="submitSuperTopicReply()">发送</button>
      </div>
    </div>`;
  // 点遮罩关闭
  wrap.addEventListener('click', () => closeSuperTopicReplyModal());
  document.body.appendChild(wrap);
  wrap._st2sStopKb = st2sTrackKeyboard(wrap);   // 输入法弹起时把框顶到键盘上方
  setTimeout(() => {
    const t = document.getElementById('st2sReplyText');
    if (t) t.focus();
  }, 60);
}
function submitSuperTopicReply() {
  const box = document.getElementById('st2sReplyText');
  const val = (box && box.value || '').trim();
  if (!val) { showToast('回复内容不能为空', 'warn'); return; }
  const found = findSuperTopicPost(superTopicDetailPostId);
  if (!found) { showToast('帖子不存在', 'warn'); return; }
  const post = found.post;
  st2sAssignCommentIds(post.commentTree, 'f');
  const parent = st2sFindComment(post.commentTree, st2sReplyTarget);
  if (!parent) { closeSuperTopicReplyModal(); return; }
  const uName = (window.currentUser && window.currentUser.name) || currentUserName() || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || (typeof window.getAvatar === 'function' ? window.getAvatar(uName, 'first') : '');
  parent.replies = parent.replies || [];
  parent.replies.push({
    name: uName, user: uName, avatar: uAvatar,
    ip: (window.userProfileData && window.userProfileData.ip) || 'LUMA',
    text: val, content: val, time: '', createdAt: Date.now(),
    replyTo: parent.name || parent.user || '匿名', replies: []
  });
  st2sExpandedComments.add(parent.id);   // 回完自动展开，让人看见自己那条
  closeSuperTopicReplyModal();
  persistSuperTopicPost(found);
  st2sEarn(found.charId, 'comment');
  showToast('回复已发表', 'ok');
  rerenderSuperTopicDetail();
}
window.closeSuperTopicReplyModal = closeSuperTopicReplyModal;
window.renderSuperTopicReplyModal = renderSuperTopicReplyModal;
window.submitSuperTopicReply = submitSuperTopicReply;

function renderSuperTopicPostDetail(post, char) {
  st2sAssignCommentIds(post.commentTree, 'f');
  // 评论的稳定 key（不随楼层位置变），管理员删过的直接过滤掉
  const cKey = c => st2sCommentKey(post.id, c);
  const alive = list => (list || []).filter(c => !st2sIsDeletedComment(cKey(c)));
  const countAlive = list => alive(list).reduce((n, c) => n + 1 + countAlive(c.replies), 0);
  const comments = alive(post.commentTree);
  const totalComments = countAlive(post.commentTree);
  // 按键可见性 = 权限等级：垃圾桶要 Lv.50，小铅笔要 Lv.20
  const canManage = st2sCan(char.id, 'manage').ok;
  const isMine = String(post.id).indexOf('st_post_') === 0;
  const canEditOwn = isMine && st2sCan(char.id, 'editOwn').ok;
  const cmtPerm = st2sCan(char.id, 'comment');
  // 生成中要重绘本体，按钮的 loading 态必须从引擎状态推导，
  // 直接给旧 DOM 节点加 class 会在重绘瞬间被冲掉
  const cmtBusy = !!(window.st2sGen && window.st2sGen.isBusy(post.id));
  const primaryTag = post.primaryTag || post.tag || ('#' + char.name + '超话#');
  const subTags = post.subTags || [];
  const mentions = (post.mentions && post.mentions.length) ? post.mentions : (post.mention ? [post.mention] : []);
  const authorAvatar = (typeof window.getPostAuthorAvatar === 'function')
    ? window.getPostAuthorAvatar(post)
    : (post.author.avatar || '');
  const timeText = post.createdAt
    ? (window.formatDynamicTime ? window.formatDynamicTime(post.createdAt) : '刚刚')
    : (post.time || '刚刚');
  const deviceTag = postDeviceTag(post);
  const stats = post.stats || (post.stats = { reposts: 0, comments: 0, likes: 0, isLiked: false, isDownloaded: false });

  // 正文一整段：主tag → @ → 正文 → 副tag，用空格连成 inline 流，绝不分行
  const parts = [`<span class="hash">${primaryTag}</span>`]
    .concat(mentions.map(m => `<span class="mention">${m}</span>`))
    .concat([st2sEditingPostId === post.id
      ? `<textarea id="st2sEditTa" class="st2s-edit-inline" rows="3">${escHtml(post.content || '')}</textarea>`
      : `<span class="txt">${post.content || ''}</span>`])
    .concat(subTags.map(t => `<span class="hash">${t}</span>`));
  const bodyHtml = parts.join(' ');

  const cnt = (label, n) => label + (n ? ' ' + n : '');

  // ── 楼层渲染（抖音式）──────────────────────────────────
  // 一层的回复全部拍平成一条列表：回复的回复不再往里缩进。
  // 原来递归渲染，每深一层多一道左边距，两三回就变成画中画。
  const flattenReplies = (list, out) => {
    (list || []).forEach(c => {
      if (st2sIsDeletedComment(cKey(c))) return;
      out.push(c);
      if (Array.isArray(c.replies) && c.replies.length) flattenReplies(c.replies, out);
    });
    return out;
  };
  // char 本人或当前用户出现的楼层，给一道焦点
  const isFocus = c => !!(c && (c.isChar
    || (window.st2sGen && window.st2sGen.isMe(c.user || c.name))));
  const fmtTime = c => c.time || (c.createdAt
    ? (window.formatDynamicTime ? window.formatDynamicTime(c.createdAt) : '刚刚') : '刚刚');
  const avImg = (name, src, cls) => src
    ? `<img src="${src}" class="${cls}" alt="">`
    : `<div class="${cls} st2s-feed-av-fallback">${(name || '?').charAt(0)}</div>`;
  const actRow = (c) => `
    <div class="st2s-detail-cmt-meta">
      <span>${fmtTime(c)}</span>
      <button type="button" class="st2s-cmt-act" onclick="st2sSetReplyTarget('${c.id}')">回复</button>
      ${canManage ? `<button type="button" class="st2s-cmt-act is-danger" title="删除这条评论" onclick="st2sRemoveComment('${post.id}','${cKey(c)}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
      </button>` : ''}
    </div>`;
  const bodyOf = (c) => {
    const name = c.name || c.user || '匿名';
    const text = c.text || c.content || '';
    return {
      name,
      sig: c.isChar ? '<span class="st2s-cmt-charsig">本人</span>' : '',
      ip: c.ip ? `<span class="st2s-detail-cmt-ip">· ${c.ip}</span>` : '',
      text: (c.replyTo ? `<span class="st2s-cmt-replyto">回复 @${c.replyTo}：</span>` : '') + text
    };
  };

  // 楼中楼：小头像 + 名字 + 正文，全部同一层级，不再嵌套
  const renderReply = (r) => {
    const b = bodyOf(r);
    return `
      <div class="st2s-cmt-reply${isFocus(r) ? ' is-focus' : ''}">
        ${avImg(b.name, r.avatar || (window.getAvatar ? window.getAvatar(b.name, 'emoji') : ''), 'st2s-cmt-reply-av')}
        <div class="st2s-cmt-reply-main">
          <div class="st2s-detail-cmt-name"><span>${b.name}</span>${b.sig}${b.ip}</div>
          <p class="st2s-detail-cmt-text">${b.text}</p>
          ${actRow(r)}
        </div>
      </div>`;
  };

  const renderFloor = (c, floorLabel) => {
    const b = bodyOf(c);
    const flat = flattenReplies(c.replies, []).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
    const expanded = st2sExpandedComments.has(c.id);
    // 折叠时只露最新一条当预告，点一下才铺开整层
    const shown = (flat.length > 1 && !expanded) ? flat.slice(-1) : flat;
    const toggleHtml = flat.length > 1 ? `
      <button type="button" class="st2s-cmt-act chevron ${expanded ? 'open' : ''}" onclick="st2sToggleReplies('${c.id}')">
        <span>${expanded ? '收起' : '查看其余 ' + (flat.length - 1) + ' 条回复'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>` : '';
    return `
      <div class="st2s-detail-comment${isFocus(c) ? ' is-focus' : ''}">
        <span class="st2s-cmt-floor">${floorLabel}</span>
        <div class="st2s-detail-cmt-left">
          ${avImg(b.name, c.avatar || (window.getAvatar ? window.getAvatar(b.name, 'emoji') : ''), 'st2s-detail-cmt-av')}
        </div>
        <div class="st2s-detail-cmt-right">
          <div class="st2s-detail-cmt-name"><span>${b.name}</span>${b.sig}${b.ip}</div>
          <p class="st2s-detail-cmt-text">${b.text}</p>
          ${actRow(c)}
          ${shown.length ? `<div class="st2s-cmt-replies">${shown.map(renderReply).join('')}</div>` : ''}
          ${toggleHtml}
        </div>
      </div>`;
  };

  return `
    <div class="st2s-detail">
      <div class="st2s-detail-topbar">
        <button class="st2s-detail-back" onclick="closePostDetail()" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4" y2="12"></line><polyline points="11 19 4 12 11 5"></polyline></svg>
          <span>返回动态</span>
        </button>
        <span class="st2s-detail-time">${timeText}</span>
      </div>

      <div class="st2s-detail-author">
        ${authorAvatar
          ? `<img src="${authorAvatar}" class="st2s-detail-avatar${post.author.isChar ? ' is-char' : ''}" alt="">`
          : `<div class="st2s-detail-avatar st2s-feed-av-fallback${post.author.isChar ? ' is-char' : ''}">${(post.author.name || '?').charAt(0)}</div>`}
        <div class="st2s-detail-author-meta">
          <div class="st2s-detail-name">
            <span>${post.author.name || '匿名'}</span>
            ${post.author.badge ? `<span class="st2s-feed-bd">${post.author.badge}</span>` : ''}
          </div>
          <div class="st2s-detail-author-sub">${timeText} · 来自 ${deviceTag}</div>
        </div>
        <div class="st2s-detail-tools">
          ${canEditOwn ? `<button type="button" class="st2s-tool-btn" title="编辑正文" onclick="st2sEditPost('${post.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>` : ''}
          ${canManage ? `<button type="button" class="st2s-tool-btn is-danger" title="删除帖子" onclick="st2sRemovePost('${post.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
          </button>` : ''}
          <button type="button" class="st2s-tool-btn ${cmtBusy ? 'is-loading' : ''}" id="st2sCmtRefresh"
                  ${cmtBusy ? 'disabled' : ''} title="生成更多评论（20~30 条）"
                  onclick="st2sRefreshComments('${post.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      <div class="st2s-detail-line">${bodyHtml}</div>
      ${st2sEditingPostId === post.id ? `
      <div class="st2s-inline-act">
        <button type="button" onclick="st2sCancelEditPost()">取消</button>
        <button type="button" class="is-primary" onclick="st2sSaveEditPost('${post.id}')">保存</button>
      </div>` : ''}

      ${post.image ? `
        <div class="st2s-detail-image"><img src="${post.image}" alt=""></div>
      ` : ''}

      <div class="st2s-detail-actions social-action-bar">
        <div class="social-action-btn" onclick="handleSuperTopicPostAction('${post.id}', 'repost')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span>${cnt('转发', stats.reposts)}</span>
        </div>
        <div class="social-action-btn ${stats.isLiked ? 'liked' : ''}" onclick="handleSuperTopicPostAction('${post.id}', 'like')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
          <span>${cnt('点赞', stats.likes)}</span>
        </div>
        <div class="social-action-btn" onclick="focusSuperTopicCommentInput()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>${cnt('评论', totalComments)}</span>
        </div>
        <div class="social-action-btn ${stats.isDownloaded ? 'downloaded' : ''}" onclick="handleSuperTopicPostAction('${post.id}', 'download')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>下载</span>
        </div>
      </div>

      <div class="st2s-detail-comments-head">
        <h4>全部评论</h4>
        <span>${totalComments} 条</span>
      </div>

      <!-- 输入框固定在评论区顶部（标题之下、一楼之上）；
           往下滑想回复某人时走「回复」按钮的二级弹窗，不依赖这个框 -->
      ${cmtPerm.ok ? `
      <div class="st2s-detail-inputbar">
        <input id="st2sCommentInput" type="text" placeholder="发条温暖善意的评论..." maxlength="200" autocomplete="off"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitSuperTopicComment();}">
        <button type="button" class="st2s-detail-send" onclick="submitSuperTopicComment()">发送</button>
      </div>` : `
      <div class="st2s-detail-locknote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        <span>${cmtPerm.reason || '当前无法评论'}</span>
      </div>`}

      ${comments.length === 0 ? `
        <div class="st2s-detail-empty">还没有人评论，坐个一楼吧</div>
      ` : comments.map((c, i) => renderFloor(c, (i + 1) + 'L')).join('')}
    </div>
  `;
}
window.renderSuperTopicPostDetail = renderSuperTopicPostDetail;

// -----------------------------------------------------------------------------
// 超话帖子操作 (覆盖 __SUPERTOPIC_POSTS__ 与 weiboPosts 两个来源)
// -----------------------------------------------------------------------------
function findSuperTopicPost(postId) {
  const char = getActiveChar();
  if (!char) return null;
  const userArr = st2sStore.postsOf(char.id);
  if (Array.isArray(userArr)) {
    const p = userArr.find(x => String(x.id) === String(postId));
    if (p) return { post: p, source: 'user', charId: char.id };
  }
  const weibo = (window.weiboPosts || []).find(x => String(x.id) === String(postId));
  if (weibo) return { post: weibo, source: 'weibo' };
  return null;
}

window.findSuperTopicPost = findSuperTopicPost;

function persistSuperTopicPost(found) {
  if (!found) return;
  const { post, source, charId } = found;
  if (source === 'user') {
    st2sStore.save(post);   // 点赞数 / 评论树 / 删除状态都靠整棵入库复原
  } else if (source === 'weibo') {
    try {
      if (typeof window.persistPostToDb === 'function') {
        window.persistPostToDb(post);
      } else if (window.api && api.db) {
        api.db.create('app_posts', post).catch(() => {
          api.db.update('app_posts', post.id, post).catch(() => {});
        });
      }
    } catch (_) {}
  }
}

function handleSuperTopicPostAction(postId, action) {
  const found = findSuperTopicPost(postId);
  if (!found) { showToast('帖子不存在', 'warn'); return; }
  // 规则 01：未关注只能浏览；下载属于本地保存，不占用发言权限
  const actPerm = { like: 'like', comment: 'comment' }[action];
  if (actPerm && !st2sGuard(found.charId, actPerm)) return;
  const post = found.post;
  post.stats = post.stats || { reposts: 0, comments: 0, likes: 0, isLiked: false, isDownloaded: false };

  if (action === 'like') {
    post.stats.isLiked = !post.stats.isLiked;
    post.stats.likes = Math.max(0, (post.stats.likes || 0) + (post.stats.isLiked ? 1 : -1));
  } else if (action === 'download') {
    // 复用热搜那条已验证可用的链路 downloadPostImageToLocal：
    // 它内部 dataURL/http/Canvas 三重兜底，且无附图时会生成卡片海报再下载，
    // 所以永远有产物 —— 我之前那版遇到没图就 return，等于点了没反应。
    if (typeof window.downloadPostImageToLocal !== 'function') {
      showToast('下载模块未就绪', 'warn'); return;
    }
    post.stats.isDownloaded = !post.stats.isDownloaded;
    try { window.downloadPostImageToLocal(post); } catch (e) { console.warn('[supertopic] 下载失败:', e); }
    persistSuperTopicPost(found);
    rerenderSuperTopicDetail();
    return;
  } else if (action === 'repost') {
    // 转发给角色：等其他入口一起做，这里先占位，不计数、不落库
    showToast('转发给角色 · 暂未开放', 'warn');
    return;
  }

  persistSuperTopicPost(found);
  rerenderSuperTopicDetail();
}
window.handleSuperTopicPostAction = handleSuperTopicPostAction;

function focusSuperTopicCommentInput() {
  const input = document.getElementById('st2sCommentInput');
  if (input) { input.focus(); return; }
  // 无权限时输入框根本没渲染，点「评论」不能静默没反应
  const ch = getActiveChar();
  if (ch) st2sGuard(ch.id, 'comment');
}
window.focusSuperTopicCommentInput = focusSuperTopicCommentInput;

function submitSuperTopicComment() {
  if (!superTopicDetailPostId) return;
  const cGate = getActiveChar();
  if (cGate && !st2sGuard(cGate.id, 'comment')) return;
  const input = document.getElementById('st2sCommentInput');
  if (!input) return;
  const val = (input.value || '').trim();
  if (!val) { showToast('评论内容不能为空', 'warn'); return; }

  const found = findSuperTopicPost(superTopicDetailPostId);
  if (!found) { showToast('帖子不存在', 'warn'); return; }
  const post = found.post;
  post.commentTree = post.commentTree || [];
  st2sAssignCommentIds(post.commentTree, 'f');

  const uName = (window.currentUser && window.currentUser.name) || currentUserName() || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || (typeof window.getAvatar === 'function' ? window.getAvatar(uName, 'first') : '');
  const uIp = (window.userProfileData && window.userProfileData.ip) || 'LUMA';
  const node = {
    id: '', name: uName, user: uName, avatar: uAvatar, ip: uIp,
    text: val, content: val, time: '', createdAt: Date.now(), replies: []
  };

  // 追加到末尾而不是插到最前 —— 有楼层号之后，1L 必须永远是最早那条
  post.commentTree.push(node);
  input.value = '';

  persistSuperTopicPost(found);
  st2sEarn(found.charId, 'comment');
  showToast('评论已发表', 'ok');
  rerenderSuperTopicDetail();
}

window.submitSuperTopicComment = submitSuperTopicComment;
