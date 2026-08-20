// =========================================================================
// 【模块二·社区子文档1·今日热搜与热点广场】LIVE/社区/module_trends.js
// 包含：
// 1. 微博经典实时热搜榜 TOP 50 (爆/热/新/沸/荐)
// 2. 今日热点广场虚拟化动态瀑布流 (Virtual Scroller 流畅不卡顿)
// 3. 词条过滤与实时发帖/AI高光动态捕捉
// =========================================================================

var api = window.api || {};
let currentHotSearchTab = 'ranking'; // 'ranking' | 'feed'
let currentHotSearchFilter = '';
let trendsVirtualScrollerInstance = null;

// 切换热搜榜与热点广场
function switchHotTrendTab(tabType) {
  currentHotSearchTab = tabType;
  const btnRanking = document.getElementById('btnHotTabRanking');
  const btnFeed = document.getElementById('btnHotTabFeed');
  const rankingBox = document.getElementById('hotSearchRankingContainer');
  const feedBox = document.getElementById('hotSearchFeedContainer');

  if (tabType === 'ranking') {
    if (btnRanking) {
      btnRanking.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition bg-slate-900 text-white shadow-xs';
    }
    if (btnFeed) {
      btnFeed.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900';
    }
    if (rankingBox) rankingBox.classList.remove('hidden');
    if (feedBox) feedBox.classList.add('hidden');
    renderHotSearchRanking();
  } else {
    if (btnRanking) {
      btnRanking.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition text-slate-600 hover:text-slate-900';
    }
    if (btnFeed) {
      btnFeed.className = 'flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition bg-slate-900 text-white shadow-xs';
    }
    if (rankingBox) rankingBox.classList.add('hidden');
    if (feedBox) feedBox.classList.remove('hidden');
    renderTrends();
  }
}
window.switchHotTrendTab = switchHotTrendTab;

// 渲染热搜 TOP 榜
function renderHotSearchRanking() {
  const container = document.getElementById('hotSearchRankingContainer');
  if (!container) return;

  const items = window.HOT_SEARCH_ITEMS || [];

  container.innerHTML = `
    <!-- 置顶焦点热搜条目 -->
    <div class="luxe-card p-3.5 bg-gradient-to-r from-rose-50 via-white to-purple-50 border border-rose-200/80 cursor-pointer shadow-xs" onclick="filterHotSearchTopic('#主播连麦当场破防#')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-xs font-black text-rose-600 flex-shrink-0">📌 置顶</span>
          <h4 class="text-xs font-black text-slate-900 truncate">#主播连麦当场破防# 官方深度吃瓜专题</h4>
        </div>
        <span class="hot-badge-bao flex-shrink-0">爆</span>
      </div>
      <p class="text-[10px] text-slate-500 mt-1 truncate">全网热度 389.2万 · 正在实时引发 5000+ 弹幕与二创讨论</p>
    </div>

    <!-- 微博经典热搜 TOP 列表卡片 -->
    <div class="luxe-card p-3 bg-white space-y-1 divide-y divide-slate-100/80 shadow-xs">
      ${items.map(item => `
        <div class="pt-2 pb-2 first:pt-0 last:pb-0 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 px-1.5 rounded-xl transition" onclick="filterHotSearchTopic('#${item.title}#')">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center font-black text-xs ${item.rank <= 3 ? 'text-rose-600 text-sm' : 'text-slate-400'}">${item.rank}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-bold text-slate-900 truncate">${item.title}</h5>
                ${item.badge ? `<span class="hot-badge-${item.badge}">${item.badgeText}</span>` : ''}
              </div>
              <p class="text-[9px] text-slate-400 mt-0.5">${item.heat} 讨论</p>
            </div>
          </div>
          <button class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
            ›
          </button>
        </div>
      `).join('')}
    </div>
  `;
}
window.renderHotSearchRanking = renderHotSearchRanking;

// 筛选词条跳转热点广场
function filterHotSearchTopic(topicTag) {
  currentHotSearchFilter = topicTag;
  switchHotTrendTab('feed');
}
window.filterHotSearchTopic = filterHotSearchTopic;

