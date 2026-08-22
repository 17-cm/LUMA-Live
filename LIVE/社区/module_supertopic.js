// =========================================================================
// 【模块二·社区子文档2·主播超话系统】LIVE/社区/module_supertopic.js
// 包含：
// 1. 深度微博超话头部（等级徽章、粉丝量、大头贴、关注状态、每日打卡）
// 2. 超话左侧抽屉式主播切换
// 3. 4 大专属分类 Tab（「动态」虚拟化列表、「贡献榜」颁奖台与全场景打榜累计、「签到榜」连续打卡与经验体系、「打榜应援」消费计入）
// =========================================================================

var api = window.api || {};
let currentActiveSuperTopicCharId = null;
let currentSuperTopicSubTab = 'posts'; // 'posts' | 'contribute' | 'checkin' | 'support'
let selectedSupportGiftId = 'gift_flower';
let superTopicVirtualScrollerInstance = null;

// 渲染超话主视图
function renderSuperTopicView(charId = null) {
  const container = document.getElementById('communitySuperTopicContent');
  if (!container) return;

  // 视图整体重绘前必须销毁旧的虚拟滚动实例，否则其 target 引用已脱离 DOM，
  // 会导致重绘后动态列表写入孤儿节点而显示空白
  if (superTopicVirtualScrollerInstance) {
    superTopicVirtualScrollerInstance.destroy();
    superTopicVirtualScrollerInstance = null;
  }

  const chars = window.getAvailableCharsList();
  if (chars.length === 0) return;

  let char = chars.find(c => String(c.id) === String(charId));
  if (!char) {
    char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];
  }
  currentActiveSuperTopicCharId = char.id;

  const isFollowed = (window.followedSuperTopics || []).includes(String(char.id));
  const checkIn = window.getSuperTopicCheckInInfo(char.id);
  // 粉丝数与个人主页/排行榜使用同一数据源 (LumaFansManager)，保证各处数字一致
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char)
    : (char.fans || 0);

  // 渲染超话基础骨架与头部
  container.innerHTML = `
    <!-- 1. 微博风格超话 Header 大卡片 -->
    <div class="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-105" style="background-image: url('${char.avatar}')"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent"></div>

      <div class="relative p-5 space-y-3.5 z-10 text-white">
        <!-- 顶栏状态与切换抽屉 -->
        <div class="flex items-center justify-between">
          <button onclick="toggleSuperTopicDrawer(true)" class="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white border border-white/20 transition active:scale-95">
            <span>切换其他主播超话</span>
            <svg class="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>

          <button onclick="handleSuperTopicFollow('${char.name}')" class="px-3 py-1 rounded-full text-xs font-bold transition active:scale-95 ${isFollowed ? 'bg-white/20 text-slate-200 border border-white/20' : 'bg-rose-500 text-white shadow-md'}">
            ${isFollowed ? '已关注超话' : '+ 关注超话'}
          </button>
        </div>

        <!-- 超话主播主信息 -->
        <div class="flex items-center gap-3.5">
          <div class="relative flex-shrink-0">
            <div class="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-400 shadow-lg">
              <img src="${char.avatar}" class="w-full h-full rounded-full object-cover border-2 border-white">
            </div>
            <span class="absolute -bottom-1 -right-1 text-xs">👑</span>
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black truncate">#${char.name}#</h3>
              <span class="text-[9px] bg-rose-500/90 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider">Lv.${checkIn.level} 皇冠超话</span>
            </div>
            <p class="text-[10px] text-slate-300 mt-1 truncate">分类: ${char.category} · ${char.tag}</p>
            <div class="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
              <span>粉丝 <strong class="text-white">${fansCount.toLocaleString()}</strong></span>
              <span>今日讨论 <strong class="text-white">${(window.weiboPosts || []).filter(p => p.tag && p.tag.includes(char.name)).length + 18}</strong></span>
            </div>
          </div>
        </div>

        <!-- 每日打卡与贡献条 -->
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <div class="text-[10px] text-slate-300">
            <span>连续签到 <strong>${checkIn.streakDays}</strong> 天</span>
            <span class="mx-1.5">·</span>
            <span>打卡经验 <strong>${checkIn.totalExp}</strong></span>
          </div>

          <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" class="px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${checkIn.isCheckedToday ? 'checkin-btn-done' : 'checkin-btn-active'}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${checkIn.isCheckedToday ? `已打卡 第${checkIn.streakDays}天` : '每日签到'}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. 房管公告栏与发帖入口 -->
    <div class="luxe-card p-3 flex items-center justify-between bg-white text-xs shadow-xs">
      <div class="flex items-center gap-1.5 text-slate-600 min-w-0">
        <span class="text-amber-500 font-bold flex-shrink-0">📢 房管:</span>
        <span class="text-slate-700 truncate">欢迎来到 #${char.name}# 超话！文明打榜，爱护主播～</span>
      </div>
      <button onclick="openCreatePostModal('#${char.name}超话#', '@${char.name}')" class="btn-brand text-[10px] !py-1 !px-2.5 shadow-sm flex-shrink-0">
        <span>+ 发超话帖</span>
      </button>
    </div>

    <!-- 3. 微博 4 大专属子 Tab 导航 -->
    <div class="bg-white rounded-2xl p-1 border border-slate-100 shadow-xs flex items-center justify-around">
      <div onclick="switchSuperTopicSubTab('posts')" id="spSubTabBtn_posts" class="weibo-sub-tab ${currentSuperTopicSubTab === 'posts' ? 'active' : ''}">动态</div>
      <div onclick="switchSuperTopicSubTab('contribute')" id="spSubTabBtn_contribute" class="weibo-sub-tab ${currentSuperTopicSubTab === 'contribute' ? 'active' : ''}">贡献榜</div>
      <div onclick="switchSuperTopicSubTab('checkin')" id="spSubTabBtn_checkin" class="weibo-sub-tab ${currentSuperTopicSubTab === 'checkin' ? 'active' : ''}">签到榜</div>
      <div onclick="switchSuperTopicSubTab('support')" id="spSubTabBtn_support" class="weibo-sub-tab ${currentSuperTopicSubTab === 'support' ? 'active' : ''}">打榜应援</div>
    </div>

    <!-- 4. 子 Tab 渲染容器 -->
    <div id="superTopicSubTabContainer" class="space-y-3 pt-1"></div>
  `;

  switchSuperTopicSubTab(currentSuperTopicSubTab || 'posts');
}
window.renderSuperTopicView = renderSuperTopicView;

