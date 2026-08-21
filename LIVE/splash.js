/**
 * LUMA Live - 开屏启动画面模块 (Splash Screen Module)
 * 优雅衬线书写动画 · 柔和光圈 · 幻彩呼吸
 * 
 * 【重要】本文件是启动器，不参与热补丁更新，永远用原始版本。
 * 负责：1) 从 api.db 读取热补丁 2) 动态加载所有 CSS/JS 文件 3) 显示开屏动画
 */
(function initSplashScreenModule() {
  // =========================================================================
  // 【动态文件加载器】根据热补丁数据，动态加载所有 CSS/JS 文件
  // 如果有热补丁，用热补丁里的内容；否则用原始地址
  // =========================================================================
  
  // 需要动态加载的文件列表（按顺序，splash.js 本身不在此列表）
  const APP_ASSET_FILES = [
    'style.css',
    'LIVE/设定/page_stack.js',
    'LIVE/core.js',
    'LIVE/数据/data_hub.js',
    'LIVE/数据/fans_manager.js',
    'LIVE/数据/guard_manager.js',
    'LIVE/数据/checkin_manager.js',
    'LIVE/数据/titles_manager.js',
    'LIVE/主页/profile.js',
    'LIVE/社区/community_store.js',
    'LIVE/社区/module_trends.js',
    'LIVE/社区/module_supertopic.js',
    'LIVE/社区/module_detail.js',
    'LIVE/社区/module_ranking.js',
    'LIVE/社区/module_forum.js',
    'LIVE/社区/module_mytopic.js',
    'LIVE/社区/trends.js',
    'LIVE/直播/room_loading.js',
    'LIVE/直播/live.js',
    'LIVE/设定/main.js',
    'LIVE/设定/patch.js'
  ];
  
  // 热补丁数据（从 api.db 读取）
  let hotpatchFiles = null;
  let hotpatchVersion = null;
  let hotpatchCommit = null;
  
  // 等待 api 对象可用（宿主注入可能需要一点时间）
  async function waitForApi() {
    let api = window.api || window.AiPhone || window.AiPhoneApp;
    let waitCount = 0;
    while (!api && waitCount < 100) {
      await new Promise(r => setTimeout(r, 50));
      api = window.api || window.AiPhone || window.AiPhoneApp;
      waitCount++;
    }
    return api;
  }
  
  // 从 api.db 读取热补丁
  async function loadHotpatchFromDb() {
    const api = await waitForApi();
    if (!api || !api.db) {
      console.warn('[LUMA Loader] ⚠️ api.db 不可用，跳过热补丁');
      return null;
    }
    try {
      const rec = await api.db.get('app_hotpatch', 'current_hotpatch').catch(() => null);
      if (rec && rec.files) {
        return rec;
      }
      return null;
    } catch (e) {
      console.error('[LUMA Loader] ❌ 读取热补丁异常:', e.message);
      return null;
    }
  }
  
  // 从热补丁数据中获取文件内容
  function getHotpatchFileContent(filePath) {
    if (!hotpatchFiles) return null;
    const fileData = hotpatchFiles[filePath];
    if (!fileData) return null;
    // 兼容两种格式：字符串 或 { content: "...", hash: "..." }
    if (typeof fileData === 'string') return fileData;
    if (fileData && typeof fileData.content === 'string') return fileData.content;
    return null;
  }
  
  // 检查内容是否是 HTML 错误页面
  function isHtmlErrorPage(content) {
    if (!content || typeof content !== 'string') return false;
    const trimmed = content.trim();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
  }
  
  // 加载单个 CSS 文件
  function loadCssFile(filePath) {
    return new Promise((resolve) => {
      const content = getHotpatchFileContent(filePath);
      
      if (content && !isHtmlErrorPage(content)) {
        // 用热补丁内容创建 style 标签
        const style = document.createElement('style');
        style.setAttribute('data-hotpatch', 'true');
        style.setAttribute('data-source', filePath);
        style.textContent = content;
        document.head.appendChild(style);
        console.log(`[LUMA Loader] ✅ ${filePath} (热补丁, ${(content.length / 1024).toFixed(1)}KB)`);
        resolve();
      } else {
        // 用原始地址加载
        if (content && isHtmlErrorPage(content)) {
          console.warn(`[LUMA Loader] ⚠️ ${filePath} 热补丁是 HTML 错误页面，回退到原始地址`);
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = filePath;
        link.onload = () => {
          console.log(`[LUMA Loader] ✅ ${filePath} (原始)`);
          resolve();
        };
        link.onerror = () => {
          console.error(`[LUMA Loader] ❌ ${filePath} 加载失败`);
          resolve(); // 失败也继续，不阻塞其他文件
        };
        document.head.appendChild(link);
      }
    });
  }
  
  // 加载单个 JS 文件
  function loadJsFile(filePath) {
    return new Promise((resolve) => {
      const content = getHotpatchFileContent(filePath);
      
      if (content && !isHtmlErrorPage(content)) {
        // 用热补丁内容创建 blob URL 加载
        try {
          const blob = new Blob([content], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const script = document.createElement('script');
          script.src = url;
          script.async = false; // 确保按顺序执行
          script.setAttribute('data-hotpatch', 'true');
          script.setAttribute('data-source', filePath);
          script.onload = () => {
            URL.revokeObjectURL(url);
            console.log(`[LUMA Loader] ✅ ${filePath} (热补丁, ${(content.length / 1024).toFixed(1)}KB)`);
            resolve();
          };
          script.onerror = () => {
            URL.revokeObjectURL(url);
            console.error(`[LUMA Loader] ❌ ${filePath} 热补丁脚本加载失败，回退到原始地址`);
            // 回退到原始地址
            loadJsFileFromOriginal(filePath).then(resolve);
          };
          document.head.appendChild(script);
        } catch (e) {
          console.error(`[LUMA Loader] ❌ ${filePath} 创建 blob 失败:`, e.message);
          loadJsFileFromOriginal(filePath).then(resolve);
        }
      } else {
        if (content && isHtmlErrorPage(content)) {
          console.warn(`[LUMA Loader] ⚠️ ${filePath} 热补丁是 HTML 错误页面，回退到原始地址`);
        }
        loadJsFileFromOriginal(filePath).then(resolve);
      }
    });
  }
  
  // 从原始地址加载 JS 文件
  function loadJsFileFromOriginal(filePath) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = filePath;
      script.async = false;
      script.onload = () => {
        console.log(`[LUMA Loader] ✅ ${filePath} (原始)`);
        resolve();
      };
      script.onerror = () => {
        console.error(`[LUMA Loader] ❌ ${filePath} 原始地址加载失败`);
        resolve(); // 失败也继续
      };
      document.head.appendChild(script);
    });
  }
  
  // 按顺序加载所有文件
  async function loadAllAppFiles() {
    console.log(`[LUMA Loader] 🚀 开始加载 ${APP_ASSET_FILES.length} 个文件...`);
    const startTime = Date.now();
    
    for (const filePath of APP_ASSET_FILES) {
      if (filePath.endsWith('.css')) {
        await loadCssFile(filePath);
      } else if (filePath.endsWith('.js')) {
        await loadJsFile(filePath);
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[LUMA Loader] 🎉 所有文件加载完成，耗时 ${elapsed}s`);
    
    // 所有文件加载完成后，检查是否需要手动触发 DOMContentLoaded
    // 因为我们是异步加载脚本，DOMContentLoaded 可能已经触发了
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      console.log('[LUMA Loader] 📢 document 已就绪，手动触发 DOMContentLoaded 事件');
      // 延迟一点，确保最后一个脚本执行完成
      setTimeout(() => {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }, 50);
    }
  }
  
  // 主启动流程
  async function bootstrap() {
    // 1. 从 api.db 读取热补丁
    const hotpatch = await loadHotpatchFromDb();
    if (hotpatch && hotpatch.files) {
      hotpatchFiles = hotpatch.files;
      hotpatchVersion = hotpatch.version;
      hotpatchCommit = hotpatch.commit;
      window.__lumaHotpatchVersion = hotpatch.version;
      window.__lumaHotpatchCommit = hotpatch.commit || '';
      window.__lumaHotpatchActive = true;
      console.log(`[LUMA Loader] 📌 检测到热补丁版本: ${hotpatch.version} ${hotpatch.commit ? '(' + hotpatch.commit + ')' : ''}`);
    } else {
      console.log('[LUMA Loader] 无热补丁数据，加载原始文件');
    }
    
    // 2. 加载所有 APP 文件
    await loadAllAppFiles();
  }
  
  // 启动（不阻塞开屏动画）
  bootstrap();
  
  // =========================================================================
  // 以下是原有的开屏动画代码
  // =========================================================================
  
  // 加载字体
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap';
  document.head.appendChild(fontLink);

  const styleEl = document.createElement('style');
  styleEl.id = 'luma-splash-style';
  styleEl.textContent = `
    #appSplashScreen {
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      background:
        radial-gradient(ellipse at 50% 45%, rgba(30, 20, 60, 0.5) 0%, transparent 55%),
        radial-gradient(ellipse at 25% 75%, rgba(50, 20, 70, 0.25) 0%, transparent 50%),
        radial-gradient(ellipse at 75% 25%, rgba(20, 35, 70, 0.25) 0%, transparent 45%),
        linear-gradient(180deg, #0a0814 0%, #060410 50%, #04030c 100%);
      z-index: 999999; display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      padding: calc(env(safe-area-inset-top, 24px) + 16px) 24px calc(env(safe-area-inset-bottom, 24px) + 24px);
      user-select: none; -webkit-user-select: none; overflow: hidden;
      transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out;
    }
    #appSplashScreen.splash-exit { transform: scale(1.04); opacity: 0; pointer-events: none; }
    .splash-stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
    .splash-star {
      position: absolute; width: 2px; height: 2px;
      background: rgba(255,255,255,0.5); border-radius: 50%;
      animation: starTwinkle 3s ease-in-out infinite;
    }
    @keyframes starTwinkle { 0%,100%{opacity:0.15;transform:scale(0.7)} 50%{opacity:0.7;transform:scale(1.1)} }
    .splash-ambient-glow {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 380px; height: 380px;
      background: radial-gradient(circle, rgba(168,85,247,0.08) 0%, rgba(244,63,94,0.05) 40%, transparent 75%);
      filter: blur(50px); pointer-events: none;
      animation: splashAmbientPulse 6s ease-in-out infinite alternate; z-index: 1;
    }
    @keyframes splashAmbientPulse { 0%{transform:translate(-50%,-50%) scale(0.85);opacity:0.6} 100%{transform:translate(-50%,-50%) scale(1.15);opacity:0.9} }
    .splash-brand-stage {
      position: relative; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 10; width: 100%;
    }
    .splash-logo-wrap {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 320px; height: 200px;
    }
    .splash-ring-svg {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 300px; height: 300px; pointer-events: none; z-index: 5;
      overflow: visible;
    }
    .splash-ring-circle {
      fill: none; stroke-width: 1.2; stroke-linecap: round;
      stroke-dasharray: 760; stroke-dashoffset: 760;
      filter: drop-shadow(0 0 6px rgba(200,168,255,0.4));
      transform-origin: center;
      transform: rotate(-90deg);
    }
    .splash-ring-circle.draw {
      animation: ringDraw 1.1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
    }
    .splash-ring-circle.draw-done {
      stroke-dashoffset: 0;
      animation: ringGlow 2s ease-in-out infinite alternate;
    }
    @keyframes ringDraw {
      0% { stroke-dashoffset: 760; opacity: 0.3; }
      10% { opacity: 1; }
      100% { stroke-dashoffset: 0; opacity: 1; }
    }
    @keyframes ringGlow {
      0% { filter: drop-shadow(0 0 4px rgba(200,168,255,0.3)); opacity: 0.7; }
      100% { filter: drop-shadow(0 0 12px rgba(200,168,255,0.6)) drop-shadow(0 0 20px rgba(244,63,94,0.3)); opacity: 1; }
    }
    .splash-logo-letters {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: clamp(64px, 16vw, 96px);
      font-weight: 600; font-style: italic;
      line-height: 1.2; letter-spacing: 4px;
      position: relative; z-index: 6; cursor: default;
      text-align: center;
      padding: 0.15em 0.3em;
      -webkit-text-stroke: 0.6px rgba(255,255,255,0.2);
      color: transparent;
      background: linear-gradient(90deg,
        rgba(255,255,255,0.95) 0%,
        rgba(235,220,255,0.9) 20%,
        rgba(210,180,255,0.85) 38%,
        rgba(255,225,240,1) 46%,
        rgba(255,255,255,1) 50%,
        rgba(210,180,255,0.12) 56%,
        transparent 57.01%);
      background-size: 200% 100%; background-position: 108% 0;
      -webkit-background-clip: text; background-clip: text;
      filter: drop-shadow(0 0 6px rgba(168,85,247,0));
      transition: background-position 2s cubic-bezier(0.65,0,0.35,1),
                  filter 0.6s ease, -webkit-text-stroke 0.6s ease;
    }
    .splash-logo-letters.writing {
      background-position: -8% 0;
      -webkit-text-stroke: 0.6px rgba(255,255,255,0.06);
    }
    .splash-logo-letters.bloom {
      -webkit-text-stroke: 0px transparent;
      background: linear-gradient(90deg,
        #ffffff 0%, #f0e4ff 18%, #dcc4ff 35%, #ffd6e8 50%,
        #ffffff 55%, #c8dcff 70%, #dcc4ff 85%, #ffffff 100%);
      background-size: 200% 100%;
      -webkit-background-clip: text; background-clip: text;
      animation: splashLogoBloom 0.7s cubic-bezier(0.16,1,0.3,1) forwards,
                 splashLogoShimmer 5s ease-in-out infinite 0.7s,
                 splashLogoFloat 5s ease-in-out infinite alternate 0.7s;
    }
    @keyframes splashLogoBloom {
      0% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(168,85,247,0.5)); }
      40% { transform: scale(1.05); filter: drop-shadow(0 0 24px rgba(220,200,255,0.8)) drop-shadow(0 0 45px rgba(168,85,247,0.5)); }
      100% { transform: scale(1); filter: drop-shadow(0 0 14px rgba(200,180,255,0.6)) drop-shadow(0 0 30px rgba(168,85,247,0.4)); }
    }
    @keyframes splashLogoShimmer { 0%,100%{background-position:0% 0} 50%{background-position:100% 0} }
    @keyframes splashLogoFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-4px)} }
    .splash-pen-tip {
      position: absolute; top: 50%; left: 0; width: 24px; height: 24px;
      transform: translate(-50%,-50%) scale(0);
      background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(220,200,255,0.7) 35%, rgba(168,85,247,0.2) 65%, transparent 80%);
      border-radius: 50%; filter: blur(1px); pointer-events: none; z-index: 11; opacity: 0;
    }
    .splash-pen-tip.active { animation: penTipMove 2s cubic-bezier(0.65,0,0.35,1) forwards; }
    @keyframes penTipMove {
      0%{left:12%;transform:translate(-50%,-50%) scale(0.4);opacity:0}
      10%{opacity:1;transform:translate(-50%,-50%) scale(1)}
      88%{opacity:1;transform:translate(-50%,-50%) scale(0.9)}
      100%{left:88%;transform:translate(-50%,-50%) scale(0.4);opacity:0}
    }
    .splash-slogan-box {
      margin-top: 22px; opacity: 0; transform: translateY(12px);
      transition: all 0.7s cubic-bezier(0.16,1,0.3,1); z-index: 10;
    }
    .splash-slogan-box.show { opacity: 1; transform: translateY(0); }
    .splash-slogan-text {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 15px; font-weight: 400; font-style: italic;
      letter-spacing: 4px; color: rgba(215,210,230,0.75);
      display: flex; align-items: center; gap: 14px;
    }
    .splash-slogan-text::before, .splash-slogan-text::after {
      content:''; display:inline-block; width:28px; height:1px;
      background: linear-gradient(90deg, transparent, rgba(200,180,255,0.5), transparent);
    }
    .splash-bottom-section {
      position: absolute; bottom: calc(env(safe-area-inset-bottom, 24px) + 28px);
      left: 0; right: 0;
      display: flex; flex-direction: column; align-items: center; gap: 12px; z-index: 10;
    }
    .splash-progress-wrap { width: 120px; height: 2px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; }
    .splash-progress-fill {
      width:0%; height:100%;
      background: linear-gradient(90deg, rgba(200,180,255,0.2) 0%, #c8b4ff 25%, #f4a8c8 50%, #ffffff 55%, #a8c8f4 75%, rgba(200,180,255,0.2) 100%);
      background-size:200% 100%; box-shadow:0 0 10px rgba(200,180,255,0.5); border-radius:999px;
      animation: progressShimmer 2.5s linear infinite;
    }
    @keyframes progressShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .splash-footer-brand { font-family:'Cormorant Garamond',serif; font-size:8.5px; font-weight:400; letter-spacing:2.5px; color:rgba(140,150,170,0.4); text-transform:uppercase; }
    .splash-footer-sub { font-size:7.5px; color:rgba(95,108,130,0.35); letter-spacing:0.5px; }
  `;
  document.head.appendChild(styleEl);

  function createStars() {
    const c = document.createElement('div'); c.className = 'splash-stars';
    for (let i = 0; i < 25; i++) {
      const s = document.createElement('div'); s.className = 'splash-star';
      s.style.left = Math.random()*100+'%'; s.style.top = Math.random()*100+'%';
      s.style.animationDelay = Math.random()*3+'s'; s.style.animationDuration = (2.5+Math.random()*2.5)+'s';
      const sz = 1+Math.random()*1.5; s.style.width = sz+'px'; s.style.height = sz+'px';
      c.appendChild(s);
    }
    return c;
  }

  function createSplashDOM() {
    let container = document.getElementById('appSplashScreen');
    if (!container) {
      container = document.createElement('div'); container.id = 'appSplashScreen';
      container.appendChild(createStars());
      container.innerHTML += `
        <div class="splash-ambient-glow"></div>
        <div class="splash-brand-stage">
          <div class="splash-logo-wrap">
            <svg class="splash-ring-svg" viewBox="0 0 300 300">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
                  <stop offset="40%" stop-color="#d4c0ff" stop-opacity="0.85"/>
                  <stop offset="70%" stop-color="#ffc8e0" stop-opacity="0.8"/>
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"/>
                </linearGradient>
              </defs>
              <circle class="splash-ring-circle" id="splashRingCircle" cx="150" cy="150" r="121" stroke="url(#ringGrad)"/>
            </svg>
            <div class="splash-logo-letters" id="splashLogoLetters">LUMA</div>
            <div class="splash-pen-tip" id="splashPenTip"></div>
          </div>
          <div class="splash-slogan-box" id="splashSloganBox">
            <p class="splash-slogan-text">开启你的直播之旅</p>
          </div>
        </div>
        <div class="splash-bottom-section">
          <div class="splash-progress-wrap"><div class="splash-progress-fill" id="splashProgressFill"></div></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <span class="splash-footer-brand">LUMA LIVE · VIRTUAL SANDBOX</span>
            <span class="splash-footer-sub">AI Live Streaming Simulation Engine</span>
          </div>
        </div>`;
      document.body.prepend(container);
    }
    return container;
  }

  let splashTimerId = null, isSplashExited = false;

  function runSplashScreenAnimation() {
    const container = createSplashDOM();
    isSplashExited = false;
    const logo = document.getElementById('splashLogoLetters');
    const penTip = document.getElementById('splashPenTip');
    const ring = document.getElementById('splashRingCircle');
    const slogan = document.getElementById('splashSloganBox');
    const progress = document.getElementById('splashProgressFill');
    container.classList.remove('splash-exit'); container.style.display = 'flex';
    if (logo) { logo.classList.remove('writing','bloom'); void logo.offsetWidth; }
    if (penTip) penTip.classList.remove('active');
    if (ring) { ring.classList.remove('draw','draw-done'); ring.style.strokeDashoffset = '760'; void ring.offsetWidth; }
    if (slogan) slogan.classList.remove('show');
    if (progress) { progress.style.transition='none'; progress.style.width='0%'; }
    container.onclick = exitSplashScreen;
    setTimeout(() => { if (progress) { progress.style.transition='width 3000ms cubic-bezier(0.2,0.8,0.2,1)'; progress.style.width='100%'; } }, 100);
    setTimeout(() => {
      if (logo) logo.classList.add('writing');
      if (penTip) penTip.classList.add('active');
    }, 350);
    setTimeout(() => {
      if (logo) { logo.classList.remove('writing'); logo.classList.add('bloom'); }
      if (ring) { ring.classList.add('draw'); }
    }, 2350);
    setTimeout(() => {
      if (ring) { ring.classList.remove('draw'); ring.classList.add('draw-done'); }
    }, 3500);
    setTimeout(() => { if (slogan) slogan.classList.add('show'); }, 2700);
    if (splashTimerId) clearTimeout(splashTimerId);
    splashTimerId = setTimeout(exitSplashScreen, 4000);
  }

  function exitSplashScreen() {
    if (isSplashExited) return;
    isSplashExited = true;
    if (splashTimerId) clearTimeout(splashTimerId);
    const container = document.getElementById('appSplashScreen');
    if (container) { container.classList.add('splash-exit'); setTimeout(() => { container.style.display='none'; }, 750); }
  }

  window.playSplashScreen = runSplashScreenAnimation;
  window.exitSplashScreen = exitSplashScreen;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSplashScreenAnimation, { once: true });
  } else {
    runSplashScreenAnimation();
  }
})();
