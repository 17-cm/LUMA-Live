// =========================================================================
// 【模块二·社区与动态】LIVE/社区/trends.js
// 包含：微博风格热搜榜、全网热点广场、深度微博超话（动态/贡献榜/签到榜/打榜应援）、
// 全屏帖子详情推入页、二级评论树、点赞与应援消费打榜
// =========================================================================

var api = window.api || {};

// 1. 全局真实持久化动态数据池
let weiboPosts = [
  {
    id: 'post_1',
    author: {
      name: '星芒吃瓜周刊',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      badge: '独家狗仔',
      verified: true
    },
    time: '10分钟前 · 来自 LUMA Pro客户端',
    tag: '#主播连麦当场破防#',
    mention: '@苏小喵',
    linkText: '网页链接 🔗 直播间回放',
    content: '昨晚在连麦PK对决中，某主播声称“全网没人能偷我的塔”，结果惨遭神秘神豪连续狂砸 5 个嘉年华瞬间反超！主播当场害羞捂脸光速下播！现场视频已传疯！',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
    stats: {
      reposts: 1240,
      comments: 3842,
      likes: 12400,
      isLiked: false,
      isDownloaded: false
    },
    commentTree: [
      {
        id: 'c1',
        user: '吃瓜第一线',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        ip: '塞博空间',
        time: '12分钟前',
        text: '昨晚看直播的我笑得想死，主播当场破防把摄像头都晃歪了哈哈哈哈！',
        likes: 342,
        isLiked: false,
        replies: [
          {
            id: 'r1',
            user: '苏小喵',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
            isAuthor: true,
            replyTo: '吃瓜第一线',
            ip: '星环港',
            time: '8分钟前',
            text: '谁踹摄像头了？！那是机械臂故障！别造谣啊！',
            likes: 128
          }
        ]
      }
    ]
  },
  {
    id: 'post_2',
    author: {
      name: '电竞前线大队长',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      badge: '赛事解说',
      verified: true
    },
    time: '25分钟前 · 来自 LUMA 网页端',
    tag: '#神秘神豪空降直播间#',
    mention: '@星奈',
    linkText: '网页链接 🔗 榜单战报',
    content: '今日全服热度榜被刷新！神秘土豪连续点亮 99 个至尊冠名灯牌，引发全服粉丝后援会疯狂围观，超话热度直冲千万大关！',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
    stats: {
      reposts: 890,
      comments: 1540,
      likes: 8760,
      isLiked: false,
      isDownloaded: false
    },
    commentTree: [
      {
        id: 'c2',
        user: '柠檬树下柠檬精',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        ip: '上海',
        time: '20分钟前',
        text: '有钱人的世界真的太震撼了，这才是真正的榜一大哥！',
        likes: 189,
        isLiked: false,
        replies: []
      }
    ]
  }
];
window.weiboPosts = weiboPosts;

// 2. 微博实时热搜榜单数据源 (真实可点击与联动)
const HOT_SEARCH_ITEMS = [
  { rank: 1, title: '主播连麦当场破防', heat: '215.8万', badge: 'bao', badgeText: '爆' },
  { rank: 2, title: '神秘神豪空降直播间狂刷嘉年华', heat: '189.4万', badge: 're', badgeText: '热' },
  { rank: 3, title: '野生新人主播首播惊艳立绘出道', heat: '145.2万', badge: 'xin', badgeText: '新' },
  { rank: 4, title: '全服超话打榜争霸赛进入决赛周', heat: '120.6万', badge: 'fei', badgeText: '沸' },
  { rank: 5, title: '苏小喵专属粉丝后援会突破十万人', heat: '98.5万', badge: 're', badgeText: '热' },
  { rank: 6, title: '直播间1:1毛玻璃沉浸式舞台新体验', heat: '82.3万', badge: 'jian', badgeText: '荐' },
  { rank: 7, title: '谁在凌晨两点给主播疯狂点赞', heat: '65.1万', badge: '', badgeText: '' },
  { rank: 8, title: '年度十佳才艺主播大赏提名公布', heat: '54.7万', badge: '', badgeText: '' },
  { rank: 9, title: '连麦偷塔战术真的有科学依据吗', heat: '43.9万', badge: '', badgeText: '' },
  { rank: 10, title: '给心仪Char打榜到底有多快乐', heat: '38.2万', badge: '', badgeText: '' }
];

// 3. 超话打榜应援道具列表
const SUPPORT_GIFTS = [
  { id: 'gift_flower', name: '应援鲜花束', icon: '🌹', price: 10, exp: 100, heat: 500, desc: '一份清新芬芳的心意' },
  { id: 'gift_light', name: '专属定制灯牌', icon: '🌟', price: 50, exp: 500, heat: 2500, desc: '在超话与直播间闪耀' },
  { id: 'gift_wish', name: '心愿助力礼盒', icon: '🎁', price: 200, exp: 2000, heat: 10000, desc: '为主播心愿进度加速' },
  { id: 'gift_rocket', name: '超级应援火箭', icon: '🚀', price: 1000, exp: 10000, heat: 50000, desc: '全服播报+超话顶流' }
];

let selectedSupportGiftId = 'gift_flower';
let currentHotSearchTab = 'ranking'; // 'ranking' | 'feed'
let currentHotSearchFilter = '';
let activePostId = null;
let currentReplyTarget = null;
let currentActiveSuperTopicCharId = null;
let currentSuperTopicSubTab = 'posts'; // 'posts' | 'contribute' | 'checkin' | 'support'
let currentCommunityRankTab = 'fans'; // 'fans' | 'guard' | 'diligent'
let currentForumTab = 'news'; // 'news' | 'feedback'

// 4. 初始化加载 DB
async function loadTrendsFromDb() {
  try {
    const savedPosts = await api.db.list("app_posts") || [];
    if (savedPosts && savedPosts.length > 0) {
      weiboPosts = savedPosts;
      window.weiboPosts = weiboPosts;
    }
  } catch (e) {}
}
window.loadTrendsFromDb = loadTrendsFromDb;

// =========================================================================
// 【一、今日热搜：微博热搜榜与热点广场】
// =========================================================================

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