// 切换超话 4 个子 Tab
function switchSuperTopicSubTab(tabKey) {
  currentSuperTopicSubTab = tabKey;
  ['posts', 'contribute', 'checkin', 'support'].forEach(key => {
    const btn = document.getElementById(`spSubTabBtn_${key}`);
    if (btn) {
      if (key === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];

  if (tabKey === 'posts') {
    renderSuperTopicPostsTab(char.id);
  } else if (tabKey === 'contribute') {
    if (superTopicVirtualScrollerInstance) {
      superTopicVirtualScrollerInstance.destroy();
      superTopicVirtualScrollerInstance = null;
    }
    renderSuperTopicContributeTab(char);
  } else if (tabKey === 'checkin') {
    if (superTopicVirtualScrollerInstance) {
      superTopicVirtualScrollerInstance.destroy();
      superTopicVirtualScrollerInstance = null;
    }
    renderSuperTopicCheckinTab(char);
  } else if (tabKey === 'support') {
    if (superTopicVirtualScrollerInstance) {
      superTopicVirtualScrollerInstance.destroy();
      superTopicVirtualScrollerInstance = null;
    }
    renderSuperTopicSupportTab(char);
  }
}
window.switchSuperTopicSubTab = switchSuperTopicSubTab;

// Tab 1: 超话动态 (包含列表虚拟化，流畅无卡顿)
function renderSuperTopicPostsTab(charId) {
  const container = document.getElementById('communitySuperTopicContent');
  const target = document.getElementById('superTopicSubTabContainer');
  if (!container || !target) return;

  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(charId)) || chars[0];

  let topicPosts = (window.weiboPosts || []).filter(p => (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name)));
  
  if (topicPosts.length === 0) {
    topicPosts = [
      {
        id: `topic_post_${char.id}`,
        author: {
          name: `${char.name}后援会会长`,
          avatar: char.avatar,
          badge: '超话大咖',
          verified: true
        },
        time: `刚刚 · 来自 ${window.getFloatClientTag(false)}`,
        tag: `#${char.name}超话#`,
        mention: `@${char.name}`,
        linkText: '',
        content: `欢迎来到【${char.name}】粉丝专属超话！每天签到打卡、给主播打榜应援均可登上超话守护总榜！`,
        image: char.avatar,
        stats: { reposts: 180, comments: 24, likes: 680, isLiked: false, isDownloaded: false },
        commentTree: []
      }
    ];
  }

  // 虚拟列表渲染超话动态
  if (!superTopicVirtualScrollerInstance || superTopicVirtualScrollerInstance.container !== container) {
    superTopicVirtualScrollerInstance = new window.CommunityVirtualScroller({
      container: container,
      target: target,
      items: topicPosts,
      estimatedItemHeight: 260,
      buffer: 4,
      renderItem: (post) => `
        <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer shadow-xs mb-3 hover:border-slate-300 transition" onclick="openTrendDetail('${post.id}')">
          <div class="flex items-center justify-between" onclick="event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <img src="${post.author.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200">
              <div>
                <h5 class="text-xs font-black text-slate-900">${post.author.name}</h5>
                <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
              </div>
            </div>
            <span class="text-[9px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full border border-rose-200">#${char.name}超话#</span>
          </div>

          <p class="text-xs text-slate-800 leading-relaxed">
            <span class="weibo-tag">#${char.name}超话#</span>
            ${post.content}
          </p>

          ${post.image ? `
            <div class="rounded-xl overflow-hidden aspect-video bg-slate-950">
              <img src="${post.image}" class="w-full h-full object-cover" loading="lazy">
            </div>
          ` : ''}

          <div class="social-action-bar" onclick="event.stopPropagation()">
            <div onclick="handlePostAction('${post.id}', 'repost')" class="social-action-btn">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span>${post.stats.reposts}</span>
            </div>
            <div onclick="openTrendDetail('${post.id}')" class="social-action-btn">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              <span>${post.stats.comments}</span>
            </div>
            <div onclick="handlePostAction('${post.id}', 'like')" class="social-action-btn ${post.stats.isLiked ? 'liked' : ''}">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
              <span>${post.stats.likes}</span>
            </div>
          </div>
        </div>
      `
    });
  } else {
    superTopicVirtualScrollerInstance.updateItems(topicPosts);
  }
}
window.renderSuperTopicPostsTab = renderSuperTopicPostsTab;

// Tab 2: 贡献榜 (所有对当前 Char 的消费/打赏/打榜累计总贡献排行，全面与全局数据同步)
function renderSuperTopicContributeTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const userExtraContribute = window.getCharContributionScore(char.id); // 玩家给该 Char 消费打榜的真实积分

  const baseFans = [
    { name: '星空拾荒者', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', score: 38200, badge: '至尊盟主' },
    { name: '喵喵守护大队长', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100', score: 26500, badge: '超级铁粉' },
    { name: '不吃香菜的猫', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100', score: 18400, badge: '忠实舰长' },
    { name: '月亮邮局', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', score: 9800, badge: '守护天使' },
    { name: '塞博浪人', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', score: 6200, badge: '真爱粉' }
  ];

  const userTotalScore = 12000 + userExtraContribute;
  const userItem = {
    name: `${uName} (你)`,
    avatar: uAvatar,
    score: userTotalScore,
    badge: userTotalScore > 30000 ? '超话神豪' : '核心应援官',
    isUser: true
  };

  const fullList = [...baseFans, userItem].sort((a, b) => b.score - a.score);
  const top1 = fullList[0];
  const top2 = fullList[1];
  const top3 = fullList[2];
  const rest = fullList.slice(3);

  container.innerHTML = `
    <!-- 榜单规则说明 -->
    <div class="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-center justify-between">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="text-sm">💎</span>
        <div class="min-w-0">
          <h5 class="font-black text-amber-950">#${char.name}# 专属贡献总榜</h5>
          <p class="text-[9px] text-amber-700 truncate">直播打赏 · 超话打榜 · 周边应援，全场景消费均计入贡献值！</p>
        </div>
      </div>
      <button onclick="openSuperTopicSupportModal()" class="btn-brand text-[10px] !py-1 !px-2.5 flex-shrink-0 shadow-xs">为Ta打榜</button>
    </div>

    <!-- 领奖台 (前三名) -->
    <div class="grid grid-cols-3 gap-2 items-end pt-3 pb-1 text-center">
      <!-- 亚军 2 -->
      ${top2 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-slate-300 shadow-md">
              <img src="${top2.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥈</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top2.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top2.score.toLocaleString()} 贡献</span>
          <div class="podium-step-2 w-full mt-2 flex items-center justify-center font-black text-slate-400 text-sm">2</div>
        </div>
      ` : '<div></div>'}

      <!-- 冠军 1 -->
      ${top1 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 shadow-lg">
              <img src="${top1.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-3 -right-1 text-base animate-bounce">👑</span>
          </div>
          <span class="text-xs font-black text-amber-600 truncate max-w-[95px]">${top1.name}</span>
          <span class="text-[9px] font-bold text-slate-500 mt-0.5">${top1.score.toLocaleString()} 贡献</span>
          <div class="podium-step-1 w-full mt-2 flex items-center justify-center font-black text-amber-500 text-lg">1</div>
        </div>
      ` : '<div></div>'}

      <!-- 季军 3 -->
      ${top3 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-amber-700/40 shadow-md">
              <img src="${top3.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥉</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top3.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top3.score.toLocaleString()} 贡献</span>
          <div class="podium-step-3 w-full mt-2 flex items-center justify-center font-black text-amber-700 text-sm">3</div>
        </div>
      ` : '<div></div>'}
    </div>

    <!-- 4 名之后列表 -->
    <div class="space-y-2">
      ${rest.map((item, idx) => `
        <div class="luxe-card p-3 flex items-center justify-between bg-white ${item.isUser ? 'border-rose-300 bg-rose-50/50' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center text-xs font-black text-slate-400">${idx + 4}</span>
            <img src="${item.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5>
                <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${item.badge}</span>
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-xs font-black text-rose-600">${item.score.toLocaleString()}</span>
            <p class="text-[8px] text-slate-400">贡献值</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Tab 3: 签到榜 (连续打卡天数榜单，真实同步玩家打卡状态)
function renderSuperTopicCheckinTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const checkIn = window.getSuperTopicCheckInInfo(char.id);

  const checkinRankList = (window.LumaCheckinManager && typeof window.LumaCheckinManager.getTopicCheckInRankList === 'function')
    ? window.LumaCheckinManager.getTopicCheckInRankList(char.id)
    : [
        { name: '苏小喵全球后援会', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', days: 128, total: 38400, badge: '开山元老' },
        { name: '每日必吸猫', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100', days: 95, total: 28500, badge: '连续满勤' },
        { name: '星奈今天直播了吗', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100', days: 64, total: 19200, badge: '超话达人' },
        { name: '早起看重播', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', days: 42, total: 12600, badge: '活跃打卡' },
        {
          name: `${uName} (你)`,
          avatar: uAvatar,
          days: checkIn.streakDays,
          total: checkIn.totalExp,
          badge: checkIn.isCheckedToday ? '今日已打卡' : '等待打卡',
          isUser: true
        }
      ].sort((a, b) => b.days - a.days);

  container.innerHTML = `
    <!-- 签到打卡卡片 -->
    <div class="luxe-card p-4 bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-200/80 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">📅</span>
          <div>
            <h4 class="text-xs font-black text-emerald-950">超话每日打卡中心</h4>
            <p class="text-[9px] text-emerald-700 mt-0.5">连续签到可提升超话头衔等级，赢取专属守护勋章</p>
          </div>
        </div>
        <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" class="px-3.5 py-1.5 rounded-full text-xs font-black ${checkIn.isCheckedToday ? 'checkin-btn-done' : 'checkin-btn-active'}">
          ${checkIn.isCheckedToday ? `已打卡 第${checkIn.streakDays}天` : '立即打卡'}
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center pt-1 border-t border-emerald-100">
        <div>
          <span class="text-xs font-black text-slate-800">${checkIn.streakDays} 天</span>
          <p class="text-[8px] text-slate-400">当前连续签到</p>
        </div>
        <div>
          <span class="text-xs font-black text-emerald-600">Lv.${checkIn.level}</span>
          <p class="text-[8px] text-slate-400">超话头衔等级</p>
        </div>
        <div>
          <span class="text-xs font-black text-slate-800">${checkIn.totalExp}</span>
          <p class="text-[8px] text-slate-400">累计签到经验</p>
        </div>
      </div>
    </div>

    <!-- 签到排行列表 -->
    <div class="space-y-2 pt-1">
      <div class="flex items-center justify-between px-1">
        <h5 class="text-xs font-black text-slate-900">连续签到排行榜 TOP</h5>
        <span class="text-[9px] text-slate-400">按连续打卡天数排序</span>
      </div>

      ${checkinRankList.map((item, idx) => `
        <div class="luxe-card p-3 flex items-center justify-between bg-white ${item.isUser ? 'border-emerald-300 bg-emerald-50/40' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center text-xs font-black ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}">${idx + 1}</span>
            <img src="${item.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5>
                <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${item.badge}</span>
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-xs font-black text-emerald-600">连续 ${item.days} 天</span>
            <p class="text-[8px] text-slate-400">累计 ${item.total} 经验</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Tab 4: 打榜应援 (消费直接计入该 Char 贡献值与超话总热度)
function renderSuperTopicSupportTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const currentWallet = window.currentWalletBalance || 18800;
  const userContribute = window.getCharContributionScore(char.id);
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char)
    : (char.fans || 0);

  container.innerHTML = `
    <!-- 打榜头部宣传 -->
    <div class="p-4 bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600 rounded-3xl text-white shadow-md space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">明星超话打榜中心</span>
        <span class="text-xs font-black text-amber-300">我的余额: ${currentWallet.toLocaleString()} 币</span>
      </div>
      <div>
        <h4 class="text-sm font-black">为 #${char.name}# 打榜应援</h4>
        <p class="text-xs text-rose-100 leading-relaxed mt-0.5">你的每一次打榜消费，都将 1:1 转化为对该主播的专属贡献值，并提升超话全服热度！</p>
      </div>
      <div class="flex items-center gap-4 text-xs pt-1 border-t border-white/15">
        <div>
          <span class="text-[9px] text-rose-200">我对Ta的打榜贡献</span>
          <p class="font-black text-white text-sm">${userContribute.toLocaleString()} 点</p>
        </div>
        <div>
          <span class="text-[9px] text-rose-200">超话总热度</span>
          <p class="font-black text-amber-300 text-sm">${(fansCount * 3 + userContribute).toLocaleString()}</p>
        </div>
      </div>
    </div>

    <!-- 打榜道具选购网格 -->
    <div class="space-y-2">
      <h5 class="text-xs font-black text-slate-900 px-1">选择打榜应援道具</h5>
      <div class="grid grid-cols-2 gap-2.5">
        ${(window.SUPPORT_GIFTS || []).map(g => `
          <div class="support-gift-card ${selectedSupportGiftId === g.id ? 'selected' : ''}" onclick="selectSupportGiftDirect('${g.id}', '${char.id}')">
            <div class="text-2xl mb-1">${g.icon}</div>
            <h6 class="text-xs font-black text-slate-900">${g.name}</h6>
            <p class="text-[9px] text-slate-400 mt-0.5">${g.desc}</p>
            <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="font-black text-rose-600">${g.price} LUMA币</span>
              <span class="text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded">+${g.exp}贡献</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <button onclick="openSuperTopicSupportModal()" class="btn-brand w-full py-2.5 justify-center text-xs font-black shadow-md flex items-center gap-1.5">
      <span>立即为主播打榜应援</span>
    </button>
  `;
}

function selectSupportGiftDirect(giftId, charId) {
  selectedSupportGiftId = giftId;
  const char = window.getAvailableCharsList().find(c => String(c.id) === String(charId));
  if (char) renderSuperTopicSupportTab(char);
}
window.selectSupportGiftDirect = selectSupportGiftDirect;

// 超话打榜弹窗
function openSuperTopicSupportModal() {
  const modal = document.getElementById('superTopicSupportModal');
  if (!modal) return;

  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];
  const charNameEl = document.getElementById('supportModalCharName');
  const userBalanceEl = document.getElementById('supportModalUserBalance');
  const grid = document.getElementById('supportItemsGrid');

  if (charNameEl) charNameEl.textContent = char.name;
  if (userBalanceEl) userBalanceEl.textContent = `${(window.currentWalletBalance || 18800).toLocaleString()} 币`;

  if (grid) {
    grid.innerHTML = (window.SUPPORT_GIFTS || []).map(g => `
      <div onclick="selectSupportGift('${g.id}')" class="support-gift-card ${selectedSupportGiftId === g.id ? 'selected' : ''}" id="supportGiftItem_${g.id}">
        <div class="text-xl">${g.icon}</div>
        <div class="text-xs font-black text-slate-900 mt-1">${g.name}</div>
        <div class="text-[10px] text-rose-600 font-bold mt-0.5">${g.price} 币</div>
        <div class="text-[8px] text-slate-400">+${g.exp} 贡献值</div>
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
      if (g.id === giftId) el.classList.add('selected');
      else el.classList.remove('selected');
    }
  });
  updateSupportButtonText();
}
window.selectSupportGift = selectSupportGift;

function updateSupportButtonText() {
  const btn = document.getElementById('btnExecuteSupport');
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  if (btn && gift) {
    btn.innerHTML = `<span>确认打榜 (消耗 ${gift.price} LUMA币 · +${gift.exp}贡献)</span>`;
  }
}

function executeSupportGift() {
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  let wallet = window.currentWalletBalance || 18800;

  if (wallet < gift.price) {
    api.ui.toast("LUMA 币余额不足，请前往充值中心！");
    return;
  }

  window.currentWalletBalance = wallet - gift.price;
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();

  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];

  // 累加打榜贡献
  window.addCharContributionScore(char.id, gift.exp);

  closeSuperTopicSupportModal();
  api.ui.toast(`🎉 打榜成功！为主播【${char.name}】送出 ${gift.name}，贡献值 +${gift.exp}！`);
  renderSuperTopicView(char.id);
}
window.executeSupportGift = executeSupportGift;

function handleSuperTopicFollow(hostName) {
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.name) === String(hostName));
  if (!char) return;

  const topicId = String(char.id);
  if (!window.followedSuperTopics) window.followedSuperTopics = [];

  const idx = window.followedSuperTopics.indexOf(topicId);
  if (idx > -1) {
    window.followedSuperTopics.splice(idx, 1);
    api.ui.toast(`已取消关注【${hostName}】超话`);
  } else {
    window.followedSuperTopics.push(topicId);
    api.ui.toast(`已成功关注【${hostName}】超话！`);
  }

  // 持久化到 localStorage
  try {
    localStorage.setItem('luma_followed_supertopics', JSON.stringify(window.followedSuperTopics));
  } catch (e) {}

  // 持久化到 api.db
  try {
    api.db.create("luma_supertopic_follows", { id: 'user', topics: window.followedSuperTopics }).catch(() => {
      api.db.update("luma_supertopic_follows", 'user', { topics: window.followedSuperTopics }).catch(() => {});
    });
  } catch (e) {}

  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  renderSuperTopicView(currentActiveSuperTopicCharId);
}
window.handleSuperTopicFollow = handleSuperTopicFollow;

// 抽屉展开与选择
function toggleSuperTopicDrawer(forceState) {
  const backdrop = document.getElementById('superTopicDrawerBackdrop');
  const panel = document.getElementById('superTopicDrawerPanel');
  if (!panel || !backdrop) return;

  const isOpen = panel.classList.contains('open');
  const nextState = (typeof forceState === 'boolean') ? forceState : !isOpen;

  if (nextState) {
    renderSuperTopicDrawer();
    backdrop.classList.remove('hidden');
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
    backdrop.classList.add('hidden');
  }
}
window.toggleSuperTopicDrawer = toggleSuperTopicDrawer;

function closeSuperTopicDrawer() {
  toggleSuperTopicDrawer(false);
}
window.closeSuperTopicDrawer = closeSuperTopicDrawer;

function renderSuperTopicDrawer() {
  const container = document.getElementById('superTopicDrawerCharList');
  if (!container) return;

  const chars = window.getAvailableCharsList();
  container.innerHTML = chars.map(c => {
    const isCurrent = (String(c.id) === String(currentActiveSuperTopicCharId));
    return `
      <div onclick="selectSuperTopicChar('${c.id}')" class="p-3 rounded-2xl flex items-center justify-between cursor-pointer active:scale-98 transition ${isCurrent ? 'bg-gradient-to-r from-rose-50 to-purple-50 border border-rose-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}">
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0">
            <img src="${c.avatar}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
            ${c.isLive ? `<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>` : ''}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h5 class="text-xs font-black text-slate-900 truncate">${c.name}</h5>
              ${isCurrent ? `<span class="text-[8px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full">当前</span>` : ''}
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5 truncate">#${c.name}的粉丝后援会#</p>
          </div>
        </div>
        <span class="text-[10px] font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-xs flex-shrink-0">
          ${c.isLive ? 'LIVE' : '超话'}
        </span>
      </div>
    `;
  }).join('');
}

function selectSuperTopicChar(charId) {
  currentActiveSuperTopicCharId = charId;
  closeSuperTopicDrawer();
  renderSuperTopicView(charId);
}
window.selectSuperTopicChar = selectSuperTopicChar;
