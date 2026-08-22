// =========================================================================
// LUMA Live 代码加载器
// 从 api.db 读取缓存的文件，按顺序加载运行
// 第一次启动时从 GitHub 克隆整个仓库到 api.db
// 用 splash 启动画面显示加载进度，不单独搞紫色界面
// =========================================================================
(function() {
  'use strict';

  // 文件加载顺序（和 index.html 里的 script 顺序一致）
  const LOAD_ORDER = [
    'LIVE/设定/page_stack.js',
    'LIVE/设定/app_presets.js',
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
    'LIVE/设定/patch.js',
    'LIVE/设定/gift_system.js'
  ];

  // CSS 文件列表
  const CSS_FILES = [
    'style.css'
  ];

  // 更新 splash 进度条和文字
  function updateSplash(message, percent) {
    const progress = document.getElementById('splashProgressFill');
    const slogan = document.getElementById('splashSloganBox');
    
    if (progress && percent !== undefined) {
      progress.style.transition = 'width 0.3s ease';
      progress.style.width = percent + '%';
    }
    
    if (slogan && message) {
      slogan.textContent = message;
      slogan.classList.add('show');
    }
  }

  // 隐藏 splash
  function hideSplash() {
    if (typeof window.exitSplashScreen === 'function') {
      window.exitSplashScreen();
    }
    const splashEl = document.getElementById('lumaSplashContainer') || document.querySelector('.splash-container');
    if (splashEl) {
      splashEl.style.display = 'none';
    }
  }

  // 加载 CSS 文件
  async function loadCssFile(filepath) {
    try {
      const content = await window.RepoCloner.getFileFromDb(filepath);
      if (!content) {
        console.warn('[CodeLoader] CSS 文件不存在:', filepath);
        return;
      }
      
      const style = document.createElement('style');
      style.textContent = content;
      style.setAttribute('data-file', filepath);
      document.head.appendChild(style);
      console.log('[CodeLoader] CSS 加载成功:', filepath);
    } catch (err) {
      console.error('[CodeLoader] CSS 加载失败:', filepath, err);
    }
  }

  // 加载 JS 文件（eval 执行）
  async function loadJsFile(filepath) {
    try {
      const content = await window.RepoCloner.getFileFromDb(filepath);
      if (!content) {
        console.warn('[CodeLoader] JS 文件不存在:', filepath);
        return;
      }
      
      // 用 eval 执行，保留文件名用于调试
      eval(content);
      console.log('[CodeLoader] JS 加载成功:', filepath);
    } catch (err) {
      console.error('[CodeLoader] JS 加载失败:', filepath, err);
      throw err;
    }
  }

  // 加载 JSON 配置文件
  async function loadJsonFile(filepath, globalVarName) {
    try {
      const content = await window.RepoCloner.getFileFromDb(filepath);
      if (!content) {
        console.warn('[CodeLoader] JSON 文件不存在:', filepath);
        return;
      }
      
      const data = JSON.parse(content);
      window[globalVarName] = data;
      console.log('[CodeLoader] JSON 加载成功:', filepath, '-> window.' + globalVarName);
    } catch (err) {
      console.error('[CodeLoader] JSON 加载失败:', filepath, err);
    }
  }

  // 主加载流程
  async function startLoading() {
    try {
      console.log('[CodeLoader] 开始加载...');
      
      // 等待 RepoCloner 加载完成
      let waitCount = 0;
      while (!window.RepoCloner && waitCount < 50) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
      }
      
      if (!window.RepoCloner) {
        throw new Error('RepoCloner 加载失败');
      }
      
      // 等待宿主 SDK 初始化完成（主入口是 window.AiPhone）
      waitCount = 0;
      while (!window.AiPhone && !window.AiPhoneApp && !window.api && waitCount < 100) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
      }
      
      const hostApi = window.AiPhone || window.AiPhoneApp || window.api;
      if (!hostApi) {
        console.warn('[CodeLoader] 警告：宿主 SDK 未找到');
      } else {
        console.log('[CodeLoader] 宿主 SDK 已初始化');
      }
      
      // 检查当前版本
      const currentVersion = await window.RepoCloner.getCurrentVersion();
      const isFirstLaunch = !currentVersion;
      
      if (isFirstLaunch) {
        // 第一次启动，从 GitHub 克隆仓库，更新 splash 进度
        console.log('[CodeLoader] 第一次启动，从 GitHub 克隆仓库...');
        updateSplash('正在从云端下载代码...', 10);
        
        const result = await window.RepoCloner.cloneRepoToDb((msg, percent) => {
          updateSplash(msg, Math.min(90, percent));
        });
        
        if (!result.success) {
          throw new Error('克隆仓库失败: ' + result.error);
        }
        
        updateSplash('下载完成，正在加载...', 90);
      } else {
        // 有缓存，静默加载，不更新 splash（让 splash 自己播完）
        console.log('[CodeLoader] 当前版本:', currentVersion.commit_hash);
      }
      
      // 加载 CSS（静默）
      for (const cssFile of CSS_FILES) {
        await loadCssFile(cssFile);
      }
      
      // 加载 JSON 配置（静默）
      await loadJsonFile('presets.json', 'appPresetsConfig');
      await loadJsonFile('regex.json', 'appRegexConfig');
      await loadJsonFile('world.json', 'appWorldConfig');
      
      // 定义全局 api 变量，指向宿主 SDK
      // 之前的代码里用 api.characters.list()、api.db.get() 等
      // 但是 eval 环境里 api 变量不存在，需要手动定义
      if (window.AiPhone && typeof api === 'undefined') {
        window.api = window.AiPhone;
        try {
          eval('var api = window.AiPhone;');
        } catch (e) {
          console.warn('[CodeLoader] 定义 api 变量失败:', e);
        }
        console.log('[CodeLoader] 已定义全局 api 变量 -> window.AiPhone');
      }
      
      // 按顺序加载 JS（静默）
      for (let i = 0; i < LOAD_ORDER.length; i++) {
        const jsFile = LOAD_ORDER[i];
        await loadJsFile(jsFile);
      }
      
      console.log('[CodeLoader] 所有文件加载完成！');
      
      // 直接调用初始化函数，不要手动触发 DOMContentLoaded/load 事件
      // 手动触发事件会导致宿主 SDK 被卸载（window.AiPhone 变成 undefined）
      if (!window.__codeLoaderInitDone) {
        window.__codeLoaderInitDone = true;
        
        console.log('[CodeLoader] 调用 main.js 初始化函数...');
        if (typeof window.lumaInitApp === 'function') {
          try {
            await window.lumaInitApp();
            console.log('[CodeLoader] main.js 初始化完成');
          } catch (e) {
            console.error('[CodeLoader] main.js 初始化失败:', e);
          }
        } else {
          console.warn('[CodeLoader] window.lumaInitApp 不存在，跳过初始化');
        }
        
        // 调用 gift_system.js 的初始化（如果存在）
        if (typeof window.initGiftSystem === 'function') {
          try {
            window.initGiftSystem();
            console.log('[CodeLoader] gift_system.js 初始化完成');
          } catch (e) {
            console.error('[CodeLoader] gift_system.js 初始化失败:', e);
          }
        }
        
        // 调用 patch.js 的初始化（如果存在）
        if (typeof window.installHotpatch === 'function') {
          try {
            window.installHotpatch();
            console.log('[CodeLoader] patch.js 初始化完成');
          } catch (e) {
            console.error('[CodeLoader] patch.js 初始化失败:', e);
          }
        }
      }
      
      // 等 splash 播完再隐藏（splash 总共 4 秒，从启动开始算）
      // 如果已经超过 4 秒，立即隐藏
      const splashStartTime = window.__splashStartTime || Date.now();
      const elapsed = Date.now() - splashStartTime;
      const remaining = Math.max(0, 4000 - elapsed);
      
      console.log('[CodeLoader] 等待 splash 播完，剩余', remaining, 'ms');
      
      setTimeout(() => {
        hideSplash();
        console.log('[CodeLoader] splash 已隐藏，APP 启动完成');
      }, remaining);
      
    } catch (err) {
      console.error('[CodeLoader] 加载失败:', err);
      updateSplash('加载失败: ' + err.message, 100);
      
      // 显示错误提示，让用户可以重试
      setTimeout(() => {
        const retry = confirm('LUMA Live 加载失败：' + err.message + '\n\n是否重试？');
        if (retry) {
          location.reload();
        }
      }, 1000);
    }
  }

  // 暴露到全局
  window.CodeLoader = {
    startLoading,
    loadJsFile,
    loadCssFile,
    loadJsonFile
  };

  // 记录 splash 开始时间
  window.__splashStartTime = Date.now();

  // 自动开始加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLoading);
  } else {
    startLoading();
  }

  console.log('[CodeLoader] 代码加载器已初始化');
})();
