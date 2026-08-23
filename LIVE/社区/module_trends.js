// =========================================================================
// 【模块二·社区子文档1·今日热搜与热点广场】LIVE/社区/module_trends.js
// 样板原封不动注入版
// =========================================================================

var api = window.api || {};
let currentHotSearchTab = 'ranking';
let currentHotSearchFilter = '';
let trendsVirtualScrollerInstance = null;

// 兼容旧调用
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

// 渲染热搜 TOP 榜（样板结构：.hero-hot 大图 + .hot-list）
function renderHotSearchRanking() {
  const heroBox = document.getElementById('hotSearchHeroContainer');
  const listBox = document.getElementById('hotSearchRankingContainer');
  if (!listBox) return;
  const items = window.HOT_SEARCH_ITEMS || [];

  // 置顶焦点热搜（大图）
  if (heroBox) {
    heroBox.innerHTML = '\
      <div class="hero-hot" onclick="filterHotSearchTopic(\'#主播连麦当场破防#\')">\
        <img src="https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&q=80" alt="">\
        <div class="scrim"></div>\
        <div class="content">\
          <div><span class="pin-badge">📌 置顶热搜</span></div>\
          <div>\
            <div class="title">主播连麦当场破防！神秘神豪连续狂砸5个嘉年华瞬间反超</div>\
            <div class="meta"><span>🔥 389.2万热度</span><span>5000+ 讨论</span></div>\
          </div>\
        </div>\
      </div>\
    ';
  }

  // 热搜榜单（.hot-list）
  listBox.innerHTML = '<div class="hot-list">' +
    items.map((item, idx) => {
      const rankClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : 'rn';
      const badgeHtml = item.badge ? '<span class="hot-badge ' + item.badge + '">' + item.badgeText + '</span>' : '';
      return '\
      <div class="hot-item" onclick="filterHotSearchTopic(\'#' + item.title + '#\')">\
        <span class="hot-rank ' + rankClass + '">' + item.rank + '</span>\
        <div class="hot-info">\
          <div class="title">' + item.title + ' ' + badgeHtml + '</div>\
          <div class="heat">' + item.heat + ' 讨论</div>\
        </div>\
      </div>';
    }).join('') +
    '</div>';
}
window.renderHotSearchRanking = renderHotSearchRanking;

// 筛选词条
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

