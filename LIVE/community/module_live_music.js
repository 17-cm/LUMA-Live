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
      '<div class="relative overflow-hidden rounded-3xl p-5 mb-4 bg-white border border-slate-100 shadow-sm">' +
        '<div class="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-fuchsia-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-blue-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="relative flex items-center gap-3 mb-3">' +
          '<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md">' +
            '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-[10px] text-slate-500 font-bold tracking-wider">NOW PLAYING</div>' +
            '<div class="text-sm font-black text-slate-900 truncate">尚未选择音乐</div>' +
          '</div>' +
        '</div>' +
        // 频谱条
        '<div class="flex items-end gap-1 h-8 mb-1">' +
          [12, 22, 18, 28, 14, 26, 20, 32, 16, 24, 19, 30, 15, 22, 26, 18, 28, 14, 24, 20, 16, 28, 22, 14, 26, 18, 30, 16, 22, 12].map(function (h, i) {
            return '<div class="flex-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-blue-500" style="height:' + h + '%; animation: lumaBar ' + (1 + (i % 5) * 0.12).toFixed(2) + 's ease-in-out infinite alternate; animation-delay:' + (i * 0.04).toFixed(2) + 's;"></div>';
          }).join('') +
        '</div>' +
        '<div class="flex items-center justify-between mt-3">' +
          '<span class="text-[10px] text-slate-500 font-medium">0 首歌曲 · 0 个歌单</span>' +
        '</div>' +
      '</div>' +

      // 快捷操作行
      '<div class="grid grid-cols-3 gap-2 mb-4">' +
        [
          { icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>', label: '歌曲列表' },
          { icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>', label: '为 char 建造歌单' },
          { icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>', label: '我的工具' }
        ].map(function (it) {
          return '<button class="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white border border-slate-200 active:scale-95 transition">' +
            '<svg class="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
            '<span class="text-[10px] text-slate-700 font-bold">' + it.label + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +

      // 搜索框
      '<div class="relative mb-5">' +
        '<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
        '<input id="liveMusicSearchInput" type="text" placeholder="搜索歌曲、歌单、主播" ' +
               'class="w-full h-10 pl-10 pr-4 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 transition" />' +
      '</div>' +

      // 歌单标题
      '<div class="flex items-center justify-between mb-2.5 px-1">' +
        '<h4 class="text-xs font-black text-slate-900 tracking-wide">我的歌单</h4>' +
        '<span class="text-[10px] text-slate-400 font-medium">0 个</span>' +
      '</div>' +

      // 歌单列表占位区（空着，等你加内容）
      '<div id="liveMusicListArea" class="min-h-[200px]"></div>';
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
      '<div class="w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl bg-white">' +
        '<div class="px-6 pt-6 pb-3 text-center">' +
          '<div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center mb-3 shadow-lg">' +
            '<svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' +
            '</svg>' +
          '</div>' +
          '<h4 class="text-base font-black text-slate-900">新建歌单</h4>' +
          '<p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">为你的直播间挑选一首应景的背景音乐</p>' +
        '</div>' +
        '<div class="px-5 pb-5 space-y-2">' +
          [
            { icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>', title: '歌曲列表', sub: '查看已添加的歌曲' },
            { icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>', title: '为 char 建造歌单', sub: '为指定主播定制专属歌单' },
            { icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>', title: '我的工具', sub: '管理已收藏的资源' }
          ].map(function (it, i) {
            return '<button onclick="document.getElementById(\'liveMusicAddModal\').remove()" ' +
                    'class="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-[0.98] transition text-left">' +
              '<div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">' +
                '<svg class="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
              '</div>' +
              '<div class="flex-1 min-w-0">' +
                '<div class="text-xs font-black text-slate-900">' + it.title + '</div>' +
                '<div class="text-[10px] text-slate-500 mt-0.5">' + it.sub + '</div>' +
              '</div>' +
              '<svg class="w-4 h-4 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div class="px-5 pb-5">' +
          '<button onclick="document.getElementById(\'liveMusicAddModal\').remove()" ' +
                  'class="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition">取消</button>' +
        '</div>' +
      '</div>';
    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);
  }
  window.openLiveMusicAddModal = openLiveMusicAddModal;
})();
