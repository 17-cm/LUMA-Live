// =========================================================================
// 【直播间状态与全息连接过渡模块】LIVE/直播/room_loading.js
// 包含：进房全息连接与弹幕打包加载、API状态检测、双金边退出按键、下播驻留离场过渡
// =========================================================================

(function initRoomLoadingModule() {
  // 1. 注入全息过渡与高奢双金边专属样式
  const styleEl = document.createElement('style');
  styleEl.id = 'luma-room-transition-style';
  styleEl.textContent = `
    .room-transition-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at 50% 40%, #0d1527 0%, #070a14 55%, #020408 100%);
      z-index: 150;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: calc(env(safe-area-inset-top, 24px) + 16px) 20px calc(env(safe-area-inset-bottom, 24px) + 24px);
      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    }

    .room-transition-overlay.hidden {
      display: none !important;
    }

    .room-transition-overlay.fade-out {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }

    /* 屏幕中心头像周围的晕染与多层呼吸光晕 */
    .room-ambient-diffusion {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(244, 63, 94, 0.32) 0%, rgba(168, 85, 247, 0.25) 40%, rgba(6, 182, 212, 0.12) 70%, transparent 85%);
      filter: blur(32px);
      border-radius: 9999px;
      pointer-events: none;
      animation: roomDiffusionPulse 3.5s ease-in-out infinite alternate;
      z-index: 1;
    }

    @keyframes roomDiffusionPulse {
      0% {
        transform: translate(-50%, -50%) scale(0.85);
        opacity: 0.55;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.18);
        opacity: 0.95;
        filter: blur(38px);
      }
      100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.7;
      }
    }

    .room-char-avatar-box {
      position: relative;
      z-index: 10;
      width: 96px;
      height: 96px;
      border-radius: 9999px;
      padding: 3px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(244, 63, 94, 0.8) 50%, rgba(168, 85, 247, 0.8) 100%);
      box-shadow: 0 0 28px rgba(244, 63, 94, 0.45), 0 0 50px rgba(168, 85, 247, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: roomAvatarFloat 4s ease-in-out infinite alternate;
    }

    @keyframes roomAvatarFloat {
      0% { transform: translateY(0); }
      100% { transform: translateY(-6px); }
    }

    .room-char-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.85);
    }

    /* 三个点的呼吸加载样式 */
    .loading-dots span {
      display: inline-block;
      animation: loadingDotPulse 1.4s infinite ease-in-out both;
      font-size: 16px;
      line-height: 1;
    }
    .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
    .loading-dots span:nth-child(3) { animation-delay: 0s; }

    @keyframes loadingDotPulse {
      0%, 80%, 100% {
        opacity: 0.2;
        transform: scale(0.8);
      }
      40% {
        opacity: 1;
        transform: scale(1.3);
        color: #f43f5e;
      }
    }

    /* 高奢金色双边框退出按钮 (双层金边，黑底白字) */
    .btn-gold-double-border {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 3px;
      background: linear-gradient(135deg, #fef08a 0%, #eab308 30%, #ca8a04 70%, #fef08a 100%);
      border-radius: 9999px;
      box-shadow: 0 0 16px rgba(234, 179, 8, 0.35), 0 4px 14px rgba(0, 0, 0, 0.6);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      border: none;
      outline: none;
    }

    .btn-gold-double-border:active {
      transform: scale(0.96);
      box-shadow: 0 0 10px rgba(234, 179, 8, 0.25);
    }

    .btn-gold-double-border-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 28px;
      background: #06080e;
      border: 1.5px solid rgba(253, 224, 71, 0.85);
      border-radius: 9999px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.8);
    }

    /* 次级重试按钮 */
    .btn-retry-hologram {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 22px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-retry-hologram:active {
      background: rgba(255, 255, 255, 0.16);
      transform: scale(0.96);
    }
  `;
  document.head.appendChild(styleEl);

  // 2. 创建或获取全局全息过渡浮层 DOM
  function getTransitionOverlay() {
    let overlay = document.getElementById('liveRoomTransitionOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'liveRoomTransitionOverlay';
      overlay.className = 'room-transition-overlay hidden';
      overlay.innerHTML = `
        <!-- 顶部栏：左侧小头像与关注胶囊，右侧退出叉号 -->
        <div class="w-full flex items-center justify-between z-20">
          <div class="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 pr-3 rounded-full border border-white/15 shadow-lg">
            <div class="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 flex-shrink-0">
              <img id="transTopAvatar" src="" class="w-full h-full rounded-full object-cover border border-white/80">
            </div>
            <div class="flex flex-col min-w-0 pr-1">
              <div class="flex items-center gap-1">
                <span id="transTopName" class="text-xs font-black text-white truncate max-w-[80px]">主播</span>
                <span class="w-3 h-3 rounded-full bg-amber-400 text-slate-950 font-black text-[7px] flex items-center justify-center">V</span>
              </div>
              <span id="transTopTag" class="text-[8px] text-slate-400 font-bold truncate max-w-[70px]">直播中</span>
            </div>
            <button id="transBtnFollow" onclick="handleTransitionFollowClick()" class="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm active:scale-95 transition">
              + 关注
            </button>
          </div>

          <button onclick="handleTransitionExitClick()" class="w-8 h-8 rounded-full bg-slate-900/70 border border-white/15 text-white/80 flex items-center justify-center active:scale-95 transition backdrop-blur-md" title="关闭">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- 屏幕中心：头像与晕染光环 + 状态信息区 -->
        <div class="flex flex-col items-center justify-center relative my-auto z-10 space-y-5">
          <!-- 晕染光晕背景 -->
          <div class="room-ambient-diffusion"></div>

          <!-- 中心 Char 头像 -->
          <div class="room-char-avatar-box">
            <img id="transCenterAvatar" src="" class="room-char-avatar-img">
          </div>

          <!-- 状态文字与加载器 -->
          <div id="transStatusBox" class="text-center px-4 space-y-1.5 relative z-10 max-w-xs">
            <!-- 动态状态标题与副标题 -->
            <div id="transTitleEl" class="text-white text-sm font-black tracking-wide flex items-center justify-center gap-1">
              <span>正在进入直播间</span>
              <span class="loading-dots"><span class="dot-1">.</span><span class="dot-2">.</span><span class="dot-3">.</span></span>
            </div>
            <p id="transSubtitleEl" class="text-[11px] text-slate-400 font-medium tracking-wider">
              正在同步弹幕包与检测全息神经连接
            </p>
          </div>
        </div>

        <!-- 底部操作区 (动态根据状态呈现：加载中、连接失败、主播已离线) -->
        <div id="transActionsBox" class="w-full flex flex-col items-center justify-center gap-3 z-20 pb-4">
          <!-- 动态注入按钮 -->
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // 3. 当前过渡态控制器
  let currentTransitionSession = null;
  let connectingTimeoutId = null;

  /**
   * 启动进房全息过渡与弹幕打包加载检测
   * @param {Object} session - 直播会话对象
   * @param {Function} onSuccessCallback - 成功进入直播间的回调
   */
  async function launchRoomConnectingStage(session, onSuccessCallback) {
    if (!session) return;
    currentTransitionSession = session;

    const overlay = getTransitionOverlay();
    overlay.classList.remove('hidden', 'fade-out');

    // 填充左上角与中心头像
    const avatarUrl = session.avatar || (session.cover || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
    const nameStr = session.name || '主播';
    const tagStr = session.subTag || session.category || '新人主播';

    const topAvatar = document.getElementById('transTopAvatar');
    const topName = document.getElementById('transTopName');
    const topTag = document.getElementById('transTopTag');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const followBtn = document.getElementById('transBtnFollow');

    if (topAvatar) topAvatar.src = avatarUrl;
    if (centerAvatar) centerAvatar.src = avatarUrl;
    if (topName) topName.textContent = nameStr;
    if (topTag) topTag.textContent = tagStr;

    // 关注状态同步
    const isFollowed = (window.followedHosts || []).includes(session.characterId);
    if (followBtn) {
      followBtn.textContent = isFollowed ? '已关注' : '+ 关注';
      if (isFollowed) {
        followBtn.className = 'bg-slate-700 text-slate-300 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm';
      } else {
        followBtn.className = 'bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm active:scale-95 transition';
      }
    }

    // 设置状态 1: 正在进入直播间...
    renderTransitionState('connecting');

    if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

    // 开始执行全息弹幕打包与 API 连接检测
    try {
      // 预估打包时长 (800ms ~ 1600ms)
      const fetchPromise = (async () => {
        // 调用底层 AI / 网关检测
        if (typeof window.aiGenerate === 'function') {
          return await window.aiGenerate({
            characterId: session.characterId,
            appTags: ['live', 'package', 'ping'],
            instruction: `当前频道：${session.category}，检测并准备直播弹幕包`
          });
        }
        return { text: '{"danmakus":[],"hostSpeeches":[]}' };
      })();

      const timeoutPromise = new Promise((_, reject) => {
        connectingTimeoutId = setTimeout(() => {
          reject(new Error("CONNECT_TIMEOUT"));
        }, 12000);
      });

      // 竞态检测 (至少停留 900ms 展现精致全息进入动画)
      const minDelayPromise = new Promise(r => setTimeout(r, 950));
      const [res] = await Promise.all([
        Promise.race([fetchPromise, timeoutPromise]),
        minDelayPromise
      ]);

      if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

      // 解析返回数据包，如果成功拿到则填充到弹幕池
      if (res && res.text) {
        const parsed = (typeof window.extractJsonFromText === 'function') ? window.extractJsonFromText(res.text) : null;
        if (parsed) {
          if (parsed.danmakus && Array.isArray(parsed.danmakus) && window.danmakuPool) {
            window.danmakuPool.push(...parsed.danmakus);
          }
          if (parsed.hostSpeeches && Array.isArray(parsed.hostSpeeches) && window.hostSpeechPool) {
            window.hostSpeechPool.push(...parsed.hostSpeeches);
          }
        }
      }

      // 连接成功！平滑淡出全息层，进入真实直播间
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('fade-out');
        if (typeof onSuccessCallback === 'function') {
          onSuccessCallback();
        }
      }, 350);

    } catch (err) {
      if (connectingTimeoutId) clearTimeout(connectingTimeoutId);
      console.warn("直播间连接与打包检测失败:", err);
      // 切换至状态 2: 网络连接失败
      renderTransitionState('failed', session, onSuccessCallback);
    }
  }

  /**
   * 渲染不同过渡态视图与按键
   */
  function renderTransitionState(state, session, callback) {
    const statusBox = document.getElementById('transStatusBox');
    const actionsBox = document.getElementById('transActionsBox');
    if (!statusBox || !actionsBox) return;

    if (state === 'connecting') {
      statusBox.innerHTML = `
        <div class="text-white text-sm font-black tracking-wide flex items-center justify-center gap-1">
          <span>正在进入直播间</span>
          <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
        <p class="text-[11px] text-slate-400 font-medium tracking-wider mt-1">
          正在打包同步弹幕流与检测全息神经连接
        </p>
      `;
      actionsBox.innerHTML = `
        <span class="text-[10px] font-bold text-slate-500 tracking-widest uppercase animate-pulse">Connecting Cyber Stream...</span>
      `;
    } else if (state === 'failed') {
      statusBox.innerHTML = `
        <div class="text-rose-400 text-sm font-black tracking-wide flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>网络连接失败，请重试…</span>
        </div>
        <p class="text-[11px] text-slate-400 font-medium tracking-wider mt-1">
          全息神经连接超时，请检查您的网络或自定义API设置
        </p>
      `;

      actionsBox.innerHTML = `
        <div class="flex items-center gap-3">
          <button onclick="handleTransitionRetryClick()" class="btn-retry-hologram">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
            <span>重试连接</span>
          </button>

          <!-- 金色双边框黑底白字退出按键 -->
          <button onclick="handleTransitionExitClick()" class="btn-gold-double-border">
            <div class="btn-gold-double-border-inner">
              <svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <span>退出房间</span>
            </div>
          </button>
        </div>
      `;
    } else if (state === 'host_left') {
      statusBox.innerHTML = `
        <div class="text-amber-300 text-sm font-black tracking-wide flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4 text-amber-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
          <span>主播已离开房间…</span>
        </div>
        <p class="text-[11px] text-slate-400 font-medium tracking-wider mt-1">
          本次全息直播已圆满下播，期待与主播下次相遇~
        </p>
      `;

      actionsBox.innerHTML = `
        <!-- 金色双边框黑底白字退出按键 -->
        <button onclick="handleTransitionExitClick()" class="btn-gold-double-border">
          <div class="btn-gold-double-border-inner">
            <svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>退出房间</span>
          </div>
        </button>
      `;
    }
  }

  /**
   * 当主播在直播间中途下播时的驻留画面
   */
  function showHostLeftRoomStage(session) {
    const s = session || window.currentRoom;
    if (!s) return;
    currentTransitionSession = s;

    const overlay = getTransitionOverlay();
    overlay.classList.remove('hidden', 'fade-out');

    const avatarUrl = s.avatar || (s.cover || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
    const topAvatar = document.getElementById('transTopAvatar');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const topName = document.getElementById('transTopName');
    const topTag = document.getElementById('transTopTag');

    if (topAvatar) topAvatar.src = avatarUrl;
    if (centerAvatar) centerAvatar.src = avatarUrl;
    if (topName) topName.textContent = s.name || '主播';
    if (topTag) topTag.textContent = '已下播';

    renderTransitionState('host_left', s);
  }

  // 4. 用户交互处理函数
  function handleTransitionExitClick() {
    const overlay = document.getElementById('liveRoomTransitionOverlay');
    if (overlay) overlay.classList.add('hidden');
    if (typeof window.closeLiveRoom === 'function') {
      window.closeLiveRoom();
    }
  }

  function handleTransitionRetryClick() {
    if (currentTransitionSession) {
      launchRoomConnectingStage(currentTransitionSession, () => {
        if (typeof window.enterLiveRoomDirectly === 'function') {
          window.enterLiveRoomDirectly(currentTransitionSession.id);
        }
      });
    }
  }

  async function handleTransitionFollowClick() {
    if (!currentTransitionSession) return;
    const charId = currentTransitionSession.characterId;
    const followBtn = document.getElementById('transBtnFollow');

    if (typeof window.toggleFollowRoomHost === 'function') {
      await window.toggleFollowRoomHost();
      const isFollowed = (window.followedHosts || []).includes(charId);
      if (followBtn) {
        followBtn.textContent = isFollowed ? '已关注' : '+ 关注';
        if (isFollowed) {
          followBtn.className = 'bg-slate-700 text-slate-300 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm';
        } else {
          followBtn.className = 'bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm active:scale-95 transition';
        }
      }
    }
  }

  window.launchRoomConnectingStage = launchRoomConnectingStage;
  window.showHostLeftRoomStage = showHostLeftRoomStage;
  window.handleTransitionExitClick = handleTransitionExitClick;
  window.handleTransitionRetryClick = handleTransitionRetryClick;
  window.handleTransitionFollowClick = handleTransitionFollowClick;
})();
