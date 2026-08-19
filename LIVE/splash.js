/**
 * LUMA Live - 模拟开屏启动画面模块 (Splash Screen Module)
 * 纯独立模块，3.0秒冷启动模拟，LUMA 逐字显现与霓虹爆闪动效
 */

(function initSplashScreenModule() {
  // 注入启动页独立样式
  const styleEl = document.createElement('style');
  styleEl.id = 'luma-splash-style';
  styleEl.textContent = `
    #appSplashScreen {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at 50% 45%, #0f172a 0%, #050814 60%, #02040a 100%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: calc(env(safe-area-inset-top, 24px) + 16px) 24px calc(env(safe-area-inset-bottom, 24px) + 24px);
      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.55s ease-out;
    }

    #appSplashScreen.splash-exit {
      transform: scale(1.08);
      opacity: 0;
      pointer-events: none;
    }

    .splash-ambient-glow {
      position: absolute;
      top: 38%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(244, 63, 94, 0.18) 0%, rgba(139, 92, 246, 0.15) 45%, rgba(6, 182, 212, 0.08) 70%, transparent 85%);
      filter: blur(48px);
      pointer-events: none;
      animation: splashAmbientPulse 4s ease-in-out infinite alternate;
      z-index: 1;
    }

    @keyframes splashAmbientPulse {
      0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.6; }
      100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.95; }
    }

    .splash-brand-stage {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      margin-top: auto;
      margin-bottom: auto;
    }

    .splash-logo-letters {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', 'Cinzel', serif;
      font-size: clamp(54px, 14vw, 76px);
      font-weight: 900;
      font-style: italic;
      letter-spacing: 6px;
      position: relative;
    }

    .splash-char {
      display: inline-block;
      opacity: 0;
      transform: translateY(18px) scale(0.9);
      color: transparent;
      -webkit-text-stroke: 1.2px rgba(255, 255, 255, 0.25);
      filter: drop-shadow(0 0 0 transparent);
      transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .splash-char.lit {
      opacity: 1;
      transform: translateY(0) scale(1);
      color: #ffffff;
      -webkit-text-stroke: 0px transparent;
      background: linear-gradient(135deg, #ffffff 15%, #ffe4e6 45%, #f43f5e 80%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 16px rgba(244, 63, 94, 0.65)) drop-shadow(0 0 35px rgba(168, 85, 247, 0.4));
    }

    .splash-logo-letters.bloom {
      animation: splashLogoBloom 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards, splashLogoFloatBreath 3s ease-in-out infinite alternate 0.7s;
    }

    @keyframes splashLogoBloom {
      0% {
        filter: drop-shadow(0 0 10px rgba(244, 63, 94, 0.5));
      }
      40% {
        transform: scale(1.06);
        filter: drop-shadow(0 0 32px rgba(244, 63, 94, 0.95)) drop-shadow(0 0 60px rgba(6, 182, 212, 0.75));
      }
      100% {
        transform: scale(1);
        filter: drop-shadow(0 0 20px rgba(244, 63, 94, 0.75)) drop-shadow(0 0 40px rgba(168, 85, 247, 0.5));
      }
    }

    @keyframes splashLogoFloatBreath {
      0% { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }

    .splash-slogan-box {
      margin-top: 14px;
      opacity: 0;
      transform: translateY(12px);
      transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .splash-slogan-box.show {
      opacity: 1;
      transform: translateY(0);
    }

    .splash-slogan-text {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 4px;
      padding-left: 4px;
      color: rgba(226, 232, 240, 0.85);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .splash-slogan-text::before,
    .splash-slogan-text::after {
      content: '';
      display: inline-block;
      width: 18px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.6), transparent);
    }

    .splash-bottom-section {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      z-index: 10;
    }

    .splash-progress-wrap {
      width: 110px;
      height: 2px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .splash-progress-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #f43f5e, #a855f7, #38bdf8);
      box-shadow: 0 0 10px rgba(244, 63, 94, 0.8);
      border-radius: 999px;
    }

    .splash-footer-brand {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: rgba(148, 163, 184, 0.6);
      text-transform: uppercase;
    }

    .splash-footer-sub {
      font-size: 8px;
      color: rgba(100, 116, 139, 0.5);
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(styleEl);

  // 创建启动页 DOM
  function createSplashDOM() {
    let container = document.getElementById('appSplashScreen');
    if (!container) {
      container = document.createElement('div');
      container.id = 'appSplashScreen';
      container.innerHTML = `
        <div class="splash-ambient-glow"></div>
        <div class="splash-brand-stage">
          <div class="splash-logo-letters" id="splashLogoLetters">
            <span class="splash-char" id="spChar-0">L</span>
            <span class="splash-char" id="spChar-1">U</span>
            <span class="splash-char" id="spChar-2">M</span>
            <span class="splash-char" id="spChar-3">A</span>
          </div>
          <div class="splash-slogan-box" id="splashSloganBox">
            <p class="splash-slogan-text">开启你的直播之旅</p>
          </div>
        </div>
        <div class="splash-bottom-section">
          <div class="splash-progress-wrap">
            <div class="splash-progress-fill" id="splashProgressFill"></div>
          </div>
          <div class="flex flex-col items-center gap-0.5">
            <span class="splash-footer-brand">LUMA LIVE · VIRTUAL SANDBOX</span>
            <span class="splash-footer-sub">AI Live Streaming Simulation Engine</span>
          </div>
        </div>
      `;
      document.body.prepend(container);
    }
    return container;
  }

  let splashTimerId = null;
  let isSplashExited = false;

  function runSplashScreenAnimation() {
    const container = createSplashDOM();
    isSplashExited = false;

    const logo = document.getElementById('splashLogoLetters');
    const slogan = document.getElementById('splashSloganBox');
    const progress = document.getElementById('splashProgressFill');

    container.classList.remove('splash-exit');
    container.style.display = 'flex';
    if (logo) logo.classList.remove('bloom');
    if (slogan) slogan.classList.remove('show');
    if (progress) {
      progress.style.transition = 'none';
      progress.style.width = '0%';
    }

    const chars = [
      document.getElementById('spChar-0'),
      document.getElementById('spChar-1'),
      document.getElementById('spChar-2'),
      document.getElementById('spChar-3')
    ];
    chars.forEach(c => c && c.classList.remove('lit'));

    // 点击背景也可快速进入
    container.onclick = exitSplashScreen;

    // 启动 2.6 秒优雅进度条
    setTimeout(() => {
      if (progress) {
        progress.style.transition = 'width 2600ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        progress.style.width = '100%';
      }
    }, 50);

    // 1. 优雅逐字点亮 (180ms -> 480ms -> 780ms -> 1080ms)
    setTimeout(() => chars[0] && chars[0].classList.add('lit'), 180);
    setTimeout(() => chars[1] && chars[1].classList.add('lit'), 480);
    setTimeout(() => chars[2] && chars[2].classList.add('lit'), 780);
    setTimeout(() => chars[3] && chars[3].classList.add('lit'), 1080);

    // 2. 全字合成爆闪高光 (1350ms)
    setTimeout(() => {
      if (logo) logo.classList.add('bloom');
    }, 1350);

    // 3. 副标题淡入滑出 (1500ms)
    setTimeout(() => {
      if (slogan) slogan.classList.add('show');
    }, 1500);

    // 4. 2.6 秒结束自动转场
    if (splashTimerId) clearTimeout(splashTimerId);
    splashTimerId = setTimeout(() => {
      exitSplashScreen();
    }, 2650);
  }

  function exitSplashScreen() {
    if (isSplashExited) return;
    isSplashExited = true;
    if (splashTimerId) clearTimeout(splashTimerId);

    const container = document.getElementById('appSplashScreen');
    if (container) {
      container.classList.add('splash-exit');
      setTimeout(() => {
        container.style.display = 'none';
      }, 700);
    }
  }

  window.playSplashScreen = runSplashScreenAnimation;
  window.exitSplashScreen = exitSplashScreen;

  // 页面加载完成后立即自动启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSplashScreenAnimation);
  } else {
    runSplashScreenAnimation();
  }
})();
