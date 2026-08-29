// =========================================================================
// 【模块二·社区主文档】LIVE/社区/trends.js
// 社区主界面总入口与全局路由分发器：
// 1. 负责社区 6 大核心子系统的全屏路由与生命周期管理
// 2. 社区数据跨模块加载与状态双向同步
// 3. 性能卡顿深度优化（GPU合成加速、RAF节流、懒加载）
// =========================================================================

var api = window.api || {};
let currentActiveCommunityPage = 'trends'; // 'trends' | 'super_topic' | 'ranking' | 'live_settings' | 'forum' | 'my_topic'

// 1. 社区全量数据初始化与异步载入
// DB (app_posts) 作为唯一权威数据源：删帖后从 DB 移除，退出 APP 重新进入也不会再恢复；
// 首次运行（DB 为空且未 seed 过）才将预置初始帖 seed 入 DB 并打上标记，
// 之后即使删光全部帖子（DB 为空）也不会重新注入初始帖。
async function loadTrendsFromDb() {
  try {
    const savedPosts = await api.db.list("app_posts", { limit: 500 }) || [];
    const dbPosts = Array.isArray(savedPosts) ? savedPosts.filter(p => p && p.id) : [];

    if (dbPosts.length > 0) {
      // DB 有记录：以其为准，按 id 去重合并，避免历史重复记录
      const byId = new Map();
      dbPosts.forEach(p => byId.set(p.id, p));
      window.weiboPosts = Array.from(byId.values());
    } else {
      // DB 为空：仅首次运行（未 seed 过）才注入预置初始帖
      let seeded = false;
      try { seeded = localStorage.getItem('luma_weibo_seeded') === '1'; } catch (e) {}
      if (!seeded && Array.isArray(window.weiboPosts) && window.weiboPosts.length > 0) {
        for (const p of window.weiboPosts) {
          try {
            if (typeof window.persistPostToDb === 'function') {
              await window.persistPostToDb(p);
            } else {
              await api.db.create("app_posts", { id: p.id, ...p }).catch(() => {});
            }
          } catch (e) {}
        }
        try { localStorage.setItem('luma_weibo_seeded', '1'); } catch (e) {}
      }
    }
  } catch (e) {}
}
window.loadTrendsFromDb = loadTrendsFromDb;

// 2. 社区专区六大子页面统一导航路由
function openCommunitySubPage(pageKey, targetCharId = null) {
  currentActiveCommunityPage = pageKey;
  const allSubViews = [
    'communityTrendsView',
    'communitySuperTopicView',
    'communityRankView',
    'communityLiveSettingsView',
    'communityForumView',
    'communityMyTopicView'
  ];

  // 隐藏其他视图
  allSubViews.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  let targetModalId = '';
  if (pageKey === 'trends') {
    targetModalId = 'communityTrendsView';
    if (typeof switchHotTrendTab === 'function') {
      switchHotTrendTab(typeof currentHotSearchTab !== 'undefined' ? currentHotSearchTab : 'ranking');
    }
  } else if (pageKey === 'super_topic') {
    targetModalId = 'communitySuperTopicView';
    if (typeof renderSuperTopicView === 'function') {
      renderSuperTopicView(targetCharId);
    }
  } else if (pageKey === 'ranking') {
    targetModalId = 'communityRankView';
    if (typeof renderCommunityRanking === 'function') {
      renderCommunityRanking(typeof currentCommunityRankTab !== 'undefined' ? currentCommunityRankTab : 'fans');
    }
  } else if (pageKey === 'live_settings') {
    targetModalId = 'communityLiveSettingsView';
    if (typeof window.renderLiveSettings === 'function') {
      setTimeout(function () { window.renderLiveSettings(); }, 80);
    }
  } else if (pageKey === 'forum') {
    targetModalId = 'communityForumView';
    if (typeof checkAndOpenForum === 'function') {
      const currentUser = typeof getForumCurrentUser === 'function' ? getForumCurrentUser() : null;
      if (!currentUser || !currentUser.uid) {
        checkAndOpenForum();
        return;
      }
    }
    if (typeof renderOfficialWeiboForum === 'function') {
      renderOfficialWeiboForum(typeof currentForumActiveTab !== 'undefined' ? currentForumActiveTab : 'official');
    }
  } else if (pageKey === 'my_topic') {
    targetModalId = 'communityMyTopicView';
    if (typeof renderMyTopicView === 'function') {
      renderMyTopicView();
    }
  }

  const targetEl = document.getElementById(targetModalId);
  if (targetEl) {
    if (window.PageStack) {
      window.PageStack.open(targetModalId);
    } else {
      targetEl.classList.remove('hidden');
    }
  }
}
window.openCommunitySubPage = openCommunitySubPage;

function closeCommunitySubPage() {
  if (window.PageStack) {
    if (typeof closeSuperTopicDrawer === 'function') {
      closeSuperTopicDrawer();
    }
    window.PageStack.back();
  } else {
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
    if (typeof closeSuperTopicDrawer === 'function') {
      closeSuperTopicDrawer();
    }
  }
}
window.closeCommunitySubPage = closeCommunitySubPage;

// 3. 全局数据刷新与跨界面同步回调
window.refreshCurrentCommunityView = function() {
  if (currentActiveCommunityPage === 'trends') {
    if (typeof renderTrends === 'function') renderTrends();
    if (typeof renderHotSearchRanking === 'function') renderHotSearchRanking();
  } else if (currentActiveCommunityPage === 'super_topic') {
    if (typeof renderSuperTopicView === 'function' && typeof currentActiveSuperTopicCharId !== 'undefined') {
      renderSuperTopicView(currentActiveSuperTopicCharId);
    }
  } else if (currentActiveCommunityPage === 'ranking') {
    if (typeof renderCommunityRanking === 'function') {
      renderCommunityRanking(typeof currentCommunityRankTab !== 'undefined' ? currentCommunityRankTab : 'fans');
    }
  } else if (currentActiveCommunityPage === 'my_topic') {
    if (typeof renderMyTopicView === 'function') {
      renderMyTopicView();
    }
  }
};

// 4. 注册全局跨模块数据联动事件
if (typeof subscribeCommunityData === 'function') {
  subscribeCommunityData((type, payload) => {
    // 当签到或打榜发生时，同步触发排行榜、超话与钱包UI联动
    if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
  });
}

// 5. 初始化载入
loadTrendsFromDb();


// =========================================================================
// 【统一页面栈注册】社区六大模块
// =========================================================================
if (window.PageStack) {
  const communityPages = [
    'communityTrendsView',
    'communitySuperTopicView',
    'communityRankView',
    'communityLiveSettingsView',
    'communityForumView',
    'communityMyTopicView',
  ];
  communityPages.forEach(id => {
    window.PageStack.register(id, {
      animationType: 'slide-right',
    });
  });
}
