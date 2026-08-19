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

let activePostId = null;
let currentReplyTarget = null;

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const savedPosts = await api.db.list("app_posts") || [];
    if (savedPosts && savedPosts.length > 0) {
      weiboPosts = savedPosts;
    }
  } catch (e) {}
});

function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) text = match[0];
  try { return JSON.parse(text); } catch (e) { return null; }
}

function renderTrends() {
  const box = document.getElementById('weiboPostFeedContainer');
  if (!box) return;

  box.innerHTML = weiboPosts.map(post => `
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
}

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
    openSharePickerModal();
  }
  
  renderTrends();
  if (activePostId === postId) renderPostDetailView(post);

  try {
    api.db.create("app_posts", post).catch(() => {
      api.db.update("app_posts", post.id, post).catch(() => {});
    });
  } catch (e) {}
}

function openTrendDetail(postId) {
  activePostId = postId;
  const post = weiboPosts.find(p => p.id === postId);
  if (!post) return;

  renderPostDetailView(post);
  document.getElementById('trendDetailModal').classList.remove('hidden');
}

function closeTrendDetail() {
  document.getElementById('trendDetailModal').classList.add('hidden');
  currentReplyTarget = null;
  activePostId = null;
}

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
  input.placeholder = `回复 @${targetUserName} :`;
  input.focus();
}

function toggleCommentLike(cIdx) {
  const post = weiboPosts.find(p => p.id === activePostId);
  if (!post || !post.commentTree[cIdx]) return;
  const c = post.commentTree[cIdx];
  c.isLiked = !c.isLiked;
  c.likes += c.isLiked ? 1 : -1;
  renderPostDetailView(post);
  try { api.db.update("app_posts", post.id, post); } catch(e) {}
}

async function submitTrendComment() {
  const input = document.getElementById('inputTrendComment');
  const val = input.value.trim();
  if (!val || !activePostId) return;

  const post = weiboPosts.find(p => p.id === activePostId);
  if (!post) return;

  if (currentReplyTarget) {
    const parentComment = post.commentTree.find(c => c.id === currentReplyTarget.parentId);
    if (parentComment) {
      if (!parentComment.replies) parentComment.replies = [];
      parentComment.replies.push({
        id: `r_${Date.now()}`,
        user: currentUser.name,
        avatar: currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        isAuthor: false,
        replyTo: currentReplyTarget.targetUser,
        ip: userProfileData.ip || 'LUMA',
        time: '刚刚',
        text: val,
        likes: 0
      });
    }
  } else {
    post.commentTree.unshift({
      id: `c_${Date.now()}`,
      user: currentUser.name,
      avatar: currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      ip: userProfileData.ip || 'LUMA',
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

async function triggerNpcReplyToComment(post, userText, target) {
  try {
    const res = await aiGenerate({
      appTags: ['live', 'netizen'],
      instruction: `用户评论了动态：“${userText}”`
    });

    const parsed = extractJsonFromText(res.text);
    if (parsed && parsed.user && parsed.text && post.commentTree.length > 0) {
      setTimeout(async () => {
        post.commentTree[0].replies.push({
          id: `r_${Date.now()}`,
          user: parsed.user,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          isAuthor: parsed.user.includes('主播') || parsed.user.includes('同桌'),
          replyTo: currentUser.name,
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
  const host = (liveList && liveList.length > 0) ? liveList[0] : { name: '某主播', category: '电竞竞技' };

  try {
    let parsed = null;
    try {
      const res = await aiGenerate({
        characterId: host.characterId,
        appTags: ['live', 'trends'],
        instruction: `主播【${host.name}】在【${host.category}】直播中发生了精彩对决或翻车事件。`
      });
      parsed = extractJsonFromText(res.text);
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
      const ratioPrompt = (imageSettings && imageSettings.prompts) ? imageSettings.prompts.map(p => p.content).join(', ') : '16:9 composition';
      const imgRes = await aiGenerateImage({
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