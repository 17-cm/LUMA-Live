// 直播全屏页面 HTML 注入
(function () {
  'use strict';
  document.getElementById('fullscreen-root').insertAdjacentHTML('beforeend', `
  <div id="liveRoomModal" class="full-page-view hidden">
    
    <!-- 【区域一：1:1 纯正方形主播立绘/视频（100% 完整无遮挡）】 -->
    <div class="stage-avatar-zone" id="stageMain">
      <img id="stageHostPortrait" src="" class="stage-portrait-main">
      <video id="stageHostVideo" class="stage-portrait-main hidden" muted loop playsinline></video>
      <div id="stageVideoLoading" class="stage-video-loading hidden">
        <div class="stage-video-loading-spinner"></div>
        <span class="stage-video-loading-text">正在切换背景视频…</span>
      </div>

      <!-- 顶部左侧：独立大退出键 (带精致磨砂边框) -->
      <button onclick="closeLiveRoom()" class="stage-back-btn" title="退出直播间">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>

      <!-- 顶部右侧：放大版动态拍摄红点 (模拟现场 REC 录制质感) 与 实时直播时长计时 -->
      <div class="stage-rec-indicator">
        <span class="stage-rec-dot"></span>
        <span class="stage-rec-text">REC</span>
        <span id="stageLiveDuration" class="stage-live-duration">00:00:00</span>
      </div>

      <!-- 1:1 头像区左下角：主播大号精致信息胶囊 (严格同款个人主页高奢彩框头像、VIP等级、ID、金V章、粉丝数与右侧称号) -->
      <div class="host-capsule-bottom">
        <div class="relative flex-shrink-0 cursor-pointer" onclick="openCurrentHostProfile()">
          <div class="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md flex items-center justify-center">
            <img id="hostAvatarSmall" src="" class="w-full h-full rounded-full object-cover border-[1.5px] border-white">
          </div>
          <span id="hostVipBadge" class="absolute -bottom-0.5 -right-0.5 bg-slate-900 text-amber-300 text-[7px] font-black px-1 py-[0.5px] rounded-full border border-amber-400/50 leading-none shadow">VIP 9</span>
        </div>
        
        <div class="flex flex-col min-w-0 pr-1 justify-center cursor-pointer" onclick="openCurrentHostProfile()">
          <div class="flex items-center gap-1.5">
            <span id="hostName" class="text-xs font-black text-white leading-none truncate max-w-[85px]">主播</span>
            <span id="hostVBadge" class="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-[8px] flex items-center justify-center shadow-sm border border-white flex-shrink-0 leading-none">V</span>
          </div>
          <div class="flex items-center gap-1.5 text-[9px] mt-1 leading-none text-white/90">
            <span class="font-bold flex items-center gap-0.5">
              <span id="hostFanCount">0</span> 粉丝
            </span>
            <span id="hostTitleTag" class="text-[8px] bg-rose-500/25 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-400/40 truncate max-w-[65px]">新人主播</span>
          </div>
        </div>

        <button id="btnFollowHost" onclick="toggleFollowRoomHost()" class="host-follow-btn-lg">+ 关注</button>
      </div>

      <!-- 1:1 头像区右下角：在看人数 (高度略低于主播信息胶囊，bottom: 8px) -->
      <div class="viewer-capsule-bottom">
        <svg class="w-3 h-3 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span id="viewerCount" class="text-[10px] font-bold text-white/95">0 在看</span>
      </div>
    </div>

    <!-- 【区域二：公屏区（铺满下半部，底层同图晕染，绝无多余底板）】 -->
    <div class="stage-chat-zone">
      <!-- 铺满整个公屏区的同图大模糊晕染底图 -->
      <img id="stageAmbientBg" src="" class="pure-ambient-bleed-bg">

      <!-- 公屏顶部的 1/5 磨砂台词条 (麦克风在左侧垂直居中、字多安全换行) -->
      <div class="host-speech-bar-top">
        <div class="w-full flex items-center gap-2.5 px-1">
          <!-- 麦克风放大在左侧垂直居中并保持呼吸闪烁 -->
          <div class="flex flex-col items-center justify-center flex-shrink-0">
            <svg class="mic-pulse-icon w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            <span class="text-[7px] font-black text-white/60 uppercase tracking-widest mt-0.5">LIVE</span>
          </div>
          <!-- 台词正文 -->
          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex items-center gap-1 mb-0.5">
              <span class="text-[7px] font-bold text-amber-300 uppercase tracking-wider">ON AIR</span>
              <span id="speechActionTag" class="text-[8px] text-white/70 font-medium truncate"></span>
            </div>
            <p id="speechContentText" class="text-xs font-medium text-white leading-relaxed max-h-12 overflow-y-auto no-scrollbar break-words">
              欢迎来到直播间！
            </p>
          </div>
        </div>
      </div>

      <!-- 送礼大型流光横幅 -->
      <div class="gift-banner-float-top" id="giftBannerTrack"></div>

      <!-- 弹幕列表视口 (铺满公屏区，顶部羽化) -->
      <div id="danmakuFeed" class="danmaku-stream-viewport"></div>

      <!-- 移至说话框下方的悬浮加号按钮 -->
      <button id="mainPlusBtn" onclick="togglePlusDrawer()" class="ui-plus-btn-sub" title="更多操作">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>

      <!-- 纯悬浮 UI 控件：长条输入框 + 40px 纯黑白磨砂发送按钮 -->
      <div class="ui-input-bar-float">
        <input id="inputDanmaku" type="text" placeholder="发条弹幕互动..." onkeydown="if(event.key==='Enter') sendUserDanmaku()">
        <button onclick="sendUserDanmaku()" class="zb-send-btn-bw" title="发送">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>

      <!-- 从加号正下方依次弹出的操作菜单 (啵啵啵向下依次展开) -->
      <div id="plusDrawerSheet" class="plus-drawer-bottom-sheet">
        <button onclick="handleDrawerAction('share')" class="bottom-drawer-btn" title="分享直播" style="--i:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          <span>分享动态</span>
        </button>
        <button onclick="handleDrawerAction('gift')" class="bottom-drawer-btn" title="赠送礼物" style="--i:1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
          <span>送出礼物</span>
        </button>
        <button onclick="handleDrawerAction('quality')" class="bottom-drawer-btn" title="画质调节" style="--i:2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          <span>画质调节</span>
        </button>
        <button onclick="handleDrawerAction('call')" class="bottom-drawer-btn" title="连麦互动" style="--i:3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
          <span>连麦互动</span>
        </button>
        <button onclick="handleDrawerAction('clear')" class="bottom-drawer-btn" title="清空公屏" style="--i:4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>清空公屏</span>
        </button>
      </div>

      <!-- 全屏礼物特效图层 (仅 User / Char 触发) -->
      <div id="liveFullscreenFxLayer" class="fullscreen-gift-fx-layer hidden"></div>

      <!-- 抖音同款右下角连击悬浮圆圈 -->
      <div id="liveComboCircleBtn" class="live-combo-circle-btn" onclick="handleComboCircleClick()">
        <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3.5"></circle>
          <circle id="comboProgressCircle" cx="32" cy="32" r="28" fill="none" stroke="#fbbf24" stroke-width="3.5" stroke-dasharray="175.9" stroke-dashoffset="0" stroke-linecap="round"></circle>
        </svg>
        <div class="relative z-10 flex flex-col items-center justify-center leading-none">
          <span class="text-[9px] font-black text-amber-300 uppercase tracking-wider drop-shadow">COMBO</span>
          <span id="comboCounterNumber" class="text-sm font-black text-white italic drop-shadow-md">x1</span>
        </div>
      </div>

      <!-- 底部礼物滑动抽屉 -->
      <div id="giftTrayModal" class="gift-sheet-modal">
        <div class="flex justify-between items-center pb-2.5 border-b border-white/10 mb-2.5 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div>
              <h4 class="text-xs font-bold text-white">赠送支持礼物</h4>
              <p class="text-[10px] text-amber-300 font-bold mt-0.5" id="giftWalletBalance">💎 0 LUMA 币</p>
            </div>
            <button onclick="openRechargeModal()" class="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-black shadow-sm active:scale-95 transition flex items-center gap-1">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>充值</span>
            </button>
          </div>
          <button onclick="toggleGiftTray()" class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-black">✕</button>
        </div>

        <!-- 数量快捷选择框 (1, 10, 52, 99, 1314) -->
        <div class="grid grid-cols-5 gap-1.5 mb-2.5 flex-shrink-0">
          <button onclick="selectGiftQuantity(1)" id="gift-qty-1" class="gift-qty-btn active">1</button>
          <button onclick="selectGiftQuantity(10)" id="gift-qty-10" class="gift-qty-btn">10</button>
          <button onclick="selectGiftQuantity(52)" id="gift-qty-52" class="gift-qty-btn">52</button>
          <button onclick="selectGiftQuantity(99)" id="gift-qty-99" class="gift-qty-btn">99</button>
          <button onclick="selectGiftQuantity(1314)" id="gift-qty-1314" class="gift-qty-btn">1314</button>
        </div>

        <div class="gift-scroll-grid" id="giftScrollGrid"></div>
      </div>
  </div>

  <div id="playerLiveRoomView" class="full-page-view hidden bg-[#080c14] text-white">
    <div class="page-nav-bar bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div class="flex items-center gap-3">
        <button onclick="closePlayerLiveView()" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div>
          <h3 class="text-xs font-black text-white">我要开播</h3>
          <p class="text-[8px] text-rose-400 uppercase tracking-wider">CREATOR STUDIO</p>
        </div>
      </div>
      <span class="text-[9px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">ON AIR 准备中</span>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div class="w-24 h-24 rounded-full border-2 border-dashed border-rose-500 flex items-center justify-center text-3xl">🎙️</div>
      <div>
        <h3 class="text-sm font-black">创作者直播间模块</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">你的专属直播间推流骨架已就绪，角色查房与互动逻辑待填充！</p>
      </div>
      <button onclick="closePlayerLiveView()" class="btn-brand text-xs !py-2 !px-6">返回主页</button>
    </div>
  </div>
  `);
})();
