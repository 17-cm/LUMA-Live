// 主入口初始化
(function () {
  'use strict';

  // 底部 Tab 切换
  function switchTab(tabId) {
    const tabs = ['live', 'trends', 'profile', 'settings'];
    tabs.forEach(t => {
      const view = document.getElementById('tab-' + t);
      const navBtn = document.getElementById('nav-btn-' + t);
      if (view) {
        if (t === tabId) view.classList.remove('hidden');
        else view.classList.add('hidden');
      }
      if (navBtn) {
        if (t === tabId) navBtn.classList.add('active');
        else navBtn.classList.remove('active');
      }
    });
    // 切 Tab 时重置页面栈（回到首页）
    if (window.PageStack) window.PageStack.reset();
  }
  window.switchTab = switchTab;

  // 初始化
  function init() {
    console.log('[LUMA Live] 框架初始化完成');
    console.log('[LUMA Live] 已加载页面:', document.querySelectorAll('.tab-page').length, '个');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
