// =========================================================================
// 【模块二·社区子文档3·全屏帖子详情与互动系统】LIVE/社区/module_detail.js
// 包含：
// 1. 全屏原生帖子推入页（多图/点赞/分享/保存/返回）
// 2. 二级评论回复树（主播置顶回复、楼中楼、点赞与时间戳）
// 3. 即时交互与数据库存储
// =========================================================================

var api = window.api || {};
let activePostId = null;
let currentReplyTarget = null;

// 打开帖子全屏详情
function openTrendDetail(postId) {
  activePostId = postId;
  const post = (window.weiboPosts || []).find(p => p.id === postId);
  if (!post) return;

  const modal = document.getElementById('trendDetailModal');
  if (modal) {
    renderPostDetailView(post);
    if (window.PageStack) {
      window.PageStack.open('trendDetailModal');
    } else {
      modal.classList.remove('hidden');
    }
  }
}
window.openTrendDetail = openTrendDetail;

// 关闭帖子详情
function closeTrendDetail() {
  if (window.PageStack) {
    window.PageStack.back();
  } else {
    const modal = document.getElementById('trendDetailModal');
    if (modal) modal.classList.add('hidden');
  }
  activePostId = null;
  currentReplyTarget = null;
}
window.closeTrendDetail = closeTrendDetail;

// 渲染帖子详情视图
function renderPostDetailView(post) {
  const box = document.getElementById('trendDetailContent');
  if (!box) return;

  let html = `
    <!-- 帖子主正文卡片 -->
    <div class="luxe-card p-4 space-y-3.5 bg-white shadow-xs">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="relative">
            <img src="${post.author.avatar}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
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

        <button onclick="handlePostAction('${post.id}', 'download')" class="p-1 text-slate-400 active:scale-95">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      </div>

      <div class="flex flex-wrap gap-1.5 text-xs">
        ${post.tag ? `<span class="weibo-tag">${post.tag}</span>` : ''}
        ${post.mention ? `<span class="weibo-mention">${post.mention}</span>` : ''}
      </div>

      <p class="text-xs text-slate-800 leading-relaxed text-justify">${post.content}</p>

      ${post.linkText ? `
        <div class="flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100">
          <span>🔗</span>
          <span class="font-bold">${post.linkText}</span>
        </div>
      ` : ''}

      ${post.image ? `
        <div class="rounded-2xl overflow-hidden aspect-video bg-slate-950 shadow-inner">
          <img src="${post.image}" class="w-full h-full object-cover">
        </div>
      ` : ''}

      <div class="social-action-bar !border-t-0 !pt-1">
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
      </div>
    </div>

    <!-- 评论区分隔条 -->
    <div class="flex items-center justify-between px-1 pt-1">
      <h4 class="text-xs font-black text-slate-900">全部评论 (${post.commentTree.length})</h4>
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

// 动态互动与操作
function handlePostAction(postId, action) {
  const posts = window.weiboPosts || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  if (action === 'like') {
    post.stats.isLiked = !post.stats.isLiked;
    post.stats.likes += post.stats.isLiked ? 1 : -1;
  } else if (action === 'download') {
    post.stats.isDownloaded = !post.stats.isDownloaded;
    if (api.ui && api.ui.toast) {
      api.ui.toast(post.stats.isDownloaded ? "已下载保存该动态！" : "已移除保存");
    }
  } else if (action === 'repost') {
    if (typeof openSharePickerModal === 'function') openSharePickerModal();
  }

  if (typeof renderTrends === 'function') renderTrends();
  if (typeof currentActiveSuperTopicCharId !== 'undefined' && currentActiveSuperTopicCharId && typeof renderSuperTopicPostsTab === 'function') {
    renderSuperTopicPostsTab(currentActiveSuperTopicCharId);
  }
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
  const posts = window.weiboPosts || [];
  const post = posts.find(p => p.id === activePostId);
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

  const posts = window.weiboPosts || [];
  const post = posts.find(p => p.id === activePostId);
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
  if (typeof renderTrends === 'function') renderTrends();

  try {
    await api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}

  if (api.ui && api.ui.toast) {
    api.ui.toast("评论已发表！");
  }
}
window.submitTrendComment = submitTrendComment;

function handleShareCurrentPost() {
  if (typeof openSharePickerModal === 'function') openSharePickerModal();
}
window.handleShareCurrentPost = handleShareCurrentPost;


// =========================================================================
// 【统一页面栈注册】动态详情
// =========================================================================
if (window.PageStack) {
  window.PageStack.register('trendDetailModal', {
    animationType: 'slide-right',
  });
  console.log('[PageStack] 动态详情已注册');
}
