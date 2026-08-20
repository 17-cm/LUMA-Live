// LUMA Live hotfixes: follow count, spawn-rate display, settings panel exposure
(function installLumaHotfixes() {
  function install() {
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

      // 关注人数只由“关注记录”决定，与主播当前是否开播完全解耦。
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