function renderHotSearchRanking() {
  const container = document.getElementById('hotSearchRankingContainer');
  if (!container) return;

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

    <!-- 微博经典热搜 TOP 10 列表卡片 -->
    <div class="luxe-card p-3 bg-white space-y-1 divide-y divide-slate-100/80 shadow-xs">
      ${HOT_SEARCH_ITEMS.map(item => `
        <div class="pt-2 pb-2 first:pt-0 last:pb-0 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 px-1.5 rounded-xl transition" onclick="filterHotSearchTopic('#${item.title}#')">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-5 text-center font-black text-xs ${item.rank <= 3 ? 'text-rose-600 text-sm' : 'text-slate-400'}">${item.rank}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-bold text-slate-900 truncate">${item.title}</h5>
                ${item.badge ? `<span class="hot-badge-${item.badge}">${item.badgeText}</span>` : ''}
              </div>
            </div>
          </div>
          <span class="text-[10px] text-slate-400 font-medium flex-shrink-0">${item.heat}</span>
        </div>
      `).join('')}
    </div>

    <div class="text-center py-2 text-[10px] text-slate-400">
      <span>实时热搜每分钟根据全服玩家讨论与直播事件自动更新</span>
    </div>
  `;
}
window.renderHotSearchRanking = renderHotSearchRanking;

function filterHotSearchTopic(topicTag) {
  currentHotSearchFilter = topicTag;
  switchHotTrendTab('feed');
  const banner = document.getElementById('hotSearchFilterBanner');
  const bannerText = document.getElementById('hotSearchFilterText');
  if (banner && bannerText) {
    bannerText.textContent = `当前筛选话题: ${topicTag}`;
    banner.classList.remove('hidden');
  }
  renderTrends();
}
window.filterHotSearchTopic = filterHotSearchTopic;

function clearHotSearchFilter() {
  currentHotSearchFilter = '';
  const banner = document.getElementById('hotSearchFilterBanner');
  if (banner) banner.classList.add('hidden');
  renderTrends();
}
window.clearHotSearchFilter = clearHotSearchFilter;

function renderTrends() {
  const boxFull = document.getElementById('weiboPostFeedContainerFull');
  if (!boxFull) return;

  let list = weiboPosts;
  if (currentHotSearchFilter) {
    list = weiboPosts.filter(p => (p.tag && p.tag.includes(currentHotSearchFilter)) || (p.content && p.content.includes(currentHotSearchFilter)));
    if (list.length === 0) list = weiboPosts; // 回退保证不为空
  }

  const html = list.map(post => `
    <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer" onclick="openTrendDetail('${post.id}')">
      <div class="flex items-center justify-between" onclick="event.stopPropagation()">
        <div class="flex items-center gap-2.5">
          <div class="relative">
            <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
            ${post.author.verified ? `<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-slate-900">V</span>` : ''}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="text-xs font-black text-slate-900">${post.author.name}</h4>
              <span class="text-[8px] bg-rose-50 text-rose-600 font-bold px-1 rounded border border-rose-200">${post.author.badge || '热点作者'}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>
        <button onclick="api.ui.toast('已关注该动态博主')" class="btn-action text-[10px] !py-1 !px-2.5">+ 关注</button>
      </div>

      <div class="text-xs text-slate-800 leading-relaxed space-y-1">
        <p>
          <span class="weibo-tag">${post.tag}</span> 
          ${post.mention ? `<span class="weibo-mention">${post.mention}</span>` : ''}
          ${post.content} 
          ${post.linkText ? `<span class="weibo-link">${post.linkText}</span>` : ''}
        </p>
      </div>

      ${post.image ? `
        <div class="rounded-2xl overflow-hidden relative aspect-video bg-slate-950 shadow-sm">
          <img src="${post.image}" class="w-full h-full object-cover">
          <span class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-[8px] text-white font-bold px-1.5 py-0.5 rounded">4K Live 截图</span>
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
        <div onclick="handlePostAction('${post.id}', 'download')" class="social-action-btn ${post.stats.isDownloaded ? 'downloaded' : ''}">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>${post.stats.isDownloaded ? '已保存' : '下载'}</span>
        </div>
      </div>
    </div>
  `).join('');

  boxFull.innerHTML = html;
}
window.renderTrends = renderTrends;

// =========================================================================
// 【二、全屏帖子详情推入页与评论系统 (修复点击直接打开)】
// =========================================================================

