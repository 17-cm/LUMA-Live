// 社区页面
(function () {
  'use strict';
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
    <div id="tab-trends" class="tab-page hidden h-full overflow-y-auto no-scrollbar px-4 pb-28 space-y-4">
      <div class="pt-6 text-center">
        <h2 class="text-xl font-black text-slate-800">社区</h2>
        <p class="text-sm text-slate-400 mt-2">框架搭建中，功能逐步迁移</p>
      </div>
    </div>
  `);
  console.log('[community] 页面已注入');
})();
