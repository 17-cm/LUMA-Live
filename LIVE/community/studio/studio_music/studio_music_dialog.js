// =========================================================================
// 【直播间音乐·弹窗】studio_music_dialog.js
// 职责：添加工具弹窗 / 工具行操作菜单 / 删除确认 / 帮助弹窗 / 错误闪烁
// 依赖：utils.js, storage.js
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;
  var escapeHtml = L.escapeHtml;

  function _clearNewToolFmtCache() {
    L._newToolFmtTitle = '';
    L._newToolFmtArtist = '';
    L._newToolFmtLyric = '';
    L._newToolFmtPlayUrl = '';
  }

  // ---- flashError：错误高亮 + toast -----------------------------------
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

  // ---- openHelpModal：帮助说明弹窗 ------------------------------------
  function openHelpModal(title, body) {
    if (document.getElementById('lmKeyHelpModal')) return;
    var h = document.createElement('div');
    h.id = 'lmKeyHelpModal';
    h.className = 'fixed inset-0 z-[10002] flex items-center justify-center px-6';
    h.style.backgroundColor = 'rgba(0,0,0,0.55)';
    h.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    h.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';
    h.innerHTML =
      '<div class="w-full max-w-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden">' +
        '<div class="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">' +
          '<h4 class="text-sm font-black text-slate-900">' + escapeHtml(title) + '</h4>' +
          '<button id="lmKeyHelpCloseBtn" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition" aria-label="关闭">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
        '<div class="px-5 py-4 text-[11px] text-slate-700 leading-relaxed">' + body + '</div>' +
      '</div>';
    h.onclick = function (e) { if (e.target === h) h.remove(); };
    h.querySelector('#lmKeyHelpCloseBtn').onclick = function () { h.remove(); };
    document.body.appendChild(h);
  }

  // ---- 工具行操作菜单（编辑/删除）-------------------------------------
  function openLiveMusicToolMenu(id) {
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === id; });
    if (!tool) return;
    if (document.getElementById('liveMusicToolMenu')) return;
    var dlg = document.createElement('div');
    dlg.id = 'liveMusicToolMenu';
    dlg.className = 'fixed inset-0 z-[10000] flex items-center justify-center px-6';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.5)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';
    dlg.innerHTML =
      '<div class="w-full max-w-[320px] bg-white rounded-3xl shadow-2xl overflow-hidden">' +
        '<div class="px-5 pt-5 pb-3">' +
          '<div class="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center mb-2.5 shadow-md">' +
            '<svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
          '</div>' +
          '<h4 class="text-base font-black text-slate-900 text-center truncate">' + escapeHtml(tool.name) + '</h4>' +
          '<p class="text-[11px] text-slate-500 text-center mt-1 truncate">' + escapeHtml(tool.method || 'GET') + ' · ' + escapeHtml(tool.url || '') + '</p>' +
        '</div>' +
        '<div class="px-3 pb-3 space-y-1">' +
          '<button id="lmToolEditBtn" class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:scale-[0.98] transition text-left">' +
            '<div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">' +
              '<svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>' +
            '</div>' +
            '<div class="flex-1">' +
              '<div class="text-xs font-black text-slate-900">编辑</div>' +
              '<div class="text-[10px] text-slate-500 mt-0.5">修改备注、URL、参数</div>' +
            '</div>' +
          '</button>' +
          '<button id="lmToolDeleteBtn" class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-50 active:scale-[0.98] transition text-left">' +
            '<div class="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">' +
              '<svg class="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>' +
            '</div>' +
            '<div class="flex-1">' +
              '<div class="text-xs font-black text-rose-500">删除</div>' +
              '<div class="text-[10px] text-rose-400 mt-0.5">永久移除该工具</div>' +
            '</div>' +
          '</button>' +
        '</div>' +
        '<div class="px-3 pb-3 border-t border-slate-100 pt-3">' +
          '<button id="lmToolCancelBtn" class="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
        '</div>' +
      '</div>';
    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);

    dlg.querySelector('#lmToolCancelBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#lmToolEditBtn').onclick = function () {
      dlg.remove();
      L.openLiveMusicAddModal(tool);
    };
    dlg.querySelector('#lmToolDeleteBtn').onclick = function () {
      dlg.remove();
      confirmDeleteTool(id);
    };
  }

  // ---- 删除确认 ---------------------------------------------------------
  function confirmDeleteTool(id) {
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === id; });
    if (!tool) return;
    if (document.getElementById('liveMusicToolDeleteConfirm')) return;
    var dlg = document.createElement('div');
    dlg.id = 'liveMusicToolDeleteConfirm';
    dlg.className = 'fixed inset-0 z-[10001] flex items-center justify-center px-6';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.55)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';
    dlg.innerHTML =
      '<div class="w-full max-w-[320px] bg-white rounded-3xl shadow-2xl px-6 pt-6 pb-5 text-center">' +
        '<div class="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-3">' +
          '<svg class="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>' +
        '</div>' +
        '<h4 class="text-base font-black text-slate-900">删除工具？</h4>' +
        '<p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">确定要删除「' + escapeHtml(tool.name) + '」吗？<br/>删除后无法恢复。</p>' +
        '<div class="flex gap-2.5 mt-5">' +
          '<button id="lmToolDelCancelBtn" class="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
          '<button id="lmToolDelConfirmBtn" class="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-rose-500 text-white text-xs font-black shadow-sm active:scale-95 transition">删除</button>' +
        '</div>' +
      '</div>';
    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);
    dlg.querySelector('#lmToolDelCancelBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#lmToolDelConfirmBtn').onclick = function () {
      window.liveMusicTools = (window.liveMusicTools || []).filter(function (t) { return t.id !== id; });
      if (window.liveMusicCurrentToolId === id) window.liveMusicCurrentToolId = null;
      L.saveSettings().then(function () {
        dlg.remove();
        if (window.AiPhone && window.AiPhone.ui && window.AiPhone.ui.toast) window.AiPhone.ui.toast('已删除');
        L.renderLiveMusicPage();
      });
    };
  }

  // ---- ➕ 添加工具 / 编辑工具弹窗 ------------------------------------
  function openLiveMusicAddModal(editTool) {
    if (document.getElementById('liveMusicAddModal')) return;
    var isEdit = !!editTool;

    var dlg = document.createElement('div');
    dlg.id = 'liveMusicAddModal';
    dlg.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/55';

    dlg.innerHTML =
      '<div class="w-[360px] max-w-[calc(100vw-40px)] bg-white rounded-3xl shadow-2xl flex flex-col overflow-y-auto max-h-[80vh]">' +
        '<div class="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">' +
          '<h4 class="text-base font-black text-slate-900">' + (isEdit ? '编辑工具' : '添加工具') + '</h4>' +
          '<button id="lmAddCloseBtn" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition" aria-label="关闭">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
        '<div id="lmAddContent" class="flex-1 overflow-y-auto px-5 py-3"></div>' +
        '<div class="px-5 py-3 border-t border-slate-100 flex gap-2">' +
          '<button id="lmAddCancelBtn" class="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
          '<button id="lmAddSaveBtn" class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-md active:scale-95 transition">保存</button>' +
        '</div>' +
      '</div>';

    dlg.onclick = function (e) {
      if (e.target === dlg) {
        _clearNewToolFmtCache();
        dlg.remove();
      }
    };
    document.body.appendChild(dlg);

    var currentMethod = (editTool && editTool.method) || 'GET';
    var paramRows = (editTool && Array.isArray(editTool.params) && editTool.params.length > 0)
      ? editTool.params.map(function (p) { return { key: p.key || '', value: p.value || '' }; })
      : [{ key: '', value: '' }];
    var searchKeyVal = (editTool && editTool.searchKey) || '';
    var detailKeyVal = (editTool && editTool.detailKey) || '';
    var toolNameVal = (editTool && editTool.name) || '';
    var toolUrlVal = (editTool && editTool.url) || '';
    var fmtTitleVal = (editTool && editTool.fmtTitle) || L._newToolFmtTitle;
    var fmtArtistVal = (editTool && editTool.fmtArtist) || L._newToolFmtArtist;
    var fmtLyricVal = (editTool && editTool.fmtLyric) || L._newToolFmtLyric;
    var fmtPlayUrlVal = (editTool && editTool.fmtPlayUrl) || L._newToolFmtPlayUrl;

    function renderApiPanel() {
      var liveSk = dlg.querySelector('#lmSearchKey');
      if (liveSk) searchKeyVal = liveSk.value;
      if (!editTool) {
        var liveFt = dlg.querySelector('#lmFmtTitle');
        if (liveFt) L._newToolFmtTitle = liveFt.value;
        var liveFa = dlg.querySelector('#lmFmtArtist');
        if (liveFa) L._newToolFmtArtist = liveFa.value;
        var liveFl = dlg.querySelector('#lmFmtLyric');
        if (liveFl) L._newToolFmtLyric = liveFl.value;
        var liveFp = dlg.querySelector('#lmFmtPlayUrl');
        if (liveFp) L._newToolFmtPlayUrl = liveFp.value;
      }
      var liveDk = dlg.querySelector('#lmDetailKey');
      if (liveDk) detailKeyVal = liveDk.value;
      var liveUrl = dlg.querySelector('#lmToolUrl');
      if (liveUrl) {
        if (editTool) editTool.url = liveUrl.value;
        else toolUrlVal = liveUrl.value;
      }
      var liveName = dlg.querySelector('#lmToolName');
      if (liveName) {
        if (editTool) editTool.name = liveName.value;
        else toolNameVal = liveName.value;
      }
      dlg.querySelectorAll('[data-param-row]').forEach(function (row) {
        var idx = parseInt(row.getAttribute('data-param-row'), 10);
        var k = row.querySelector('[data-param-key]');
        var v = row.querySelector('[data-param-value]');
        if (k && paramRows[idx]) paramRows[idx].key = k.value;
        if (v && paramRows[idx]) paramRows[idx].value = v.value;
      });

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
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">备注</label>' +
            '<input id="lmToolName" type="text" placeholder="例：我的网易云歌单" value="' + escapeHtml(editTool ? editTool.name : toolNameVal) + '" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求地址</label>' +
            '<input id="lmToolUrl" type="text" placeholder="https://api.example.com/api.php" value="' + escapeHtml(editTool ? editTool.url : toolUrlVal) + '" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求方式</label>' +
            '<div class="flex gap-2">' +
              '<button data-method="GET" class="flex-1 py-2 rounded-xl text-xs font-black transition border ' + (currentMethod === 'GET' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200') + '">GET</button>' +
              '<button data-method="POST" class="flex-1 py-2 rounded-xl text-xs font-black transition border ' + (currentMethod === 'POST' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200') + '">POST</button>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="flex items-center justify-between mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">默认参数</label>' +
              '<button id="lmParamAddBtn" class="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center shadow-sm active:scale-90 transition" aria-label="增加参数">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
              '</button>' +
            '</div>' +
            '<div id="lmParamRows">' + rows + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="flex items-center gap-1.5 mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">搜索框参数</label>' +
              '<button id="lmSearchKeyHelpBtn" class="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black active:scale-90 transition" aria-label="说明">?</button>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<input id="lmSearchKey" type="text" placeholder="例：name" value="' + escapeHtml(searchKeyVal) + '" ' +
                     'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
              '<div class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[10px] text-slate-400 flex items-center">搜索框输入</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="flex items-center gap-1.5 mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">二次请求参数</label>' +
              '<button id="lmDetailKeyHelpBtn" class="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black active:scale-90 transition" aria-label="说明">?</button>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<input id="lmDetailKey" type="text" placeholder="例：n（不填则跳过二级请求）" value="' + escapeHtml(detailKeyVal) + '" ' +
                     'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
              '<div class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[10px] text-slate-400 flex items-center">歌曲序号</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">返回格式（告诉系统哪个字段是哪个）</label>' +
            '<div class="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">' +
              '<div class="flex items-center gap-2 px-3 py-2.5">' +
                '<span class="text-[10px] font-black text-slate-500 w-16 flex-shrink-0">歌名</span>' +
                '<input id="lmFmtTitle" type="text" placeholder="name" value="' + escapeHtml(editTool ? (editTool.fmtTitle || '') : fmtTitleVal) + '" ' +
                       'class="flex-1 h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400" />' +
              '</div>' +
              '<div class="flex items-center gap-2 px-3 py-2.5">' +
                '<span class="text-[10px] font-black text-slate-500 w-16 flex-shrink-0">歌手</span>' +
                '<input id="lmFmtArtist" type="text" placeholder="singer" value="' + escapeHtml(editTool ? (editTool.fmtArtist || '') : fmtArtistVal) + '" ' +
                       'class="flex-1 h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400" />' +
              '</div>' +
              '<div class="flex items-center gap-2 px-3 py-2.5">' +
                '<span class="text-[10px] font-black text-slate-500 w-16 flex-shrink-0">歌词</span>' +
                '<input id="lmFmtLyric" type="text" placeholder="lyric" value="' + escapeHtml(editTool ? (editTool.fmtLyric || '') : fmtLyricVal) + '" ' +
                       'class="flex-1 h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400" />' +
              '</div>' +
              '<div class="flex items-center gap-2 px-3 py-2.5">' +
                '<span class="text-[10px] font-black text-slate-500 w-16 flex-shrink-0">播放URL</span>' +
                '<input id="lmFmtPlayUrl" type="text" placeholder="music_url" value="' + escapeHtml(editTool ? (editTool.fmtPlayUrl || '') : fmtPlayUrlVal) + '" ' +
                       'class="flex-1 h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400" />' +
              '</div>' +
            '</div>' +
            '<p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">填 API 返回的<b>字段名</b>，系统会用它去对应 JSON 里取值。留空 = 自动启发式匹配。</p>' +
          '</div>' +
        '</div>';

      dlg.querySelectorAll('[data-method]').forEach(function (b) {
        b.onclick = function () {
          currentMethod = b.getAttribute('data-method');
          dlg.querySelectorAll('[data-method]').forEach(function (x) {
            x.className = x.className.replace(/bg-slate-900 text-white border-slate-900|bg-white text-slate-600 border-slate-200/g, '');
            x.className += x.getAttribute('data-method') === currentMethod ? ' bg-slate-900 text-white border-slate-900' : ' bg-white text-slate-600 border-slate-200';
          });
        };
      });
      dlg.querySelector('#lmParamAddBtn').onclick = function () {
        paramRows.push({ key: '', value: '' });
        renderApiPanel();
      };
      var skHelpBtn = dlg.querySelector('#lmSearchKeyHelpBtn');
      if (skHelpBtn) skHelpBtn.onclick = function () {
        openHelpModal('搜索框参数说明',
          '<p>这里填写的是「<b>搜索框内容会发到哪个参数名</b>」。</p>' +
          '<p class="mt-2">比如你的接口：<br/><span class="font-mono text-slate-900">?token=xxx&name=江辰</span></p>' +
          '<p class="mt-2">「name」就是要填的内容（搜索框输入「江辰」，请求就带上 <span class="font-mono text-slate-900">name=江辰</span>）。</p>' +
          '<p class="mt-3 pt-3 border-t border-slate-100"><b>例：</b>你想搜索歌手，接口是 <span class="font-mono">?singer=xx</span>，这里就填 <span class="font-mono text-fuchsia-600">singer</span>。</p>' +
          '<p class="mt-2 text-slate-500 text-[10px]">这个参数是<strong>独立</strong>的，不需要在默认参数里预先添加！</p>'
        );
      };
      var dkHelpBtn = dlg.querySelector('#lmDetailKeyHelpBtn');
      if (dkHelpBtn) dkHelpBtn.onclick = function () {
        openHelpModal('二次请求参数说明',
          '<p>当你的接口需要「<b>分两次请求</b>」拿歌时配置：</p>' +
          '<p class="mt-2"><b>第 1 次：</b>搜索框输入关键词 → 接口返回歌曲<b>列表</b>（带序号）</p>' +
          '<p class="mt-2"><b>第 2 次：</b>点列表里某首后面的 ➕ → 自动用那首歌的序号再次请求 → 拿<b>详情</b>（含播放 URL / 封面）</p>' +
          '<p class="mt-2 pt-2 border-t border-slate-100">这里填的是「第 2 次请求时携带的<b>序号参数名</b>」。</p>' +
          '<p class="mt-2"><b>例：</b>你的接口是 <span class="font-mono">?token=xxx&name=江辰&n=1</span>，这里就填 <span class="font-mono text-fuchsia-600">n</span>。</p>' +
          '<p class="mt-2 text-slate-500 text-[10px]">这个参数是<strong>独立</strong>的，不需要在默认参数里预先添加！</p>'
        );
      };
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

    dlg.querySelector('#lmAddCloseBtn').onclick = function () { _clearNewToolFmtCache(); dlg.remove(); };
    dlg.querySelector('#lmAddCancelBtn').onclick = function () { _clearNewToolFmtCache(); dlg.remove(); };
    dlg.querySelector('#lmAddSaveBtn').onclick = function () {
      var name = ((dlg.querySelector('#lmToolName') || {}).value || '').trim();
      var url = ((dlg.querySelector('#lmToolUrl') || {}).value || '').trim();
      var fmtTitle = ((dlg.querySelector('#lmFmtTitle') || {}).value || '').trim();
      var fmtArtist = ((dlg.querySelector('#lmFmtArtist') || {}).value || '').trim();
      var fmtLyric = ((dlg.querySelector('#lmFmtLyric') || {}).value || '').trim();
      var fmtPlayUrl = ((dlg.querySelector('#lmFmtPlayUrl') || {}).value || '').trim();
      var searchKey = ((dlg.querySelector('#lmSearchKey') || {}).value || '').trim();
      var detailKey = ((dlg.querySelector('#lmDetailKey') || {}).value || '').trim();
      if (!name) { flashError(dlg, 'lmToolName', '请填写备注'); return; }
      if (!url) { flashError(dlg, 'lmToolUrl', '请填写请求地址'); return; }
      var cleanParams = paramRows
        .filter(function (p) { return p.key.trim() || p.value.trim(); })
        .map(function (p) { return { key: p.key.trim(), value: p.value.trim() }; });
      if (isEdit) {
        editTool.name = name;
        editTool.url = url;
        editTool.method = currentMethod;
        editTool.params = cleanParams;
        editTool.fmtTitle = fmtTitle;
        editTool.fmtArtist = fmtArtist;
        editTool.fmtLyric = fmtLyric;
        editTool.fmtPlayUrl = fmtPlayUrl;
        editTool.searchKey = searchKey;
        editTool.detailKey = detailKey;
        editTool.updatedAt = Date.now();
      } else {
        var tool = {
          id: 'tool_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: name,
          url: url,
          method: currentMethod,
          params: cleanParams,
          fmtTitle: fmtTitle,
          fmtArtist: fmtArtist,
          fmtLyric: fmtLyric,
          fmtPlayUrl: fmtPlayUrl,
          searchKey: searchKey,
          detailKey: detailKey,
          createdAt: Date.now()
        };
        window.liveMusicTools.push(tool);
        if (!window.liveMusicCurrentToolId) window.liveMusicCurrentToolId = tool.id;
      }
      L.saveSettings().then(function () {
        _clearNewToolFmtCache();
        dlg.remove();
        if (window.AiPhone && window.AiPhone.ui && window.AiPhone.ui.toast) window.AiPhone.ui.toast(isEdit ? '已保存' : '已添加工具');
        else if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast(isEdit ? '已保存' : '已添加工具');
        L.renderLiveMusicPage();
      });
    };

    renderApiPanel();
  }

  L.openLiveMusicAddModal = openLiveMusicAddModal;
  L.openLiveMusicToolMenu = openLiveMusicToolMenu;
  L.confirmDeleteTool = confirmDeleteTool;
  L.openHelpModal = openHelpModal;
  L.flashError = flashError;
})();