function openTrendDetail(postId) {
  activePostId = postId;
  const post = weiboPosts.find(p => p.id === postId);
  if (!post) return;

  renderPostDetailView(post);
  const modal = document.getElementById('trendDetailModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}
window.openTrendDetail = openTrendDetail;

function closeTrendDetail() {
  const modal = document.getElementById('trendDetailModal');
  if (modal) modal.classList.add('hidden');
  currentReplyTarget = null;
  activePostId = null;
}
window.closeTrendDetail = closeTrendDetail;

function handleShareCurrentPost() {
  if (typeof openSharePickerModal === 'function') {
    openSharePickerModal();
  } else {
    api.ui.toast("已复制该动态分享链接！");
  }
}
window.handleShareCurrentPost = handleShareCurrentPost;

function renderPostDetailView(post) {
  const box = document.getElementById('trendDetailContent');
  if (!box) return;

  let html = `
    <!-- 帖子主体卡片 -->
    <div class="luxe-card p-4 space-y-3 bg-white border border-slate-100 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <img src="${post.author.avatar}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="text-xs font-black text-slate-900">${post.author.name}</h4>
              <span class="text-[8px] bg-rose-50 text-rose-600 font-bold px-1 rounded border border-rose-200">${post.author.badge || '作者'}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>
        <button onclick="api.ui.toast('已关注该动态博主')" class="btn-action text-[10px] !py-1 !px-2.5">+ 关注</button>
      </div>

      <div class="text-xs text-slate-800 leading-relaxed space-y-1.5">
        <p>
          <span class="weibo-tag">${post.tag}</span> 
          ${post.mention ? `<span class="weibo-mention">${post.mention}</span>` : ''}
          ${post.content}
        </p>
      </div>

      ${post.image ? `
        <div class="rounded-2xl overflow-hidden shadow-sm aspect-video bg-slate-950">
          <img src="${post.image}" class="w-full h-full object-cover">
        </div>
      ` : ''}

      <div class="social-action-bar !pt-2 !mt-2">
        <div onclick="handlePostAction('${post.id}', 'repost')" class="social-action-btn">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span>${post.stats.reposts}</span>
        </div>
        <div class="social-action-btn">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>${post.stats.comments}</span>
        </div>
        <div onclick="handlePostAction('${post.id}', 'like')" class="social-action-btn ${post.stats.isLiked ? 'liked' : ''}">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
          <span>${post.stats.likes}</span>
        </div>
        <div onclick="handlePostAction('${post.id}', 'download')" class="social-action-btn ${post.stats.isDownloaded ? 'downloaded' : ''}">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>${post.stats.isDownloaded ? '已保存' : '下载'}</span>
        </div>
      </div>
    </div>

    <!-- 评论区标题 -->
    <div class="flex items-center justify-between px-1 pt-1">
      <h4 class="text-xs font-black text-slate-900">全部评论 · ${post.commentTree.length}</h4>
      <span class="text-[10px] text-slate-400">实时互动流</span>
    </div>
  `;

  if (post.commentTree.length === 0) {
    html += `
      <div class="luxe-card p-6 text-center text-xs text-slate-400 bg-white">
        暂无评论，快来抢首评吧～
      </div>
    `;
  } else {
    html += post.commentTree.map((c, cIdx) => `
      <div class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs space-y-2.5">
        <div class="flex items-start justify-between">
          <div class="flex gap-2.5 min-w-0">
            <img src="${c.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0">
            <div>
              <div class="flex items-center gap-1.5">
                <h5 class="text-xs font-black text-slate-900">${c.user}</h5>
                <span class="text-[9px] text-slate-400">· ${c.ip}</span>
              </div>
              <p class="text-xs text-slate-800 leading-relaxed mt-1">${c.text}</p>
              <div class="flex items-center gap-3 mt-1.5 text-[9px] text-slate-400">
                <span>${c.time}</span>
                <button onclick="setReplyTarget('${c.id}', '${c.user}')" class="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded active:scale-95">回复</button>
              </div>
            </div>
          </div>
          <button onclick="toggleCommentLike(${cIdx})" class="flex flex-col items-center text-slate-400 active:scale-90">
            <svg class="w-3.5 h-3.5 ${c.isLiked ? 'fill-rose-500 text-rose-500' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
            <span class="text-[8px] mt-0.5">${c.likes}</span>
          </button>
        </div>

        ${c.replies && c.replies.length > 0 ? `
          <div class="space-y-2 bg-slate-50 p-2.5 rounded-xl text-xs">
            ${c.replies.map(r => `
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-1.5 min-w-0">
                  <img src="${r.avatar}" class="w-5 h-5 rounded-full object-cover flex-shrink-0 mt-0.5">
                  <div>
                    <span class="font-bold text-slate-900">${r.user}</span>
                    ${r.isAuthor ? `<span class="text-[8px] bg-rose-100 text-rose-700 font-bold px-1 rounded">主播</span>` : ''}
                    <span class="text-slate-400 mx-0.5">回复</span>
                    <span class="font-bold text-blue-600">@${r.replyTo}</span>:
                    <span class="text-slate-800 ml-1 leading-relaxed">${r.text}</span>
                    <div class="mt-1 flex items-center gap-2 text-[9px] text-slate-400">
                      <span>${r.time || '刚刚'}</span>
                      <button onclick="setReplyTarget('${c.id}', '${r.user}')" class="font-bold text-rose-600 hover:underline">回复</button>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  box.innerHTML = html;
}

function handlePostAction(postId, action) {
  const post = weiboPosts.find(p => p.id === postId);
  if (!post) return;

  if (action === 'like') {
    post.stats.isLiked = !post.stats.isLiked;
    post.stats.likes += post.stats.isLiked ? 1 : -1;
  } else if (action === 'download') {
    post.stats.isDownloaded = !post.stats.isDownloaded;
    api.ui.toast(post.stats.isDownloaded ? "已下载保存该动态！" : "已移除保存");
  } else if (action === 'repost') {
    if (typeof openSharePickerModal === 'function') openSharePickerModal();
  }

  renderTrends();
  if (currentActiveSuperTopicCharId) renderSuperTopicPostsTab(currentActiveSuperTopicCharId);
  if (activePostId === postId) renderPostDetailView(post);

  try {
    api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}
}
window.handlePostAction = handlePostAction;

function setReplyTarget(parentCommentId, targetUserName) {
  currentReplyTarget = { parentId: parentCommentId, targetUser: targetUserName };
  const input = document.getElementById('inputTrendComment');
  if (input) {
    input.placeholder = `回复 @${targetUserName} :`;
    input.focus();
  }
}
window.setReplyTarget = setReplyTarget;

function toggleCommentLike(cIdx) {
  const post = weiboPosts.find(p => p.id === activePostId);
  if (!post || !post.commentTree[cIdx]) return;
  const c = post.commentTree[cIdx];
  c.isLiked = !c.isLiked;
  c.likes += c.isLiked ? 1 : -1;
  renderPostDetailView(post);
  try { api.db.update("app_posts", post.id, post); } catch(e) {}
}
window.toggleCommentLike = toggleCommentLike;

async function submitTrendComment() {
  const input = document.getElementById('inputTrendComment');
  if (!input) return;
  const val = input.value.trim();
  if (!val || !activePostId) return;

  const post = weiboPosts.find(p => p.id === activePostId);
  if (!post) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
  const uIp = (window.userProfileData && window.userProfileData.ip) || 'LUMA';

  if (currentReplyTarget) {
    const parentComment = post.commentTree.find(c => c.id === currentReplyTarget.parentId);
    if (parentComment) {
      if (!parentComment.replies) parentComment.replies = [];
      parentComment.replies.push({
        id: `r_${Date.now()}`,
        user: uName,
        avatar: uAvatar,
        isAuthor: false,
        replyTo: currentReplyTarget.targetUser,
        ip: uIp,
        time: '刚刚',
        text: val,
        likes: 0
      });
    }
  } else {
    post.commentTree.unshift({
      id: `c_${Date.now()}`,
      user: uName,
      avatar: uAvatar,
      ip: uIp,
      time: '刚刚',
      text: val,
      likes: 1,
      isLiked: true,
      replies: []
    });
  }

  post.stats.comments += 1;
  input.value = '';
  input.placeholder = '发条温暖善意的评论...';
  currentReplyTarget = null;

  renderPostDetailView(post);
  renderTrends();

  try {
    await api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}

  api.ui.toast("评论已发表！");
}
window.submitTrendComment = submitTrendComment;

// =========================================================================
// 【三、微博超话深度复刻：4大分类 Tab（动态/贡献榜/签到榜/打榜应援）】
// =========================================================================

// 辅助：获取主播列表
function getAvailableCharsList() {
  const liveList = window.liveList || [];
  const allChars = window.allCharacters || [];
  const map = new Map();

  liveList.forEach(c => {
    const id = c.characterId || c.id || c.name;
    map.set(id, {
      id: id,
      characterId: c.characterId || c.id,
      name: c.name || '主播',
      avatar: c.avatar || c.cover || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      category: c.category || '随性杂谈',
      fans: c.heat ? Math.floor(c.heat * 1.5) : (c.followers || 12800),
      isLive: true,
      tag: (c.tags && c.tags[0]) || c.category || '元气主播'
    });
  });

  allChars.forEach(c => {
    const id = c.characterId || c.id || c.name;
    if (!map.has(id)) {
      map.set(id, {
        id: id,
        characterId: c.characterId || c.id,
        name: c.name || '主播',
        avatar: c.avatar || c.cover || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
        category: c.category || '次元才艺',
        fans: c.followers || 8600,
        isLive: false,
        tag: (c.tags && c.tags[0]) || '特邀主播'
      });
    }
  });

  if (map.size === 0) {
    map.set('default_1', {
      id: 'default_1',
      name: '苏小喵',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      category: '次元才艺',
      fans: 24600,
      isLive: true,
      tag: '元气猫娘'
    });
  }

  return Array.from(map.values());
}

// 获取某个 Char 的累计贡献值 (持久化于 localStorage)
function getCharContributionScore(charId) {
  try {
    const raw = localStorage.getItem(`luma_char_contribution_${charId}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch (e) {
    return 0;
  }
}

function addCharContributionScore(charId, addAmount) {
  const current = getCharContributionScore(charId);
  const next = current + addAmount;
  try {
    localStorage.setItem(`luma_char_contribution_${charId}`, next.toString());
  } catch (e) {}
  return next;
}

// 签到存储
function getCheckInStorageKey(targetKey) {
  return `luma_checkin_${targetKey}`;
}

function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSuperTopicCheckInInfo(targetKey) {
  try {
    const raw = localStorage.getItem(getCheckInStorageKey(targetKey));
    if (!raw) return { isCheckedToday: false, streakDays: 0, totalExp: 0, level: 1 };
    const data = JSON.parse(raw);
    const today = getTodayDateStr();
    const isCheckedToday = (data.lastDate === today);
    const exp = data.totalExp || 0;
    const level = Math.floor(exp / 300) + 1;
    return {
      isCheckedToday,
      streakDays: data.streakDays || 0,
      totalExp: exp,
      level: Math.min(level, 16)
    };
  } catch (e) {
    return { isCheckedToday: false, streakDays: 0, totalExp: 0, level: 1 };
  }
}

function handleSuperTopicCheckIn(targetKey, targetName = '该超话') {
  const info = getSuperTopicCheckInInfo(targetKey);
  if (info.isCheckedToday) {
    api.ui.toast(`今日已在【${targetName}】打卡，明天再来哦！`);
    return;
  }

  const today = getTodayDateStr();
  const newStreak = info.streakDays + 1;
  const newExp = info.totalExp + 100;
  const newLevel = Math.floor(newExp / 300) + 1;

  const storeData = {
    lastDate: today,
    streakDays: newStreak,
    totalExp: newExp,
    level: newLevel
  };

  try {
    localStorage.setItem(getCheckInStorageKey(targetKey), JSON.stringify(storeData));
  } catch (e) {}

  api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${newStreak} 天！`);

  if (targetKey === 'player_user_self') {
    renderMyTopicView();
  } else {
    renderSuperTopicView(targetKey);
  }
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

// 切换超话内部 4 大子 Tab
function switchSuperTopicSubTab(tabName) {
  currentSuperTopicSubTab = tabName;
  const chars = getAvailableCharsList();
  let char = chars.find(c => c.id === currentActiveSuperTopicCharId) || chars[0];
  if (!char) return;

  // 更新 Tab 选中状态
  const tabs = ['posts', 'contribute', 'checkin', 'support'];
  tabs.forEach(t => {
    const el = document.getElementById(`spSubTabBtn_${t}`);
    if (el) {
      if (t === tabName) el.classList.add('active');
      else el.classList.remove('active');
    }
  });

  const contentBox = document.getElementById('superTopicSubTabContainer');
  if (!contentBox) return;

  if (tabName === 'posts') {
    renderSuperTopicPostsTab(char.id);
  } else if (tabName === 'contribute') {
    renderSuperTopicContributeTab(char);
  } else if (tabName === 'checkin') {
    renderSuperTopicCheckinTab(char);
  } else if (tabName === 'support') {
    renderSuperTopicSupportTab(char);
  }
}
window.switchSuperTopicSubTab = switchSuperTopicSubTab;

// 渲染超话整体框架
function renderSuperTopicView(charId = null) {
  const chars = getAvailableCharsList();
  let char = chars.find(c => c.id === charId);
  if (!char && chars.length > 0) char = chars[0];
  if (!char) return;

  currentActiveSuperTopicCharId = char.id;
  const container = document.getElementById('communitySuperTopicContent');
  const headerTitle = document.getElementById('superTopicHeaderTitle');
  if (headerTitle) headerTitle.textContent = `#${char.name}# 超话`;
  if (!container) return;

  const checkIn = getSuperTopicCheckInInfo(char.id);
  const isFollowed = (window.followedHosts || []).includes(char.name);

  // 专属帖子
  const topicTag = `#${char.name}超话#`;
  const topicPosts = weiboPosts.filter(p => (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name)));

  container.innerHTML = `
    <!-- 1. 微博超话大 Header (纯正超话质感) -->
    <div class="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/50 shadow-md">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-105" style="background-image: url('${char.avatar}')"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/85 to-transparent"></div>
      
      <div class="relative p-5 space-y-4 z-10 text-white">
        <!-- 顶栏快捷操作 -->
        <div class="flex items-center justify-between">
          <button onclick="toggleSuperTopicDrawer(true)" class="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-xs font-bold active:scale-95 transition">
            <svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            <span>切换主播超话 (${chars.length})</span>
          </button>
          
          <button onclick="handleSuperTopicFollow('${char.name}')" class="btn-action !py-1 !px-3 text-xs font-bold ${isFollowed ? '!bg-white/20 !text-white !border-white/30' : '!bg-rose-500 !text-white !border-rose-400'}">
            <span>${isFollowed ? '已关注' : '+ 关注超话'}</span>
          </button>
        </div>

        <!-- 超话头像与信息 -->
        <div class="flex items-center gap-3.5">
          <div class="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-400 shadow-lg flex-shrink-0">
            <img src="${char.avatar}" class="w-full h-full rounded-[14px] object-cover border border-white">
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black truncate">#${char.name}#</h3>
              <span class="text-[9px] bg-amber-400/20 text-amber-300 font-extrabold px-1.5 py-0.2 rounded border border-amber-400/40">Lv.${checkIn.level} 皇冠超话</span>
            </div>
            <p class="text-[10px] text-slate-300 mt-1">专属粉丝根据地 · ${char.tag} · ${char.category}</p>
            <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
              <span>粉丝 <strong class="text-white">${char.fans.toLocaleString()}</strong></span>
              <span>讨论帖 <strong class="text-white">${topicPosts.length + 32}</strong></span>
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

  // 渲染默认激活的子 Tab
  switchSuperTopicSubTab(currentSuperTopicSubTab || 'posts');
}
window.renderSuperTopicView = renderSuperTopicView;

// Tab 1: 超话动态 (独立流，每条帖底下只带自己的超话)
function renderSuperTopicPostsTab(charId) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const chars = getAvailableCharsList();
  const char = chars.find(c => c.id === charId) || chars[0];

  // 严格过滤属于该超话的帖子
  let topicPosts = weiboPosts.filter(p => (p.tag && p.tag.includes(char.name)) || (p.mention && p.mention.includes(char.name)));
  
  if (topicPosts.length === 0) {
    // 自动为当前超话生成一条专属置顶动态
    topicPosts = [
      {
        id: `topic_post_${char.id}`,
        author: {
          name: `${char.name}后援会会长`,
          avatar: char.avatar,
          badge: '超话大咖',
          verified: true
        },
        time: '刚刚 · 来自 LUMA 超话客户端',
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

  container.innerHTML = topicPosts.map(post => `
    <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer shadow-xs" onclick="openTrendDetail('${post.id}')">
      <div class="flex items-center justify-between" onclick="event.stopPropagation()">
        <div class="flex items-center gap-2.5">
          <img src="${post.author.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200">
          <div>
            <h5 class="text-xs font-black text-slate-900">${post.author.name}</h5>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>
        <!-- 每个超话帖底下只有自己的超话标签 -->
        <span class="text-[9px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full border border-rose-200">#${char.name}超话#</span>
      </div>

      <p class="text-xs text-slate-800 leading-relaxed">
        <span class="weibo-tag">#${char.name}超话#</span>
        ${post.content}
      </p>

      ${post.image ? `
        <div class="rounded-xl overflow-hidden aspect-video bg-slate-950">
          <img src="${post.image}" class="w-full h-full object-cover">
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
  `).join('');
}

// Tab 2: 贡献榜 (所有对当前 Char 的消费/打赏/打榜累计总贡献排行，User / Char 均可上榜)
function renderSuperTopicContributeTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const userExtraContribute = getCharContributionScore(char.id); // 玩家给该 Char 消费打榜的真实积分

  // 生成贡献榜单 (Char 铁粉 + User)
  const baseFans = [
    { name: '星空拾荒者', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', score: 38200, badge: '至尊盟主' },
    { name: '喵喵守护大队长', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100', score: 26500, badge: '超级铁粉' },
    { name: '不吃香菜的猫', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100', score: 18400, badge: '忠实舰长' },
    { name: '月亮邮局', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', score: 9800, badge: '守护天使' },
    { name: '塞博浪人', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', score: 6200, badge: '真爱粉' }
  ];

  // 玩家总贡献值 = 基础打赏 + 打榜消费累计
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

// Tab 3: 签到榜 (连续签到天数排行榜，User 和 Char 粉丝均可上榜)
function renderSuperTopicCheckinTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const checkIn = getSuperTopicCheckInInfo(char.id);

  const checkinRankList = [
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

// Tab 4: 打榜应援 (明星打榜专区，直接消费 LUMA 币，消费直接计入该 Char 贡献值与超话热度)
function renderSuperTopicSupportTab(char) {
  const container = document.getElementById('superTopicSubTabContainer');
  if (!container) return;

  const currentWallet = window.currentWalletBalance || 18800;
  const userContribute = getCharContributionScore(char.id);

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
          <p class="font-black text-amber-300 text-sm">${(char.fans * 3 + userContribute).toLocaleString()}</p>
        </div>
      </div>
    </div>

    <!-- 打榜道具选购网格 -->
    <div class="space-y-2">
      <h5 class="text-xs font-black text-slate-900 px-1">选择打榜应援道具</h5>
      <div class="grid grid-cols-2 gap-2.5">
        ${SUPPORT_GIFTS.map(g => `
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
  const char = getAvailableCharsList().find(c => c.id === charId);
  if (char) renderSuperTopicSupportTab(char);
}
window.selectSupportGiftDirect = selectSupportGiftDirect;

// 超话打榜弹窗
function openSuperTopicSupportModal() {
  const modal = document.getElementById('superTopicSupportModal');
  if (!modal) return;

  const chars = getAvailableCharsList();
  const char = chars.find(c => c.id === currentActiveSuperTopicCharId) || chars[0];
  const charNameEl = document.getElementById('supportModalCharName');
  const userBalanceEl = document.getElementById('supportModalUserBalance');
  const grid = document.getElementById('supportItemsGrid');

  if (charNameEl) charNameEl.textContent = char.name;
  if (userBalanceEl) userBalanceEl.textContent = `${(window.currentWalletBalance || 18800).toLocaleString()} 币`;

  if (grid) {
    grid.innerHTML = SUPPORT_GIFTS.map(g => `
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
  SUPPORT_GIFTS.forEach(g => {
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
  const gift = SUPPORT_GIFTS.find(g => g.id === selectedSupportGiftId) || SUPPORT_GIFTS[0];
  if (btn && gift) {
    btn.innerHTML = `<span>确认打榜 (消耗 ${gift.price} LUMA币 · +${gift.exp}贡献)</span>`;
  }
}

function executeSupportGift() {
  const gift = SUPPORT_GIFTS.find(g => g.id === selectedSupportGiftId) || SUPPORT_GIFTS[0];
  let wallet = window.currentWalletBalance || 18800;

  if (wallet < gift.price) {
    api.ui.toast("LUMA 币余额不足，请前往充值中心！");
    return;
  }

  // 扣减钱包
  window.currentWalletBalance = wallet - gift.price;
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();

  const chars = getAvailableCharsList();
  const char = chars.find(c => c.id === currentActiveSuperTopicCharId) || chars[0];

  // 累加贡献值
  addCharContributionScore(char.id, gift.exp);

  closeSuperTopicSupportModal();
  api.ui.toast(`🎉 打榜成功！为主播【${char.name}】送出 ${gift.name}，贡献值 +${gift.exp}！`);

  // 刷新超话当前视图
  renderSuperTopicView(char.id);
}
window.executeSupportGift = executeSupportGift;

function handleSuperTopicFollow(hostName) {
  if (!window.followedHosts) window.followedHosts = [];
  const idx = window.followedHosts.indexOf(hostName);
  if (idx > -1) {
    window.followedHosts.splice(idx, 1);
    api.ui.toast(`已取消关注【${hostName}】超话`);
  } else {
    window.followedHosts.push(hostName);
    api.ui.toast(`已成功关注【${hostName}】超话！`);
  }
  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  renderSuperTopicView(currentActiveSuperTopicCharId);
}
window.handleSuperTopicFollow = handleSuperTopicFollow;

// 超话左侧主播抽屉
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

  const chars = getAvailableCharsList();
  container.innerHTML = chars.map(c => {
    const isCurrent = (c.id === currentActiveSuperTopicCharId);
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

// =========================================================================
// 【四、专区统一导航路由与子系统（排行榜/官方论坛/我的超话）】
// =========================================================================

function openCommunitySubPage(pageKey, targetCharId = null) {
  const allSubViews = [
    'communityTrendsView',
    'communitySuperTopicView',
    'communityRankView',
    'communityLiveSettingsView',
    'communityForumView',
    'communityMyTopicView'
  ];
  allSubViews.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  let targetModalId = '';
  if (pageKey === 'trends') {
    targetModalId = 'communityTrendsView';
    switchHotTrendTab(currentHotSearchTab || 'ranking');
  } else if (pageKey === 'super_topic') {
    targetModalId = 'communitySuperTopicView';
    renderSuperTopicView(targetCharId);
  } else if (pageKey === 'ranking') {
    targetModalId = 'communityRankView';
    renderCommunityRanking(currentCommunityRankTab);
  } else if (pageKey === 'live_settings') {
    targetModalId = 'communityLiveSettingsView';
  } else if (pageKey === 'forum') {
    targetModalId = 'communityForumView';
    renderOfficialForum(currentForumTab);
  } else if (pageKey === 'my_topic') {
    targetModalId = 'communityMyTopicView';
    renderMyTopicView();
  }

  const targetEl = document.getElementById(targetModalId);
  if (targetEl) {
    targetEl.classList.remove('hidden');
  }
}
window.openCommunitySubPage = openCommunitySubPage;

function closeCommunitySubPage() {
  const allSubViews = [
    'communityTrendsView',
    'communitySuperTopicView',
    'communityRankView',
    'communityLiveSettingsView',
    'communityForumView',
    'communityMyTopicView'
  ];
  allSubViews.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  closeSuperTopicDrawer();
}
window.closeCommunitySubPage = closeCommunitySubPage;

// 排行榜系统
function switchCommunityRankTab(tabType) {
  currentCommunityRankTab = tabType;
  renderCommunityRanking(tabType);
}
window.switchCommunityRankTab = switchCommunityRankTab;

function renderCommunityRanking(tabType = 'fans') {
  const container = document.getElementById('communityRankingListContainer');
  if (!container) return;

  const btnFans = document.getElementById('btnRankTabFans');
  const btnGuard = document.getElementById('btnRankTabGuard');
  const btnDiligent = document.getElementById('btnRankTabDiligent');

  [btnFans, btnGuard, btnDiligent].forEach(b => b && b.classList.remove('active', 'border-rose-600', 'text-rose-600', 'font-black'));
  if (tabType === 'fans' && btnFans) btnFans.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');
  if (tabType === 'guard' && btnGuard) btnGuard.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');
  if (tabType === 'diligent' && btnDiligent) btnDiligent.classList.add('active', 'border-rose-600', 'text-rose-600', 'font-black');

  const chars = getAvailableCharsList();
  const uProfile = window.userProfileData || {};
  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uWallet = window.currentWalletBalance || 18800;

  let rankedItems = [];

  if (tabType === 'fans') {
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.tag || '人气主播',
      score: c.fans,
      scoreLabel: '粉丝'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: uProfile.tag || '新人主播',
      score: uProfile.fanCount || 520,
      scoreLabel: '粉丝',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  } else if (tabType === 'guard') {
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: '全服打投',
      score: Math.floor(c.fans * 2.8 + 5000) + getCharContributionScore(c.id),
      scoreLabel: '贡献值'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: '至尊榜一',
      score: (uWallet * 3) + 12000,
      scoreLabel: '贡献值',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  } else {
    rankedItems = chars.map((c, idx) => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.isLive ? '🔴 正在连播' : '常驻主播',
      score: Math.floor(120 - idx * 12 + (c.isLive ? 40 : 0)),
      scoreLabel: '活跃工时'
    }));
    rankedItems.push({
      name: uName + ' (你)',
      avatar: uAvatar,
      badge: '开播体验官',
      score: 35,
      scoreLabel: '活跃工时',
      isUser: true
    });
    rankedItems.sort((a, b) => b.score - a.score);
  }

  const top1 = rankedItems[0] || null;
  const top2 = rankedItems[1] || null;
  const top3 = rankedItems[2] || null;
  const rest = rankedItems.slice(3);

  const podiumHtml = `
    <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
      ${top2 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-slate-300 shadow-md">
              <img src="${top2.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥈</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top2.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top2.score.toLocaleString()} ${top2.scoreLabel}</span>
          <div class="podium-step-2 w-full mt-2 flex items-center justify-center font-black text-slate-400 text-sm">2</div>
        </div>
      ` : '<div></div>'}

      ${top1 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-15 h-15 rounded-full p-0.5 bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-500 shadow-lg">
              <img src="${top1.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-3 -right-1 text-base animate-bounce">👑</span>
          </div>
          <span class="text-xs font-black text-amber-600 truncate max-w-[95px]">${top1.name}</span>
          <span class="text-[9px] font-bold text-slate-500 mt-0.5">${top1.score.toLocaleString()} ${top1.scoreLabel}</span>
          <div class="podium-step-1 w-full mt-2 flex items-center justify-center font-black text-amber-500 text-lg">1</div>
        </div>
      ` : '<div></div>'}

      ${top3 ? `
        <div class="flex flex-col items-center">
          <div class="relative mb-2">
            <div class="w-12 h-12 rounded-full p-0.5 bg-amber-700/40 shadow-md">
              <img src="${top3.avatar}" class="w-full h-full rounded-full object-cover">
            </div>
            <span class="absolute -top-2 -right-1 text-xs">🥉</span>
          </div>
          <span class="text-xs font-black text-slate-800 truncate max-w-[85px]">${top3.name}</span>
          <span class="text-[9px] text-slate-400 mt-0.5">${top3.score.toLocaleString()} ${top3.scoreLabel}</span>
          <div class="podium-step-3 w-full mt-2 flex items-center justify-center font-black text-amber-700 text-sm">3</div>
        </div>
      ` : '<div></div>'}
    </div>
  `;

  const listHtml = rest.map((item, idx) => `
    <div class="luxe-card p-3 flex items-center justify-between bg-white ${item.isUser ? 'border-rose-300 bg-rose-50/50' : ''}">
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-5 text-center text-xs font-black text-slate-400">${idx + 4}</span>
        <img src="${item.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h5 class="text-xs font-black text-slate-900 truncate">${item.name}</h5>
            <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${item.badge}</span>
          </div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="text-xs font-black text-rose-600">${item.score.toLocaleString()}</span>
        <p class="text-[8px] text-slate-400">${item.scoreLabel}</p>
      </div>
    </div>
  `).join('');

  container.innerHTML = podiumHtml + `<div class="space-y-2 pt-2">${listHtml}</div>`;
}
window.renderCommunityRanking = renderCommunityRanking;

// 官方论坛
const OFFICIAL_NEWS_LOG = [
  {
    version: 'v3.5.0',
    date: '2026-08-20',
    title: '微博热搜与超话 4 大专属分类系统全面升级',
    content: '1. 微博热搜全新升级为实时 TOP 50 榜单与话题动态广场。\n2. 超话引入 4 大微博专属分类：动态、贡献榜、签到榜、打榜应援！\n3. 全场景给主播消费打榜实时计入 Char 贡献总榜与超话热度！'
  },
  {
    version: 'v3.4.0',
    date: '2026-08-18',
    title: '社区 2.0 全新架构上线',
    content: '重构六大专区，引入真实时间戳连续签到打卡生态！'
  }
];

function switchForumTab(tabType) {
  currentForumTab = tabType;
  renderOfficialForum(tabType);
}
window.switchForumTab = switchForumTab;

function renderOfficialForum(tabType = 'news') {
  const container = document.getElementById('communityForumContent');
  if (!container) return;

  const btnNews = document.getElementById('btnForumTabNews');
  const btnFeedback = document.getElementById('btnForumTabFeedback');
  if (btnNews) btnNews.className = `flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition ${tabType === 'news' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}`;
  if (btnFeedback) btnFeedback.className = `flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition ${tabType === 'feedback' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}`;

  if (tabType === 'news') {
    container.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl text-white shadow-sm space-y-1">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">📢</span>
            <h4 class="text-xs font-black">LUMA 官方公告栏</h4>
          </div>
          <p class="text-[10px] text-purple-100 leading-relaxed">欢迎来到 LUMA 官方论坛！这里是开发团队发布最新版本说明与更新日志的第一阵地。</p>
        </div>

        ${OFFICIAL_NEWS_LOG.map(item => `
          <div class="luxe-card p-4 space-y-2 bg-white">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">${item.version}</span>
              <span class="text-[9px] text-slate-400">${item.date}</span>
            </div>
            <h5 class="text-xs font-black text-slate-900">${item.title}</h5>
            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-2.5 rounded-xl">${item.content}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    const savedFeedback = JSON.parse(localStorage.getItem('luma_user_feedback_list') || '[]');
    container.innerHTML = `
      <div class="space-y-3">
        <div class="luxe-card p-4 space-y-3 bg-white">
          <div>
            <h4 class="text-xs font-black text-slate-900">提交建议或 Bug 反馈</h4>
            <p class="text-[10px] text-slate-400 mt-0.5">你的每条留言都会安全记录并直接反馈给开发者！</p>
          </div>

          <div class="space-y-2">
            <select id="selectFeedbackType" class="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none">
              <option value="bug">🐛 问题与 Bug 反馈</option>
              <option value="feature">💡 新功能与玩法建议</option>
              <option value="experience">🎮 直播与互动体验吐槽</option>
              <option value="other">💬 其他求助与留言</option>
            </select>

            <textarea id="textFeedbackContent" rows="4" placeholder="请详细描述你在应用中遇到的问题或你的脑洞想法..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none resize-none leading-relaxed"></textarea>
            
            <button onclick="submitCommunityFeedback()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow-md">
              <span>立即提交给 LUMA 官方</span>
            </button>
          </div>
        </div>

        ${savedFeedback.length > 0 ? `
          <div class="space-y-2 pt-2">
            <h5 class="text-[11px] font-black text-slate-700 px-1">我的历史反馈 (${savedFeedback.length})</h5>
            ${savedFeedback.map(f => `
              <div class="luxe-card p-3 space-y-1.5 bg-white text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded">${f.typeLabel}</span>
                  <span class="text-[9px] text-slate-400">${f.time}</span>
                </div>
                <p class="text-slate-800 leading-relaxed">${f.content}</p>
                <div class="mt-1 p-2 bg-emerald-50 rounded-lg text-[10px] text-emerald-700 font-bold flex items-center gap-1.5">
                  <span>✓ 官方处理状态: 已收到并归档，感谢你的支持！</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}
window.renderOfficialForum = renderOfficialForum;

function submitCommunityFeedback() {
  const select = document.getElementById('selectFeedbackType');
  const textarea = document.getElementById('textFeedbackContent');
  if (!textarea || !textarea.value.trim()) {
    api.ui.toast("请输入反馈内容后再提交哦！");
    return;
  }

  const typeMap = {
    bug: '🐛 Bug反馈',
    feature: '💡 功能建议',
    experience: '🎮 体验吐槽',
    other: '💬 其他求助'
  };

  const list = JSON.parse(localStorage.getItem('luma_user_feedback_list') || '[]');
  const item = {
    id: `fb_${Date.now()}`,
    type: select.value,
    typeLabel: typeMap[select.value] || '反馈',
    content: textarea.value.trim(),
    time: new Date().toLocaleString()
  };

  list.unshift(item);
  localStorage.setItem('luma_user_feedback_list', JSON.stringify(list));

  api.ui.toast("🎉 反馈提交成功！官方已收悉，非常感谢你的建议！");
  textarea.value = '';
  renderOfficialForum('feedback');
}
window.submitCommunityFeedback = submitCommunityFeedback;

// 我的超话 (User 个人专属应援地)
function renderMyTopicView() {
  const container = document.getElementById('communityMyTopicContent');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || document.getElementById('userAvatarBox')?.src || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uProfile = window.userProfileData || {};
  const checkIn = getSuperTopicCheckInInfo('player_user_self');

  const myPosts = weiboPosts.filter(p => p.author && p.author.name === uName);

  container.innerHTML = `
    <div class="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/50 shadow-md">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-105" style="background-image: url('${uAvatar}')"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent"></div>
      
      <div class="relative p-5 space-y-4 z-10 text-white">
        <div class="flex items-center justify-between">
          <span class="text-[9px] bg-pink-500/20 text-pink-300 font-extrabold px-2 py-0.5 rounded-full border border-pink-400/30 uppercase tracking-wider">Player Super Topic · 专属主场</span>
          <button onclick="openCreatePostModal('#${uName}的后援会#', '')" class="btn-brand !py-1 !px-3 text-xs font-bold shadow-md">
            <span>+ 发专属动态</span>
          </button>
        </div>

        <div class="flex items-center gap-3.5">
          <div class="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-400 shadow-lg flex-shrink-0">
            <img src="${uAvatar}" class="w-full h-full rounded-full object-cover border-2 border-white">
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black truncate">#${uName}的粉丝团#</h3>
              <span class="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded">Lv.${checkIn.level} VIP</span>
            </div>
            <p class="text-[10px] text-slate-300 mt-1 truncate">${uProfile.bio || '理性看播，感性砸车。'}</p>
            <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
              <span>粉丝 <strong class="text-white">${uProfile.fanCount || 520}</strong></span>
              <span>发帖 <strong class="text-white">${myPosts.length}</strong></span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <div class="text-[10px] text-slate-300">
            <span>连续打卡 <strong>${checkIn.streakDays}</strong> 天</span>
            <span class="mx-1.5">·</span>
            <span>主场声望 <strong>${checkIn.totalExp}</strong></span>
          </div>

          <button onclick="handleSuperTopicCheckIn('player_user_self', '${uName}的主场')" class="px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${checkIn.isCheckedToday ? 'checkin-btn-done' : 'checkin-btn-active'}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${checkIn.isCheckedToday ? `已打卡 第${checkIn.streakDays}天` : '每日专属打卡'}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-3 pt-2">
      <div class="flex items-center justify-between px-1">
        <h4 class="text-xs font-black text-slate-900">我发布的动态 (${myPosts.length})</h4>
      </div>
      ${myPosts.length === 0 ? `
        <div class="luxe-card p-6 text-center text-xs text-slate-400 bg-white/70">
          <p>你还没有在社区发布过专属动态哦</p>
          <button onclick="openCreatePostModal('#${uName}的生活碎片#', '')" class="btn-brand text-xs !py-1.5 !px-3.5 mt-2.5 shadow-sm">
            <span>发布第一条动态</span>
          </button>
        </div>
      ` : myPosts.map(post => `
        <div class="luxe-card p-4 space-y-3 bg-white">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="${post.author.avatar}" class="w-8 h-8 rounded-full object-cover">
              <div>
                <h5 class="text-xs font-black text-slate-900">${post.author.name}</h5>
                <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
              </div>
            </div>
            <span class="text-[9px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-bold">我的动态</span>
          </div>
          <p class="text-xs text-slate-800 leading-relaxed">${post.content}</p>
        </div>
      `).join('')}
    </div>
  `;
}
window.renderMyTopicView = renderMyTopicView;

// 发帖 Modal
function openCreatePostModal(prefilledTag = '', prefilledMention = '') {
  const modal = document.getElementById('communityCreatePostModal');
  if (!modal) return;
  const tagInput = document.getElementById('inputPostTag');
  const mentionInput = document.getElementById('inputPostMention');
  const contentInput = document.getElementById('inputPostContent');
  if (tagInput) tagInput.value = prefilledTag || '#社区新风向#';
  if (mentionInput) mentionInput.value = prefilledMention || '';
  if (contentInput) contentInput.value = '';
  modal.classList.remove('hidden');
}
window.openCreatePostModal = openCreatePostModal;

function closeCreatePostModal() {
  const modal = document.getElementById('communityCreatePostModal');
  if (modal) modal.classList.add('hidden');
}
window.closeCreatePostModal = closeCreatePostModal;

async function handlePublishNewPost() {
  const tagInput = document.getElementById('inputPostTag');
  const mentionInput = document.getElementById('inputPostMention');
  const contentInput = document.getElementById('inputPostContent');
  if (!contentInput || !contentInput.value.trim()) {
    api.ui.toast("请输入动态正文内容！");
    return;
  }

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || document.getElementById('userAvatarBox')?.src || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';

  const newPost = {
    id: `post_${Date.now()}`,
    author: {
      name: uName,
      avatar: uAvatar,
      badge: '社区达人',
      verified: true
    },
    time: '刚刚 · 来自 LUMA Pro客户端',
    tag: tagInput ? tagInput.value.trim() : '#社区热点#',
    mention: mentionInput ? mentionInput.value.trim() : '',
    linkText: '网页链接 🔗 动态详情',
    content: contentInput.value.trim(),
    image: '',
    stats: {
      reposts: 0,
      comments: 0,
      likes: 1,
      isLiked: true,
      isDownloaded: false
    },
    commentTree: []
  };

  weiboPosts.unshift(newPost);
  closeCreatePostModal();
  renderTrends();
  if (currentActiveSuperTopicCharId) renderSuperTopicPostsTab(currentActiveSuperTopicCharId);
  renderMyTopicView();

  try {
    await api.db.create("app_posts", newPost);
  } catch (e) {}

  api.ui.toast("🎉 动态发布成功！");
}
window.handlePublishNewPost = handlePublishNewPost;

async function handleGenerateNewTrend() {
  api.ui.toast("正在抓取全网热点与直播高光...");
  const liveList = window.liveList || [];
  const host = (liveList.length > 0) ? liveList[0] : { name: '苏小喵', category: '电竞竞技' };

  const fallbackScenarios = [
    {
      tag: '#主播连麦当场破防#',
      summary: `昨晚【${host.name}】在连麦PK中遭遇神秘神豪狂刷嘉年华反超，主播当场破防光速下播！`,
      comments: [{ user: '吃瓜群众小王', text: '哈哈哈哈我在现场，主播表情太搞笑了！' }]
    },
    {
      tag: '#神秘神豪空降直播间#',
      summary: `土豪连续点亮99个定制灯牌，超话热度全线飘红！`,
      comments: [{ user: '前排嗑瓜子', text: '榜一大哥带带我！' }]
    }
  ];
  const parsed = fallbackScenarios[Math.floor(Math.random() * fallbackScenarios.length)];

  const newPost = {
    id: `post_${Date.now()}`,
    author: {
      name: `${host.name}超话前线`,
      avatar: host.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      badge: '独家爆料',
      verified: true
    },
    time: '刚刚 · 来自 LUMA Pro客户端',
    tag: parsed.tag,
    mention: `@${host.name}`,
    linkText: '网页链接 🔗 直播间切片',
    content: parsed.summary,
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
    stats: {
      reposts: Math.floor(Math.random() * 800 + 50),
      comments: (parsed.comments || []).length,
      likes: Math.floor(Math.random() * 4000 + 500),
      isLiked: false,
      isDownloaded: false
    },
    commentTree: (parsed.comments || []).map((c, i) => ({
      id: `c_${Date.now()}_${i}`,
      user: c.user || '吃瓜群众',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      ip: '星云节点',
      time: '1分钟前',
      text: c.text || '前排围观！',
      likes: Math.floor(Math.random() * 30 + 5),
      isLiked: false,
      replies: []
    }))
  };

  weiboPosts.unshift(newPost);
  renderTrends();
  renderHotSearchRanking();
  try {
    await api.db.create("app_posts", newPost);
  } catch (e) {}

  api.ui.toast("已抓取并刷新最新热点动态！");
}
window.handleGenerateNewTrend = handleGenerateNewTrend;
