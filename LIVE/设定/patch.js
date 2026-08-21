// LUMA Live hotfixes: follow count, spawn-rate display, settings panel exposure
(function installLumaHotfixes() {
  // =========================================================================
  // 【热补丁 JS 执行】所有业务脚本加载完成后，用新版本代码覆盖旧函数
  // =========================================================================
  // 【热补丁 JS 执行】从宿主数据库 api.db 读取热补丁，用新版本代码覆盖旧函数
  // 沙盒 iframe 无法访问 localStorage，必须用 api.db
  async function applyHotpatchJs() {
    if (window.__lumaHotpatchJsApplied) return;
    // 等待 api 对象可用
    let api = window.api || window.AiPhone || window.AiPhoneApp;
    let waitCount = 0;
    while (!api && waitCount < 50) {
      await new Promise(r => setTimeout(r, 50));
      api = window.api || window.AiPhone || window.AiPhoneApp;
      waitCount++;
    }
    if (!api || !api.db) {
      console.warn('[LUMA Hotpatch] ⚠️ api.db 不可用，跳过 JS 热补丁');
      return;
    }
    try {
      const hotpatchRec = await api.db.get('app_hotpatch', 'current_hotpatch').catch(() => null);
      if (!hotpatchRec || !hotpatchRec.files) {
        console.log('[LUMA Hotpatch] 无热补丁数据，跳过 JS 注入');
        return;
      }
      const files = hotpatchRec.files;
      const fileCount = Object.keys(files).length;
      console.log(`[LUMA Hotpatch] 检测到 ${fileCount} 个热补丁文件，开始应用...`);
      // 需要排除的文件：splash.js（已执行完，重执行会重播启动动画）
      // patch.js（正在执行，重执行会递归）
      const excludeFiles = ['LIVE/splash.js', 'LIVE/设定/patch.js'];
      let appliedCount = 0;
      let failCount = 0;
      for (const [filePath, fileContent] of Object.entries(files)) {
        if (!filePath.endsWith('.js')) continue;
        if (excludeFiles.includes(filePath)) continue;
        if (typeof fileContent !== 'string' || !fileContent.trim()) {
          console.warn(`[LUMA Hotpatch] ⚠️ ${filePath} 内容为空，跳过`);
          failCount++;
          continue;
        }
        // 检查是否下载到了 HTML 错误页面
        if (fileContent.trim().startsWith('<!DOCTYPE') || fileContent.trim().startsWith('<html')) {
          console.error(`[LUMA Hotpatch] ❌ ${filePath} 是 HTML 错误页面，跳过`);
          failCount++;
          continue;
        }
        try {
          // 用动态创建 script 标签的方式加载，比 eval 更接近正常脚本加载
          const blob = new Blob([fileContent], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const script = document.createElement('script');
          script.src = url;
          script.setAttribute('data-hotpatch', filePath);
          script.onload = () => {
            URL.revokeObjectURL(url);
          };
          script.onerror = () => {
            console.error(`[LUMA Hotpatch] ❌ ${filePath} 脚本加载失败`);
            URL.revokeObjectURL(url);
          };
          document.head.appendChild(script);
          appliedCount++;
          console.log(`[LUMA Hotpatch] ✅ ${filePath} 已注入 (${(fileContent.length / 1024).toFixed(1)}KB)`);
        } catch (evalErr) {
          console.error(`[LUMA Hotpatch] ❌ ${filePath} 注入失败: ${evalErr.message}`);
          failCount++;
        }
      }
      if (appliedCount > 0) {
        window.__lumaHotpatchJsApplied = true;
        console.log(`[LUMA Hotpatch] 🎉 热补丁应用完成：成功 ${appliedCount} 个，失败 ${failCount} 个`);
      } else {
        console.warn('[LUMA Hotpatch] ⚠️ 没有成功应用任何 JS 热补丁');
      }
    } catch (e) {
      console.error('[LUMA Hotpatch] ❌ JS 热补丁应用异常:', e.message);
    }
  }

  function install() {
    // 先应用 JS 热补丁（更新所有函数到最新版本）
    applyHotpatchJs();
    if (typeof window.syncParamDisplays !== 'function' || typeof window.updateParam !== 'function') {
      setTimeout(install, 25);
      return;
    }
    if (!window.__lumaHotfixInstalled) {
      window.__lumaHotfixInstalled = true;
      const originalUpdateParam = window.updateParam;
      window.updateParam = function updateParamHotfix(key, val) {
        originalUpdateParam(key, val);
        if (key === 'charSpawnRate') {
          const num = Number(val);
          const valueEl = document.getElementById('valCharSpawnRate');
          const tagEl = document.getElementById('tagCharRate');
          if (valueEl) valueEl.textContent = `${num}%`;
          if (tagEl) tagEl.textContent = `${num}% 概率开播`;
        }
      };
      const originalSyncParamDisplays = window.syncParamDisplays;
      window.syncParamDisplays = function syncParamDisplaysHotfix() {
        originalSyncParamDisplays();
        const p = window.appParams || {};
        const rate = p.charSpawnRate !== undefined ? Number(p.charSpawnRate) : 45;
        const input = document.getElementById('paramCharSpawnRate');
        const valueEl = document.getElementById('valCharSpawnRate');
        const tagEl = document.getElementById('tagCharRate');
        if (input) input.value = rate;
        if (valueEl) valueEl.textContent = `${rate}%`;
        if (tagEl) tagEl.textContent = `${rate}% 概率开播`;
      };
      window.syncFollowCountDisplay = function syncFollowCountDisplay() {
        const followed = Array.isArray(window.followedHosts) ? window.followedHosts : [];
        // LUMA 官方运营组固定占 1 个关注项，其余均来自真实关注记录。
        const count = followed.length + 1;
        const statEl = document.getElementById('statFollowCount');
        if (statEl) statEl.textContent = String(count);
      };
      // 关注人数只由"关注记录"决定，与主播当前是否开播完全解耦。
      setInterval(window.syncFollowCountDisplay, 500);
      window.syncFollowCountDisplay();
      // 设置页底部操作区给底部 Dock 留出足够滚动空间；同时避免参数抽屉高度截断保存按钮。
      const style = document.createElement('style');
      style.id = 'luma-hotfix-style';
      style.textContent = `
        #tab-settings { padding-bottom: 190px !important; }
        #tab-settings .accordion-item.open { max-height: 1400px !important; }
        #tab-settings .accordion-body { padding-bottom: 24px; }
        #tab-settings .accordion-item.open .btn-brand { min-height: 42px; }
      `;
      document.head.appendChild(style);
      window.syncParamDisplays();
      window.syncFollowCountDisplay();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
