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

  // 头像统一解析，保证与热搜卡片展示一致
  const authorAvatar = (typeof window.getPostAuthorAvatar === 'function')
    ? window.getPostAuthorAvatar(post)
    : (post.author.avatar || (typeof window.getAvatar === 'function' ? window.getAvatar(post.author.name, 'emoji') : ''));

  let html = `
    <!-- 帖子主正文卡片 -->
    <div class="luxe-card p-4 space-y-3.5 bg-white shadow-xs">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="relative">
            <img src="${authorAvatar}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
            ${post.author.verified ? `<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-[8px] text-white font-black">V</span>` : ''}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="text-xs font-black text-slate-900">${post.author.name}</h4>
              <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">${post.author.badge}</span>
            </div>
            <p class="text-[9px] text-slate-400 mt-0.5">${post.createdAt ? `<span data-dynamic-time data-ts="${post.createdAt}">${window.formatDynamicTime ? window.formatDynamicTime(post.createdAt) : '刚刚'}</span>` : (post.time || '刚刚')}</p>
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
        <div class="rounded-2xl overflow-hidden bg-slate-950 shadow-inner">
          <img src="${post.image}" class="w-full h-auto object-contain block">
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
                <span ${c.createdAt ? `data-dynamic-time data-ts="${c.createdAt}"` : ''}>${(c.createdAt && window.formatDynamicTime) ? window.formatDynamicTime(c.createdAt) : (c.time || '刚刚')}</span>
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
                      <span ${r.createdAt ? `data-dynamic-time data-ts="${r.createdAt}"` : ''}>${(r.createdAt && window.formatDynamicTime) ? window.formatDynamicTime(r.createdAt) : (r.time || '刚刚')}</span>
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

// 真实下载图片到本地：统一将图片来源（data URL / http(s)）转成 Blob 后走浏览器对象 URL 下载，
// 兼容 AI 生成的 base64 大图与外部 URL 图片，无弹窗直接触发真实下载。
function downloadImageToLocal(src, fileName) {
  const name = fileName || `luma_image_${Date.now()}.png`;
  const finish = (url) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        try { URL.revokeObjectURL(url); } catch (e) {}
      }, 1000);
      return true;
    } catch (e) {
      console.warn("[downloadImageToLocal] 触发下载失败:", e);
      return false;
    }
  };

  // 1. data URL（AI 生图/Canvas 切片）：base64 转 Blob 后下载，避免大体积 data URL 在 webview 中下载失败
  if (String(src).startsWith('data:')) {
    try {
      const parts = String(src).split(',');
      const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(parts[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      finish(URL.createObjectURL(blob));
      return true;
    } catch (e) {
      console.warn("[downloadImageToLocal] data URL 转 Blob 失败，回退直接触发:", e);
      return finish(src);
    }
  }

  // 2. http(s) 外部图片：fetch 获取 Blob 后下载
  try {
    fetch(src, { mode: 'cors' })
      .then(r => { if (r.ok) return r.blob(); throw new Error('fetch fail'); })
      .then(blob => finish(URL.createObjectURL(blob)))
      .catch(() => {
        // 3. fetch 跨域受限时用 Canvas 兜底重绘后下载
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function () {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              canvas.getContext('2d').drawImage(img, 0, 0);
              canvas.toBlob(blob => {
                if (blob) finish(URL.createObjectURL(blob));
                else finish(src);
              }, 'image/png');
            } catch (e) {
              finish(src);
            }
          };
          img.onerror = function () {
            finish(src);
          };
          img.src = src;
        } catch (e) {
          finish(src);
        }
      });
  } catch (e) {
    finish(src);
  }
  return true;
}

// 下载帖子图片
function downloadPostImageToLocal(post) {
  const imageUrl = post.image;
  const fileName = `luma_post_${post.id || Date.now()}.png`;

  if (imageUrl) {
    downloadImageToLocal(imageUrl, fileName);
    if (window.api?.ui?.toast) window.api.ui.toast("已开始下载！");
  } else {
    // 动态无附图时，生成动态卡片海报并直接保存为本地图片
    generateAndDownloadPostPoster(post, fileName);
  }
}
window.downloadPostImageToLocal = downloadPostImageToLocal;

