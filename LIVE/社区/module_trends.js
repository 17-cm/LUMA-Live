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

// 热搜刷新：调用API生成新帖子
let isRefreshingTrends = false;
async function refreshTrendsWithAI() {
  if (isRefreshingTrends) return;
  isRefreshingTrends = true;
  if (window.api && api.ui && api.ui.toast) api.ui.toast('正在生成新动态…');

  try {
    let contextText = '平台目前没有正在直播的主播，请生成一条泛娱乐八卦动态。';
    try {
      const sessions = await api.db.list('live_sessions', { limit: 500 }) || [];
      const active = sessions.filter(s => s && s.name);
      if (active.length > 0) {
        const picked = active[Math.floor(Math.random() * active.length)];
        const duration = picked.startTime ? Math.floor((Date.now() - picked.startTime) / 60000) : 0;
        contextText = `主播【${picked.name}】正在直播，赛道：${picked.category || '日常'}（${picked.subTag || '闲聊'}），标题：${picked.topic || '无标题'}，已播${duration}分钟，热度${picked.heat || 0}。请根据这个直播情况生成一条社区动态。`;
      }
    } catch (e) {}

    const res = await window.aiGenerate({
      appTags: ['trends', 'post'],
      instruction: contextText
    });

    const parsed = window.extractJsonFromText ? window.extractJsonFromText(res.text) : null;
    if (!parsed || !parsed.content) {
      if (window.api && api.ui && api.ui.toast) api.ui.toast('生成失败，请检查API配置');
      return;
    }

    const mediaAccounts = ['星芒吃瓜周刊', '赛博娱乐前线', '直播圈内君', '热搜挖掘机', 'LUMA速报'];
    const accountName = parsed.mediaName || mediaAccounts[Math.floor(Math.random() * mediaAccounts.length)];
    const newPost = {
      id: 'post_ai_' + Date.now(),
      author: {
        name: accountName,
        avatar: '',
        badge: parsed.badge || '娱乐速报',
        verified: true
      },
      time: '刚刚',
      tag: parsed.tag || '#LUMA Live#',
      mention: parsed.mention || '',
      linkText: parsed.linkText || '',
      clipText: parsed.clipText || '',
      content: parsed.content,
      image: '',
      stats: { reposts: 0, comments: 0, likes: 0, isLiked: false, isDownloaded: false },
      commentTree: []
    };

    if (!window.weiboPosts) window.weiboPosts = [];
    window.weiboPosts.unshift(newPost);

    try { await api.db.create('community_posts', newPost).catch(() => {}); } catch (e) {}

    renderHotSearchRanking();
    renderTrends();
    if (window.api && api.ui && api.ui.toast) api.ui.toast('新动态已生成');
  } catch (e) {
    if (window.api && api.ui && api.ui.toast) api.ui.toast('生成失败：' + (e.message || '未知错误'));
  } finally {
    isRefreshingTrends = false;
  }
}
window.refreshTrendsWithAI = refreshTrendsWithAI;

// 置顶热搜数据管理
const HERO_STORAGE_KEY = 'luma_hero_hot_search';
const DEFAULT_HERO_DATA = {
  image: 'https://files.catbox.moe/d1jldl.png',
  title: '主播连麦当场破防！神秘神豪连续狂砸5个嘉年华瞬间反超',
  heat: '389.2万',
  discussions: '5000+'
};

function getHeroData() {
  try {
    const saved = localStorage.getItem(HERO_STORAGE_KEY);
    if (saved) return { ...DEFAULT_HERO_DATA, ...JSON.parse(saved) };
  } catch (e) {}
  return { ...DEFAULT_HERO_DATA };
}

