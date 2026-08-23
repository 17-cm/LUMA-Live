// =========================================================================
// 【模块二·社区子文档2·主播超话系统】LIVE/社区/module_supertopic.js
// 星幕超话设计版：电影感暗色英雄头部 + 纯白内容区 + 胶囊Tab
// =========================================================================
var api = window.api || {};
let currentActiveSuperTopicCharId = null;
let currentSuperTopicSubTab = 'posts';
let selectedSupportGiftId = 'gift_flower';
let superTopicVirtualScrollerInstance = null;

function toggleSuperTopicMenu() {
  const popup = document.getElementById('superTopicMenuPopup');
  if (!popup) return;
  popup.classList.toggle('hidden');
}
window.toggleSuperTopicMenu = toggleSuperTopicMenu;

document.addEventListener('click', function(e) {
  const popup = document.getElementById('superTopicMenuPopup');
  if (!popup || popup.classList.contains('hidden')) return;
  if (!e.target.closest('#superTopicMenuPopup') && !e.target.closest('[onclick*="toggleSuperTopicMenu"]')) {
    popup.classList.add('hidden');
  }
});

function renderSuperTopicView(charId = null) {
  const container = document.getElementById('communitySuperTopicContent');
  if (!container) return;
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
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char)
    : (char.fans || 0);
  const topicPosts = (window.weiboPosts || []).filter(p => (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name)));
  const todayDiscuss = topicPosts.length + 18;
  const heatValue = (fansCount * 3 + (window.getCharContributionScore(char.id) || 0)).toLocaleString();

  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}超话#`;

  container.innerHTML = `
    <div class="st-hero relative overflow-hidden rounded-3xl -mx-4 -mt-3">
      <div class="absolute inset-0 bg-cover bg-center opacity-40 blur-sm scale-110" style="background-image:url('${char.avatar}')"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/70 to-slate-950"></div>
      <div class="absolute inset-0" style="background:radial-gradient(ellipse at 30% 20%, rgba(255,42,109,.25), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(121,40,202,.3), transparent 55%)"></div>
      <div class="relative z-10 px-5 pt-5 pb-5 text-white">
        <div class="flex items-start gap-3.5">
          <div class="relative flex-shrink-0">
            <div class="w-16 h-16 rounded-2xl p-[2px] bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-violet-500 shadow-lg">
              <img src="${char.avatar}" class="w-full h-full rounded-[14px] object-cover">
            </div>
            <span class="absolute -bottom-1 -right-1 text-xs drop-shadow-lg">👑</span>
          </div>
          <div class="min-w-0 flex-1 pt-0.5">
            <h2 class="text-lg font-black leading-tight truncate">#${char.name}超话#</h2>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="st-level-tag">Lv.${checkIn.level} 皇冠超话</span>
              <span class="st-cat-tag">${char.category || '明星超话'}</span>
              <span class="st-cat-tag">${char.tag || '次元才艺'}</span>
            </div>
            <p class="text-[10px] text-slate-300/80 mt-1.5">主持人：@${char.name}后援会 · 2023年创建</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          <div class="st-stat">
            <span class="st-stat-num">${fansCount.toLocaleString()}</span>
            <span class="st-stat-label">粉丝</span>
          </div>
          <div class="st-stat st-stat-divider">
            <span class="st-stat-num">${todayDiscuss}</span>
            <span class="st-stat-label">今日讨论</span>
          </div>
          <div class="st-stat st-stat-divider">
            <span class="st-stat-num">${heatValue}</span>
            <span class="st-stat-label">超话热度</span>
          </div>
        </div>
        <div class="flex items-center gap-2.5 mt-4">
          <button onclick="handleSuperTopicFollow('${char.name}')" class="st-follow-btn ${isFollowed ? 'st-followed' : ''}">
            ${isFollowed ? '已关注超话' : '+ 关注超话'}
          </button>
          <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" id="stHeroCheckinBtn" class="st-icon-btn" title="每日签到">
            ${checkIn.isCheckedToday ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`}
          </button>
          <button onclick="openCreatePostModal('#${char.name}超话#', '@${char.name}')" class="st-icon-btn" title="发超话帖">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="st-announce mt-3">
      <span class="st-announce-icon">📢</span>
      <span class="st-announce-text">房管公告：欢迎来到 #${char.name}超话#！文明打榜，爱护主播～</span>
    </div>
    <div class="st-tabbar mt-3">
      <div onclick="switchSuperTopicSubTab('posts')" id="spSubTabBtn_posts" class="st-tab ${currentSuperTopicSubTab === 'posts' ? 'active' : ''}">动态</div>
      <div onclick="switchSuperTopicSubTab('contribute')" id="spSubTabBtn_contribute" class="st-tab ${currentSuperTopicSubTab === 'contribute' ? 'active' : ''}">贡献榜</div>
      <div onclick="switchSuperTopicSubTab('checkin')" id="spSubTabBtn_checkin" class="st-tab ${currentSuperTopicSubTab === 'checkin' ? 'active' : ''}">签到榜</div>
      <div onclick="switchSuperTopicSubTab('support')" id="spSubTabBtn_support" class="st-tab ${currentSuperTopicSubTab === 'support' ? 'active' : ''}">打榜应援</div>
    </div>
    <div id="superTopicSubTabContainer" class="mt-3"></div>
  `;
  switchSuperTopicSubTab(currentSuperTopicSubTab || 'posts');
}
window.renderSuperTopicView = renderSuperTopicView;

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
    if (superTopicVirtualScrollerInstance) { superTopicVirtualScrollerInstance.destroy(); superTopicVirtualScrollerInstance = null; }
    renderSuperTopicContributeTab(char);
  } else if (tabKey === 'checkin') {
    if (superTopicVirtualScrollerInstance) { superTopicVirtualScrollerInstance.destroy(); superTopicVirtualScrollerInstance = null; }
    renderSuperTopicCheckinTab(char);
  } else if (tabKey === 'support') {
    if (superTopicVirtualScrollerInstance) { superTopicVirtualScrollerInstance.destroy(); superTopicVirtualScrollerInstance = null; }
    renderSuperTopicSupportTab(char);
  }
}
window.switchSuperTopicSubTab = switchSuperTopicSubTab;

function renderSuperTopicPostsTab(charId) {
  const container = document.getElementById('communitySuperTopicContent');
  const target = document.getElementById('superTopicSubTabContainer');
  if (!container || !target) return;
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(charId)) || chars[0];
  let topicPosts = (window.weiboPosts || []).filter(p => (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name)));
  if (topicPosts.length === 0) {
    topicPosts = [{
      id: `topic_post_${char.id}`,
      author: { name: `${char.name}后援会会长`, avatar: char.avatar, badge: '超话大咖', verified: true },
      time: `刚刚 · 来自 ${window.getFloatClientTag(true)}`,
      tag: `#${char.name}超话#`, mention: `@${char.name}`, linkText: '',
      content: `欢迎来到【${char.name}】粉丝专属超话！每天签到打卡、给主播打榜应援均可登上超话守护总榜！`,
      image: char.avatar,
      stats: { reposts: 180, comments: 24, likes: 680, isLiked: false, isDownloaded: false },
      commentTree: []
    }];
  }
  if (!superTopicVirtualScrollerInstance || superTopicVirtualScrollerInstance.container !== container) {
    superTopicVirtualScrollerInstance = new window.CommunityVirtualScroller({
      container: container, target: target, items: topicPosts,
      estimatedItemHeight: 260, buffer: 4,
      renderItem: (post) => `
        <div class="st-post-card" onclick="openTrendDetail('${post.id}')">
          <div class="flex items-center justify-between" onclick="event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
              <div>
                <div class="flex items-center gap-1.5">
                  <h5 class="text-xs font-black text-slate-900">${post.author.name}</h5>
                  ${post.author.badge ? `<span class="st-post-badge">${post.author.badge}</span>` : ''}
                </div>
                <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
              </div>
            </div>
            <span class="st-post-tag">#${char.name}超话#</span>
          </div>
          <p class="text-xs text-slate-800 leading-relaxed mt-2.5">
            <span class="weibo-tag">#${char.name}超话#</span>${post.content}
          </p>
          ${post.image ? `<div class="rounded-xl overflow-hidden aspect-video bg-slate-100 mt-2.5"><img src="${post.image}" class="w-full h-full object-cover" loading="lazy"></div>` : ''}
          <div class="social-action-bar mt-2.5" onclick="event.stopPropagation()">
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
  } else { superTopicVirtualScrollerInstance.updateItems(topicPosts); }
}
window.renderSuperTopicPostsTab = renderSuperTopicPostsTab;

function renderSuperTopicContributeTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
  const userExtraContribute = window.getCharContributionScore(char.id);
  const baseFans = [
    { name: '星空拾荒者', avatar: getAvatar('星空拾荒者', 'first'), score: 38200, badge: '至尊盟主' },
    { name: '喵喵守护大队长', avatar: getAvatar('喵喵守护大队长', 'first'), score: 26500, badge: '超级铁粉' },
    { name: '不吃香菜的猫', avatar: getAvatar('不吃香菜的猫', 'first'), score: 18400, badge: '忠实舰长' },
    { name: '月亮邮局', avatar: getAvatar('月亮邮局', 'first'), score: 9800, badge: '守护天使' },
    { name: '塞博浪人', avatar: getAvatar('塞博浪人', 'first'), score: 6200, badge: '真爱粉' }
  ];
  const userTotalScore = 12000 + userExtraContribute;
  const userItem = { name: `${uName} (你)`, avatar: uAvatar, score: userTotalScore, badge: userTotalScore > 30000 ? '超话神豪' : '核心应援官', isUser: true };
  const fullList = [...baseFans, userItem].sort((a, b) => b.score - a.score);
  const top1 = fullList[0], top2 = fullList[1], top3 = fullList[2], rest = fullList.slice(3);
  container.innerHTML = `
    <div class="st-contribute-header">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-lg">💎</span>
        <div class="min-w-0">
          <h5 class="font-black text-slate-900 text-xs">#${char.name}# 专属贡献总榜</h5>
          <p class="text-[9px] text-slate-500 mt-0.5 truncate">直播打赏 · 超话打榜 · 周边应援，全场景消费均计入贡献值！</p>
        </div>
      </div>
      <button onclick="openSuperTopicSupportModal()" class="st-mini-btn">为Ta打榜</button>
    </div>
    <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
      ${top2 ? `<div class="flex flex-col items-center"><div class="relative mb-2"><div class="w-12 h-12 rounded-full p-0.5 bg-slate-300 shadow-md"><img src="${top2.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-2 -right-1 text-xs">🥈</span></div><span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top2.name}</span><span class="text-[9px] text-slate-400 mt-0.5">${top2.score.toLocaleString()} 贡献</span><div class="podium-step-2 w-full mt-2 flex items-center justify-center font-black text-slate-400 text-sm">2</div></div>` : '<div></div>'}
      ${top1 ? `<div class="flex flex-col items-center"><div class="relative mb-2"><div class="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 shadow-lg"><img src="${top1.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-3 -right-1 text-base animate-bounce">👑</span></div><span class="text-xs font-black text-amber-600 truncate max-w-[95px]">${top1.name}</span><span class="text-[9px] font-bold text-slate-500 mt-0.5">${top1.score.toLocaleString()} 贡献</span><div class="podium-step-1 w-full mt-2 flex items-center justify-center font-black text-amber-500 text-lg">1</div></div>` : '<div></div>'}
      ${top3 ? `<div class="flex flex-col items-center"><div class="relative mb-2"><div class="w-12 h-12 rounded-full p-0.5 bg-amber-700/40 shadow-md"><img src="${top3.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-2 -right-1 text-xs">🥉</span></div><span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top3.name}</span><span class="text-[9px] text-slate-400 mt-0.5">${top3.score.toLocaleString()} 贡献</span><div class="podium-step-3 w-full mt-2 flex items-center justify-center font-black text-amber-700 text-sm">3</div></div>` : '<div></div>'}
    </div>
    <div class="space-y-2 mt-2">
      ${rest.map((item, idx) => `
        <div class="st-rank-item ${item.isUser ? 'st-rank-user' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center text-xs font-black text-slate-400">${idx + 4}</span>
            <img src="${item.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0"><div class="flex items-center gap-1.5"><h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5><span class="st-rank-badge">${item.badge}</span></div></div>
          </div>
          <div class="text-right flex-shrink-0"><span class="text-xs font-black text-rose-600">${item.score.toLocaleString()}</span><p class="text-[8px] text-slate-400">贡献值</p></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSuperTopicCheckinTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
  const checkIn = window.getSuperTopicCheckInInfo(char.id);
  const checkinRankList = (window.LumaCheckinManager && typeof window.LumaCheckinManager.getTopicCheckInRankList === 'function')
    ? window.LumaCheckinManager.getTopicCheckInRankList(char.id)
    : [
        { name: '苏小喵全球后援会', avatar: getAvatar('苏小喵全球后援会', 'first'), days: 128, total: 38400, badge: '开山元老' },
        { name: '每日必吸猫', avatar: getAvatar('每日必吸猫', 'first'), days: 95, total: 28500, badge: '连续满勤' },
        { name: '星奈今天直播了吗', avatar: getAvatar('星奈今天直播了吗', 'first'), days: 64, total: 19200, badge: '超话达人' },
        { name: '早起看重播', avatar: getAvatar('早起看重播', 'first'), days: 42, total: 12600, badge: '活跃打卡' },
        { name: `${uName} (你)`, avatar: uAvatar, days: checkIn.streakDays, total: checkIn.totalExp, badge: checkIn.isCheckedToday ? '今日已打卡' : '等待打卡', isUser: true }
      ].sort((a, b) => b.days - a.days);
  container.innerHTML = `
    <div class="luxe-card p-4 bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-200/80 space-y-3 rounded-2xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">📅</span>
          <div><h4 class="text-xs font-black text-emerald-950">超话每日打卡中心</h4><p class="text-[9px] text-emerald-700 mt-0.5">连续签到可提升超话头衔等级，赢取专属守护勋章</p></div>
        </div>
        <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" class="px-3.5 py-1.5 rounded-full text-xs font-black ${checkIn.isCheckedToday ? 'checkin-btn-done' : 'checkin-btn-active'}">
          ${checkIn.isCheckedToday ? `已打卡 第${checkIn.streakDays}天` : '立即打卡'}
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center pt-1 border-t border-emerald-100">
        <div><span class="text-xs font-black text-slate-800">${checkIn.streakDays} 天</span><p class="text-[8px] text-slate-400">当前连续签到</p></div>
        <div><span class="text-xs font-black text-emerald-600">Lv.${checkIn.level}</span><p class="text-[8px] text-slate-400">超话头衔等级</p></div>
        <div><span class="text-xs font-black text-slate-800">${checkIn.totalExp}</span><p class="text-[8px] text-slate-400">累计签到经验</p></div>
      </div>
    </div>
    <div class="space-y-2 pt-3 mt-1">
      <div class="flex items-center justify-between px-1"><h5 class="text-xs font-black text-slate-900">连续签到排行榜 TOP</h5><span class="text-[9px] text-slate-400">按连续打卡天数排序</span></div>
      ${checkinRankList.map((item, idx) => `
        <div class="st-rank-item ${item.isUser ? 'st-rank-emerald' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center text-xs font-black ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}">${idx + 1}</span>
            <img src="${item.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0"><div class="flex items-center gap-1.5"><h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5><span class="st-rank-badge">${item.badge}</span></div></div>
          </div>
          <div class="text-right flex-shrink-0"><span class="text-xs font-black text-emerald-600">连续 ${item.days} 天</span><p class="text-[8px] text-slate-400">累计 ${item.total} 经验</p></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSuperTopicSupportTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;
  const currentWallet = window.currentWalletBalance || 18800;
  const userContribute = window.getCharContributionScore(char.id);
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function') ? window.LumaFansManager.getFans(char.id, char) : (char.fans || 0);
  container.innerHTML = `
    <div class="st-support-hero">
      <div class="flex items-center justify-between">
        <span class="st-support-tag">明星超话打榜中心</span>
        <span class="text-xs font-black text-amber-300">我的余额: ${currentWallet.toLocaleString()} 币</span>
      </div>
      <div class="mt-2.5"><h4 class="text-sm font-black">为 #${char.name}# 打榜应援</h4><p class="text-xs text-rose-100 leading-relaxed mt-1">你的每一次打榜消费，都将 1:1 转化为对该主播的专属贡献值，并提升超话全服热度！</p></div>
      <div class="flex items-center gap-4 text-xs pt-2.5 mt-2.5 border-t border-white/15">
        <div><span class="text-[9px] text-rose-200">我对Ta的打榜贡献</span><p class="font-black text-white text-sm">${userContribute.toLocaleString()} 点</p></div>
        <div><span class="text-[9px] text-rose-200">超话总热度</span><p class="font-black text-amber-300 text-sm">${(fansCount * 3 + userContribute).toLocaleString()}</p></div>
      </div>
    </div>
    <div class="space-y-2 mt-3">
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
    <button onclick="openSuperTopicSupportModal()" class="btn-brand w-full py-2.5 justify-center text-xs font-black shadow-md flex items-center gap-1.5 mt-3"><span>立即为主播打榜应援</span></button>
  `;
}

function selectSupportGiftDirect(giftId, charId) {
  selectedSupportGiftId = giftId;
  const char = window.getAvailableCharsList().find(c => String(c.id) === String(charId));
  if (char) renderSuperTopicSupportTab(char);
}
window.selectSupportGiftDirect = selectSupportGiftDirect;

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
    if (el) { if (g.id === giftId) el.classList.add('selected'); else el.classList.remove('selected'); }
  });
  updateSupportButtonText();
}
window.selectSupportGift = selectSupportGift;

function updateSupportButtonText() {
  const btn = document.getElementById('btnExecuteSupport');
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  if (btn && gift) btn.innerHTML = `<span>确认打榜 (消耗 ${gift.price} LUMA币 · +${gift.exp}贡献)</span>`;
}

function executeSupportGift() {
  const gift = (window.SUPPORT_GIFTS || []).find(g => g.id === selectedSupportGiftId) || (window.SUPPORT_GIFTS || [])[0];
  let wallet = window.currentWalletBalance || 18800;
  if (wallet < gift.price) { api.ui.toast("LUMA 币余额不足，请前往充值中心！"); return; }
  window.currentWalletBalance = wallet - gift.price;
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(currentActiveSuperTopicCharId)) || chars[0];
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
  if (idx > -1) { window.followedSuperTopics.splice(idx, 1); api.ui.toast(`已取消关注【${hostName}】超话`); }
  else { window.followedSuperTopics.push(topicId); api.ui.toast(`已成功关注【${hostName}】超话！`); }
  try { localStorage.setItem('luma_followed_supertopics', JSON.stringify(window.followedSuperTopics)); } catch (e) {}
  try { api.db.create("luma_supertopic_follows", { id: 'user', topics: window.followedSuperTopics }).catch(() => { api.db.update("luma_supertopic_follows", 'user', { topics: window.followedSuperTopics }).catch(() => {}); }); } catch (e) {}
  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  renderSuperTopicView(currentActiveSuperTopicCharId);
}
window.handleSuperTopicFollow = handleSuperTopicFollow;

function handleSuperTopicCheckIn(charId, charName) {
  const checkIn = window.getSuperTopicCheckInInfo(charId);
  if (checkIn.isCheckedToday) { api.ui.toast('今日已打卡，明天再来哦～'); return; }
  if (window.LumaCheckinManager && typeof window.LumaCheckinManager.checkIn === 'function') {
    window.LumaCheckinManager.checkIn(charId);
  } else {
    if (!window.superTopicCheckinData) window.superTopicCheckinData = {};
    window.superTopicCheckinData[charId] = { isCheckedToday: true, streakDays: (checkIn.streakDays || 0) + 1, totalExp: (checkIn.totalExp || 0) + 100, level: checkIn.level || 1 };
  }
  const heroBtn = document.getElementById('stHeroCheckinBtn');
  if (heroBtn) heroBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${(checkIn.streakDays || 0) + 1} 天！`);
  const chars = window.getAvailableCharsList();
  const char = chars.find(c => String(c.id) === String(charId));
  if (char && currentSuperTopicSubTab === 'checkin') renderSuperTopicCheckinTab(char);
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

function toggleSuperTopicDrawer(forceState) {
  const backdrop = document.getElementById('superTopicDrawerBackdrop');
  const panel = document.getElementById('superTopicDrawerPanel');
  if (!panel || !backdrop) return;
  const isOpen = panel.classList.contains('open');
  const nextState = (typeof forceState === 'boolean') ? forceState : !isOpen;
  if (nextState) { renderSuperTopicDrawer(); backdrop.classList.remove('hidden'); panel.classList.add('open'); }
  else { panel.classList.remove('open'); backdrop.classList.add('hidden'); }
}
window.toggleSuperTopicDrawer = toggleSuperTopicDrawer;

function closeSuperTopicDrawer() { toggleSuperTopicDrawer(false); }
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
            <div class="flex items-center gap-1.5"><h5 class="text-xs font-black text-slate-900 truncate">#${c.name}超话#</h5>${isCurrent ? `<span class="text-[8px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.2 rounded-full">当前</span>` : ''}</div>
            <p class="text-[9px] text-slate-400 mt-0.5 truncate">${c.category || '明星超话'} · ${c.tag || '次元才艺'}</p>
          </div>
        </div>
        <svg class="w-4 h-4 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `;
  }).join('');
}

function selectSuperTopicChar(charId) {
  closeSuperTopicDrawer();
  currentSuperTopicSubTab = 'posts';
  renderSuperTopicView(charId);
}
window.selectSuperTopicChar = selectSuperTopicChar;
