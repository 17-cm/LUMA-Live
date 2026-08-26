// 直播广场页面
(function () {
  'use strict';
  // 注入页面 HTML
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
    <div id="tab-live" class="tab-page h-full overflow-y-auto no-scrollbar px-4 pb-28 space-y-3.5">
      <div class="pt-6 text-center">
        <h2 class="text-xl font-black text-slate-800">直播广场</h2>
        <p class="text-sm text-slate-400 mt-2">框架搭建中，功能逐步迁移</p>
      </div>
    </div>
  `);
  console.log('[live] 页面已注入');
})();
