// =========================================================================
// LUMA Live 代码加载器
// 从 api.db 读取缓存的文件，按顺序加载运行
// 第一次启动时从 GitHub 克隆整个仓库到 api.db
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
    'LIVE/设定/gift_system.js'
  ];

  // CSS 文件列表
  const CSS_FILES = [
    'style.css'
  ];

  // 显示加载界面
  function showLoadingScreen(message, percent) {
    let overlay = document.getElementById('cloud-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cloud-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;color:white;font-family:-apple-system,sans-serif;';
      overlay.innerHTML = `
        <div style="font-size:48px;margin-bottom:20px;">🎬</div>
        <div style="font-size:24px;font-weight:bold;margin-bottom:10px;">LUMA Live</div>
        <div id="cloud-loading-message" style="font-size:14px;margin-bottom:20px;opacity:0.9;">正在加载...</div>
        <div style="width:200px;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;">
          <div id="cloud-loading-bar" style="height:100%;width:0%;background:white;border-radius:3px;transition:width 0.3s;"></div>
        </div>
        <div id="cloud-loading-percent" style="font-size:12px;margin-top:10px;opacity:0.7;">0%</div>
      `;
      document.body.appendChild(overlay);
    }
    
    document.getElementById('cloud-loading-message').textContent = message;
    document.getElementById('cloud-loading-bar').style.width = percent + '%';
    document.getElementById('cloud-loading-percent').textContent = percent + '%';
  }

  // 隐藏加载界面
  function hideLoadingScreen() {
    const overlay = document.getElementById('cloud-loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 500);
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
      showLoadingScreen('正在初始化...', 0);
      
      // 等待 RepoCloner 加载完成
      let waitCount = 0;
      while (!window.RepoCloner && waitCount < 50) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
      }
      
      if (!window.RepoCloner) {
        throw new Error('RepoCloner 加载失败');
      }
      
      // 等待宿主 api 初始化完成
      waitCount = 0;
      while (!window.api && waitCount < 100) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
      }
      
      if (!window.api) {
        console.warn('[CodeLoader] 警告：window.api 未找到，尝试使用全局 api');
      } else {
        console.log('[CodeLoader] 宿主 api 已初始化');
      }
      
      // 检查当前版本
      showLoadingScreen('正在检查版本...', 5);
      const currentVersion = await window.RepoCloner.getCurrentVersion();
      
      if (!currentVersion) {
        // 第一次启动，从 GitHub 克隆仓库
        showLoadingScreen('第一次启动，正在从云端下载代码...', 10);
        const result = await window.RepoCloner.cloneRepoToDb((msg, percent) => {
          showLoadingScreen(msg, percent);
        });
        
        if (!result.success) {
          throw new Error('克隆仓库失败: ' + result.error);
        }
      } else {
        console.log('[CodeLoader] 当前版本:', currentVersion.commit_hash);
      }
      
      // 加载 CSS
      showLoadingScreen('正在加载样式...', 80);
      for (const cssFile of CSS_FILES) {
        await loadCssFile(cssFile);
      }
      
      // 加载 JSON 配置
      await loadJsonFile('presets.json', 'appPresetsConfig');
      await loadJsonFile('regex.json', 'appRegexConfig');
      await loadJsonFile('world.json', 'appWorldConfig');
      
      // 按顺序加载 JS
      showLoadingScreen('正在加载核心模块...', 85);
      for (let i = 0; i < LOAD_ORDER.length; i++) {
        const jsFile = LOAD_ORDER[i];
        const percent = 85 + Math.round((i / LOAD_ORDER.length) * 13);
        showLoadingScreen(`正在加载: ${jsFile.split('/').pop()}`, percent);
        await loadJsFile(jsFile);
      }
      
      showLoadingScreen('加载完成！', 100);
      
      // 延迟隐藏加载界面
      setTimeout(() => {
        hideLoadingScreen();
      }, 500);
      
      console.log('[CodeLoader] 所有文件加载完成！');
    } catch (err) {
      console.error('[CodeLoader] 加载失败:', err);
      showLoadingScreen('加载失败: ' + err.message, 100);
      
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

  // 自动开始加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLoading);
  } else {
    startLoading();
  }

  console.log('[CodeLoader] 代码加载器已初始化');
})();
