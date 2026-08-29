// =========================================================================
// 【直播设置·直播间音乐】LIVE/community/module_live_music.js
// 负责：直播设置子页的歌单入口卡片 + 直播间音乐子页（页面栈第二级）
//       顶部状态卡 + 搜索框 + 工具列表（API 工具·本地导入/接口导入）
// 当前迭代：仅做页面 + 工具增删/选中，不调真接口
// =========================================================================
(function () {
  'use strict';

  // ---- 工具数据（API 工具，可多选一为当前） ------------------------
  var LIVE_MUSIC_TOOLS_KEY = 'live_music_tools';
  window.liveMusicTools = window.liveMusicTools || [];
  window.liveMusicCurrentToolId = window.liveMusicCurrentToolId || null;

  function loadTools() {
    try {
      var raw = localStorage.getItem(LIVE_MUSIC_TOOLS_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        window.liveMusicTools = Array.isArray(data.list) ? data.list : [];
        window.liveMusicCurrentToolId = data.current || null;
      }
    } catch (e) {}
  }
  function saveTools() {
    try {
      localStorage.setItem(LIVE_MUSIC_TOOLS_KEY, JSON.stringify({
        list: window.liveMusicTools,
        current: window.liveMusicCurrentToolId
      }));
    } catch (e) {}
  }
  loadTools();

  // ---- 页面栈：进入 / 返回直播间音乐子页 ----------------------------
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

  function closeLiveMusicSubPage() {
    if (window.PageStack) {
      window.PageStack.back();
    } else {
      var el = document.getElementById('communityLiveMusicView');
      if (el) el.classList.add('hidden');
    }
  }
  window.closeLiveMusicSubPage = closeLiveMusicSubPage;

  // ---- 渲染子页 -----------------------------------------------------
  function renderLiveMusicPage() {
    var box = document.getElementById('liveMusicContent');
    if (!box) return;

    box.innerHTML =
      // 顶部状态卡：当前播放 + 频谱条 + 右上 ➕
      '<div class="relative overflow-hidden rounded-3xl p-5 mb-4 bg-white border border-slate-100 shadow-sm">' +
        '<div class="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-fuchsia-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-blue-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="relative flex items-center gap-3 mb-3 pr-12">' +
          '<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md flex-shrink-0">' +
            '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-[10px] text-slate-500 font-bold tracking-wider">NOW PLAYING</div>' +
            '<div class="text-sm font-black text-slate-900 truncate">尚未选择音乐</div>' +
          '</div>' +
        '</div>' +
        // ➕ 右上角
        '<button onclick="openLiveMusicAddModal()" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white shadow-md active:scale-90 transition z-10" aria-label="添加工具">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
        '</button>' +
        // 频谱条
        '<div class="flex items-end gap-1 h-8 mb-1">' +
          [12, 22, 18, 28, 14, 26, 20, 32, 16, 24, 19, 30, 15, 22, 26, 18, 28, 14, 24, 20, 16, 28, 22, 14, 26, 18, 30, 16, 22, 12].map(function (h, i) {
            return '<div class="flex-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-blue-500" style="height:' + h + '%; animation: lumaBar ' + (1 + (i % 5) * 0.12).toFixed(2) + 's ease-in-out infinite alternate; animation-delay:' + (i * 0.04).toFixed(2) + 's;"></div>';
          }).join('') +
        '</div>' +
        '<div class="flex items-center justify-between mt-3">' +
          '<span class="text-[10px] text-slate-500 font-medium">' + window.liveMusicTools.length + ' 个工具 · ' + (window.liveMusicCurrentToolId ? '已选中' : '未选中') + '</span>' +
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

      // 工具区标题
      '<div class="flex items-center justify-between mb-2.5 px-1">' +
        '<h4 class="text-xs font-black text-slate-900 tracking-wide">我的工具</h4>' +
        '<span class="text-[10px] text-slate-400 font-medium">' + window.liveMusicTools.length + ' 个</span>' +
      '</div>' +

      // 工具列表 / 空态
      '<div id="liveMusicListArea" class="space-y-2">' + renderToolListHTML() + '</div>';
  }
  window.renderLiveMusicPage = renderLiveMusicPage;

  function renderToolListHTML() {
    if (!window.liveMusicTools || window.liveMusicTools.length === 0) {
      return '<div class="flex flex-col items-center justify-center py-12 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200">' +
        '<div class="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center mb-3">' +
          '<svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>' +
          '</svg>' +
        '</div>' +
        '<p class="text-sm font-black text-slate-900">还没有工具</p>' +
        '<p class="text-[11px] text-slate-500 mt-1.5 text-center">点卡片右上角 ➕ 添加你的第一个工具</p>' +
      '</div>';
    }
    return window.liveMusicTools.map(function (t) {
      var isCurrent = t.id === window.liveMusicCurrentToolId;
      return '<div class="flex items-center gap-3 p-3 rounded-2xl bg-white border ' + (isCurrent ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200') + '">' +
        '<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">' +
          '<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(t.name) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(t.method || 'GET') + ' · ' + escapeHtml(t.url || '') + '</div>' +
        '</div>' +
        // 选中灯
        '<button onclick="toggleLiveMusicTool(\'' + t.id + '\')" class="flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (isCurrent ? 'bg-fuchsia-500' : 'bg-slate-200') + '" aria-label="选中此工具">' +
          '<span class="absolute top-0.5 ' + (isCurrent ? 'left-[22px]' : 'left-0.5') + ' w-5 h-5 rounded-full bg-white shadow-sm transition-all"></span>' +
        '</button>' +
      '</div>';
    }).join('');
  }
  window.toggleLiveMusicTool = function (id) {
    window.liveMusicCurrentToolId = (window.liveMusicCurrentToolId === id) ? null : id;
    saveTools();
    renderLiveMusicPage();
  };

  // 简单转义
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- ➕ 弹窗 -------------------------------------------------------
  //   - 本地导入 / 设置接口导入（单弹窗内分两段按钮）
  //   - 设置接口导入：备注/URL/method/参数/返回格式
  function openLiveMusicAddModal() {
    if (document.getElementById('liveMusicAddModal')) return;

    var dlg = document.createElement('div');
    dlg.id = 'liveMusicAddModal';
    dlg.className = 'fixed inset-0 z-[10000] flex items-center justify-center px-5';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.55)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';

    dlg.innerHTML =
      '<div class="w-full max-w-[400px] max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">' +
        // 头部
        '<div class="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">' +
          '<h4 class="text-base font-black text-slate-900">添加工具</h4>' +
          '<button id="lmAddCloseBtn" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition" aria-label="关闭">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +

        // 模式切换
        '<div class="px-5 pt-3 pb-2 flex gap-2">' +
          '<button id="lmModeLocalBtn" class="flex-1 py-2 rounded-2xl text-xs font-black transition bg-slate-100 text-slate-500 active:scale-95">本地导入</button>' +
          '<button id="lmModeApiBtn" class="flex-1 py-2 rounded-2xl text-xs font-black transition bg-slate-900 text-white active:scale-95">设置接口导入</button>' +
        '</div>' +

        // 内容滚动区
        '<div id="lmAddContent" class="flex-1 overflow-y-auto px-5 py-3"></div>' +

        // 底部按钮
        '<div class="px-5 py-3 border-t border-slate-100 flex gap-2">' +
          '<button id="lmAddCancelBtn" class="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
          '<button id="lmAddSaveBtn" class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-md active:scale-95 transition">保存</button>' +
        '</div>' +
      '</div>';

    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);

    var mode = 'api'; // 'local' | 'api'
    var paramRows = [{ key: '', value: '' }];

    function renderMode() {
      var btns = dlg.querySelectorAll('#lmModeLocalBtn, #lmModeApiBtn');
      btns.forEach(function (b) { b.className = b.className.replace(/bg-(slate-900|slate-100)\s+text-(white|slate-500)/g, ''); });
      if (mode === 'local') {
        dlg.querySelector('#lmModeLocalBtn').className += ' bg-slate-900 text-white';
        dlg.querySelector('#lmModeApiBtn').className += ' bg-slate-100 text-slate-500';
        dlg.querySelector('#lmAddSaveBtn').style.display = 'none';
        renderLocalPanel();
      } else {
        dlg.querySelector('#lmModeApiBtn').className += ' bg-slate-900 text-white';
        dlg.querySelector('#lmModeLocalBtn').className += ' bg-slate-100 text-slate-500';
        dlg.querySelector('#lmAddSaveBtn').style.display = '';
        renderApiPanel();
      }
    }

    function renderLocalPanel() {
      dlg.querySelector('#lmAddContent').innerHTML =
        '<div class="flex flex-col items-center justify-center py-12 text-center">' +
          '<div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">' +
            '<svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
          '</div>' +
          '<p class="text-sm font-black text-slate-900">本地导入</p>' +
          '<p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">占位，等后续接入</p>' +
        '</div>';
    }

    function renderApiPanel() {
      var initialMethod = (dlg.querySelector('#lmAddContent') && dlg.querySelector('#lmAddContent').dataset.method) || 'GET';
      var rows = paramRows.map(function (r, i) {
        return '<div class="flex items-center gap-2 mb-2" data-param-row="' + i + '">' +
          '<input type="text" data-param-key placeholder="参数名" value="' + escapeHtml(r.key) + '" ' +
                 'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '<input type="text" data-param-value placeholder="值" value="' + escapeHtml(r.value) + '" ' +
                 'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          (paramRows.length > 1 ?
            '<button data-param-remove="' + i + '" class="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 active:scale-90 transition" aria-label="删除该参数">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            '</button>' :
            '<div class="w-9 h-9 flex-shrink-0"></div>'
          ) +
        '</div>';
      }).join('');

      dlg.querySelector('#lmAddContent').innerHTML =
        '<div class="space-y-3">' +
          // 备注
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">备注</label>' +
            '<input id="lmToolName" type="text" placeholder="例：我的网易云歌单" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          // 请求地址
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求地址</label>' +
            '<input id="lmToolUrl" type="text" placeholder="https://api.example.com/songs" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          // 请求方式
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求方式</label>' +
            '<div class="flex gap-2">' +
              '<button data-method="GET" class="flex-1 py-2 rounded-xl text-xs font-black transition border ' + (initialMethod === 'GET' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200') + '">GET</button>' +
              '<button data-method="POST" class="flex-1 py-2 rounded-xl text-xs font-black transition border ' + (initialMethod === 'POST' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200') + '">POST</button>' +
            '</div>' +
          '</div>' +
          // 添加参数
          '<div>' +
            '<div class="flex items-center justify-between mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">添加参数</label>' +
              '<button id="lmParamAddBtn" class="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center shadow-sm active:scale-90 transition" aria-label="增加参数">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
              '</button>' +
            '</div>' +
            '<div id="lmParamRows">' + rows + '</div>' +
          '</div>' +
          // 返回格式
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">返回格式</label>' +
            '<input id="lmToolFormat" type="text" placeholder="例：data.items[].title" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
            '<p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">用于从返回 JSON 中提取歌曲字段的路径表达式</p>' +
          '</div>' +
        '</div>';

      // 绑定 method 选择
      dlg.querySelectorAll('[data-method]').forEach(function (b) {
        b.onclick = function () {
          var m = b.getAttribute('data-method');
          dlg.querySelectorAll('[data-method]').forEach(function (x) {
            x.className = x.className.replace(/bg-slate-900\s+text-white\s+border-slate-900|bg-white\s+text-slate-600\s+border-slate-200/g, '');
            x.className += x.getAttribute('data-method') === m ? ' bg-slate-900 text-white border-slate-900' : ' bg-white text-slate-600 border-slate-200';
          });
          dlg.querySelector('#lmAddContent').dataset.method = m;
        };
      });
      dlg.querySelector('#lmAddContent').dataset.method = 'GET';

      // 增加参数
      dlg.querySelector('#lmParamAddBtn').onclick = function () {
        paramRows.push({ key: '', value: '' });
        renderApiPanel();
      };
      // 删除参数 / 同步输入
      dlg.querySelectorAll('[data-param-row]').forEach(function (row) {
        var idx = parseInt(row.getAttribute('data-param-row'), 10);
        row.querySelector('[data-param-key]').oninput = function (e) { paramRows[idx].key = e.target.value; };
        row.querySelector('[data-param-value]').oninput = function (e) { paramRows[idx].value = e.target.value; };
        var rm = row.querySelector('[data-param-remove]');
        if (rm) {
          rm.onclick = function () {
            paramRows.splice(idx, 1);
            renderApiPanel();
          };
        }
      });
    }

    dlg.querySelector('#lmModeLocalBtn').onclick = function () { mode = 'local'; renderMode(); };
    dlg.querySelector('#lmModeApiBtn').onclick = function () { mode = 'api'; renderMode(); };
    dlg.querySelector('#lmAddCloseBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#lmAddCancelBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#lmAddSaveBtn').onclick = function () {
      if (mode === 'local') return;
      var name = (dlg.querySelector('#lmToolName') || {}).value || '';
      var url = (dlg.querySelector('#lmToolUrl') || {}).value || '';
      var method = (dlg.querySelector('#lmAddContent') || {}).dataset || { method: 'GET' };
      var format = (dlg.querySelector('#lmToolFormat') || {}).value || '';
      if (!name.trim()) { flashError(dlg, 'lmToolName', '请填写备注'); return; }
      if (!url.trim()) { flashError(dlg, 'lmToolUrl', '请填写请求地址'); return; }
      var cleanParams = paramRows.filter(function (p) { return p.key.trim() || p.value.trim(); }).map(function (p) { return { key: p.key.trim(), value: p.value.trim() }; });
      var tool = {
        id: 'tool_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name.trim(),
        url: url.trim(),
        method: method.method || 'GET',
        params: cleanParams,
        format: format.trim(),
        createdAt: Date.now()
      };
      window.liveMusicTools.push(tool);
      if (!window.liveMusicCurrentToolId) window.liveMusicCurrentToolId = tool.id;
      saveTools();
      dlg.remove();
      renderLiveMusicPage();
    };

    renderMode();
  }
  window.openLiveMusicAddModal = openLiveMusicAddModal;

  function flashError(dlg, inputId, msg) {
    var el = dlg.querySelector('#' + inputId);
    if (!el) return;
    el.style.borderColor = '#ef4444';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast(msg);
    setTimeout(function () {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 1500);
  }
})();
