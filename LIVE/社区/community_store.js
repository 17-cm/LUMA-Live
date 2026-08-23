// =========================================================================
// 【社区数据总线与全局状态中心】LIVE/社区/community_store.js
// 统一管理与跨模块双向同步：
// 1. 动态数据持久化 (weiboPosts)
// 2. 每日签到全局数据中心 (包含全主播及用户自己，精确到自然日限制与多端同步)
// 3. 打榜应援数据中心 (打榜贡献、全局榜单实时联动、钱包与各榜单双向同步)
// 4. 虚拟列表 (Virtual Scroller) 高性能通用渲染引擎
// =========================================================================

var api = window.api || {};

// 1. 基础预置帖子数据
window.weiboPosts = window.weiboPosts || [
  // ⚠️ 样板帖子（临时展示用，确认框架后删除）
  {
    id: 'post_sample_framework',
    author: {
      name: '希尔维娅的超话前线',
      avatar: '',
      badge: '独家爆料',
      verified: true
    },
    time: '刚刚',
    tag: '#希尔维娅直播间空间错位#',
    mention: '@希尔维娅',
    linkText: '网页链接 🔗',
    clipText: '直播间切片',
    content: '希尔维娅在直播国风宅舞时，因实验室通风系统异常导致重心偏移，她下意识动用S级空间异能修正姿态，结果导致直播间全息投影瞬间发生折叠，背景中的实验架直接被"折叠"到了天花板上。面对满屏惊叹，教授冷静地关掉舞蹈伴奏，对着镜头开始分析此次空间介质紊乱的力学原理，直播画风从"才艺秀"瞬间秒变"空间物理公开课"。',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    stats: {
      reposts: 814,
      comments: 4,
      likes: 3066,
      isLiked: false,
      isDownloaded: false
    },
    commentTree: []
  },
  {
    id: 'post_1',
    author: {
      name: '星芒吃瓜周刊',
      avatar: getAvatar('星芒吃瓜周刊', 'first'),
      badge: '独家狗仔',
      verified: true
    },
    time: '10分钟前',
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
        avatar: getAvatar(null, 'emoji'),
        ip: '塞博空间',
        time: '12分钟前',
        text: '昨晚看直播的我笑得想死，主播当场破防把摄像头都晃歪了哈哈哈哈！',
        likes: 342,
        isLiked: false,
        replies: [
          {
            id: 'r1',
            user: '苏小喵',
            avatar: getAvatar(null, 'emoji'),
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
      avatar: getAvatar('电竞前线大队长', 'first'),
      badge: '赛事解说',
      verified: true
    },
    time: '25分钟前',
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
        avatar: getAvatar(null, 'emoji'),
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
