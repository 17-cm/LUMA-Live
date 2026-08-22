// =========================================================================
// 【模块二·社区子文档6·玩家专属超话与动态发布】LIVE/社区/module_mytopic.js
// 包含：
// 1. 玩家自己的专属超话主场（大头贴、等级勋章、专属打卡、粉丝与发帖统计）
// 2. 玩家专属动态流与历史动态管理
// 3. 发布新动态 Modal 与 AI 随机抓取热点高光机制
// =========================================================================

var api = window.api || {};

// 渲染我的专属超话
function renderMyTopicView() {
  const container = document.getElementById('communityMyTopicContent');
  if (!container) return;

  const uName = (window.currentUser && window.currentUser.name) || '玩家';
  const uAvatar = (window.currentUser && window.currentUser.avatar) || document.getElementById('userAvatarBox')?.src || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200';
  const uProfile = window.userProfileData || {};
  const checkIn = window.getSuperTopicCheckInInfo('player_user_self');

  const allPosts = window.weiboPosts || [];
  const myPosts = allPosts.filter(p => p.author && p.author.name === uName);

  container.innerHTML = `
    <!-- 玩家专属超话头部卡片 -->
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

    <!-- 动态流列表 -->
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
        <div class="luxe-card p-4 space-y-3 bg-white cursor-pointer hover:border-slate-300 transition" onclick="openTrendDetail('${post.id}')">
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

// 打开与关闭发帖弹窗
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

// 发布新动态
async function handlePublishNewPost() {
  const tagInput = document.getElementById('inputPostTag');
  const mentionInput = document.getElementById('inputPostMention');
  const contentInput = document.getElementById('inputPostContent');
  if (!contentInput || !contentInput.value.trim()) {
    if (api.ui && api.ui.toast) api.ui.toast("请输入动态正文内容！");
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
    time: `刚刚 · 来自 ${window.getFloatClientTag(true)}`,
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

  if (!window.weiboPosts) window.weiboPosts = [];
  window.weiboPosts.unshift(newPost);
  closeCreatePostModal();

  if (typeof renderTrends === 'function') renderTrends();
  if (typeof currentActiveSuperTopicCharId !== 'undefined' && currentActiveSuperTopicCharId && typeof renderSuperTopicPostsTab === 'function') {
    renderSuperTopicPostsTab(currentActiveSuperTopicCharId);
  }
  renderMyTopicView();

  try {
    await api.db.create("app_posts", newPost);
  } catch (e) {}

  if (api.ui && api.ui.toast) {
    api.ui.toast("🎉 动态发布成功！");
  }
}
window.handlePublishNewPost = handlePublishNewPost;

// AI 抓取与生成高光动态
async function handleGenerateNewTrend() {
  if (api.ui && api.ui.toast) api.ui.toast("正在抓取全网热点与直播高光...");
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
    time: `刚刚 · 来自 ${window.getFloatClientTag(true)}`,
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

  if (!window.weiboPosts) window.weiboPosts = [];
  window.weiboPosts.unshift(newPost);
  if (typeof renderTrends === 'function') renderTrends();
  if (typeof renderHotSearchRanking === 'function') renderHotSearchRanking();
  
  try {
    await api.db.create("app_posts", newPost);
  } catch (e) {}

  if (api.ui && api.ui.toast) {
    api.ui.toast("已抓取并刷新最新热点动态！");
  }
}
window.handleGenerateNewTrend = handleGenerateNewTrend;
