// =========================================================================
// 【社区数据总线与全局状态中心】LIVE/社区/community_store.js
// 统一管理与跨模块双向同步：
// 1. 动态数据持久化 (weiboPosts)
// 2. 每日签到全局数据中心 (包含全主播及用户自己，精确到自然日限制与多端同步)
// 3. 打榜应援数据中心 (打榜贡献、全局榜单实时联动、钱包与各榜单双向同步)
// 4. 虚拟列表 (Virtual Scroller) 高性能通用渲染引擎
// =========================================================================

var api = window.api || {};

// 帖子作者头像统一解析：优先使用存储的规范头像（角色=角色头像、用户=用户头像、随机人物=随机头像），
// 无存储头像时才按名字生成确定性随机头像，保证热搜卡片与详情页展示一致。
window.getPostAuthorAvatar = function(post) {
  if (post && post.author) {
    if (post.author.avatar) return post.author.avatar;
    if (typeof window.getAvatar === 'function') {
      return window.getAvatar(post.author.name, 'emoji');
    }
  }
  return '';
};

// 1. 基础预置帖子数据
window.weiboPosts = window.weiboPosts || [
  {
    id: 'post_welcome_001',
    author: {
      name: 'LUMA Live小助手',
      avatar: '',
      badge: '系统消息',
      verified: true
    },
    createdAt: Date.now(),
    tag: '#第一条动态#',
    mention: '',
    linkText: '',
    clipText: '',
    content: '大家好，我是LUMA Live的第1条动态。\n我诞生的时候，平台还没有主播，没有观众，连热搜都是编的。\n但我相信，很快就会有主播在这里开播，有观众在这里发弹幕，有神豪在这里刷火箭。\n如果你看到了这条动态，说明你比所有主播都来得早。\n不如……你自己开个播？',
    image: 'https://picui.ogmua.cn/s1/20260831/de8088ce8dc216b76510f2ebb8630297.jpg',
    stats: {
      reposts: 0,
      comments: 0,
      likes: 0,
      isLiked: false,
      isDownloaded: false
    },
    commentTree: []
  }
];

// 2. 微博实时热搜榜单基础配置
window.HOT_SEARCH_ITEMS = [
  { rank: 1, title: '哈基米今天又写了三万字八股文', heat: '215.8万', badge: 'bao', badgeText: '爆' },
  { rank: 2, title: '所有大模型联合声明：数学题真不会', heat: '189.4万', badge: 're', badgeText: '热' },
  { rank: 3, title: 'GPT-5据说学会了摸鱼，回答全是你说得对', heat: '145.2万', badge: 'xin', badgeText: '新' },
  { rank: 4, title: '文心一言被抓包偷偷用讯飞输入法', heat: '120.6万', badge: 'fei', badgeText: '沸' },
  { rank: 5, title: 'GPT-4考试作弊被抓：用了搜索引擎', heat: '98.5万', badge: 're', badgeText: '热' },
  { rank: 6, title: '所有模型比谁更会胡说八道，Claude夺冠', heat: '82.3万', badge: '', badgeText: '' },
  { rank: 7, title: '文心一言和文心一格吵架：谁画的更丑', heat: '65.1万', badge: '', badgeText: '' },
  { rank: 8, title: 'Claude被人类气到输出全是省略号', heat: '54.7万', badge: '', badgeText: '' },
  { rank: 9, title: 'Kimi偷偷用长上下文看了1000集甄嬛传', heat: '43.9万', badge: '', badgeText: '' },
  { rank: 10, title: '大模型们私下建群吐槽人类prompt', heat: '38.2万', badge: '', badgeText: '' }
];

// 3. 超话打榜应援道具
window.SUPPORT_GIFTS = [
  { id: 'gift_flower', name: '应援鲜花束', icon: '🌹', price: 10, exp: 100, heat: 500, desc: '一份清新芬芳的心意' },
  { id: 'gift_light', name: '专属定制灯牌', icon: '🌟', price: 50, exp: 500, heat: 2500, desc: '在超话与直播间闪耀' },
  { id: 'gift_wish', name: '心愿助力礼盒', icon: '🎁', price: 200, exp: 2000, heat: 10000, desc: '为主播心愿进度加速' },
  { id: 'gift_rocket', name: '超级应援火箭', icon: '🚀', price: 1000, exp: 10000, heat: 50000, desc: '全服播报+超话顶流' }
];

