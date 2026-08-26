// 直播广场页面 - 静态HTML结构
(function () {
  'use strict';
  // 注入页面 HTML
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
<div id="tab-live" class="tab-page h-full overflow-y-auto no-scrollbar px-4 pb-28 space-y-3.5">
      <div onclick="handleGenerateWildNPC()" class="holo-wild-card p-3.5 flex items-center justify-between cursor-pointer active:scale-98 transition shadow-sm">
        <div class="flex items-center gap-3 relative z-10">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-purple-600 to-cyan-400 p-0.5 shadow-md">
            <div class="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white text-base font-bold">
              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h3 class="text-xs font-black text-slate-900">偶遇野生主播 · AI 生图</h3>
              <span class="text-[8px] bg-purple-100 text-purple-700 font-extrabold px-1.5 py-0.2 rounded-full">NEW</span>
            </div>
            <p class="text-[10px] text-slate-500 mt-0.5">召唤专属虚拟主播（自动套用生图参数）</p>
          </div>
        </div>
        <div id="btnSummonWildBadge" class="relative z-10 flex items-center gap-1 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white text-rose-600 text-[10px] font-black shadow-sm">
          <span>召唤</span><span>›</span>
        </div>
      </div>

      <div class="space-y-1.5 pt-0.5">
        <div class="flex justify-between items-center px-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PRIMARY CHANNELS · 核心频道</span>
        </div>
        <div id="channelCircleContainer" class="flex gap-3.5 overflow-x-auto no-scrollbar py-1 px-1">
          <div onclick="selectMainCategory('all')" id="ch-all" class="channel-circle-box active">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">全部</span>
          </div>
          <div onclick="selectMainCategory('电竞竞技')" id="ch-电竞竞技" class="channel-circle-box">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 18 3 18 8 6 8 6 3"></polygon><line x1="12" y1="8" x2="12" y2="21"></line></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">电竞竞技</span>
          </div>
          <div onclick="selectMainCategory('声动音律')" id="ch-声动音律" class="channel-circle-box">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">声动音律</span>
          </div>
          <div onclick="selectMainCategory('次元才艺')" id="ch-次元才艺" class="channel-circle-box">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">次元才艺</span>
          </div>
          <div onclick="selectMainCategory('随性杂谈')" id="ch-随性杂谈" class="channel-circle-box">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">随性杂谈</span>
          </div>
          <div onclick="selectMainCategory('探索开箱')" id="ch-探索开箱" class="channel-circle-box">
            <div class="channel-circle"><div class="channel-circle-inner"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg></div></div>
            <span class="text-[10px] text-slate-500 font-bold">探索开箱</span>
          </div>
        </div>
      </div>

      <div class="space-y-1">
        <div id="subCategoryFilterBar" class="flex gap-2 overflow-x-auto no-scrollbar py-1"></div>
      </div>

      <div id="liveGrid" class="grid grid-cols-2 gap-3.5 pt-1"></div>
    </div>

    <!-- Tab 2: 社区总界面 (全新 6 宫格 & 导览中心) -->
  `);
  console.log('[live] 页面HTML已注入');
})();
