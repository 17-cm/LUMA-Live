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

// 兼容旧调用：新版单页滚动，热搜榜与动态流同页，无需切换
function switchHotTrendTab(tabType) {
  if (tabType === 'feed') {
    renderTrends();
    const feedList = document.getElementById('weiboPostFeedContainerFull');
    if (feedList && feedList.scrollIntoView) {
      feedList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    renderHotSearchRanking();
  }
}
window.switchHotTrendTab = switchHotTrendTab;

// 渲染热搜 TOP 榜
function renderHotSearchRanking() {
  const heroBox = document.getElementById('hotSearchHeroContainer');
  const listBox = document.getElementById('hotSearchRankingContainer');
  if (!listBox) return;
  const items = window.HOT_SEARCH_ITEMS || [];
  // 置顶焦点热搜
  if (heroBox) {
    heroBox.innerHTML = '\
      <div class="hot-hero-card" onclick="filterHotSearchTopic(\'#主播连麦当场破防#\')">\
        <div class="hot-hero-badge">置顶热搜</div>\
        <div class="hot-hero-title">主播连麦当场破防！神秘神豪连续狂砸5个嘉年华瞬间反超</div>\
        <div class="hot-hero-meta">\
          <span>🔥 389.2万热度</span>\
          <span>5000+ 讨论</span>\
        </div>\
      </div>\
    ';
  }
  // 热搜列表
  listBox.innerHTML = '\
    <div class="hot-ranking-card">' +
    items.map(item => '\
      <div class="hot-ranking-item" onclick="filterHotSearchTopic(\'#' + item.title + '#\')">\
        <span class="hot-rank-num ' + (item.rank <= 3 ? 'hot' : '') + '">' + item.rank + '</span>\
        <div class="hot-rank-content">\
          <div class="hot-rank-title-row">\
            <span class="hot-rank-title">' + item.title + '</span>' +
            (item.badge ? '<span class="hot-rank-badge hot-badge-' + item.badge + '">' + item.badgeText + '</span>' : '') +
          '</div>\
          <span class="hot-rank-heat">' + item.heat + ' 讨论</span>\
        </div>\
        <span class="hot-rank-arrow">›</span>\
      </div>\
    ').join('') +
    '</div>';
}
window.renderHotSearchRanking = renderHotSearchRanking;


// 筛选词条：设置过滤条件，渲染动态流并滚动到该区域
function filterHotSearchTopic(topicTag) {
  currentHotSearchFilter = topicTag;
  renderTrends();
  const feedList = document.getElementById('weiboPostFeedContainerFull');
  if (feedList && feedList.scrollIntoView) {
    feedList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
window.filterHotSearchTopic = filterHotSearchTopic;

function clearHotSearchFilter() {
  currentHotSearchFilter = '';
  renderTrends();
}
window.clearHotSearchFilter = clearHotSearchFilter;

// 单条动态卡片 HTML 模板函数（新版：内联文本流 + 16:9 图片 + 四键互动栏）
// 框架标记：各部分用 data-post-* 属性，方便后续 API 预设填充
function getPostCardHtml(post) {
  // 头像：优先用 getAvatar（游戏角色头像），回退到 post.author.avatar
  const avatarSrc = (typeof window.getAvatar === 'function')
    ? window.getAvatar(post.author.name, 'emoji')
    : (post.author.avatar || '');
  // 手机型号：统一用 Float 品牌 + 随机型号
  const deviceTag = (typeof window.getFloatClientTag === 'function')
    ? window.getFloatClientTag(true)
    : 'Float 客户端';
  // 内联文本流：#标签# @用户(可选) 正文 网页链接 直播间切片(可选)
  const tagHtml = post.tag
    ? '<span class="hot-post-tag" data-post="tag" onclick="event.stopPropagation(); filterHotSearchTopic(\'' + post.tag + '\')">' + post.tag + '</span>'
    : '';
  const mentionHtml = post.mention
    ? '<span class="hot-post-mention" data-post="mention">' + post.mention + '</span>'
    : '';
  const contentHtml = '<span class="hot-post-content" data-post="content">' + (post.content || '') + '</span>';
  const linkHtml = post.linkText
    ? ' <span class="hot-post-link" data-post="link">' + post.linkText + '</span>'
    : '';
  const clipHtml = post.clipText
    ? ' <span class="hot-post-clip" data-post="clip">' + post.clipText + '</span>'
    : '';
  // 媒体：16:9 容器，object-cover 只显示中间区域（点开详情才有全图）
  const mediaHtml = post.image
    ? '<div class="hot-post-media" data-post="media"><img src="' + post.image + '" loading="lazy"></div>'
    : '';
  // 下载状态
  const isDownloaded = post.stats && post.stats.isDownloaded;
  const avatarInner = avatarSrc
    ? '<img src="' + avatarSrc + '" class="hot-post-avatar" alt="">'
    : '<div class="hot-post-avatar hot-post-avatar-fallback">' + (post.author.name || '?').charAt(0) + '</div>';
  return `
    <div class="hot-post-card" data-post="card" data-post-id="${post.id}" onclick="openTrendDetail('${post.id}')">
      <div class="hot-post-head" onclick="event.stopPropagation()">
        <div class="hot-post-author">
          <div class="hot-post-avatar-wrap">
            ${avatarInner}
            ${post.author.verified ? '<span class="hot-post-vbadge">V</span>' : ''}
          </div>
          <div class="hot-post-meta">
            <div class="hot-post-name-row">
              <span class="hot-post-name" data-post="author-name">${post.author.name}</span>
              ${post.author.badge ? '<span class="hot-post-badge" data-post="author-badge">' + post.author.badge + '</span>' : ''}
            </div>
            <span class="hot-post-time" data-post="time">${post.time} \u00B7 来自 ${deviceTag}</span>
          </div>
        </div>
        <button class="hot-post-more" aria-label="更多">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </div>
      <p class="hot-post-text" data-post="text">${tagHtml}${mentionHtml}${contentHtml}${linkHtml}${clipHtml}</p>
      ${mediaHtml}
      <div class="hot-post-actions" data-post="actions" onclick="event.stopPropagation()">
        <button class="hot-action-btn" data-action="share" onclick="handlePostAction('${post.id}', 'repost')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span data-stat="reposts">${post.stats.reposts}</span>
        </button>
        <button class="hot-action-btn" data-action="comment" onclick="openTrendDetail('${post.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span data-stat="comments">${post.stats.comments}</span>
        </button>
        <button class="hot-action-btn ${post.stats.isLiked ? 'liked' : ''}" data-action="like" onclick="handlePostAction('${post.id}', 'like')">
          <svg viewBox="0 0 24 24" fill="${post.stats.isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
          <span data-stat="likes">${post.stats.likes}</span>
        </button>
        <button class="hot-action-btn ${isDownloaded ? 'downloaded' : ''}" data-action="download" onclick="handlePostAction('${post.id}', 'download')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      </div>
    </div>
  `;
}
// 判断帖子是否属于某个热搜话题（tag / 正文 / 艾特 任一命中即可，双向包含提升匹配容错）
function matchesHotTopicFilter(post, tagFilter) {
  if (!tagFilter) return true;
  const core = String(tagFilter).replace(/#/g, '').trim();
  if (!core) return true;

  const haystack = [post.tag, post.content, post.mention].filter(Boolean).join(' ');
  if (haystack.includes(core)) return true;

  const postTagCore = String(post.tag || '').replace(/#/g, '').trim();
  if (postTagCore && (postTagCore.includes(core) || core.includes(postTagCore))) return true;

  return false;
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
    displayPosts = allPosts.filter(p => matchesHotTopicFilter(p, currentHotSearchFilter));
  } else {
    if (banner) banner.classList.add('hidden');
  }

  if (displayPosts.length === 0) {
    // 该话题暂无专属动态：回退展示全网热点，保证广场动态不消失
    if (currentHotSearchFilter) {
      if (banner) banner.classList.remove('hidden');
      const tip = document.getElementById('activeTopicTipText');
      if (tip) tip.textContent = '该话题暂无专属动态，已为你展示全网热点';
      displayPosts = allPosts;
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