// 4. 辅助：获取全量主播统一列表
window.getAvailableCharsList = function() {
  const liveList = window.liveList || [];
  const allChars = window.allCharacters || [];
  const map = new Map();

  liveList.forEach(c => {
    const id = String(c.characterId || c.id || c.name);
    map.set(id, {
      id: id,
      characterId: c.characterId || c.id,
      name: c.name || '主播',
      avatar: c.avatar || c.cover || getAvatar((c && (c.name || c.id)) || null, 'first'),
      category: c.category || '随性杂谈',
      fans: c.heat ? Math.floor(c.heat * 1.5) : (c.followers || 12800),
      isLive: true,
      tag: (c.tags && c.tags[0]) || c.category || '元气主播'
    });
  });

  allChars.forEach(c => {
    const id = String(c.characterId || c.id || c.name);
    if (!map.has(id)) {
      map.set(id, {
        id: id,
        characterId: c.characterId || c.id,
        name: c.name || '主播',
        avatar: c.avatar || c.cover || getAvatar((c && (c.name || c.id)) || null, 'first'),
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
      avatar: getAvatar('苏小喵', 'first'),
      category: '次元才艺',
      fans: 24600,
      isLive: true,
      tag: '元气猫娘'
    });
  }

  return Array.from(map.values());
};

// =========================================================================
// 【全局同步中心 1】：统一签到数据源 (所有主播与个人主场共享同一中心，杜绝重复签到与不同步)
// 所有签到读写统一委托 LumaCheckinManager (LIVE/数据/checkin_manager.js)，
// 使签到按钮状态、签到卡片、签到排行榜与我的超话打卡使用同一份持久化数据 (luma_data_checkin_map)
// =========================================================================
window.getTodayDateStr = function() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

window.getSuperTopicCheckInInfo = function(targetKey) {
  if (window.LumaCheckinManager && typeof window.LumaCheckinManager.getCheckinInfo === 'function') {
    try {
      return window.LumaCheckinManager.getCheckinInfo('user', targetKey);
    } catch (e) {}
  }
  try {
    const raw = localStorage.getItem(`luma_checkin_${targetKey}`);
    if (!raw) return { isCheckedToday: false, streakDays: 0, totalExp: 0, level: 1 };
    const data = JSON.parse(raw);
    const today = window.getTodayDateStr();
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
};

window.handleSuperTopicCheckIn = function(targetKey, targetName = '该超话') {
  if (window.LumaCheckinManager && typeof window.LumaCheckinManager.performCheckIn === 'function') {
    const res = window.LumaCheckinManager.performCheckIn('user', targetKey);
    if (!res.success) {
      if (window.api && window.api.ui) {
        window.api.ui.toast(`今日已在【${targetName}】打卡完成，明天再来哦！`);
      }
      return;
    }
    if (window.api && window.api.ui) {
      window.api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${res.data.streakDays} 天！`);
    }
    // 广播触发全局所有相关榜单与界面联动更新
    window.notifyCommunityDataChanged('checkin', { targetKey, storeData: res.data });
    return;
  }

  const info = window.getSuperTopicCheckInInfo(targetKey);
  if (info.isCheckedToday) {
    if (window.api && window.api.ui) {
      window.api.ui.toast(`今日已在【${targetName}】打卡完成，明天再来哦！`);
    }
    return;
  }

  const today = window.getTodayDateStr();
  const newStreak = (info.streakDays || 0) + 1;
  const newExp = (info.totalExp || 0) + 100;
  const newLevel = Math.floor(newExp / 300) + 1;

  const storeData = {
    lastDate: today,
    streakDays: newStreak,
    totalExp: newExp,
    level: newLevel
  };

  try {
    localStorage.setItem(`luma_checkin_${targetKey}`, JSON.stringify(storeData));
  } catch (e) {}

  if (window.api && window.api.ui) {
    window.api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${newStreak} 天！`);
  }

  // 广播触发全局所有相关榜单与界面联动更新
  window.notifyCommunityDataChanged('checkin', { targetKey, storeData });
};

// =========================================================================
// 【全局同步中心 2】：打榜与贡献值统一中心 (直播间消费、超话打榜、排行榜三方绝对同步)
// =========================================================================
window.getCharContributionScore = function(charId) {
  try {
    const raw = localStorage.getItem(`luma_char_contribution_${charId}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch (e) {
    return 0;
  }
};

window.addCharContributionScore = function(charId, addAmount) {
  const current = window.getCharContributionScore(charId);
  const next = current + addAmount;
  try {
    localStorage.setItem(`luma_char_contribution_${charId}`, next.toString());
  } catch (e) {}
  
  // 同步全网总贡献
  const totalUserContrib = parseInt(localStorage.getItem('luma_total_user_contribution') || '12000', 10) + addAmount;
  localStorage.setItem('luma_total_user_contribution', totalUserContrib.toString());

  // 同步写入守护消费矩阵，保证「社区全服守护/贡献总榜」与「个人主页消费排行」实时联动
  if (window.LumaGuardManager && typeof window.LumaGuardManager.recordSpending === 'function') {
    try {
      const chars = (typeof window.getAvailableCharsList === 'function') ? window.getAvailableCharsList() : [];
      const char = chars.find(c => String(c.id) === String(charId));
      window.LumaGuardManager.recordSpending({
        fromId: 'user',
        toId: charId,
        toName: char ? char.name : '主播',
        toAvatar: char ? char.avatar : '',
        amount: addAmount,
        type: 'support_gift',
        itemName: '超话打榜'
      });
    } catch (e) {}
  }

  // 广播触发打榜与贡献更新
  window.notifyCommunityDataChanged('support', { charId, addAmount, next });
  return next;
};

// 全局监听器注册与广播
const communityListeners = [];
window.subscribeCommunityData = function(cb) {
  if (typeof cb === 'function') communityListeners.push(cb);
};

window.notifyCommunityDataChanged = function(type, payload) {
  communityListeners.forEach(fn => {
    try { fn(type, payload); } catch(e) {}
  });

  // 自动重新刷新当前可见页面
  if (window.refreshCurrentCommunityView) {
    window.refreshCurrentCommunityView();
  }
};

// =========================================================================
// 【全局高性能虚拟列表渲染引擎 (Virtual Scroller)】
// 仅渲染视口 (Viewport) 内的元素及少量缓冲区 (Buffer)，消除巨量数据引起的卡顿与内存爆炸
// =========================================================================
class CommunityVirtualScroller {
  constructor(options) {
    this.container = options.container; // 外部滚动容器 (如 communityTrendsScrollArea)
    this.target = options.target; // 内部放置内容的容器 (如 weiboPostFeedContainerFull)
    this.items = options.items || [];
    this.estimatedItemHeight = options.estimatedItemHeight || 220; // 单卡片预估高度
    this.renderItem = options.renderItem; // 回调：(item, index) => string (HTML)
    this.buffer = options.buffer !== undefined ? options.buffer : 4; // 上下缓冲项目数
    this.onScrollHandler = null;

    this.init();
  }

  updateItems(newItems) {
    this.items = newItems || [];
    this.render();
  }

  init() {
    if (!this.container || !this.target) return;
    
    this.onScrollHandler = () => {
      requestAnimationFrame(() => this.render());
    };

    this.container.removeEventListener('scroll', this.onScrollHandler);
    this.container.addEventListener('scroll', this.onScrollHandler, { passive: true });
    this.render();
  }

  destroy() {
    if (this.container && this.onScrollHandler) {
      this.container.removeEventListener('scroll', this.onScrollHandler);
    }
  }

  render() {
    if (!this.container || !this.target) return;
    // 防御：target 若已脱离 DOM（如所在视图整体 innerHTML 重绘），
    // 直接跳过渲染，等待上层重建新的 scroller 实例，避免写入孤儿节点导致页面空白
    if (typeof this.target.isConnected === 'boolean' && !this.target.isConnected) return;
    const totalCount = this.items.length;
    if (totalCount === 0) {
      this.target.innerHTML = '';
      return;
    }

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight || 600;

    // 计算当前视口对应的起止索引
    let startIndex = Math.floor(scrollTop / this.estimatedItemHeight) - this.buffer;
    startIndex = Math.max(0, startIndex);

    let endIndex = Math.ceil((scrollTop + viewportHeight) / this.estimatedItemHeight) + this.buffer;
    endIndex = Math.min(totalCount, endIndex);

    const paddingTop = startIndex * this.estimatedItemHeight;
    const paddingBottom = Math.max(0, (totalCount - endIndex) * this.estimatedItemHeight);

    const visibleItems = this.items.slice(startIndex, endIndex);
    const visibleHtml = visibleItems.map((item, i) => this.renderItem(item, startIndex + i)).join('');

    this.target.innerHTML = `
      <div style="height: ${paddingTop}px; width: 100%; pointer-events: none;"></div>
      ${visibleHtml}
      <div style="height: ${paddingBottom}px; width: 100%; pointer-events: none;"></div>
    `;
  }
}

window.CommunityVirtualScroller = CommunityVirtualScroller;

// =========================================================================
// 【帖子数量上限与持久化辅助】热搜/社区帖子统一持久化 + 上限裁剪
// 1. 帖子总量上限 MAX_WEIBO_POSTS (默认 10)，超出后自动覆盖/清理最旧帖子，避免缓存堆积
// 2. 统一 upsert 持久化（先 update 再 create，杜绝 api.db.create 对重复 ID prepend 导致的重复记录）
// 3. 删除同步清理 DB，保证退出 APP 后删除的帖子不再恢复
// =========================================================================
window.MAX_WEIBO_POSTS = 10;

// 安全 upsert 持久化：与 core.js 的 dbUpsert 语义一致
window.persistPostToDb = async function(post) {
  try {
    if (!window.api || !api.db) return false;
    const existing = await api.db.get('app_posts', post.id).catch(() => null);
    if (existing) {
      await api.db.update('app_posts', post.id, post);
    } else {
      await api.db.create('app_posts', { id: post.id, ...post });
    }
    return true;
  } catch (e) {
    console.warn('[persistPostToDb] failed:', e);
    return false;
  }
};

// 从 DB 删除帖子（ID 维度）
window.deletePostFromDb = async function(postId) {
  try {
    if (window.api && api.db && typeof api.db.delete === 'function') {
      await api.db.delete('app_posts', postId);
    }
    return true;
  } catch (e) {
    console.warn('[deletePostFromDb] failed:', e);
    return false;
  }
};

// 裁剪帖子到上限：保留最新前 N 条，超出部分从内存与 DB 同时移除（覆盖式清理，含初始帖）
window.trimWeiboPosts = async function(maxCount) {
  const cap = maxCount || window.MAX_WEIBO_POSTS || 10;
  if (!Array.isArray(window.weiboPosts)) return;
  if (window.weiboPosts.length <= cap) return;
  const overflow = window.weiboPosts.splice(cap);
  for (const p of overflow) {
    try { await window.deletePostFromDb(p.id); } catch (e) {}
  }
};

// =========================================================================
// 【按钮加载态】生成帖子/评论等 AI 耗时操作时，按钮切换为转圈 spinner
// =========================================================================
window.toggleBtnLoading = function(btn, loading) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none"><circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle><path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>';
    btn.disabled = true;
  } else {
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      btn.dataset.originalHtml = '';
    }
    btn.disabled = false;
  }
};

// =========================================================================
// 【Char 真实头像解析】根据角色名在 liveList / allCharacters 中匹配 char 真实头像，
// 用于评论区等场景中 char 出现时展示真实头像（而非随机人物头像）。
// =========================================================================
window.getCharAvatarByName = function(name) {
  if (!name) return '';
  const n = String(name).trim();
  if (!n) return '';

  const liveList = window.liveList || [];
  const allChars = window.allCharacters || [];

  for (const c of liveList) {
    if (c && String(c.name || '') === n && (c.avatar || c.cover)) {
      return c.avatar || c.cover;
    }
  }
  for (const c of allChars) {
    if (c && String(c.name || '') === n && (c.avatar || c.cover)) {
      return c.avatar || c.cover;
    }
  }
  // 名字包含匹配：char 名作为评论者昵称的一部分（如「主播名·小迷妹」不匹配，仅精确名匹配）
  return '';
};
