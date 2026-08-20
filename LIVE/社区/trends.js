// =========================================================================
// 【模块二·社区与动态】LIVE/trends.js
// 包含：微博风格社区流、评论树交互、点赞、AI热点发帖与插图生成
// =========================================================================

var api = window.api || {};

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
    mention: '@傲娇同桌',
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
            user: '傲娇同桌',
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
  }
];
window.weiboPosts = weiboPosts;

let activePostId = null;
let currentReplyTarget = null;

async function loadTrendsFromDb() {
  try {
    const savedPosts = await api.db.list("app_posts") || [];
    if (savedPosts && savedPosts.length > 0) {
      weiboPosts = savedPosts;
      window.weiboPosts = weiboPosts;
    }
  } catch (e) {}
}

function renderTrends() {
  const boxFull = document.getElementById('weiboPostFeedContainerFull');
  if (!boxFull) return;

  const html = weiboPosts.map(post => `
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
              <span class="text-[8px] bg-rose-50 text-rose-600 font-bold px-1 rounded border border-rose-200">${post.author.badge}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
          </div>
        </div>
        <button onclick="api.ui.toast('已关注该动态博主')" class="btn-action text-[10px] !py-1 !px-2.5">+ 关注</button>
      </div>

      <div class="text-xs text-slate-800 leading-relaxed space-y-1">
        <p>
          <span class="weibo-tag">${post.tag}</span> 
          <span class="weibo-mention">${post.mention}</span> 
          ${post.content} 
          <span class="weibo-link">${post.linkText}</span>
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
          <span>${post.stats.isDownloaded ? '已下载' : '下载'}</span>
        </div>
      </div>
    </div>
  `).join('');

  boxFull.innerHTML = html;
}
window.renderTrends = renderTrends;

function handlePostAction(postId, action) {
  const post = weiboPosts.find(p => p.id === postId);
  if (!post) return;

  if (action === 'like') {
    post.stats.isLiked = !post.stats.isLiked;
    post.stats.likes += post.stats.isLiked ? 1 : -1;
  } else if (action === 'download') {
    post.stats.isDownloaded = !post.stats.isDownloaded;
    api.ui.toast(post.stats.isDownloaded ? "已下载保存该动态截图！" : "已移除下载记录");
  } else if (action === 'repost') {
    if (typeof openSharePickerModal === 'function') openSharePickerModal();
  }
  
  renderTrends();
  if (activePostId === postId) renderPostDetailView(post);

  try {
    api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}
}
window.handlePostAction = handlePostAction;

function openTrendDetail(postId) {
  activePostId = postId;
  const post = weiboPosts.find(p => p.id === postId);
  if (!post) return;

  renderPostDetailView(post);
  const modal = document.getElementById('trendDetailModal');
  if (modal) modal.classList.remove('hidden');
}
window.openTrendDetail = openTrendDetail;

function closeTrendDetail() {
  const modal = document.getElementById('trendDetailModal');
  if (modal) modal.classList.add('hidden');
  currentReplyTarget = null;
  activePostId = null;
}
window.closeTrendDetail = closeTrendDetail;

