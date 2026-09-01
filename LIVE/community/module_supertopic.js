// =========================================================================
// 【模块二·社区子文档2·主播超话系统】LIVE/社区/module_supertopic.js
// 深度复刻微博超话：点击头像切换超话 + 个人主页式分段导航（动态 | 签到 | 打榜 | 贡献榜）
// 签到一天一次 → 贡献值+100、应援币+100（真实连续天数）；打榜周边应援消耗应援币增长贡献值
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
function getSupportCoin(charId) {
  try {
    if (window.LumaCheckinManager && typeof window.LumaCheckinManager.getSupportCoin === 'function') {
      return Number(window.LumaCheckinManager.getSupportCoin(charId)) || 0;
    }
  } catch (e) {}
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
// 主视图渲染：Hero + 分段导航 + 内容面板
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
  const supportCoin = getSupportCoin(char.id);
  const topicPosts = topicPostsFor(char);
  const todayDiscuss = topicPosts.length + 18;
  const heatValue = (fansCount * 3 + contribution).toLocaleString();

  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}超话#`;

  container.innerHTML = `
    <!-- 1. 沉浸式超话 Hero 头部卡片 -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 shadow-xl border border-slate-700/50">
      <div class="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-br from-rose-500/25 via-purple-500/20 to-transparent blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none"></div>

      <div class="relative z-10 flex items-start justify-between gap-3">
        <div class="flex items-center gap-3.5 min-w-0 flex-1">
          <!-- 头像：点击切换超话 -->
          <div class="relative flex-shrink-0 cursor-pointer active:scale-95 transition" onclick="toggleSuperTopicDrawer()">
            <div class="w-14 h-14 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-cyan-400 shadow-md">
              <img class="w-full h-full rounded-[14px] object-cover bg-slate-950" src="${char.avatar}" alt="超话头像">
            </div>
            <span class="absolute -bottom-1 -right-1 text-[8px] bg-slate-900/90 text-rose-300 font-extrabold px-1.5 py-0.5 rounded-full border border-rose-500/40 shadow-sm">切换</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h2 class="text-base font-black tracking-tight text-white truncate max-w-[160px]">#${char.name}超话#</h2>
              <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-sm">超话·${char.category || '明星'}</span>
            </div>
            <p class="text-[10px] text-slate-300/80 mt-1 flex items-center gap-1 truncate">
              <span class="text-rose-400 font-bold">主持人</span> @${char.name}后援会 · 官方认证
            </p>
          </div>
        </div>
        <button onclick="handleSuperTopicFollow('${char.name}')" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black transition active:scale-95 shadow-md ${isFollowed ? 'bg-white/15 text-slate-200 backdrop-blur-md border border-white/20' : 'bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-rose-500/30'}">
          ${isFollowed ? '✓ 已关注' : '+ 关注'}
        </button>
      </div>

      <!-- 4合1 数据总览栏 -->
      <div class="relative z-10 grid grid-cols-4 gap-1 mt-3.5 pt-3 border-t border-white/10 text-center">
        <div class="px-1">
          <div class="text-xs font-black text-white tracking-tight">${fansCount.toLocaleString()}</div>
          <div class="text-[9px] text-slate-400 mt-0.5 font-medium">粉丝数</div>
        </div>
        <div class="px-1 border-l border-white/10">
          <div class="text-xs font-black text-white tracking-tight">${todayDiscuss}</div>
          <div class="text-[9px] text-slate-400 mt-0.5 font-medium">今日讨论</div>
        </div>
        <div class="px-1 border-l border-white/10">
          <div class="text-xs font-black text-amber-300 tracking-tight">${contribution.toLocaleString()}</div>
          <div class="text-[9px] text-slate-400 mt-0.5 font-medium">我的贡献</div>
        </div>
        <div class="px-1 border-l border-white/10">
          <div class="text-xs font-black text-rose-400 tracking-tight">${heatValue}</div>
          <div class="text-[9px] text-slate-400 mt-0.5 font-medium">超话热度</div>
        </div>
      </div>
    </div>

    <!-- 2. 个人主页式分段导航：动态 | 签到 | 打榜 | 贡献榜 -->
    <div class="sticky top-0 z-20 mt-3 bg-white/95 backdrop-blur-xl rounded-2xl p-1 shadow-sm border border-slate-100 flex">
      ${['posts', 'checkin', 'support', 'contribute'].map(k => {
        const label = { posts: '动态', checkin: '签到', support: '打榜', contribute: '贡献榜' }[k];
        const icon = { posts: '📃', checkin: '📅', support: '🎁', contribute: '🏆' }[k];
        return `<button id="spTabBtn_${k}" onclick="switchSuperTopicTab('${k}')" class="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition active:scale-95 ${currentSuperTopicTab === k ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md' : 'text-slate-500'}">
          <span class="text-[13px] leading-none">${icon}</span>
          <span class="text-[10px] font-black">${label}</span>
        </button>`;
      }).join('')}
    </div>

    <!-- 3. 内容面板（随分段导航刷新的挂载点） -->
    <div id="superTopicPanel" class="space-y-3 mt-3 pb-24"></div>
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
    if (k === tabKey) btn.className = 'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition active:scale-95 bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md';
    else btn.className = 'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition active:scale-95 text-slate-500';
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
      content: `欢迎来到【${char.name}】粉丝专属超话！每天签到打卡、用应援币为主播打榜周边，均可登上超话守护贡献总榜！`,
      image: char.avatar,
      stats: { reposts: 180, comments: 24, likes: 680, isLiked: false, isDownloaded: false },
      commentTree: []
    }];
  }

  panel.innerHTML = `
    <div class="flex items-center justify-between px-1">
      <h3 class="text-sm font-black text-slate-900">超话动态</h3>
      <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">${posts.length} 篇</span>
    </div>
    ${posts.map(post => `
      <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 transition active:scale-[0.99] cursor-pointer" onclick="openTrendDetail('${post.id}')">
        <div class="flex items-center justify-between" onclick="event.stopPropagation()">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-black text-slate-900 truncate">${post.author.name}</h5>
                ${post.author.badge ? `<span class="text-[8px] px-1.5 py-0.2 rounded bg-gradient-to-r from-rose-50 to-purple-50 text-rose-600 font-extrabold border border-rose-200/50">${post.author.badge}</span>` : ''}
              </div>
              <p class="text-[9px] text-slate-400 mt-0.5">${post.time || (post.createdAt ? (function(){ try { return (window.formatDynamicTime ? window.formatDynamicTime(post.createdAt) : '刚刚') + ' · 来自 ' + (window.getFloatClientTag ? window.getFloatClientTag(true) : '小手机'); } catch(e){ return '刚刚'; } })() : '刚刚')}</p>
            </div>
          </div>
          <span class="text-[10px] text-rose-500 font-black bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 flex-shrink-0">#${char.name}超话#</span>
        </div>
        <p class="text-xs text-slate-800 leading-relaxed mt-2.5 font-normal">
          <span class="text-rose-600 font-bold mr-1">#${char.name}超话#</span>${post.content}
        </p>
        ${post.image ? `<div class="rounded-xl overflow-hidden aspect-video bg-slate-100 mt-2.5 shadow-inner"><img src="${post.image}" class="w-full h-full object-cover" loading="lazy"></div>` : ''}
        <div class="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-slate-500 text-xs" onclick="event.stopPropagation()">
          <div onclick="handlePostAction('${post.id}', 'repost')" class="flex items-center gap-1.5 hover:text-slate-800 transition active:scale-90 p-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <span class="text-[10px] font-bold">${post.stats.reposts}</span>
          </div>
          <div onclick="openTrendDetail('${post.id}')" class="flex items-center gap-1.5 hover:text-slate-800 transition active:scale-90 p-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span class="text-[10px] font-bold">${post.stats.comments}</span>
          </div>
          <div onclick="handlePostAction('${post.id}', 'like')" class="flex items-center gap-1.5 transition active:scale-90 p-1 ${post.stats.isLiked ? 'text-rose-500 font-black' : 'hover:text-rose-500'}">
            <svg class="w-3.5 h-3.5 ${post.stats.isLiked ? 'fill-rose-500' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
            <span class="text-[10px] font-bold">${post.stats.likes}</span>
          </div>
        </div>
      </div>
    `).join('')}

    <!-- 底部发布动态快捷栏 -->
    <div class="bg-white rounded-2xl p-3 flex items-center gap-2.5 border border-slate-100 shadow-sm" onclick="openCreatePostModal('#${char.name}超话#', '@${char.name}')">
      <div class="flex-1 bg-slate-50 text-slate-400 text-xs font-bold px-3.5 py-2 rounded-full">说点什么，为主播打 call...</div>
      <button class="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-rose-500/30 flex-shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
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
  const supportCoin = getSupportCoin(char.id);
  const contribution = getCharContribution(char.id);
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  let calendar = '';
  for (let i = 0; i < 7; i++) {
    let cls = 'text-slate-300 bg-slate-50 border border-slate-100';
    if (i < dayOfWeek) cls = 'text-rose-500 bg-rose-50 border border-rose-200 font-bold';
    else if (i === dayOfWeek) cls = checkIn.isCheckedToday
      ? 'text-rose-500 bg-rose-50 border border-rose-200 font-black ring-1 ring-rose-300'
      : 'text-rose-600 bg-white border-2 border-dashed border-rose-400 font-black animate-pulse';
    calendar += `<div class="flex-1 aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] ${cls}">${weekDays[i]}</div>`;
  }

  const rankList = (window.LumaCheckinManager && typeof window.LumaCheckinManager.getTopicCheckInRankList === 'function')
    ? window.LumaCheckinManager.getTopicCheckInRankList(char.id).slice(0, 5) : [];

  panel.innerHTML = `
    <!-- 签到主卡 -->
    <div class="bg-gradient-to-br from-emerald-50 via-teal-50 to-white border border-emerald-200/80 p-4 rounded-3xl shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">📅</span>
          <div>
            <h4 class="text-xs font-black text-emerald-950">#${char.name}# 每日签到</h4>
            <p class="text-[9px] text-emerald-700 mt-0.5">一天一次 · 签到即得 贡献+100 / 应援币+100</p>
          </div>
        </div>
        <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" class="px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 shadow-md ${checkIn.isCheckedToday ? 'bg-emerald-100 text-emerald-700 shadow-none cursor-default' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20'}">
          ${checkIn.isCheckedToday ? '✓ 今日已签到' : '立即签到'}
        </button>
      </div>

      <!-- 本周签到日历 -->
      <div class="flex items-center gap-1.5 mt-1">${calendar}</div>

      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 text-center">
        <div class="bg-white/70 rounded-xl py-2">
          <span class="block text-lg font-black text-emerald-600 leading-none">${checkIn.streakDays || 0} 天</span>
          <span class="text-[8px] text-slate-400 font-bold mt-1 block">连续签到</span>
        </div>
        <div class="bg-white/70 rounded-xl py-2">
          <span class="block text-lg font-black text-slate-800 leading-none">${checkIn.totalDays || 0} 天</span>
          <span class="text-[8px] text-slate-400 font-bold mt-1 block">累计已签到</span>
        </div>
      </div>

      <!-- 我 已签到 x 天 -->
      <div class="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 bg-white/70 rounded-xl py-2 font-bold">
        <span class="text-rose-500">我已签到 <b class="text-rose-600">${checkIn.totalDays || 0}</b> 天</span>
        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>连签 <b class="text-emerald-600">${checkIn.streakDays || 0}</b> 天</span>
        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>应援币 <b class="text-amber-600">${supportCoin.toLocaleString()}</b></span>
        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>贡献 <b class="text-purple-600">${contribution.toLocaleString()}</b></span>
      </div>
    </div>

    <!-- 签到排行榜 -->
    <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-1.5 text-xs font-black text-slate-900"><span class="text-sm">🏆</span><span>连续签到榜 TOP</span></div>
        <span class="text-[9px] text-slate-400 font-bold">按连签天数排序</span>
      </div>
      ${rankList.length ? rankList.map((item, idx) => `
        <div class="py-2 flex items-center justify-between border-b border-slate-50 last:border-0 ${item.isUser ? 'ring-1 ring-emerald-300 rounded-xl my-0.5 px-2 bg-emerald-50/40' : ''}">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-5 text-center text-xs font-black ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}">${idx + 1}</span>
            <img src="${item.avatar}" class="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5"><h5 class="text-[11px] font-black text-slate-900 truncate">${item.name}</h5></div>
              <p class="text-[8px] text-slate-400 font-bold">Lv.${item.level || 1} ${item.badge || '签到打卡'}</p>
            </div>
          </div>
          <span class="text-xs font-black text-emerald-600 shrink-0">${item.days} 天</span>
        </div>
      `).join('') : '<p class="text-center text-[10px] text-slate-400 py-3 font-bold">暂时还没有人签到，快来抢首签！</p>'}
    </div>
  `;
}
window.renderSuperTopicCheckinTab = renderSuperTopicCheckinTab;

