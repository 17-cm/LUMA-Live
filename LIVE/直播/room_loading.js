// =========================================================================
// 【直播间状态与全息连接过渡模块】LIVE/直播/room_loading.js
// 包含：方案1【纯正高斯模糊毛玻璃背景扩散】、唱片级头像、三层浅红细圈步进扩散、
// 抖音高仿豪华主播栏（粉丝团/榜单/小心心/关注）、#A0B0BD 字体、#CD853F 双细线暗金边退出按键
// =========================================================================

(function initRoomLoadingModule() {
  // 1. 注入样式
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
      background-color: #030508;
    }

    .room-transition-overlay.hidden {
      display: none !important;
    }

    .room-transition-overlay.fade-out {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }

    /* 方案 1：全屏高斯模糊毛玻璃背景 */
    .room-gaussian-blur-bg {
      position: absolute;
      inset: -40px;
      background-size: cover;
      background-position: center;
      filter: blur(48px) brightness(0.4) saturate(1.4);
      -webkit-filter: blur(48px) brightness(0.4) saturate(1.4);
      transform: scale(1.25);
      z-index: 1;
      pointer-events: none;
      transition: background-image 0.4s ease;
    }

    /* 柔和暗角压暗遮罩 */
    .room-vignette-mask {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 50%, rgba(3, 5, 8, 0.25) 0%, rgba(2, 3, 5, 0.75) 70%, #010204 100%);
      z-index: 2;
      pointer-events: none;
    }

    /* 抖音风格左上角丰富的主播互动胶囊群 (进一步高仿豪华版) */
    .douyin-top-bar-cluster {
      position: absolute;
      top: max(var(--ai-phone-app-safe-top, 56px), 56px);
      left: 14px;
      right: 14px;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: auto;
    }

    .douyin-host-capsule {
      display: flex;
      align-items: center;
      gap: 9px;
      background: rgba(10, 12, 20, 0.55);
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9999px;
      padding: 4px 14px 4px 4px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.08);
      max-width: calc(100vw - 110px);
    }

    .douyin-avatar-wrap {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    .douyin-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 1.5px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }

    .douyin-live-ring {
      position: absolute;
      inset: -2.5px;
      border-radius: 9999px;
      border: 1.5px solid #fe2c55;
      animation: douyinLiveRingPulse 1.8s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes douyinLiveRingPulse {
      0%, 100% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.1); opacity: 0.4; }
    }

    .douyin-badge-v {
      position: absolute;
      bottom: -1px;
      right: -1px;
      width: 13px;
      height: 13px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #000;
      font-size: 8.5px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }

    .douyin-host-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding-right: 2px;
    }

    .douyin-name-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .douyin-host-name {
      font-size: 12px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 82px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    .douyin-level-tag {
      font-size: 8px;
      font-weight: 900;
      color: #ffd700;
      background: linear-gradient(135deg, #4338ca, #6366f1);
      padding: 0.5px 4px;
      border-radius: 3px;
      line-height: 1.1;
      border: 0.5px solid rgba(255, 215, 0, 0.6);
    }

    .douyin-sub-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 1.5px;
    }

    .douyin-host-sub {
      font-size: 9px;
      font-weight: 600;
      color: #A0B0BD;
      line-height: 1.1;
      white-space: nowrap;
    }

    .douyin-fans-club-tag {
      font-size: 8px;
      font-weight: 800;
      color: #ffedd5;
      background: linear-gradient(90deg, #f97316, #ea580c);
      padding: 0.5px 4.5px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 1.5px;
      line-height: 1.1;
      box-shadow: 0 1px 4px rgba(234, 88, 12, 0.4);
    }

    .douyin-city-tag {
      font-size: 8px;
      font-weight: 700;
      color: #A0B0BD;
      background: rgba(255, 255, 255, 0.12);
      padding: 0.5px 3.5px;
      border-radius: 3px;
      line-height: 1.1;
    }

    .douyin-btn-follow {
      background: linear-gradient(135deg, #fe2c55, #ff0050);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 9999px;
      border: none;
      outline: none;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 3px 10px rgba(254, 44, 85, 0.45), inset 0 1px 0 rgba(255,255,255,0.2);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 2px;
      letter-spacing: 0.5px;
    }

    .douyin-btn-follow:active {
      transform: scale(0.94);
      box-shadow: 0 1px 5px rgba(254, 44, 85, 0.3);
    }

    .douyin-btn-follow.followed {
      background: rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.9);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.15);
    }

    /* 抖音右侧榜单小头像组与热度胶囊 */
    .douyin-top-right-ranks {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .douyin-rank-avatars {
      display: flex;
      align-items: center;
    }

    .douyin-rank-user {
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.85);
      margin-left: -6px;
      object-fit: cover;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    .douyin-rank-user:first-child {
      margin-left: 0;
      border-color: #ffd700;
    }

    .douyin-heat-pill {
      display: flex;
      align-items: center;
      gap: 3px;
      background: rgba(10, 12, 20, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      padding: 5px 10px;
      color: #fbbf24;
      font-size: 10px;
      font-weight: 800;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      letter-spacing: 0.3px;
    }
    .douyin-heat-pill .heat-icon {
      font-size: 11px;
    }

    /* 核心舞台：包含高斯模糊毛玻璃空隙散开 + 三层浅红细圈向外步进扩散 */
    .avatar-stage-container {
      position: relative;
      z-index: 10;
      width: clamp(230px, 64vw, 270px);
      height: clamp(230px, 64vw, 270px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* 三个很细的浅红扩散光圈 (步进式向外蔓延) */
    .ripple-step-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 9999px;
      border: 1px solid rgba(248, 113, 113, 0.55);
      pointer-events: none;
      z-index: 3;
      animation: rippleStepSpread 3.6s cubic-bezier(0.1, 0.45, 0.3, 1) infinite;
    }

    .ripple-ring-1 {
      animation-delay: 0s;
    }
    .ripple-ring-2 {
      animation-delay: 1.2s;
    }
    .ripple-ring-3 {
      animation-delay: 2.4s;
    }

    @keyframes rippleStepSpread {
      0% {
        width: 170px;
        height: 170px;
        opacity: 0.85;
        border-color: rgba(248, 113, 113, 0.65);
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.35);
      }
      50% {
        opacity: 0.45;
        border-color: rgba(248, 113, 113, 0.35);
      }
      100% {
        width: 290px;
        height: 290px;
        opacity: 0;
        border-color: rgba(248, 113, 113, 0);
        box-shadow: 0 0 16px rgba(239, 68, 68, 0);
      }
    }

    /* 中心头像框（大唱片尺寸） */
    .avatar-crisp-frame {
      position: relative;
      width: clamp(180px, 50vw, 210px);
      height: clamp(180px, 50vw, 210px);
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }

    /* 方案 1：中间头像背后直接垫一层一模一样的头像，放大并施加高斯模糊（向外毛玻璃虚化晕散） */
    .avatar-gaussian-underlay {
      position: absolute;
      inset: -18px;
      border-radius: 9999px;
      background-size: cover;
      background-position: center;
      filter: blur(22px) brightness(1.05) saturate(1.6);
      -webkit-filter: blur(22px) brightness(1.05) saturate(1.6);
      opacity: 0.9;
      z-index: 1;
      animation: underlayPulse 3.8s ease-in-out infinite alternate;
    }

    @keyframes underlayPulse {
      0% {
        transform: scale(0.96);
        opacity: 0.75;
      }
      100% {
        transform: scale(1.06);
        opacity: 0.98;
        filter: blur(26px) brightness(1.15) saturate(1.8);
      }
    }

    /* 中间清晰的 Char 头像 */
    .avatar-crisp-img {
      position: relative;
      z-index: 10;
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.8);
    }

    /* 状态提示文案区 (紧贴头像下方) */
    .room-status-content-flow {
      position: relative;
      z-index: 10;
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 24px;
    }

    /* 中间一行字体：#A0B0BD 雅致淡蓝灰 */
    .status-custom-headline {
      color: #A0B0BD;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.5;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 12px rgba(160, 176, 189, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    /* #A0B0BD 跳动三点加载效果 */
    .loading-dots-custom span {
      display: inline-block;
      animation: customDotJump 1.4s infinite ease-in-out both;
      font-size: 15px;
      font-weight: 800;
      color: #A0B0BD;
    }
    .loading-dots-custom span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots-custom span:nth-child(2) { animation-delay: -0.16s; }
    .loading-dots-custom span:nth-child(3) { animation-delay: 0s; }

    @keyframes customDotJump {
      0%, 80%, 100% { opacity: 0.35; transform: scale(0.85); color: #718096; }
      40% { opacity: 1; transform: scale(1.25); color: #E2E8F0; }
    }

    /* #CD853F 双细线金色边框按键 (外1px细线 + 2px暗隙 + 内1px细线，纯黑底白字，无图标) */
    .btn-bronze-double-border {
      position: relative;
      margin-top: 20px;
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
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(205, 133, 63, 0.22);
    }

    .btn-bronze-double-border:active {
      transform: scale(0.96);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .btn-bronze-double-border-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 32px;
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
        <!-- 方案 1：全屏高斯模糊背景与暗角遮罩 -->
        <div id="transGaussianBg" class="room-gaussian-blur-bg"></div>
        <div class="room-vignette-mask"></div>

        <!-- 抖音高仿豪华主播栏群 (包含主播胶囊、等级、粉丝团标、榜单头像、小心心) -->
        <div class="douyin-top-bar-cluster">
          <div class="douyin-host-capsule">
            <div class="douyin-avatar-wrap">
              <div class="douyin-live-ring"></div>
              <img id="transTopAvatar" src="" class="douyin-avatar-img">
              <span class="douyin-badge-v">V</span>
            </div>
            <div class="douyin-host-meta">
              <div class="douyin-name-row">
                <span id="transTopName" class="douyin-host-name">主播</span>
                <span id="transTopLevel" class="douyin-level-tag">Lv.16</span>
              </div>
              <div class="douyin-sub-row">
                <span id="transTopSub" class="douyin-host-sub">1.2w 本场点赞</span>
                <span class="douyin-fans-club-tag">💖 粉丝团</span>
              </div>
            </div>
            <button id="transBtnFollow" onclick="handleTransitionFollowClick()" class="douyin-btn-follow">
              <span>+</span> 关注
            </button>
          </div>

          <div class="douyin-top-right-ranks">
            <div class="douyin-heat-pill">
              <span class="heat-icon">🔥</span>
              <span id="transTopHeat">8.6w</span>
            </div>
          </div>
        </div>

        <!-- 核心舞台：包含高斯模糊毛玻璃空隙散开 + 3层浅红细圈步进向外扩散 -->
        <div class="avatar-stage-container">
          <!-- 3 个浅红扩散细圈 -->
          <div class="ripple-step-ring ripple-ring-1"></div>
          <div class="ripple-step-ring ripple-ring-2"></div>
          <div class="ripple-step-ring ripple-ring-3"></div>

          <!-- 方案 1：头像背后高斯模糊垫层 + 中心清晰头像 -->
          <div class="avatar-crisp-frame">
            <div id="transGaussianUnderlay" class="avatar-gaussian-underlay"></div>
            <img id="transCenterAvatar" src="" class="avatar-crisp-img">
          </div>
        </div>

        <!-- 状态提示与退出按键区域 (紧贴在文字下方，#A0B0BD 字体) -->
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

    const gaussianBg = document.getElementById('transGaussianBg');
    const gaussianUnderlay = document.getElementById('transGaussianUnderlay');
    const topAvatar = document.getElementById('transTopAvatar');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const topName = document.getElementById('transTopName');
    const topSub = document.getElementById('transTopSub');
    const topLevel = document.getElementById('transTopLevel');
    const followBtn = document.getElementById('transBtnFollow');
    const heatEl = document.getElementById('transTopHeat');

    if (gaussianBg) gaussianBg.style.backgroundImage = `url('${avatarUrl}')`;
    if (gaussianUnderlay) gaussianUnderlay.style.backgroundImage = `url('${avatarUrl}')`;
    if (topAvatar) topAvatar.src = avatarUrl;
    if (centerAvatar) centerAvatar.src = avatarUrl;
    if (topName) topName.textContent = nameStr;
    if (topSub) topSub.textContent = viewersStr;
    if (topLevel) topLevel.textContent = `Lv.${(nameStr.length * 3 + 7) % 30 + 1}`;
    // 动态填充热度数据
    if (heatEl) {
      const heat = session.heat || viewersCount * 10 || 86000;
      const heatStr = heat > 10000 ? (heat / 10000).toFixed(1) + 'w' : String(heat);
      heatEl.textContent = heatStr;
    }

    // 关注状态同步
    const isFollowed = (window.followedHosts || []).includes(session.characterId);
    if (followBtn) {
      followBtn.innerHTML = isFollowed ? '已关注' : '<span>+</span> 关注';
      if (isFollowed) {
        followBtn.classList.add('followed');
      } else {
        followBtn.classList.remove('followed');
      }
    }

    // 状态：正在进入直播间… (#A0B0BD)
    renderTransitionState('connecting');

    if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

    // 检查 API 配置状态以精准判定网络失败类型
    const customCfg = window.customApiConfig || {};
    // 修复：正确判断是否已配置 API（支持全局模型 / 自定义 API Key / 自定义地址）
    const hasConfiguredApi = !!(
      customCfg.enableGlobalModel ||
      customCfg.text?.key ||
      customCfg.text?.url ||
      customCfg.apiKey ||
      customCfg.endpoint
    );

    try {
      // 离线/未联网检测
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error("NO_NETWORK_DISCONNECTED");
      }

      // 执行打包：在过渡期间预加载首包弹幕与主播台词，生成完成后直接进房
      // 采用 60 秒兜底超时（防止 API 真挂了用户一直卡着），正常生成不受时间限制
      const fetchPromise = (async () => {
        if (typeof window.aiGenerate === 'function') {
          return await window.aiGenerate({
            characterId: session.characterId,
            appTags: ['luma', 'stream', 'content'],
            instruction: `当前频道：${session.category || '综合'}（${session.subTag || '生活'}），标题：${session.topic || '直播间'}。${(typeof window.getLivePackagePrompt === 'function') ? window.getLivePackagePrompt() : '请生成观众弹幕（danmakus数组）和主播互动台词（hostSpeeches数组，每条包含speech和action字段）。返回JSON格式。'}`
          });
        }
        return { text: '{"danmakus":[],"hostSpeeches":[]}' };
      })();

      const timeoutPromise = new Promise((_, reject) => {
        connectingTimeoutId = setTimeout(() => {
          reject(new Error("TIMEOUT_ERROR"));
        }, 60000);
      });

      // 拿到响应或完成首包打包后立即进房，不人为堆叠任何多余延迟
      const res = await Promise.race([fetchPromise, timeoutPromise]);

      if (connectingTimeoutId) clearTimeout(connectingTimeoutId);

      // 解析弹幕包注入全局弹幕池与主播台词池，确保一进房弹幕就立刻满载滚动
      if (res && res.text) {
        const parsed = (typeof window.extractJsonFromText === 'function') ? window.extractJsonFromText(res.text) : null;
        if (parsed) {
          if (parsed.danmakus && Array.isArray(parsed.danmakus)) {
            window.danmakuPool = window.danmakuPool || [];
            window.danmakuPool.push(...parsed.danmakus);
          }
          if (parsed.hostSpeeches && Array.isArray(parsed.hostSpeeches)) {
            window.hostSpeechPool = window.hostSpeechPool || [];
            window.hostSpeechPool.push(...parsed.hostSpeeches);
          }
        }
      }

      // 成功进入：全息层立刻隐去进入直播间
      overlay.classList.add('hidden');
      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
      }

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
   * 渲染 #A0B0BD 状态文案与 #CD853F 双细线退出按键
   */
  function renderTransitionState(state) {
    const flowBox = document.getElementById('transStatusFlowBox');
    if (!flowBox) return;

    if (state === 'connecting') {
      flowBox.innerHTML = `
        <div class="status-custom-headline">
          <span>正在进入直播间</span>
          <span class="loading-dots-custom"><span>.</span><span>.</span><span>.</span></span>
        </div>
      `;
    } else if (state === 'timeout') {
      flowBox.innerHTML = `
        <div class="status-custom-headline">
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
        <div class="status-custom-headline">
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
        <div class="status-custom-headline">
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
    const gaussianBg = document.getElementById('transGaussianBg');
    const gaussianUnderlay = document.getElementById('transGaussianUnderlay');
    const topAvatar = document.getElementById('transTopAvatar');
    const centerAvatar = document.getElementById('transCenterAvatar');
    const topName = document.getElementById('transTopName');
    const topSub = document.getElementById('transTopSub');

    if (gaussianBg) gaussianBg.style.backgroundImage = `url('${avatarUrl}')`;
    if (gaussianUnderlay) gaussianUnderlay.style.backgroundImage = `url('${avatarUrl}')`;
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
    // 确保 followedHosts 是数组
    if (!Array.isArray(window.followedHosts)) window.followedHosts = [];
    const isFollowed = window.followedHosts.includes(charId);
    // 等待 api 对象可用
    let api = window.api || window.AiPhone || window.AiPhoneApp;
    let waitCount = 0;
    while (!api && waitCount < 30) {
      await new Promise(r => setTimeout(r, 50));
      api = window.api || window.AiPhone || window.AiPhoneApp;
      waitCount++;
    }
    if (isFollowed) {
      window.followedHosts = window.followedHosts.filter(id => id !== charId);
      if (api && api.db) await api.db.delete("follows", charId).catch(() => {});
      if (api && api.ui && api.ui.toast) api.ui.toast("已取消关注");
    } else {
      if (!window.followedHosts.includes(charId)) {
        window.followedHosts.push(charId);
      }
      if (api && api.db) await api.db.create("follows", { id: charId, timestamp: Date.now() }).catch(() => {});
      if (api && api.ui && api.ui.toast) api.ui.toast("关注成功！");
    }
    // 更新按钮状态
    const newIsFollowed = window.followedHosts.includes(charId);
    if (followBtn) {
      followBtn.innerHTML = newIsFollowed ? '已关注' : '<span>+</span> 关注';
      if (newIsFollowed) {
        followBtn.classList.add('followed');
      } else {
        followBtn.classList.remove('followed');
      }
    }
    // 更新关注人数显示
    const statEl = document.getElementById('statFollowCount');
    if (statEl) statEl.textContent = window.followedHosts.length + 1;
  }

  window.launchRoomConnectingStage = launchRoomConnectingStage;
  window.showHostLeftRoomStage = showHostLeftRoomStage;
  window.handleTransitionExitClick = handleTransitionExitClick;
  window.handleTransitionFollowClick = handleTransitionFollowClick;
})();