// 单条动态卡片 HTML（样板 .post-card 结构，内联文本流）
function getPostCardHtml(post) {
  // 头像：优先用 getAvatar
  const avatarSrc = (typeof window.getAvatar === 'function')
    ? window.getAvatar(post.author.name, 'emoji')
    : (post.author.avatar || '');
  // 手机型号：Float
  const deviceTag = (typeof window.getFloatClientTag === 'function')
    ? window.getFloatClientTag(true)
    : 'Float 客户端';

  // 内联文本流
  const tagHtml = post.tag
    ? '<span class="tag" data-post-tag>' + post.tag + '</span>'
    : '';
  const mentionHtml = post.mention
    ? '<span class="mention" data-post-mention>' + post.mention + '</span>'
    : '';
  const contentHtml = '<span data-post-content>' + (post.content || '') + '</span>';
  const linkHtml = post.linkText
    ? '<span class="link" data-post-link>' + post.linkText + '</span>'
    : '';
  const clipHtml = post.clipText
    ? '<span class="clip" data-post-clip> ' + post.clipText + '</span>'
    : '';

  // 媒体（16:9 容器）
  const mediaHtml = post.image
    ? '<div class="post-media" data-post-media style="aspect-ratio:16/9;"><img src="' + post.image + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;"></div>'
    : '';

  // 头像
  const avatarInner = avatarSrc
    ? '<img class="avatar" src="' + avatarSrc + '" alt="">'
    : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;background:#EEEDF0;color:#9E9EB2;font-size:14px;font-weight:700;">' + (post.author.name || '?').charAt(0) + '</div>';

  // 验证标
  const verifiedHtml = post.author.verified ? '<span class="verified">V</span>' : '';
  // 徽章
  const badgeHtml = post.author.badge ? '<span class="badge">' + post.author.badge + '</span>' : '';

  // 下载状态
  const isDownloaded = post.stats && post.stats.isDownloaded;

  return '\
    <article class="post-card" data-post-id="' + post.id + '" onclick="openTrendDetail(\'' + post.id + '\')">\
      <div class="post-head" onclick="event.stopPropagation()">\
        <div class="author">\
          <div class="avatar-wrap">' + avatarInner + verifiedHtml + '</div>\
          <div class="author-info">\
            <div class="name-row">\
              <span class="name">' + post.author.name + '</span>' + badgeHtml + '\
            </div>\
            <div class="time">' + post.time + ' · 来自 ' + deviceTag + '</div>\
          </div>\
        </div>\
        <button class="more-btn" onclick="if(window.api&&api.ui&&api.ui.toast)api.ui.toast(\'更多操作\')">\
          <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z"/></svg>\
        </button>\
      </div>\
      <div class="post-body">\
        <p class="post-text">' + tagHtml + mentionHtml + contentHtml + linkHtml + clipHtml + '</p>' + mediaHtml + '\
      </div>\
      <div class="action-bar" onclick="event.stopPropagation()">\
        <button class="action-btn" data-action="share" onclick="handlePostAction(\'' + post.id + '\', \'repost\')">\
          <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Z"/></svg>\
          <span data-stat="reposts">' + post.stats.reposts + '</span>\
        </button>\
        <button class="action-btn" data-action="comment" onclick="openTrendDetail(\'' + post.id + '\')">\
          <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Z"/></svg>\
          <span data-stat="comments">' + post.stats.comments + '</span>\
        </button>\
        <button class="action-btn ' + (post.stats.isLiked ? 'liked' : '') + '" data-action="like" onclick="handlePostAction(\'' + post.id + '\', \'like\')">\
          <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12Z"/></svg>\
          <span data-stat="likes">' + post.stats.likes + '</span>\
        </button>\
        <button class="action-btn ' + (isDownloaded ? 'liked' : '') + '" data-action="download" onclick="handlePostAction(\'' + post.id + '\', \'download\')">\
          <svg class="ic" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M216,152v48a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V152"/><path d="M128,24v128"/><polyline points="88,112 128,152 168,112"/></svg>\
        </button>\
      </div>\
    </article>';
}

// 判断帖子是否属于某个热搜话题
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

// 渲染动态流
function renderTrends() {
  const container = document.getElementById('flow');
  const target = document.getElementById('weiboPostFeedContainerFull');
  const banner = document.getElementById('activeTopicBanner');
  if (!container || !target) return;

  const allPosts = window.weiboPosts || [];
  let displayPosts = allPosts;

  if (currentHotSearchFilter) {
    if (banner) banner.classList.remove('hidden');
    const tagText = document.getElementById('activeTopicTagText');
    if (tagText) tagText.textContent = '当前话题: ' + currentHotSearchFilter;
    displayPosts = allPosts.filter(p => matchesHotTopicFilter(p, currentHotSearchFilter));
  } else {
    if (banner) banner.classList.add('hidden');
  }

  if (displayPosts.length === 0) {
    if (currentHotSearchFilter) {
      if (banner) banner.classList.remove('hidden');
      const tip = document.getElementById('activeTopicTipText');
      if (tip) tip.textContent = '该话题暂无专属动态，已为你展示全网热点';
      displayPosts = allPosts;
    }
    if (displayPosts.length === 0) {
      target.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;text-align:center;font-size:12px;color:#9E9EB2;">暂无该话题的动态，快来发布第一条吧～</div>';
      return;
    }
  }

  // 直接渲染（不用虚拟滚动，样板原封不动）
  target.innerHTML = displayPosts.map(item => getPostCardHtml(item)).join('');
}
window.renderTrends = renderTrends;

// 分类切换
document.addEventListener('DOMContentLoaded', function() {
  const catRail = document.getElementById('hotCatRail');
  if (catRail) {
    catRail.querySelectorAll('.cat-chip').forEach(c => {
      c.onclick = function() {
        catRail.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        if (window.api && api.ui && api.ui.toast) api.ui.toast('切换到「' + c.textContent.trim() + '」');
      };
    });
  }
});