// 无附图时，用 Canvas 绘制精美的动态卡片海报并直接保存为本地图片
function generateAndDownloadPostPoster(post, fileName) {
  try {
    const canvas = document.createElement('canvas');
    const width = 750;
    const height = 900;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 背景渐变
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 顶部品牌装饰条
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(0, 0, width, 12);

    // 标题与来源
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(post.author?.name || 'LUMA 热点', 50, 80);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${post.time || '刚刚'} · 来自 LUMA 社区热搜`, 50, 120);

    // 分割线
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 150);
    ctx.lineTo(700, 150);
    ctx.stroke();

    // 话题标签
    let startY = 210;
    if (post.tag) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(post.tag, 50, startY);
      startY += 50;
    }

    // 艾特
    if (post.mention) {
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(post.mention, 50, startY);
      startY += 45;
    }

    // 正文自动换行
    ctx.fillStyle = '#1e293b';
    ctx.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
    const text = post.content || '';
    const maxWidth = 650;
    const lineHeight = 42;
    let line = '';
    let currentY = startY + 10;

    for (let n = 0; n < text.length; n++) {
      const testLine = line + text[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 50, currentY);
        line = text[n];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 50, currentY);

    // 底部水印与数据
    const statY = height - 70;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`👍 ${post.stats?.likes || 0}   💬 ${post.stats?.comments || 0}   🔁 ${post.stats?.reposts || 0}`, 50, statY);
    ctx.fillText('LUMA LIVE · 赛博社交沙盒', 440, statY);

    canvas.toBlob(function (blob) {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        try { URL.revokeObjectURL(blobUrl); } catch (e) {}
      }, 1000);
      if (window.api?.ui?.toast) window.api.ui.toast("已生成海报！");
    }, 'image/png');
  } catch (e) {
    if (window.api?.ui?.toast) window.api.ui.toast("动态保存完成");
  }
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
    downloadPostImageToLocal(post);
  } else if (action === 'repost') {
    if (typeof openSharePickerModal === 'function') openSharePickerModal();
  }

  if (typeof renderTrends === 'function') renderTrends();
  if (typeof currentActiveSuperTopicCharId !== 'undefined' && currentActiveSuperTopicCharId && typeof renderSuperTopicPostsTab === 'function') {
    renderSuperTopicPostsTab(currentActiveSuperTopicCharId);
  }
  if (activePostId === postId) renderPostDetailView(post);

  try {
    if (typeof window.persistPostToDb === 'function') {
      window.persistPostToDb(post);
    } else {
      api.db.create("app_posts", post).catch(() => {
        api.db.update("app_posts", post.id, post).catch(() => {});
      });
    }
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
  const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
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
        createdAt: Date.now(),
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
      createdAt: Date.now(),
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
    if (typeof window.persistPostToDb === 'function') {
      await window.persistPostToDb(post);
    } else {
      await api.db.create("app_posts", post).catch(() => {
        api.db.update("app_posts", post.id, post).catch(() => {});
      });
    }
  } catch (e) {}

  if (api.ui && api.ui.toast) {
    api.ui.toast("评论已发表！");
  }
}
window.submitTrendComment = submitTrendComment;

// 右上角「分享」按钮：改为调用 AI 根据帖子内容批量生成真实路人回复（含楼中楼、主播空降、楼主互动），
// 生成结果注入 commentTree 并持久化，退出 APP 后不丢失。
async function handleShareCurrentPost() {
  const post = (window.weiboPosts || []).find(p => p.id === activePostId);
  if (!post) return;

  const btn = document.getElementById('btnSharePost');
  const getAvatarFn = (typeof window.getAvatar === 'function') ? window.getAvatar : (() => '');
  const resolveAvatar = (uname) => {
    if (typeof window.getCharAvatarByName === 'function') {
      const charAv = window.getCharAvatarByName(uname);
      if (charAv) return charAv;
    }
    return getAvatarFn(uname, 'first');
  };

  if (typeof window.toggleBtnLoading === 'function') window.toggleBtnLoading(btn, true);
  if (window.api && api.ui && api.ui.toast) api.ui.toast('正在根据帖子内容生成回复…');

  try {
    // 组装丰富的上下文：楼主、当前用户、平台主播名单、已有评论，供 AI 生成真实评论区（主播空降、围绕用户互动、楼主再次下场）
    const userName = (window.currentUser && window.currentUser.name) || '';
    const authorName = (post.author && post.author.name) || '楼主';
    const charList = (typeof window.getAvailableCharsList === 'function') ? window.getAvailableCharsList() : [];
    const charNames = charList.map(c => c.name).filter(Boolean);
    const existingComments = (Array.isArray(post.commentTree) ? post.commentTree : [])
      .slice(0, 10)
      .map(c => `${c.user}：${c.text}`).join('\n');
    const userCommented = (Array.isArray(post.commentTree) ? post.commentTree : [])
      .some(c => c.user === userName);

    const instruction = [
      `【帖子作者(楼主)】：${authorName}`,
      userName ? `【当前用户】：${userName}（${userCommented ? '已在本帖发表过评论，需围绕其发言展开互动' : '尚未发言，按普通路人处理'}）` : '',
      charNames.length ? `【平台主播名单】：${charNames.join('、')}（请随机挑选其中 1~2 位以真实姓名空降评论区发言）` : '',
      `【帖子正文】：${post.content || '(无正文)'}`,
      existingComments ? `【已有评论概览】：\n${existingComments}` : ''
    ].filter(Boolean).join('\n\n');

    const res = await window.aiGenerate({
      appTags: ['comment'],
      instruction: instruction
    });

    const parsed = window.extractJsonFromText ? window.extractJsonFromText(res.text) : null;
    const rawReplies = parsed && Array.isArray(parsed.replies) ? parsed.replies : (Array.isArray(parsed) ? parsed : null);
    if (!rawReplies || rawReplies.length === 0) {
      if (window.api && api.ui && api.ui.toast) api.ui.toast('生成回复失败，请重试');
      return;
    }

    const baseTs = Date.now();
    const ipPool = ['北京', '上海', '广东', '浙江', '四川', '江苏', '山东', '赛博星云'];

    const mapped = rawReplies.map((r, i) => {
      const rUser = r.user || `网友_${Math.floor(Math.random() * 9000 + 1000)}`;
      const subReplies = Array.isArray(r.replies) ? r.replies : [];
      return {
        id: `c_ai_${baseTs}_${i}`,
        user: rUser,
        avatar: resolveAvatar(rUser),
        ip: r.ip || ipPool[Math.floor(Math.random() * ipPool.length)],
        createdAt: baseTs - i * 30000,
        text: r.text || '围观打卡！',
        likes: typeof r.likes === 'number' ? r.likes : Math.floor(Math.random() * 200 + 5),
        isLiked: false,
        replies: subReplies.map((sub, j) => {
          const subUser = sub.user || `网友_${Math.floor(Math.random() * 9000 + 1000)}`;
          return {
            id: `r_ai_${baseTs}_${i}_${j}`,
            user: subUser,
            avatar: resolveAvatar(subUser),
            isAuthor: !!sub.isAuthor,
            replyTo: sub.replyTo || rUser,
            ip: sub.ip || ipPool[Math.floor(Math.random() * ipPool.length)],
            createdAt: baseTs - i * 30000 + (j + 1) * 5000,
            text: sub.text || '',
            likes: Math.floor(Math.random() * 60 + 4)
          };
        })
      };
    });

    if (!Array.isArray(post.commentTree)) post.commentTree = [];
    post.commentTree = post.commentTree.concat(mapped);
    post.stats.comments += mapped.length;

    try {
      if (typeof window.persistPostToDb === 'function') {
        await window.persistPostToDb(post);
      } else {
        await api.db.create("app_posts", post).catch(() => {
          api.db.update("app_posts", post.id, post).catch(() => {});
        });
      }
    } catch (e) {}

    renderPostDetailView(post);
    if (typeof renderTrends === 'function') renderTrends();

    if (window.api && api.ui && api.ui.toast) api.ui.toast(`已生成 ${mapped.length} 条回复`);
  } catch (e) {
    if (window.api && api.ui && api.ui.toast) api.ui.toast('生成失败：' + (e.message || '未知错误'));
  } finally {
    if (typeof window.toggleBtnLoading === 'function') window.toggleBtnLoading(btn, false);
  }
}
window.handleShareCurrentPost = handleShareCurrentPost;


// =========================================================================
// 【统一页面栈注册】动态详情
// =========================================================================
if (window.PageStack) {
  window.PageStack.register('trendDetailModal', {
    animationType: 'slide-right',
  });
}