function clearHotSearchFilter() {
  currentHotSearchFilter = '';
  renderTrends();
}
window.clearHotSearchFilter = clearHotSearchFilter;

// 单条动态卡片 HTML 模板函数
function getPostCardHtml(post) {
  return `
    <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer hover:border-slate-300 transition shadow-xs mb-3" onclick="openTrendDetail('${post.id}')">
      <!-- 头部：发布者 -->
      <div class="flex items-center justify-between" onclick="event.stopPropagation()">
        <div class="flex items-center gap-2.5">
          <div class="relative">
            <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
            ${post.author.verified ? `<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-[8px] text-white font-black">V</span>` : ''}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="text-xs font-black text-slate-900">${post.author.name}</h4>
              <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${post.author.badge}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>

        <button onclick="handlePostAction('${post.id}', 'download')" class="p-1 text-slate-400 hover:text-slate-700">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      </div>

      <!-- 标签与艾特 -->
      <div class="flex flex-wrap gap-1.5 text-xs">
        ${post.tag ? `<span class="weibo-tag cursor-pointer" onclick="event.stopPropagation(); filterHotSearchTopic('${post.tag}')">${post.tag}</span>` : ''}
        ${post.mention ? `<span class="weibo-mention">${post.mention}</span>` : ''}
      </div>

      <!-- 正文内容 -->
      <p class="text-xs text-slate-800 leading-relaxed">${post.content}</p>

      <!-- 链接条 -->
      ${post.linkText ? `
        <div class="flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-50/70 p-2 rounded-xl border border-blue-100">
          <span>🔗</span>
          <span class="font-bold">${post.linkText}</span>
        </div>
      ` : ''}

      <!-- 媒体配图 -->
      ${post.image ? `
        <div class="rounded-xl overflow-hidden aspect-video bg-slate-950">
          <img src="${post.image}" class="w-full h-full object-cover" loading="lazy">
        </div>
      ` : ''}

      <!-- 底部互动操作栏 -->
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
  `;
}

// 核心：使用 CommunityVirtualScroller 对今日热搜动态流进行虚拟化滚动渲染
function renderTrends() {
  const container = document.getElementById('communityTrendsScrollArea');
  const target = document.getElementById('weiboPostFeedContainerFull');
  const banner = document.getElementById('activeTopicBanner');
  if (!container || !target) return;

  const allPosts = window.weiboPosts || [];
  let displayPosts = allPosts;

  if (currentHotSearchFilter) {
    if (banner) {
      banner.classList.remove('hidden');
      const tagText = document.getElementById('activeTopicTagText');
      if (tagText) tagText.textContent = currentHotSearchFilter;
    }
    displayPosts = allPosts.filter(p => (p.tag && p.tag.includes(currentHotSearchFilter)) || (p.content && p.content.includes(currentHotSearchFilter)));
  } else {
    if (banner) banner.classList.add('hidden');
  }

  if (displayPosts.length === 0) {
    if (trendsVirtualScrollerInstance) {
      trendsVirtualScrollerInstance.destroy();
      trendsVirtualScrollerInstance = null;
    }
    target.innerHTML = `
      <div class="luxe-card p-8 text-center text-xs text-slate-400 bg-white">
        <p>暂无该话题的动态，快来发布第一条吧～</p>
        <button onclick="openCreatePostModal('${currentHotSearchFilter || '#社区热点#'}', '')" class="btn-brand text-xs !py-1.5 !px-3.5 mt-3 shadow-sm">
          <span>+ 发布话题动态</span>
        </button>
      </div>
    `;
    return;
  }

  // 列表虚拟化渲染引擎接入
  if (!trendsVirtualScrollerInstance || trendsVirtualScrollerInstance.container !== container) {
    trendsVirtualScrollerInstance = new window.CommunityVirtualScroller({
      container: container,
      target: target,
      items: displayPosts,
      estimatedItemHeight: 280, // 单卡片平均高度
      buffer: 4,
      renderItem: (item) => getPostCardHtml(item)
    });
  } else {
    trendsVirtualScrollerInstance.updateItems(displayPosts);
  }
}
window.renderTrends = renderTrends;
