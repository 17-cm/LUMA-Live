// =========================================================================
// 【直播设置·直播间音乐】LIVE/community/module_live_music.js
// 负责：直播设置子页的歌单入口卡片 + 直播间音乐子页（页面栈第二级）
//       顶部状态卡 + 歌单列表渲染（占位） + 右上 ➕ 弹窗（占位）
// 当前迭代：仅做页面，功能后做
// =========================================================================
(function () {
  'use strict';

  // 进入直播间音乐子页（页面栈：社区 -> 直播设置 -> 直播间音乐）
  function openLiveMusicSubPage() {
    if (window.PageStack) {
      window.PageStack.open('communityLiveMusicView', { animationType: 'slide-right' });
    } else {
      var el = document.getElementById('communityLiveMusicView');
      if (el) el.classList.remove('hidden');
    }
    setTimeout(function () { renderLiveMusicPage(); }, 60);
  }
  window.openLiveMusicSubPage = openLiveMusicSubPage;

  // 返回上一级
  function closeLiveMusicSubPage() {
    if (window.PageStack) {
      window.PageStack.back();
    } else {
      var el = document.getElementById('communityLiveMusicView');
      if (el) el.classList.add('hidden');
    }
  }
  window.closeLiveMusicSubPage = closeLiveMusicSubPage;

  // 渲染子页：顶部状态卡 + 歌单列表（占位）
  function renderLiveMusicPage() {
    var box = document.getElementById('liveMusicContent');
    if (!box) return;

    box.innerHTML =
      // 顶部状态卡：当前播放 + 频谱条装饰
      '<div class="relative overflow-hidden rounded-3xl p-5 mb-4" ' +
           'style="background: linear-gradient(135deg, rgba(217,70,239,0.35) 0%, rgba(59,130,246,0.35) 50%, rgba(16,185,129,0.25) 100%); ' +
                   'box-shadow: 0 8px 32px rgba(217,70,239,0.18);">' +
        '<div class="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-fuchsia-400/20 blur-2xl pointer-events-none"></div>' +
        '<div class="relative flex items-center gap-3 mb-3">' +
          '<div class="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20">' +
            '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-[10px] text-white/60 font-bold tracking-wider">NOW PLAYING</div>' +
            '<div class="text-sm font-black text-white truncate">尚未选择音乐</div>' +
          '</div>' +
        '</div>' +
        // 频谱条
        '<div class="flex items-end gap-1 h-8 mb-1">' +
          [12, 22, 18, 28, 14, 26, 20, 32, 16, 24, 19, 30, 15, 22, 26, 18, 28, 14, 24, 20, 16, 28, 22, 14, 26, 18, 30, 16, 22, 12].map(function (h, i) {
            return '<div class="flex-1 rounded-full bg-white/60" style="height:' + h + '%; animation: lumaBar ' + (1 + (i % 5) * 0.12).toFixed(2) + 's ease-in-out infinite alternate; animation-delay:' + (i * 0.04).toFixed(2) + 's;"></div>';
          }).join('') +
        '</div>' +
        '<div class="flex items-center justify-between mt-3">' +
          '<span class="text-[10px] text-white/70 font-medium">0 首歌曲 · 0 个歌单</span>' +
          '<button class="px-3 h-7 rounded-full bg-white text-slate-900 text-[10px] font-black tracking-wider active:scale-95 transition">浏览全部</button>' +
        '</div>' +
      '</div>' +

      // 快捷操作行
      '<div class="grid grid-cols-3 gap-2 mb-5">' +
        [
          { icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>', label: '本地音乐' },
          { icon: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>', label: '在线曲库' },
          { icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>', label: '我的收藏' }
        ].map(function (it) {
          return '<button class="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 active:scale-95 transition">' +
            '<svg class="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
            '<span class="text-[10px] text-white/80 font-bold">' + it.label + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +

      // 歌单标题
      '<div class="flex items-center justify-between mb-2.5 px-1">' +
        '<h4 class="text-xs font-black text-white tracking-wide">我的歌单</h4>' +
        '<span class="text-[10px] text-white/40 font-medium">0 个</span>' +
      '</div>' +

      // 空态：居中
      '<div class="flex flex-col items-center justify-center py-16 px-6 rounded-3xl bg-white/5 border border-white/10 border-dashed">' +
        '<div class="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-blue-500/30 flex items-center justify-center mb-3 ring-1 ring-white/15">' +
          '<svg class="w-7 h-7 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>' +
          '</svg>' +
        '</div>' +
        '<p class="text-sm font-black text-white/90">还没有歌单</p>' +
        '<p class="text-[11px] text-white/50 mt-1.5 text-center leading-relaxed">点击右上角 <span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white align-middle"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></span> 创建你的第一个歌单<br/>直播间就能循环播放啦</p>' +
        '<button onclick="openLiveMusicAddModal()" class="mt-5 px-5 h-9 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-lg active:scale-95 transition">+ 新建歌单</button>' +
      '</div>';
  }
  window.renderLiveMusicPage = renderLiveMusicPage;

  // 右上 ➕ 弹窗：居中、占位
  function openLiveMusicAddModal() {
    if (document.getElementById('liveMusicAddModal')) return;
    var dlg = document.createElement('div');
    dlg.id = 'liveMusicAddModal';
    dlg.className = 'fixed inset-0 z-[10000] flex items-center justify-center px-6';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.6)';
    dlg.style.backdropFilter = 'blur(8px)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';
    dlg.innerHTML =
      '<div class="w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl" ' +
           'style="background: linear-gradient(180deg, #1f1147 0%, #0f0820 100%);">' +
        '<div class="px-6 pt-6 pb-3 text-center">' +
          '<div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center mb-3 shadow-lg">' +
            '<svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' +
            '</svg>' +
          '</div>' +
          '<h4 class="text-base font-black text-white">新建歌单</h4>' +
          '<p class="text-[11px] text-white/50 mt-1.5 leading-relaxed">为你的直播间挑选一首应景的背景音乐</p>' +
        '</div>' +
        '<div class="px-5 pb-5 space-y-2">' +
          [
            { icon: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>', title: '从本地上传', sub: 'MP3 / WAV / M4A' },
            { icon: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>', title: '搜索在线曲库', sub: '千万首正版音乐' },
            { icon: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>', title: '从收藏导入', sub: '之前收藏的歌曲' }
          ].map(function (it, i) {
            return '<button onclick="document.getElementById(\'liveMusicAddModal\').remove()" ' +
                    'class="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-[0.98] transition text-left">' +
              '<div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">' +
                '<svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
              '</div>' +
              '<div class="flex-1 min-w-0">' +
                '<div class="text-xs font-black text-white">' + it.title + '</div>' +
                '<div class="text-[10px] text-white/50 mt-0.5">' + it.sub + '</div>' +
              '</div>' +
              '<svg class="w-4 h-4 text-white/30 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div class="px-5 pb-5">' +
          '<button onclick="document.getElementById(\'liveMusicAddModal\').remove()" ' +
                  'class="w-full py-2.5 rounded-2xl bg-white/10 text-white/80 text-xs font-bold active:scale-95 transition">取消</button>' +
        '</div>' +
      '</div>';
    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);
  }
  window.openLiveMusicAddModal = openLiveMusicAddModal;
})();
