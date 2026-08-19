// =========================================================================
// 【直播间状态与全息连接过渡模块】LIVE/直播/room_loading.js
// 包含：网易云全屏晕染背景、唱片级立绘、抖音风左上角主播栏、双细线暗金边退出按键
// =========================================================================

(function initRoomLoadingModule() {
  // 1. 注入网易云全屏晕染背景与 #CD853F 双细线专属样式
  const styleEl = document.createElement('style');
  styleEl.id = 'luma-room-transition-style';
  styleEl.textContent = `
    .room-transition-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 150;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s ease-out;
      background-color: #05070c;
    }

    .room-transition-overlay.hidden {
      display: none !important;
    }

    .room-transition-overlay.fade-out {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }

    /* 网易云全屏背景晕染层 */
    .room-full-diffusion-bg {
      position: absolute;
      inset: -30px;
      background-size: cover;
      background-position: center;
      filter: blur(55px) brightness(0.32) saturate(1.35);
      transform: scale(1.2);
      z-index: 1;
      pointer-events: none;
      transition: background-image 0.5s ease;
    }

    /* 全屏径向压暗与暗角遮罩 */
    .room-vignette-mask {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 48%, rgba(8, 10, 15, 0.35) 0%, rgba(4, 5, 8, 0.8) 65%, #020306 100%);
      z-index: 2;
      pointer-events: none;
    }

    /* 抖音风格左上角主播信息栏 */
    .douyin-host-capsule {
      position: absolute;
      top: 32px;
      left: 16px;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(0, 0, 0, 0.48);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 0.8px solid rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
      padding: 3px 6px 3px 3px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      max-width: calc(100vw - 32px);
    }

    .douyin-avatar-wrap {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    .douyin-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 1.5px solid rgba(255, 255, 255, 0.85);
    }

    .douyin-badge-v {
      position: absolute;
      bottom: -1px;
      right: -1px;
      width: 13px;
      height: 13px;
      border-radius: 9999px;
      background: #f59e0b;
      color: #000;
      font-size: 8px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #fff;
    }

    .douyin-host-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding-right: 2px;
    }

    .douyin-host-name {
      font-size: 12px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    .douyin-host-sub {
      font-size: 9px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
    }

    .douyin-btn-follow {
      background: #fe2c55;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 9999px;
      border: none;
      outline: none;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(254, 44, 85, 0.45);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .douyin-btn-follow:active {
      transform: scale(0.94);
    }

    .douyin-btn-follow.followed {
      background: rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.85);
      box-shadow: none;
    }

    /* 网易云唱片级中心大头像 */
    .vinyl-stage-box {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .vinyl-disc-frame {
      width: clamp(190px, 54vw, 224px);
      height: clamp(190px, 54vw, 224px);
      border-radius: 9999px;
      padding: 10px;
      background: radial-gradient(circle, #242730 0%, #13161f 55%, #080a0f 85%, #040508 100%);
      box-shadow: 0 16px 45px rgba(0, 0, 0, 0.8), 0 0 45px rgba(205, 133, 63, 0.22);
      border: 1.5px solid rgba(205, 133, 63, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      animation: vinylFloatBreath 4s ease-in-out infinite alternate;
    }

    @keyframes vinylFloatBreath {
      0% {
        transform: translateY(0) scale(1);
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.8), 0 0 35px rgba(205, 133, 63, 0.18);
      }
      100% {
        transform: translateY(-6px) scale(1.015);
        box-shadow: 0 22px 55px rgba(0, 0, 0, 0.9), 0 0 55px rgba(205, 133, 63, 0.32);
      }
    }

    .vinyl-inner-avatar {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.88);
    }

    /* 状态提示文案区 (紧贴唱片下方) */
    .room-status-content-flow {
      position: relative;
      z-index: 10;
      margin-top: 26px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 24px;
    }

    .status-main-headline {
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.5;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    /* 三个点跳动加载效果 */
    .loading-dots-clean span {
      display: inline-block;
      animation: cleanDotJump 1.4s infinite ease-in-out both;
      font-size: 14px;
      font-weight: 700;
    }
    .loading-dots-clean span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots-clean span:nth-child(2) { animation-delay: -0.16s; }
    .loading-dots-clean span:nth-child(3) { animation-delay: 0s; }

    @keyframes cleanDotJump {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
      40% { opacity: 1; transform: scale(1.2); color: #CD853F; }
    }

    /* #CD853F 双细线金色边框按键 (外1px细线 + 2px暗隙 + 内1px细线，纯黑底白字，无图标) */
    .btn-bronze-double-border {
      position: relative;
      margin-top: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      background: transparent;
      border: 1px solid #CD853F;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      border-style: solid;
      outline: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(205, 133, 63, 0.25);
    }

    .btn-bronze-double-border:active {
      transform: scale(0.96);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .btn-bronze-double-border-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 30px;
      background: #06080d;
      border: 1px solid #CD853F;
      border-radius: 9999px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    }
  `;
  document.head.appendChild(styleEl);

  // 2. 获取或创建过渡 DOM 结构
  function getTransitionOverlay() {
    let overlay = document.getElementById('liveRoomTransitionOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'liveRoomTransitionOverlay';
      overlay.className = 'room-transition-overlay hidden';
      overlay.innerHTML = `
        <!-- 网易云全屏背景晕染层与遮罩 -->
        <div id="transFullDiffusionBg" class="room-full-diffusion-bg"></div>
        <div class="room-vignette-mask"></div>

        <!-- 抖音风格左上角主播信息栏 (往下移，不避让状态栏) -->
        <div class="douyin-host-capsule">
          <div class="douyin-avatar-wrap">
            <img id="transTopAvatar" src="" class="douyin-avatar-img">
            <span class="douyin-badge-v">V</span>
          </div>
          <div class="douyin-host-meta">
            <span id="transTopName" class="douyin-host-name">主播</span>
            <span id="transTopSub" class="douyin-host-sub">1.2w 在看</span>
          </div>
          <button id="transBtnFollow" onclick="handleTransitionFollowClick()" class="douyin-btn-follow">
            + 关注
          </button>
        </div>

        <!-- 网易云唱片级中心大头像舞台 -->
        <div class="vinyl-stage-box">
          <div class="vinyl-disc-frame">
            <img id="transCenterAvatar" src="" class="vinyl-inner-avatar">
          </div>
        </div>

        <!-- 状态提示与退出按键区域 (紧贴在文字下方) -->
        <div id="transStatusFlowBox" class="room-status-content-flow">
          <!-- 动态注入状态与退出按键 -->
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // 3. 全局控制器与状态维护
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

    // 填充头像与背景
    const avatarUrl = session.avatar || (session.cover || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500');
    const nameStr = session.name || '主播';
    const viewersCount = (typeof window.getLiveSessionViewers === 'function') ? window.getLiveSessionViewers(session) : 1200;
    const viewersStr = viewersCount > 10000 ? (viewersCount / 10000).toFixed(1) + 'w 在看' : `${viewersCount} 在看`;

    const fullBg = document.getElementById('transFullDiffusionBg');
    const topAvatar = document.getElementById('transTopAvatar');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const topName = document.getElementById('transTopName');
    const topSub = document.getElementById('transTopSub');
    const followBtn = document.getElementById('transBtnFollow');

    if (fullBg) fullBg.style.backgroundImage = `url('${avatarUrl}')`;
    if (topAvatar) topAvatar.src = avatarUrl;
    if (centerAvatar) centerAvatar.src = avatarUrl;
    if (topName) topName.textContent = nameStr;
    if (topSub) topSub.textContent = viewersStr;

    // 关注状态同步
    const isFollowed = (window.followedHosts || []).includes(session.characterId);
    if (followBtn) {
      followBtn.textContent = isFollowed ? '已关注' : '+ 关注';
      if (isFollowed) {
        followBtn.classList.add('followed');
      } else {
        followBtn.classList.remove('followed');
      }
    }

    // 状态：正在进入直播间…
    renderTransitionState('connecting');

    if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

    // 检查 API 配置状态以精准判定网络失败类型
    const customCfg = window.customApiConfig || {};
    const hasConfiguredApi = !!(customCfg.apiKey || customCfg.endpoint);

    try {
      // 离线/未联网检测
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error("NO_NETWORK_DISCONNECTED");
      }

      // 执行打包与连通性检测
      const fetchPromise = (async () => {
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
          reject(new Error("TIMEOUT_ERROR"));
        }, 10000);
      });

      // 保持最少 900ms 丝滑黑胶进房体验
      const minDelayPromise = new Promise(r => setTimeout(r, 900));
      const [res] = await Promise.all([
        Promise.race([fetchPromise, timeoutPromise]),
        minDelayPromise
      ]);

      if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

      // 解析弹幕包注入弹幕池
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

      // 成功进入：平滑淡出全息层
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
      console.warn("进房连接检测:", err);

      const errMsg = String(err?.message || '');
      // 第一种情况：连接了API，但返回失败/请求超时 (网络连接超时，请重试)
      // 第二种情况：没有配置API或完全断网 (网络连接失败，请检查你的网络环境。)
      if (hasConfiguredApi || errMsg.includes('TIMEOUT')) {
        renderTransitionState('timeout');
      } else {
        renderTransitionState('network_error');
      }
    }
  }

  /**
   * 渲染状态文案与 #CD853F 双细线退出按键
   */
  function renderTransitionState(state) {
    const flowBox = document.getElementById('transStatusFlowBox');
    if (!flowBox) return;

    if (state === 'connecting') {
      flowBox.innerHTML = `
        <div class="status-main-headline">
          <span>正在进入直播间</span>
          <span class="loading-dots-clean"><span>.</span><span>.</span><span>.</span></span>
        </div>
      `;
    } else if (state === 'timeout') {
      flowBox.innerHTML = `
        <div class="status-main-headline text-rose-300">
          <span>网络连接超时，请重试</span>
        </div>
        <button onclick="handleTransitionExitClick()" class="btn-bronze-double-border">
          <div class="btn-bronze-double-border-inner">
            <span>退出直播间</span>
          </div>
        </button>
      `;
    } else if (state === 'network_error') {
      flowBox.innerHTML = `
        <div class="status-main-headline text-rose-300">
          <span>网络连接失败，请检查你的网络环境。</span>
        </div>
        <button onclick="handleTransitionExitClick()" class="btn-bronze-double-border">
          <div class="btn-bronze-double-border-inner">
            <span>退出直播间</span>
          </div>
        </button>
      `;
    } else if (state === 'host_left') {
      flowBox.innerHTML = `
        <div class="status-main-headline text-amber-200">
          <span>主播已离开房间…</span>
        </div>
        <button onclick="handleTransitionExitClick()" class="btn-bronze-double-border">
          <div class="btn-bronze-double-border-inner">
            <span>退出直播间</span>
          </div>
        </button>
      `;
    }
  }

  /**
   * 主播下播时的停留画面
   */
  function showHostLeftRoomStage(session) {
    const s = session || window.currentRoom;
    if (!s) return;
    currentTransitionSession = s;

    const overlay = getTransitionOverlay();
    overlay.classList.remove('hidden', 'fade-out');

    const avatarUrl = s.avatar || (s.cover || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500');
    const fullBg = document.getElementById('transFullDiffusionBg');
    const topAvatar = document.getElementById('transTopAvatar');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const topName = document.getElementById('transTopName');
    const topSub = document.getElementById('transTopSub');

    if (fullBg) fullBg.style.backgroundImage = `url('${avatarUrl}')`;
    if (topAvatar) topAvatar.src = avatarUrl;
    if (centerAvatar) centerAvatar.src = avatarUrl;
    if (topName) topName.textContent = s.name || '主播';
    if (topSub) topSub.textContent = '已下播';

    renderTransitionState('host_left');
  }

  // 4. 用户交互处理函数
  function handleTransitionExitClick() {
    const overlay = document.getElementById('liveRoomTransitionOverlay');
    if (overlay) overlay.classList.add('hidden');
    if (typeof window.closeLiveRoom === 'function') {
      window.closeLiveRoom();
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
          followBtn.classList.add('followed');
        } else {
          followBtn.classList.remove('followed');
        }
      }
    }
  }

  window.launchRoomConnectingStage = launchRoomConnectingStage;
  window.showHostLeftRoomStage = showHostLeftRoomStage;
  window.handleTransitionExitClick = handleTransitionExitClick;
  window.handleTransitionFollowClick = handleTransitionFollowClick;
})();