function renderPostDetailView(post) {
  const box = document.getElementById('trendDetailContent');
  if (!box) return;

  let html = `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
      <div class="flex items-center gap-2.5">
        <img src="${post.author.avatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
        <div>
          <h4 class="text-xs font-black text-slate-900">${post.author.name}</h4>
          <p class="text-[9px] text-slate-400 mt-0.5">${post.time}</p>
        </div>
      </div>
      <p class="text-xs text-slate-800 leading-relaxed">
        <span class="weibo-tag">${post.tag}</span> 
        <span class="weibo-mention">${post.mention}</span> 
        ${post.content}
      </p>
      ${post.image ? `<img src="${post.image}" class="w-full rounded-xl object-cover shadow-sm">` : ''}

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
          <span>${post.stats.isDownloaded ? '已下载' : '下载'}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between px-1 pt-1">
      <h4 class="text-xs font-black text-slate-900">全部评论 · ${post.commentTree.length}</h4>
      <span class="text-[10px] text-slate-400">实时互动流</span>
    </div>
  `;

  html += post.commentTree.map((c, cIdx) => `
    <div class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
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
        <div class="comment-level-2-box space-y-2 bg-slate-50 p-2.5 rounded-xl">
          ${c.replies.map(r => `
            <div class="flex items-start justify-between text-xs">
              <div class="flex items-start gap-1.5 min-w-0">
                <img src="${r.avatar}" class="w-5 h-5 rounded-full object-cover flex-shrink-0 mt-0.5">
                <div>
                  <span class="font-bold text-slate-900">${r.user}</span>
                  ${r.isAuthor ? `<span class="comment-author-badge">主播</span>` : ''}
                  <span class="text-slate-400 mx-0.5">回复</span>
                  <span class="font-bold text-blue-600">@${r.replyTo}</span>
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

  box.innerHTML = html;
}

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
  input.placeholder = '爱评论的人运气都不会差...';
  const lastTarget = currentReplyTarget;
  currentReplyTarget = null;

  renderPostDetailView(post);
  renderTrends();

  try {
    await api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}

  triggerNpcReplyToComment(post, val, lastTarget);
}
window.submitTrendComment = submitTrendComment;

async function triggerNpcReplyToComment(post, userText, target) {
  try {
    const res = await window.aiGenerate({
      appTags: ['live', 'netizen'],
      instruction: `用户评论了动态：“${userText}”`
    });

    const parsed = window.extractJsonFromText(res.text);
    const uName = (window.currentUser && window.currentUser.name) || '玩家';

    if (parsed && parsed.user && parsed.text && post.commentTree.length > 0) {
      setTimeout(async () => {
        post.commentTree[0].replies.push({
          id: `r_${Date.now()}`,
          user: parsed.user,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          isAuthor: parsed.user.includes('主播') || parsed.user.includes('同桌'),
          replyTo: uName,
          ip: '星环港',
          time: '刚刚',
          text: parsed.text,
          likes: Math.floor(Math.random() * 20 + 5)
        });
        if (activePostId === post.id) renderPostDetailView(post);

        try {
          await api.db.create("app_posts", post).catch(() => {
            api.db.update("app_posts", post.id, post).catch(() => {});
          });
        } catch (e) {}
      }, 1400);
    }
  } catch (e) {}
}

