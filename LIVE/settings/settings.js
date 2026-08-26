// 设定页面
(function () {
  'use strict';
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
    <div id="tab-settings" class="tab-page hidden h-full overflow-y-auto no-scrollbar px-4 pb-44 space-y-3.5">
      <div class="pt-6 text-center">
        <h2 class="text-xl font-black text-slate-800">设定</h2>
        <p class="text-sm text-slate-400 mt-2">框架搭建中，功能逐步迁移</p>
      </div>
    </div>
  `);
  console.log('[settings] 页面已注入');
})();