// -------------------------------------------------------------------------
// 打榜/周边应援 Tab（消耗应援币 → 增长贡献值）
// -------------------------------------------------------------------------
function renderSuperTopicSupportTab(char) {
  const panel = document.getElementById('superTopicPanel');
  if (!panel) return;
  const supportCoin = getSupportCoin(char.id);
  const contribution = getCharContribution(char.id);
  const fansCount = (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function')
    ? window.LumaFansManager.getFans(char.id, char) : (char.fans || 0);

  panel.innerHTML = `
    <div class="bg-gradient-to-br from-rose-600 via-pink-600 to-purple-700 rounded-3xl p-4 text-white shadow-xl space-y-2.5 relative overflow-hidden">
      <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      <div class="relative z-10 flex items-center justify-between">
        <span class="text-[10px] font-black bg-white/20 px-2.5 py-0.5 rounded-full border border-white/20">明星超话 · 周边应援中心</span>
        <span class="text-xs font-black text-amber-200">应援币余额：${supportCoin.toLocaleString()}</span>
      </div>
      <div class="relative z-10">
        <h4 class="text-sm font-black">为主播 #${char.name}# 应援</h4>
        <p class="text-[10px] text-rose-100 leading-relaxed mt-1">每日签到领取应援币，用于购买主播周边应援物。每一份应援都将 1:1 转化为主播的专属贡献值！</p>
      </div>
      <div class="relative z-10 flex items-center gap-4 text-xs pt-2.5 mt-2 border-t border-white/15">
        <div><span class="text-[9px] text-rose-200 font-medium">我贡献的应援值</span><p class="font-black text-white text-sm">${contribution.toLocaleString()} 点</p></div>
        <div><span class="text-[9px] text-rose-200 font-medium">超话总热度</span><p class="font-black text-amber-200 text-sm">${(fansCount * 3 + contribution).toLocaleString()}</p></div>
      </div>
    </div>

    <div class="space-y-2.5">
      <h5 class="text-xs font-black text-slate-900 px-1">选择应援周边</h5>
      <div class="grid grid-cols-2 gap-2.5">
        ${(window.SUPPORT_GIFTS || []).map(g => `
          <div class="bg-white rounded-2xl p-3 border transition active:scale-95 cursor-pointer shadow-sm ${selectedSupportGiftId === g.id ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-100 hover:border-slate-200'}" onclick="selectSupportGiftDirect('${g.id}', '${char.id}')">
            <div class="text-2xl mb-1">${g.icon}</div>
            <h6 class="text-xs font-black text-slate-900">${g.name}</h6>
            <p class="text-[9px] text-slate-400 mt-0.5">${g.desc}</p>
            <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="font-black text-rose-600">${g.exp} 贡献</span>
              <span class="text-[8px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded">${g.price} 应援币</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <button onclick="executeSupportGift()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white text-xs font-black shadow-lg shadow-rose-500/25 active:scale-98 transition mb-2">
      立即应援打榜（消耗应援币 · 涨贡献）
    </button>
    <p class="text-center text-[9px] text-slate-400 font-bold pb-2">应援币不足？去「签到」栏每日签到领取 +100</p>
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
  const userContribute = getCharContribution(char.id);

  // 融合预设粉丝生态 + 玩家真实贡献
  const baseFans = [
    { name: '星空拾荒者', id: 'seed_1', avatar: getAvatarFor('星空拾荒者', 'first'), score: 38200, badge: '至尊盟主' },
    { name: '喵喵守护大队长', id: 'seed_2', avatar: getAvatarFor('喵喵守护大队长', 'first'), score: 26500, badge: '超级铁粉' },
    { name: '不吃香菜的猫', id: 'seed_3', avatar: getAvatarFor('不吃香菜的猫', 'first'), score: 18400, badge: '忠实舰长' },
    { name: '月亮邮局', id: 'seed_4', avatar: getAvatarFor('月亮邮局', 'first'), score: 9800, badge: '守护天使' }
  ];
  const userItem = {
    name: `${currentUserName()} (你)`,
    id: 'user',
    avatar: currentUserAvatar(),
    score: userContribute,
    badge: userContribute >= 30000 ? '超话神豪' : (userContribute > 0 ? '核心应援官' : '暂未贡献'),
    isUser: true
  };
  const fullList = [...baseFans, userItem].sort((a, b) => b.score - a.score);
  const top1 = fullList[0], top2 = fullList[1], top3 = fullList[2], rest = fullList.slice(3);

  panel.innerHTML = `
    <div class="bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-lg border border-purple-800/40 relative overflow-hidden">
      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl">💎</span>
          <div class="min-w-0">
            <h5 class="font-black text-xs text-white">#${char.name}# 专属守护·贡献总榜</h5>
            <p class="text-[9px] text-purple-200 mt-0.5 truncate">直播间送礼 · 每日签到 · 周边应援，全场景消费均计入贡献值！</p>
          </div>
        </div>
        <button onclick="switchSuperTopicTab('support')" class="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black shadow-md active:scale-95 flex-shrink-0">去应援</button>
      </div>

      <!-- 领奖台 -->
      <div class="grid grid-cols-3 gap-2 items-end pt-5 pb-1 text-center relative z-10">
        ${top2 ? `<div class="flex flex-col items-center"><div class="relative mb-1.5"><div class="w-11 h-11 rounded-full p-0.5 bg-slate-300 shadow-md"><img src="${top2.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-2 -right-1 text-xs">🥈</span></div><span class="text-[11px] font-black text-slate-200 truncate max-w-[80px]">${top2.name}</span><span class="text-[9px] text-purple-300 font-bold mt-0.5">${top2.score.toLocaleString()} 贡献</span><div class="w-full mt-2 py-1 bg-white/10 backdrop-blur-md rounded-t-xl font-black text-slate-300 text-xs border-t border-white/20">2</div></div>` : '<div></div>'}
        ${top1 ? `<div class="flex flex-col items-center"><div class="relative mb-1.5"><div class="w-13 h-13 rounded-full p-0.5 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 shadow-lg"><img src="${top1.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-3 -right-1 text-sm animate-bounce">👑</span></div><span class="text-xs font-black text-amber-300 truncate max-w-[90px]">${top1.name}</span><span class="text-[9px] font-bold text-amber-200 mt-0.5">${top1.score.toLocaleString()} 贡献</span><div class="w-full mt-2 py-2 bg-gradient-to-t from-amber-500/30 to-amber-400/20 backdrop-blur-md rounded-t-xl font-black text-amber-300 text-sm border-t border-amber-400/40">1</div></div>` : '<div></div>'}
        ${top3 ? `<div class="flex flex-col items-center"><div class="relative mb-1.5"><div class="w-11 h-11 rounded-full p-0.5 bg-amber-700/60 shadow-md"><img src="${top3.avatar}" class="w-full h-full rounded-full object-cover"></div><span class="absolute -top-2 -right-1 text-xs">🥉</span></div><span class="text-[11px] font-black text-slate-200 truncate max-w-[80px]">${top3.name}</span><span class="text-[9px] text-purple-300 font-bold mt-0.5">${top3.score.toLocaleString()} 贡献</span><div class="w-full mt-2 py-0.5 bg-white/10 backdrop-blur-md rounded-t-xl font-black text-amber-600 text-xs border-t border-white/20">3</div></div>` : '<div></div>'}
      </div>
    </div>

    <div class="space-y-2 mt-2">
      ${rest.map((item, idx) => `
        <div class="bg-white rounded-2xl p-3 flex items-center justify-between border border-slate-100 shadow-sm ${item.isUser ? 'ring-1 ring-rose-400 bg-rose-50/30' : ''}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center text-xs font-black text-slate-400">${idx + 4}</span>
            <img src="${item.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5"><h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5><span class="text-[8px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.2 rounded">${item.badge}</span></div>
              ${item.isUser ? '<p class="text-[8px] text-rose-500 font-bold mt-0.5">由你的签到与应援积累</p>' : ''}
            </div>
          </div>
          <div class="text-right flex-shrink-0"><span class="text-xs font-black text-rose-600">${item.score.toLocaleString()}</span><p class="text-[8px] text-slate-400 font-bold">贡献值</p></div>
        </div>
      `).join('')}
    </div>
    <p class="text-center text-[9px] text-slate-400 font-bold pt-1 pb-2">累计贡献 = 直播间送礼 + 每日签到 + 周边应援</p>
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

  const balance = getSupportCoin(char.id);
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
// 打榜弹窗（可选入口）
// -------------------------------------------------------------------------
function openSuperTopicSupportModal() {
  const modal = document.getElementById('superTopicSupportModal');
  if (!modal) return;
  const char = getActiveChar();
  if (!char) return;
  const supportCoin = getSupportCoin(char.id);

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
// 切换超话抽屉
// -------------------------------------------------------------------------
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

function closeSuperTopicDrawer() { toggleSuperTopicDrawer(false); }
window.closeSuperTopicDrawer = closeSuperTopicDrawer;

function renderSuperTopicDrawer() {
  const container = document.getElementById('superTopicDrawerCharList');
  if (!container) return;
  const chars = window.getAvailableCharsList();
  container.innerHTML = chars.map(c => {
    const isCurrent = (String(c.id) === String(currentActiveSuperTopicCharId));
    const contribution = getCharContribution(c.id);
    return `
      <div onclick="selectSuperTopicChar('${c.id}')" class="p-3 rounded-2xl flex items-center justify-between cursor-pointer active:scale-98 transition ${isCurrent ? 'bg-gradient-to-r from-rose-50 to-purple-50 border border-rose-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}">
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0">
            <img src="${c.avatar}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
            ${c.isLive ? '<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>' : ''}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5"><h5 class="text-xs font-black text-slate-900 truncate">#${c.name}超话#</h5>${isCurrent ? '<span class="text-[8px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.2 rounded-full">当前</span>' : ''}</div>
            <p class="text-[9px] text-slate-400 mt-0.5 truncate">${c.category || '明星超话'} · 我的贡献 ${contribution.toLocaleString()}</p>
          </div>
        </div>
        <svg class="w-4 h-4 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `;
  }).join('');
}

function selectSuperTopicChar(charId) {
  closeSuperTopicDrawer();
  currentSuperTopicTab = 'posts';
  renderSuperTopicView(charId);
}
window.selectSuperTopicChar = selectSuperTopicChar;