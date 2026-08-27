// 主页全屏页面 HTML 注入
(function () {
  'use strict';
  document.getElementById('fullscreen-root').insertAdjacentHTML('beforeend', `
  <div id="streamerProfilePageView">
    <!-- 浮动导航（固定在顶部，不随内容滚动） -->
    <div class="profile-top-nav">
      <button onclick="closeStreamerProfilePage()" class="profile-nav-btn" title="返回">
        <svg class="w-5 h-5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
    </div>

    <!-- 滚动内容容器 -->
    <div class="profile-content-scroll">
      <!-- 顶部封面（朋友圈风格，随内容滚动） -->
      <div class="profile-cover-banner">
        <img id="spCoverImg" src="" class="profile-cover-img" alt="Cover">
        <div class="profile-cover-mask"></div>
        <button class="profile-cover-upload-btn" onclick="document.getElementById('spCoverInput').click()" title="更换封面">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </button>
        <input type="file" id="spCoverInput" accept="image/*" class="hidden" onchange="handleStreamerCoverUpload(event)">
      </div>
      <!-- 头部档案资料区 -->
      <div class="px-4 pb-3 bg-white">
        <div class="flex items-end justify-between mb-3">
          <!-- 头像与金V认证 -->
          <div class="profile-avatar-wrapper">
            <img id="spAvatar" src="" class="profile-avatar-img" alt="Avatar">
            <div class="v-badge-gold" title="官方认证金V">
              <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
          </div>

          <!-- 操作按钮行 -->
          <div class="flex items-center gap-2">
            <!-- 直播中快捷入口 (动态展示) -->
            <button id="spBtnGoLiveRoom" onclick="spEnterLiveRoom()" class="hidden px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition">
              <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
              <span>直播中</span>
            </button>

            <!-- 关注按钮 -->
            <button id="spBtnFollow" onclick="spToggleFollow()" class="px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm active:scale-95 transition flex items-center gap-1">
              <svg class="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span id="spFollowBtnText">关注</span>
            </button>

            <!-- 铅笔：编辑主播档案 -->
            <button onclick="spOpenProfileEdit()" class="p-2 rounded-full bg-slate-100 text-slate-700 active:scale-95 transition" title="编辑档案">
              <svg class="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
          </div>
        </div>

        <!-- 名字与头衔 -->
        <div>
          <div class="flex items-center gap-2">
            <h2 id="spName" class="text-base font-black text-slate-900">主播名字</h2>
            <span id="spVipTag" class="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-400/40">VIP 9</span>
            <span id="spCategoryBadge" class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">签约主播</span>
          </div>

          <!-- 认证说明 -->
          <div class="flex items-center gap-1.5 text-[11px] text-amber-600 font-bold mt-1">
            <svg class="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span id="spVerifyTitle" class="truncate">LUMA 平台年度认证大V主播</span>
          </div>

          <!-- 4 宫格核心数据矩阵 (微博经典：粉丝数与直播场数强绑定) -->
          <div class="grid grid-cols-4 gap-2 my-3 py-2.5 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <div class="cursor-pointer">
              <span id="spFansCount" class="block text-sm font-black text-slate-900">0</span>
              <span class="text-[9px] text-slate-400 font-medium">粉丝</span>
            </div>
            <div class="cursor-pointer border-l border-slate-200">
              <span id="spLiveShowsCount" class="block text-sm font-black text-rose-600">0</span>
              <span class="text-[9px] text-slate-400 font-medium">直播场次</span>
            </div>
            <div class="cursor-pointer border-l border-slate-200">
              <span id="spFollowCount" class="block text-sm font-black text-slate-900">0</span>
              <span class="text-[9px] text-slate-400 font-medium">关注</span>
            </div>
            <div class="cursor-pointer border-l border-slate-200">
              <span id="spLikesCount" class="block text-sm font-black text-slate-900">0</span>
              <span class="text-[9px] text-slate-400 font-medium">转赞评</span>
            </div>
          </div>

          <!-- 详细基本信息：个签、IP、标签、粉丝团 -->
          <p id="spBioText" class="text-xs text-slate-700 leading-relaxed font-medium">心怀旷野，在直播间弹琴唱歌给你听~</p>

          <div class="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500">
            <span class="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
              <svg class="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
              <span id="spIpLocation">IP属地: 广东</span>
            </span>
            <span class="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
              <svg class="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span id="spJoinDays">入驻 320 天</span>
            </span>
            <span class="flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md font-bold">
              <svg class="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span id="spFanClubName">粉丝团: 星辰守护团</span>
            </span>
          </div>

          <!-- 标签 Tags -->
          <div id="spTagsContainer" class="flex flex-wrap gap-1.5 mt-2.5"></div>
        </div>
      </div>

      <!-- 微博 Tab 导航条 (粘性定位；动态 Tab 保留，随机内容已清空，等社区真实功能) -->
      <div class="sticky top-0 z-20 bg-white/95 backdrop-blur border-y border-slate-100 flex items-center justify-around px-2 shadow-xs">
        <div onclick="switchSpTab('posts')" id="spTabPosts" class="weibo-tab-item active">动态</div>
        <div onclick="switchSpTab('shows')" id="spTabShows" class="weibo-tab-item">直播场次</div>
        <div onclick="switchSpTab('gallery')" id="spTabGallery" class="weibo-tab-item">相册</div>
        <div onclick="switchSpTab('guestbook')" id="spTabGuestbook" class="weibo-tab-item">留言墙</div>
      </div>

      <!-- Tab 1: 动态微博列表（随机内容已清空，显示空态） -->
      <div id="spPanelPosts" class="p-3 space-y-3"></div>

      <!-- Tab 2: 直播场次与回放记录 -->
      <div id="spPanelShows" class="hidden p-3 space-y-3"></div>

      <!-- Tab 2: 相册影集 -->
      <div id="spPanelGallery" class="hidden p-3"></div>

      <!-- Tab 4: 留言墙与守护榜 -->
      <div id="spPanelGuestbook" class="hidden p-3 space-y-3">
        <!-- 留言输入框 -->
        <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <svg class="w-4 h-4 text-rose-500 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>主播私密留言墙 (角色会根据人设温暖回复)</span>
          </div>
          <div class="flex gap-2">
            <input id="inputSpaceComment" placeholder="给主播留句话..." class="input-ins flex-1">
            <button onclick="submitGuestbookComment()" class="btn-brand text-xs">留言</button>
          </div>
        </div>
        <div id="spaceGuestbookList" class="space-y-2.5"></div>
      </div>
    </div>
  </div>

  <div id="followListPageView" class="full-page-view hidden bg-[#f1f4f9]">
    <div class="page-nav-bar">
      <button onclick="closeFollowListPageView()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">关注列表</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">FOLLOWING LIST</span>
      </div>
      <div class="w-8"></div>
    </div>
    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-2.5" id="followListContentContainer">
    </div>
  </div>

  <div id="walletPageView" class="full-page-view hidden bg-[#f1f4f9]">
    <div class="page-nav-bar">
      <button onclick="closeWalletPageView()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">我的钱包</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">LUMA WALLET</span>
      </div>
      <div class="w-8"></div>
    </div>
    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-4">
      <div class="luxe-card p-4 bg-gradient-to-br from-amber-500 to-rose-500 text-white">
        <p class="text-[10px] opacity-80 font-bold">营收余额</p>
        <p class="text-2xl font-black mt-1" id="pageRevenueBalance">0</p>
        <p class="text-[9px] opacity-70 mt-1">LUMA 币</p>
      </div>
      <div>
        <h4 class="text-xs font-black text-slate-700 mb-2 px-1">交易流水</h4>
        <div class="space-y-2" id="transactionLedgerContainer">
        </div>
      </div>
    </div>
  </div>
  `);
})();
