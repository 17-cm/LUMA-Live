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
      <button class="icon-btn" onclick="refreshTrendsWithAI()" aria-label="刷新">
        <svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48v48a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h21.74A79.54,79.54,0,0,0,128,40a80,80,0,1,0,78.36,97.78,8,8,0,0,1,15.68,3.17A96,96,0,1,1,128,24a95.6,95.6,0,0,1,67.6,28.14V48a8,8,0,0,1,8-8A8,8,0,0,1,224,48Z"/></svg>
      </button>
    </div>
    <!-- 分类横滑 -->
    <div class="cat-rail" id="hotCatRail" style="display:flex;align-items:center;gap:6px;">
      <div id="hotCatChips" style="display:flex;gap:6px;flex:1;overflow-x:auto;"></div>
      <button id="hotCatEditBtn" onclick="toggleHotCatEdit()" class="flex-shrink-0 p-1.5 rounded-full bg-slate-100 text-slate-600 active:scale-95 transition" title="编辑分类" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;cursor:pointer;">
        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
      </button>
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

  <!-- 子页面 2: 主播超话专区 全屏子页 (深度复刻微博超话 UI) -->
  <div id="communitySuperTopicView" class="full-page-view hidden">
    <div class="page-nav-bar">
      <button onclick="closeCommunitySubPage()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none" id="superTopicHeaderTitle">主播超话专区</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">SUPER TOPICS · 粉丝主场</span>
      </div>
      <div class="relative">
        <button onclick="toggleSuperTopicMenu()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
        </button>
        <div id="superTopicMenuPopup" class="hidden absolute right-0 top-10 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 overflow-hidden">
          <button onclick="toggleSuperTopicDrawer(true);toggleSuperTopicMenu()" class="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition">
            <svg class="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            切换超话
          </button>
          <button onclick="toggleSuperTopicMenu()" class="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition">
            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            超话规则
          </button>
          <button onclick="toggleSuperTopicMenu()" class="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition">
            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
            举报超话
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-3" id="communitySuperTopicContent">
      <!-- 动态渲染微博超话完整视图 (包含 Header、4大子Tab及对应面板) -->
    </div>
  </div>

  <!-- 超话左侧主播切换抽屉 -->
  <div id="superTopicDrawerBackdrop" class="drawer-backdrop hidden" onclick="closeSuperTopicDrawer()"></div>
  <div id="superTopicDrawerPanel" class="drawer-panel">
    <div class="px-5 pb-3 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-black text-slate-900 leading-none">主播超话列表</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-1 block">CHOOSE SUPER TOPIC</span>
      </div>
      <button onclick="closeSuperTopicDrawer()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
    </div>
    <div class="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1.5" id="superTopicDrawerCharList">
      <!-- 动态填充角色列表 -->
    </div>
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
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">直播设置 · 开播前瞻</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">STREAMER STUDIO PREVIEW</span>
      </div>
      <div class="w-8"></div>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-4">
      <div class="p-4 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 rounded-3xl text-white shadow-md space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-base">🎥</span>
          <h4 class="text-sm font-black">主播控制台 · 开播前瞻</h4>
        </div>
        <p class="text-xs text-cyan-100 leading-relaxed">此处用于玩家自定义开播参数、推流清晰度、直播间封面与弹幕过滤。功能正在深度筹备中，参数已与沙盒底层连接！</p>
      </div>

      <div class="luxe-card p-4 space-y-3 bg-white">
        <h5 class="text-xs font-black text-slate-900">开播预设偏好</h5>
        <div class="space-y-2 text-xs">
          <div>
            <label class="text-[10px] font-bold text-slate-500">默认直播间标题</label>
            <input value="【塞博漫游】今晚不破防不开麦！" class="input-ins mt-1">
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-500">开播所属分区</label>
            <select class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold mt-1">
              <option>电竞竞技</option>
              <option>声动音律</option>
              <option>次元才艺</option>
              <option>随性杂谈</option>
              <option>探索开箱</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-500">推流分辨率模拟</label>
            <div class="grid grid-cols-3 gap-2 mt-1">
              <div class="p-2 rounded-xl border border-rose-400 bg-rose-50/50 text-center font-bold text-rose-600">4K 超清</div>
              <div class="p-2 rounded-xl border border-slate-200 bg-slate-50 text-center font-bold text-slate-600">1080P 60帧</div>
              <div class="p-2 rounded-xl border border-slate-200 bg-slate-50 text-center font-bold text-slate-600">720P 极速</div>
            </div>
          </div>
        </div>
        <button onclick="api.ui.toast('开播偏好参数已保存！')" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow-md">
          保存开播参数
        </button>
      </div>
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
  console.log('[community] 全屏页面HTML已注入');
})();