function saveHeroData(data) {
  try { localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// 置顶热搜编辑模式
let heroEditMode = false;

function enterHeroEdit() {
  heroEditMode = true;
  renderHotSearchRanking();
}
window.enterHeroEdit = enterHeroEdit;

function cancelHeroEdit() {
  heroEditMode = false;
  renderHotSearchRanking();
}
window.cancelHeroEdit = cancelHeroEdit;

function saveHeroEdit() {
  const titleEl = document.getElementById('heroEditTitle');
  const heatEl = document.getElementById('heroEditHeat');
  const discEl = document.getElementById('heroEditDisc');
  const imgEl = document.getElementById('heroEditImg');
  const data = {
    title: titleEl ? titleEl.value.trim() || DEFAULT_HERO_DATA.title : DEFAULT_HERO_DATA.title,
    heat: heatEl ? heatEl.value.trim() || DEFAULT_HERO_DATA.heat : DEFAULT_HERO_DATA.heat,
    discussions: discEl ? discEl.value.trim() || DEFAULT_HERO_DATA.discussions : DEFAULT_HERO_DATA.discussions,
    image: imgEl ? imgEl.src : DEFAULT_HERO_DATA.image
  };
  saveHeroData(data);
  heroEditMode = false;
  renderHotSearchRanking();
  if (window.api && api.ui && api.ui.toast) api.ui.toast('置顶热搜已保存');
}
window.saveHeroEdit = saveHeroEdit;

function handleHeroImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const imgEl = document.getElementById('heroEditImg');
    if (imgEl) imgEl.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
window.handleHeroImageUpload = handleHeroImageUpload;

// 渲染热搜 TOP 榜（样板结构：.hero-hot 大图 + .hot-list）
// 热搜编辑模式状态
let hotSearchEditMode = false;

function renderHotSearchRanking() {
  const heroBox = document.getElementById('hotSearchHeroContainer');
  const listBox = document.getElementById('hotSearchRankingContainer');
  if (!listBox) return;
  const items = window.HOT_SEARCH_ITEMS || [];

  // 置顶焦点热搜（大图）—— 支持编辑
  if (heroBox) {
    const hero = getHeroData();
    if (heroEditMode) {
      heroBox.innerHTML = '\
        <div class="hero-hot hero-hot-edit" style="cursor:default;">\
          <div class="hero-edit-img-wrap">\
            <img src="' + hero.image + '" alt="" id="heroEditImg">\
            <label class="hero-upload-btn">\
              <input type="file" accept="image/*" style="display:none;" onchange="handleHeroImageUpload(event)">\
              📷 更换图片\
            </label>\
          </div>\
          <div class="hero-edit-form">\
            <input type="text" id="heroEditTitle" value="' + hero.title.replace(/"/g, '&quot;') + '" placeholder="热搜标题" class="hero-edit-input">\
            <div class="hero-edit-row">\
              <input type="text" id="heroEditHeat" value="' + hero.heat + '" placeholder="热度" class="hero-edit-input-sm">\
              <input type="text" id="heroEditDisc" value="' + hero.discussions + '" placeholder="讨论数" class="hero-edit-input-sm">\
            </div>\
            <div class="hero-edit-actions">\
              <button onclick="saveHeroEdit()" class="hero-save-btn">保存</button>\
              <button onclick="cancelHeroEdit()" class="hero-cancel-btn">取消</button>\
            </div>\
          </div>\
        </div>\
      ';
    } else {
      heroBox.innerHTML = '\
        <div class="hero-hot" style="cursor:default;">\
          <img src="' + hero.image + '" alt="">\
          <div class="scrim"></div>\
          <div class="content">\
            <div style="display:flex;justify-content:space-between;align-items:center;">\
              <span class="pin-badge">📌 置顶热搜</span>\
              <button onclick="enterHeroEdit()" class="hero-edit-btn" title="编辑置顶热搜">\
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>\
              </button>\
            </div>\
            <div>\
              <div class="title">' + hero.title + '</div>\
              <div class="meta"><span>🔥 ' + hero.heat + ' 热度</span><span>' + hero.discussions + ' 讨论</span></div>\
            </div>\
          </div>\
        </div>\
      ';
    }
  }

  // 热搜榜单（.hot-list）
  listBox.innerHTML = '<div class="hot-list">' +
    items.map((item, idx) => {
      const rankClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : 'rn';
      const badgeHtml = item.badge ? '<span class="hot-badge ' + item.badge + '">' + item.badgeText + '</span>' : '';
      // 编辑模式下标题变成可编辑input
      const titleHtml = hotSearchEditMode
        ? '<input class="hot-edit-input" data-idx="' + idx + '" value="' + item.title.replace(/"/g, '&quot;') + '" style="width:100%;border:1px solid #3B82F6;border-radius:6px;padding:4px 8px;font-size:13px;font-weight:600;background:#EFF6FF;outline:none;">'
        : '<span>' + item.title + '</span> ' + badgeHtml;
      return '\
      <div class="hot-item" style="cursor:default;">\
        <span class="hot-rank ' + rankClass + '">' + item.rank + '</span>\
        <div class="hot-info">\
          <div class="title">' + titleHtml + '</div>\
          <div class="heat">' + item.heat + ' 讨论</div>\
        </div>\
      </div>';
    }).join('') +
    '</div>';

  // 编辑模式下绑定input事件
  if (hotSearchEditMode) {
    setTimeout(() => {
      document.querySelectorAll('.hot-edit-input').forEach(input => {
        input.addEventListener('blur', function() {
          const idx = parseInt(this.dataset.idx);
          if (window.HOT_SEARCH_ITEMS && window.HOT_SEARCH_ITEMS[idx]) {
            window.HOT_SEARCH_ITEMS[idx].title = this.value;
          }
        });
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') this.blur();
        });
      });
    }, 10);
  }
}
window.renderHotSearchRanking = renderHotSearchRanking;

// 切换热搜编辑模式
function toggleHotSearchEdit() {
  hotSearchEditMode = !hotSearchEditMode;
  renderHotSearchRanking();
  // 铅笔图标样式切换
  const btn = document.getElementById('hotSearchEditBtn');
  if (btn) {
    if (hotSearchEditMode) {
      btn.style.opacity = '1';
      btn.style.color = '#3B82F6';
      btn.style.transform = 'rotate(-15deg)';
    } else {
      btn.style.opacity = '.5';
      btn.style.color = 'inherit';
      btn.style.transform = 'rotate(0)';
    }
  }
  if (window.api && api.ui && api.ui.toast) {
    api.ui.toast(hotSearchEditMode ? '编辑模式：点击词条可修改' : '热搜已保存');
  }
}
window.toggleHotSearchEdit = toggleHotSearchEdit;

// （铅笔按钮点击事件通过HTML onclick绑定，无需动态绑定）

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
        <button class="more-btn" onclick="showPostDeleteMenu(\'' + post.id + '\', event)">\
          <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"/></svg>\
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

// 帖子删除菜单
function showPostDeleteMenu(postId, event) {
  event.stopPropagation();
  // 移除已存在的菜单
  const oldMenu = document.getElementById('postDeleteMenu');
  if (oldMenu) oldMenu.remove();

  // 找到帖子卡片
  const card = event.target.closest('.post-card');
  if (!card) return;

  const menu = document.createElement('div');
  menu.id = 'postDeleteMenu';
  menu.style.cssText = 'position:absolute;z-index:10;top:44px;right:10px;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:4px;min-width:80px;';
  menu.innerHTML = '<button style="display:block;width:100%;padding:8px 14px;border:0;background:none;color:#F43F5E;font-size:13px;font-weight:600;text-align:center;cursor:pointer;border-radius:8px;" onmouseover="this.style.background=\'#FFF1F2\'" onmouseout="this.style.background=\'none\'" onclick="deletePost(\'' + postId + '\')">删除</button>';

  card.appendChild(menu);

  // 点击其他地方关闭
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}
window.showPostDeleteMenu = showPostDeleteMenu;

// 删除帖子
function deletePost(postId) {
  const menu = document.getElementById('postDeleteMenu');
  if (menu) menu.remove();

  if (window.weiboPosts) {
    const idx = window.weiboPosts.findIndex(p => p.id === postId);
    if (idx > -1) {
      window.weiboPosts.splice(idx, 1);
    }
  }
  renderTrends();
  if (window.api && api.ui && api.ui.toast) api.ui.toast('帖子已删除');
}
window.deletePost = deletePost;
