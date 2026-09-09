// 社区全屏页面 HTML 注入
(function () {
  'use strict';
  document.getElementById('fullscreen-root').insertAdjacentHTML('beforeend', `
<div id="communityTrendsView" class="full-page-view hidden">
    <!-- 顶部导航：返回 + 搜索 + 加号(发布) + 刷新 -->
    <div class="topbar">
      <button class="icon-btn" onclick="closeCommunitySubPage()" aria-label="返回">
        <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H115.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48a8,8,0,0,1,11.32,11.32L115.31,120H216A8,8,0,0,1,224,128Z"/></svg>
      </button>
      <div class="search-box">
        <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>
        <input type="text" placeholder="搜索热搜、用户、话题">
      </div>
      <!-- 加号 = 发布帖子入口 -->
      <button class="icon-btn" onclick="openCreatePostModal('#微博热搜#')">
        <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>
      </button>
      <button class="icon-btn" id="btnRefreshTrends" onclick="refreshTrendsWithAI()" aria-label="刷新">
        <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48v48a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h21.74A79.54,79.54,0,0,0,128,40a80,80,0,1,0,78.36,97.78,8,8,0,0,1,15.68,3.17A96,96,0,1,1,128,24a95.6,95.6,0,0,1,67.6,28.14V48a8,8,0,0,1,8-8A8,8,0,0,1,224,48Z"/></svg>
      </button>
    </div>
    <!-- 分类横滑 -->
    <div class="cat-rail" id="hotCatRail">
      <div id="hotCatChips" style="display:flex;gap:6px;"></div>
    </div>
    <div id="flow">
      <!-- 置顶焦点热搜（JS 渲染 .hero-hot 结构） -->
      <div id="hotSearchHeroContainer"></div>
      <!-- 热搜榜单 -->
      <div class="section-title">
        <h3>🔥 实时热搜榜</h3>
        <button id="hotSearchEditBtn" onclick="toggleHotSearchEdit()" class="p-2 rounded-full bg-slate-100 text-slate-700 active:scale-95 transition" title="编辑热搜" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;cursor:pointer;">
          <svg class="w-4 h-4 stroke-[2]" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
      </div>
      <div id="hotSearchRankingContainer"></div>
      <!-- 话题过滤提示 -->
      <div id="activeTopicBanner" class="hidden" style="background:#fff;border-radius:16px;padding:10px 14px;margin:10px 0;display:flex;align-items:center;gap:8px;border:1px solid #EEEDF0;">
        <span id="activeTopicTagText" class="font-bold truncate" style="font-size:12px;color:#1A1A2E;">当前话题: #xxx#</span>
        <span id="activeTopicTipText" class="text-[9px] truncate px-1" style="font-size:10px;color:#9E9EB2;"></span>
        <button onclick="clearHotSearchFilter()" style="margin-left:auto;font-size:11px;color:#3B82F6;font-weight:600;background:none;border:0;cursor:pointer;">查看全部</button>
      </div>
      <!-- 热点动态 -->
      <div class="section-title">
        <h3>📰 热点动态</h3>
      </div>
      <div id="weiboPostFeedContainerFull"></div>
    </div>
  </div>

  <!-- 子页面 2: 主播超话专区 全屏子页 (超话 2.0 · 全息深空 UI) -->
  <div id="communitySuperTopicView" class="full-page-view st2-page hidden">
      <!-- 顶部导览 (返回按钮) - 圆形 SVG 图标 -->
    <div class="st2-nav">
      <button onclick="closeCommunitySubPage()" class="st2s-nav-back" aria-label="返回">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <line x1="20" y1="12" x2="4" y2="12"></line>
          <polyline points="11 19 4 12 11 5"></polyline>
        </svg>
      </button>
      <div class="w-8"></div>
    </div>

    <!-- 内容滚动区 -->
    <div class="st2-body" id="communitySuperTopicContent">
      <!-- 动态渲染超话视图 (Hero + 分段导航 + 内容面板) -->
    </div>
  </div>

  <!-- 超话左侧切换抽屉（修复 z-index：置于全屏页栈之上） -->
  <div id="superTopicDrawerBackdrop" class="st2-backdrop" onclick="closeSuperTopicDrawer()"></div>
  <div id="superTopicDrawerPanel" class="st2-drawer">
    <div class="st2-drawer-hd">
      <span class="st2-nav-mark">#</span>
      <div class="t">
        <h3>切换超话</h3>
        <p>SUPER TOPIC</p>
      </div>
      <button onclick="closeSuperTopicDrawer()" class="st2-drawer-close" aria-label="关闭">✕</button>
    </div>
    <div class="st2-drawer-sub">
      <span id="superTopicDrawerCount">粉丝超话列表</span>
      <span>共 <b id="superTopicDrawerTotal">0</b> 个</span>
    </div>
    <div class="st2-drawer-list" id="superTopicDrawerCharList">
      <!-- 动态填充角色超话 -->
    </div>
    <div class="st2-drawer-ft"># 关注主播 · 加入她的超话应援</div>
  </div>

  <!-- 子页面 3: 排行榜 全屏子页 -->
  <div id="communityRankView" class="full-page-view hidden">
    <div class="page-nav-bar">
      <button onclick="closeCommunitySubPage()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">社区风向排行榜</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">OFFICIAL LEADERBOARD</span>
      </div>
      <div class="w-8"></div>
    </div>

    <!-- 三大榜单切换 Tab -->
    <div class="px-4 pb-2">
      <div class="bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-white shadow-xs flex items-center justify-between">
        <button onclick="switchCommunityRankTab('fans')" id="btnRankTabFans" class="flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition border-b-2 border-transparent">
          🔥 人气榜
        </button>
        <button onclick="switchCommunityRankTab('guard')" id="btnRankTabGuard" class="flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition border-b-2 border-transparent">
          💎 守护榜
        </button>
        <button onclick="switchCommunityRankTab('diligent')" id="btnRankTabDiligent" class="flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition border-b-2 border-transparent">
          ⚡ 勤奋榜
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-3" id="communityRankingListContainer">
      <!-- 动态渲染排行榜 -->
    </div>
  </div>

  <!-- 子页面 4: 直播设置 全屏子页 -->
  <div id="communityLiveSettingsView" class="full-page-view hidden">
    <div class="page-nav-bar">
      <button onclick="closeCommunitySubPage()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div></div>
      <div class="w-8"></div>
    </div>

    <div id="liveSettingsModuleArea" class="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-24 space-y-4">
      <!-- 各模块由模块文件动态渲染 -->
    </div>
  </div>

  <!-- 子页面 4.5: 直播间音乐 全屏子页 -->
  <div id="communityLiveMusicView" class="full-page-view hidden bg-slate-50">
    <div class="page-nav-bar bg-white border-b border-slate-100">
      <button onclick="closeLiveMusicSubPage()" class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition" aria-label="返回">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-sm font-black text-slate-900 leading-none tracking-wide">直播间音乐</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-[0.18em] mt-1 block">LIVE MUSIC · PLAYLIST</span>
      </div>
      <div class="w-9 h-9"></div>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-1" id="liveMusicContent">
      <!-- 顶部状态卡 + 歌单列表由 studio_music.js 渲染 -->
    </div>
  </div>

  <!-- 子页面 5: 官方论坛 全屏子页 (仿微博官方账号主页 & 玩家广场) -->
  <div id="communityForumView" class="full-page-view hidden bg-[#f1f4f9]">
    <div class="page-nav-bar">
      <button onclick="closeCommunitySubPage()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">官方论坛 · LUMA STATION</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">OFFICIAL WEIBO & COMMUNITY</span>
      </div>
      <button onclick="openVoucherManageModal()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition" title="通行证凭据">
        <span class="text-xs">🔑</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-4" id="communityForumContent">
      <!-- 动态渲染仿微博官方账号主页、置顶公告、玩家广场与发帖流 -->
    </div>
  </div>

  <!-- 子页面 6: 我的超话 全屏子页 -->
  <div id="communityMyTopicView" class="full-page-view hidden">
    <div class="page-nav-bar">
      <button onclick="closeCommunitySubPage()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">我的专属超话</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">MY PERSONAL SUPER TOPIC</span>
      </div>
      <div class="w-8"></div>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-4" id="communityMyTopicContent">
      <!-- 动态渲染玩家专属超话 -->
    </div>
  </div>


  <!-- 关注列表页面 -->
  `);
})();
