// 主入口初始化
(function () {
  'use strict';

  // switchTab 由 LIVE/settings/main.js 提供（更完整，含顶部Header同步）

  // 初始化
  function init() {
    // 设定页参数显示同步（如果函数存在）
    if (typeof syncParamDisplays === 'function') {
      try { syncParamDisplays(); } catch(e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
