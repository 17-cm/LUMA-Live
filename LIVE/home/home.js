// 主页页面 - 静态HTML结构
(function () {
  'use strict';
  // 注入页面 HTML
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
<div id="tab-profile" class="tab-page hidden h-full overflow-y-auto no-scrollbar px-4 pb-28 space-y-4">
      <div class="luxe-card p-5 space-y-3.5">
        <div class="flex items-start justify-between">
          <div class="flex gap-3.5">
            <div class="relative">
              <div id="userAvatarContainer" class="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md">
                <img id="userAvatarBox" src="" class="w-full h-full rounded-full object-cover border-2 border-white">
              </div>
              <span class="absolute -bottom-1 -right-1 bg-slate-900 text-amber-300 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-amber-400/40">VIP 9</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h3 id="userName" class="font-black text-base text-slate-900">玩家</h3>
                <span id="userVBadge" class="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-sm border border-white">V</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">UID: <span id="displayUserUID">88291048</span> · IP属地: <span id="displayUserIP">LUMA</span></p>
              <div class="flex gap-1.5 mt-1.5" id="userTagsBox">
                <span class="text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded border border-rose-200" id="displayUserTag">新人主播</span>
              </div>
            </div>
          </div>
          <button id="userProfileEditBtn" onclick="toggleUserProfileEdit()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>

        <p id="userBioText" class="text-xs text-slate-600 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-white/60">
          “白天是理智社畜，深夜是某主播的头号榜一大哥。理性看播，感性砸车。”
        </p>

        <div class="grid grid-cols-4 text-center pt-1 border-t border-slate-100">
          <div onclick="openFollowListPageView()" class="cursor-pointer active:opacity-70">
            <p class="text-xs font-black text-rose-600" id="statFollowCount">1</p>
            <p class="text-[10px] text-slate-500 font-bold mt-0.5">关注 ›</p>
          </div>
          <div><p class="text-xs font-black text-slate-900" id="statFanCount">0</p><p class="text-[10px] text-slate-400 mt-0.5">粉丝</p></div>
          <div><p class="text-xs font-black text-slate-900" id="statLikeCount">0</p><p class="text-[10px] text-slate-400 mt-0.5">获赞</p></div>
          <div><p class="text-xs font-black text-slate-900" id="statMedalCount">0</p><p class="text-[10px] text-slate-400 mt-0.5">守护勋章</p></div>
        </div>
      </div>

      <!-- 黑金卡收益中心 -->
      <div onclick="openWalletPageView()" class="black-card p-5 cursor-pointer active:scale-98 transition space-y-3">
        <div class="flex justify-between items-center relative z-10">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-amber-400">✦</span>
            <span class="text-xs font-black tracking-wider text-amber-200 uppercase">LUMA Vault · 收益金库</span>
          </div>
          <span class="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">钱包与流水 ›</span>
        </div>
        <div class="relative z-10">
          <p class="text-[11px] text-slate-400">待提现收益 (LUMA 币)</p>
          <div class="mt-1 flex items-baseline gap-2">
            <span class="text-3xl font-black tracking-tight text-white" id="liveRevenueAmount">0</span>
            <span class="text-xs text-amber-400 font-bold">≈ 点击管理</span>
          </div>
        </div>
      </div>

      <!-- 双列守护排行榜 -->
      <div class="luxe-card p-4 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <div class="flex gap-4">
            <button onclick="switchRankTab('fans')" id="btnRankFans" class="text-xs font-black text-rose-600 border-b-2 border-rose-600 pb-1">粉丝守护榜</button>
            <button onclick="switchRankTab('my')" id="btnRankMy" class="text-xs font-bold text-slate-400 pb-1">我的守护榜</button>
          </div>
        </div>
        <div id="dualRankListContainer" class="space-y-2"></div>
      </div>

      <button onclick="openPlayerLiveView()" class="btn-brand w-full !py-3.5 justify-center text-xs font-black shadow-lg shadow-rose-500/20">
        <span>我要开播</span>
      </button>
    </div>

    <!-- Tab 4: 设置中心 -->
  `);
  console.log('[home] 页面HTML已注入');
})();