async function handleGenerateNewTrend() {
  const btn = document.getElementById('btnRefreshTrends');
  const originalBtnHtml = btn ? btn.innerHTML : '<span>刷新帖子</span>';
  if (btn) {
    btn.innerHTML = `<svg class="animate-spin w-3.5 h-3.5 text-white mr-1 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>刷新中…</span>`;
    btn.disabled = true;
  }

  await api.ui.toast("正在抓取全网热点与直播高光...");
  const liveList = window.liveList || [];
  const host = (liveList.length > 0) ? liveList[0] : { name: '某主播', category: '电竞竞技' };

  try {
    let parsed = null;
    try {
      const res = await window.aiGenerate({
        characterId: host.characterId,
        appTags: ['live', 'trends'],
        instruction: `主播【${host.name}】在【${host.category}】直播中发生了精彩对决或翻车事件。`
      });
      parsed = window.extractJsonFromText(res.text);
    } catch (e) {}

    if (!parsed || !parsed.tag) {
      const fallbackScenarios = [
        {
          tag: '#主播深夜排位破防连麦偷塔#',
          summary: `昨晚【${host.name}】在连麦PK中遭遇神秘神豪狂刷嘉年华反超，主播当场破防光速下播！`,
          comments: [{ user: '吃瓜群众小王', text: '哈哈哈哈我在现场，主播表情太搞笑了！' }]
        },
        {
          tag: '#野生新人主播首播惊艳立绘出道#',
          summary: `路人偶遇绝美立绘野生主播开播，弹幕全员要求立刻签约公会！`,
          comments: [{ user: '技术考据党', text: '五分钟内我要这个主播的全部资料！' }]
        }
      ];
      parsed = fallbackScenarios[Math.floor(Math.random() * fallbackScenarios.length)];
    }

    let generatedCover = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800';
    try {
      const imgSettings = window.imageSettings || {};
      const ratioPrompt = imgSettings.prompts ? imgSettings.prompts.map(p => p.content).join(', ') : '16:9 composition';
      const imgRes = await window.aiGenerateImage({
        prompt: `16:9 cinematic live stream screenshot, anime character streaming on screen, ${parsed.tag}, ${ratioPrompt}, masterpiece`
      });
      if (imgRes?.dataUrl) generatedCover = imgRes.dataUrl;
    } catch (imgErr) {}

    const newPost = {
      id: `post_${Date.now()}`,
      author: {
        name: `${host.name}的超话前线`,
        avatar: host.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        badge: '独家爆料',
        verified: true
      },
      time: '刚刚 · 来自 LUMA Pro客户端',
      tag: parsed.tag,
      mention: `@${host.name}`,
      linkText: '网页链接 🔗 直播间切片',
      content: parsed.summary || '全网围观中！现场高能不断！',
      image: generatedCover,
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

    try {
      await api.db.create("app_posts", newPost);
    } catch (e) {}

    await api.ui.toast("新热点帖子已发布并持久化落盘！");
  } finally {
    if (btn) {
      btn.innerHTML = originalBtnHtml;
      btn.disabled = false;
    }
  }
}
window.handleGenerateNewTrend = handleGenerateNewTrend;
window.loadTrendsFromDb = loadTrendsFromDb;

// =========================================================================
// 【社区全新六大专区子系统】
// =========================================================================

let currentActiveSuperTopicCharId = null;
let currentCommunityRankTab = 'fans'; // 'fans' | 'guard' | 'diligent'
let currentForumTab = 'news'; // 'news' | 'feedback'

// 1. 专区子页面统一路由导航
function openCommunitySubPage(pageKey, targetCharId = null) {
  // 先关闭所有专区子页
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
    renderTrends();
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

// 2. 超话左侧抽屉开关与渲染
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
      tag: (c.tags && c.tags[0]) || c.category || '电竞女神'
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

// 3. 真实时间戳签到系统 (1 天只能签到 1 次，严格按本地日期 YYYY-MM-DD 校验)
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

  if (api.ui?.toast) {
    api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${newStreak} 天！`);
  }

  // 刷新当前视图签到按钮
  if (targetKey === 'player_user_self') {
    renderMyTopicView();
  } else {
    renderSuperTopicView(targetKey);
  }
}
window.handleSuperTopicCheckIn = handleSuperTopicCheckIn;

// 4. 超话主页内容渲染 (微博范儿)
function renderSuperTopicView(charId = null) {
  const chars = getAvailableCharsList();
  let char = chars.find(c => c.id === charId);
  if (!char && chars.length > 0) char = chars[0];
  if (!char) return;

  currentActiveSuperTopicCharId = char.id;
  const container = document.getElementById('communitySuperTopicContent');
  if (!container) return;

  const checkIn = getSuperTopicCheckInInfo(char.id);
  const isFollowed = (window.followedHosts || []).includes(char.name);

  // 过滤出与该主播相关的帖子，若无则展示通用超话帖
  const topicPosts = weiboPosts.filter(p => 
    (p.mention && p.mention.includes(char.name)) || 
    (p.tag && p.tag.includes(char.name)) || 
    (p.author && p.author.name.includes(char.name))
  );
  const postsToShow = (topicPosts.length > 0) ? topicPosts : weiboPosts;

  container.innerHTML = `
    <!-- 超话 Banner 头部 -->
    <div class="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/50 shadow-md">
      <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-md scale-105" style="background-image: url('${char.avatar}')"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent"></div>
      
      <div class="relative p-5 space-y-4 z-10 text-white">
        <div class="flex items-center justify-between">
          <button onclick="toggleSuperTopicDrawer(true)" class="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-xs font-bold active:scale-95 transition">
            <svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            <span>切换超话 (${chars.length})</span>
          </button>
          
          <button onclick="handleSuperTopicFollow('${char.name}')" class="btn-action !py-1 !px-3 text-xs font-bold ${isFollowed ? '!bg-white/20 !text-white' : '!bg-rose-500 !text-white !border-rose-400'}">
            <span>${isFollowed ? '已关注' : '+ 关注超话'}</span>
          </button>
        </div>

        <div class="flex items-center gap-3.5">
          <div class="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-400 shadow-lg flex-shrink-0">
            <img src="${char.avatar}" class="w-full h-full rounded-[14px] object-cover border border-white">
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black truncate">#${char.name}#</h3>
              <span class="text-[9px] bg-amber-400/20 text-amber-300 font-extrabold px-1.5 py-0.2 rounded border border-amber-400/40">Lv.${checkIn.level} 皇冠</span>
            </div>
            <p class="text-[10px] text-slate-300 mt-1">专属根据地 · ${char.tag} · ${char.category}</p>
            <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
              <span>粉丝 <strong class="text-white">${char.fans.toLocaleString()}</strong></span>
              <span>今日帖子 <strong class="text-white">${postsToShow.length + 18}</strong></span>
            </div>
          </div>
        </div>

        <!-- 签到与互动栏 -->
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <div class="text-[10px] text-slate-300">
            <span>连续签到 <strong>${checkIn.streakDays}</strong> 天</span>
            <span class="mx-1.5">·</span>
            <span>贡献值 <strong>${checkIn.totalExp}</strong></span>
          </div>

          <button onclick="handleSuperTopicCheckIn('${char.id}', '${char.name}')" class="px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${checkIn.isCheckedToday ? 'checkin-btn-done' : 'checkin-btn-active'}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${checkIn.isCheckedToday ? `已打卡 第${checkIn.streakDays}天` : '每日签到'}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 超话版规与房管公告 (微博氛围装饰) -->
    <div class="luxe-card p-3.5 flex items-center justify-between bg-white text-xs">
      <div class="flex items-center gap-2 text-slate-600">
        <span class="text-amber-500 font-bold">📢 房管公告:</span>
        <span class="text-slate-700 truncate max-w-[210px]">文明应援，严禁拉踩！每晚8点准时连麦～</span>
      </div>
      <button onclick="openCreatePostModal('#${char.name}#', '@${char.name}')" class="btn-brand text-[10px] !py-1 !px-2.5 shadow-sm flex-shrink-0">
        <span>+ 发帖</span>
      </button>
    </div>

    <!-- 超话动态信息流 -->
    <div class="space-y-3 pt-1">
      <div class="flex items-center justify-between px-1">
        <h4 class="text-xs font-black text-slate-900">超话精选动态 (${postsToShow.length})</h4>
        <span class="text-[10px] text-slate-400">实时讨论流</span>
      </div>
      ${postsToShow.map(post => `
        <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer" onclick="openTrendDetail('${post.id}')">
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
            <span class="weibo-tag">${post.tag}</span>
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
      `).join('')}
    </div>
  `;
}
window.renderSuperTopicView = renderSuperTopicView;

function handleSuperTopicFollow(hostName) {
  if (!window.followedHosts) window.followedHosts = [];
  const idx = window.followedHosts.indexOf(hostName);
  if (idx > -1) {
    window.followedHosts.splice(idx, 1);
    if (api.ui?.toast) api.ui.toast(`已取消关注【${hostName}】超话`);
  } else {
    window.followedHosts.push(hostName);
    if (api.ui?.toast) api.ui.toast(`已成功关注【${hostName}】超话！`);
  }
  if (typeof syncFollowCountDisplay === 'function') syncFollowCountDisplay();
  renderSuperTopicView(currentActiveSuperTopicCharId);
}
window.handleSuperTopicFollow = handleSuperTopicFollow;

// 5. 真实数据多维排行榜系统 (人气榜 / 守护榜 / 勤奋榜，全由真实 Char 与 User 数据驱动)
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
    // 人气榜：按真实粉丝量/热度排序
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: c.tag || '人气主播',
      score: c.fans,
      scoreLabel: '粉丝'
    }));
    // 加入玩家自己
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
    // 守护榜：全服消费打赏总计榜
    rankedItems = chars.map(c => ({
      name: c.name,
      avatar: c.avatar,
      badge: '全服打投',
      score: Math.floor(c.fans * 2.8 + 5000),
      scoreLabel: '贡献值'
    }));
    // 玩家真实贡献打赏
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
    // 勤奋榜：直播场次与活跃指数
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

  // 领奖台 (前三名)
  const top1 = rankedItems[0] || null;
  const top2 = rankedItems[1] || null;
  const top3 = rankedItems[2] || null;
  const rest = rankedItems.slice(3);

  const podiumHtml = `
    <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
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
          <span class="text-[9px] text-slate-400 mt-0.5">${top2.score.toLocaleString()} ${top2.scoreLabel}</span>
          <div class="podium-step-2 w-full mt-2 flex items-center justify-center font-black text-slate-400 text-sm">2</div>
        </div>
      ` : '<div></div>'}

      <!-- 冠军 1 -->
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
          <span class="text-[9px] text-slate-400 mt-0.5">${top3.score.toLocaleString()} ${top3.scoreLabel}</span>
          <div class="podium-step-3 w-full mt-2 flex items-center justify-center font-black text-amber-700 text-sm">3</div>
        </div>
      ` : '<div></div>'}
    </div>
  `;

  // 4 - 50 名列表
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

// 6. 官方论坛与反馈信箱系统 (安全无敏感泄露，支持云端更新日志 + 玩家求助反馈)
const OFFICIAL_NEWS_LOG = [
  {
    version: 'v3.4.0',
    date: '2026-08-20',
    title: '社区 2.0 宇宙重磅上线！超话系统与全服风向榜开启',
    content: '1. 开放全新社区总界面，集成今日热搜、超话专区、全服真实排行榜三大核心板块。\n2. 引入真实时间戳每日签到机制，连续打卡累积专属超话经验！\n3. 新增官方论坛与玩家反馈信箱，你的建议将直达 LUMA 架构师！'
  },
  {
    version: 'v3.3.0',
    date: '2026-08-18',
    title: '1:1 双区毛玻璃直播间体验重构',
    content: '重构沉浸式直播舞台，实现纯正方形立绘零遮挡与全功能弹幕互动条！'
  },
  {
    version: 'v3.2.0',
    date: '2026-08-15',
    title: '生图中转模型拉取与自定义 API 深度优化',
    content: '完美支持 New API / One API / OpenAI 格式接口拉取与自由手动填写！'
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
  if (btnNews) btnNews.className = `text-xs font-bold pb-1.5 ${tabType === 'news' ? 'text-rose-600 border-b-2 border-rose-600 font-black' : 'text-slate-400'}`;
  if (btnFeedback) btnFeedback.className = `text-xs font-bold pb-1.5 ${tabType === 'feedback' ? 'text-rose-600 border-b-2 border-rose-600 font-black' : 'text-slate-400'}`;

  if (tabType === 'news') {
    container.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl text-white shadow-sm space-y-1">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">📢</span>
            <h4 class="text-xs font-black">LUMA 官方公告栏</h4>
          </div>
          <p class="text-[10px] text-purple-100 leading-relaxed">欢迎来到 LUMA 官方论坛！这里是开发团队发布最新版本说明、维护公告与开发者日志的第一阵地。</p>
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
    // 玩家反馈信箱
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

            <textarea id="textFeedbackContent" rows="4" placeholder="请详细描述你在小手机中遇到的问题、复现步骤或你的脑洞想法..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none resize-none leading-relaxed"></textarea>
            
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

// 7. 我的超话 (User 个人专属应援地)
function renderMyTopicView() {
  const container = document.getElementById('communityMyTopicContent');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || document.getElementById('userAvatarBox')?.src || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uProfile = window.userProfileData || {};
  const checkIn = getSuperTopicCheckInInfo('player_user_self');

  const myPosts = weiboPosts.filter(p => p.author && p.author.name === uName);

  container.innerHTML = `
    <!-- 个人超话 Banner -->
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

        <!-- 每日打卡 -->
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

    <!-- 我的动态流 -->
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

// 8. 快速发帖弹窗交互
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
  if (currentActiveSuperTopicCharId) renderSuperTopicView(currentActiveSuperTopicCharId);
  renderMyTopicView();

  try {
    await api.db.create("app_posts", newPost);
  } catch (e) {}

  api.ui.toast("🎉 动态发布成功！");
}
window.handlePublishNewPost = handlePublishNewPost;
