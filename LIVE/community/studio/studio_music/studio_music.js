// =========================================================================
// 【直播间音乐·主入口】studio_music.js
// 职责：页面栈 / 主渲染 / 搜索 / 加歌 / 列表渲染
// 依赖：utils.js, storage.js, request.js, parser.js, dialog.js
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;
  var escapeHtml = L.escapeHtml;
  var doFetchJson = L.doFetchJson;
  var buildRequest = L.buildRequest;
  var parseSongsFromResponse = L.parseSongsFromResponse;
  var saveSettings = L.saveSettings;
  var uid = L.uid;
  var renderRawJsonFallback = L.renderRawJsonFallback;

  // ---- 页面栈：进入 / 返回直播间音乐子页 ---------------------------
  function openLiveMusicSubPage() {
    if (window.PageStack) {
      window.PageStack.open('communityLiveMusicView', { animationType: 'slide-right' });
    } else {
      var el = document.getElementById('communityLiveMusicView');
      if (el) el.classList.remove('hidden');
    }
    setTimeout(function () { renderLiveMusicPage(); bindSearchInput(); }, 60);
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

  // ---- 主渲染 ---------------------------------------------------------
  window.__liveMusicDisplayMode = window.__liveMusicDisplayMode || null;

  function renderLiveMusicPage() {
    var box = document.getElementById('liveMusicContent');
    if (!box) return;

    var currentTool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    var placeholder = '输入歌手、歌名、id、分享链接发送请求';

    box.innerHTML =
      // 顶部状态卡
      '<div class="relative overflow-hidden rounded-3xl p-5 mb-4 bg-white border border-slate-100 shadow-sm">' +
        '<div class="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-fuchsia-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-blue-200/40 blur-2xl pointer-events-none"></div>' +
        '<div class="relative flex items-center gap-3 mb-3 pr-12">' +
          '<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md flex-shrink-0">' +
            '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-[10px] text-slate-500 font-bold tracking-wider">NOW PLAYING</div>' +
            '<div class="text-sm font-black text-slate-900 truncate">' + (currentTool ? escapeHtml(currentTool.name || '当前工具') : '尚未选择工具') + '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="window.LM.openLiveMusicAddModal()" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white shadow-md active:scale-90 transition z-10" aria-label="添加工具">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
        '</button>' +
        '<div class="flex items-end gap-1 h-8 mb-1">' +
          [12, 22, 18, 28, 14, 26, 20, 32, 16, 24, 19, 30, 15, 22, 26, 18, 28, 14, 24, 20, 16, 28, 22, 14, 26, 18, 30, 16, 22, 12].map(function (h, i) {
            return '<div class="flex-1 rounded-full bg-gradient-to-t from-fuchsia-500 to-blue-500" style="height:' + h + '%; animation: lumaBar ' + (1 + (i % 5) * 0.12).toFixed(2) + 's ease-in-out infinite alternate; animation-delay:' + (i * 0.04).toFixed(2) + 's;"></div>';
          }).join('') +
        '</div>' +
        '<div class="flex items-center justify-between mt-3">' +
          '<span class="text-[10px] text-slate-500 font-medium">' + (window.liveMusicTools || []).length + ' 个工具 · 歌曲库 ' + (window.liveMusicSongs || []).length + ' 首</span>' +
        '</div>' +
      '</div>' +

      // 快捷入口 3 卡
      '<div class="grid grid-cols-3 gap-2 mb-4">' +
        [
          { key: 'songs', icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>', label: '歌曲列表' },
          { key: 'char_playlist', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>', label: '为 char 建造歌单' },
          { key: 'tools', icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>', label: '我的工具' }
        ].map(function (it) {
          var active = window.__liveMusicDisplayMode === it.key;
          return '<button onclick="switchLiveMusicDisplay(\'' + it.key + '\')" class="flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition ' + (active ? 'bg-fuchsia-50 border-fuchsia-300' : 'bg-white border-slate-200') + ' active:scale-95">' +
            '<svg class="w-5 h-5 ' + (active ? 'text-fuchsia-600' : 'text-slate-700') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + it.icon + '</svg>' +
            '<span class="text-[10px] font-black ' + (active ? 'text-fuchsia-700' : 'text-slate-700') + '">' + it.label + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +

      // 搜索框
      '<div class="relative mb-3">' +
        '<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
        '<input id="liveMusicSearchInput" type="text" placeholder="' + escapeHtml(placeholder) + '" ' +
               'class="w-full h-10 pl-10 pr-4 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 transition" />' +
        '<button id="liveMusicSearchBtn" class="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-xl bg-slate-900 text-white text-[10px] font-black active:scale-95 transition">搜索</button>' +
      '</div>' +

      // 唯一显示区
      '<div id="liveMusicDisplayArea" class="min-h-[200px]">' + renderDisplayHTML() + '</div>';

    bindSearchInput();
  }
  L.renderLiveMusicPage = renderLiveMusicPage;

  function renderDisplayHTML() {
    var mode = window.__liveMusicDisplayMode;
    if (!mode) return '';
    if (mode === 'search') {
      if (window.__liveMusicLastResult && window.__liveMusicLastResult.length > 0) return renderSearchResultHTML(window.__liveMusicLastResult);
      return '<div class="text-center py-12 text-[11px] text-slate-400">输入关键词开始搜索</div>';
    }
    if (mode === 'songs') return renderSongListHTML();
    if (mode === 'tools') return renderToolListHTML();
    if (mode === 'char_playlist') return renderCharPlaylistHTML();
    return '';
  }
  L.renderDisplayHTML = renderDisplayHTML;

  function renderCharPlaylistHTML() {
    return '<div class="flex flex-col items-center justify-center py-12 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200">' +
      '<div class="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center mb-3">' +
        '<svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
      '</div>' +
      '<p class="text-sm font-black text-slate-900">为 char 建造歌单</p>' +
      '<p class="text-[11px] text-slate-500 mt-1.5 text-center">等后续接入</p>' +
    '</div>';
  }

  window.switchLiveMusicDisplay = function (key) {
    window.__liveMusicDisplayMode = (window.__liveMusicDisplayMode === key) ? null : key;
    renderLiveMusicPage();
  };

  function renderSearchResultHTML(songs) {
    if (!songs || songs.length === 0) return '<div class="text-center py-12 text-[11px] text-slate-400">没有匹配的歌曲</div>';
    return songs.map(function (s, i) {
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 mb-2">' +
        '<div class="w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center">' +
          '<svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist) + '</div>' +
        '</div>' +
        '<button onclick="addLiveMusicSong(' + i + ')" class="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm active:scale-90 transition" aria-label="添加到歌曲库" title="添加">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  }

  // ---- 搜索框绑定 -----------------------------------------------------
  function bindSearchInput() {
    var input = document.getElementById('liveMusicSearchInput');
    var btn = document.getElementById('liveMusicSearchBtn');
    if (!input || !btn) return;
    var lastKw = '';
    function doSearch() {
      var kw = (input.value || '').trim();
      if (kw === lastKw && window.__liveMusicLastResult) {
        showSearchResult(window.__liveMusicLastResult);
        return;
      }
      lastKw = kw;
      runToolSearch(kw);
    }
    btn.onclick = doSearch;
    input.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    };
  }

  function runToolSearch(keyword) {
    var area = document.getElementById('liveMusicDisplayArea');
    if (!area) return;
    if (!keyword) {
      area.innerHTML = '<div class="text-center py-12 text-[11px] text-slate-400">输入关键词开始搜索</div>';
      window.__liveMusicLastResult = null;
      return;
    }
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    if (!tool) {
      area.innerHTML = '<div class="text-center py-12 text-[11px] text-rose-500">请先在"我的工具"中选中一个工具</div>';
      window.__liveMusicLastResult = null;
      return;
    }
    area.innerHTML = '<div class="text-center py-12 text-[11px] text-slate-400 flex items-center justify-center gap-2">' +
      '<svg class="w-4 h-4 animate-spin text-fuchsia-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>' +
      '正在搜索…</div>';

    buildRequest(tool, keyword).then(function (req) {
      return doFetchJson(req).then(function (json) {
        window.__liveMusicLastRawJson = json;
        window.__liveMusicDisplayMode = 'search';
        var songs = parseSongsFromResponse(json);
        if (!songs || songs.length === 0) {
          area.innerHTML = renderRawJsonFallback(json);
          window.__liveMusicLastResult = null;
          return;
        }
        window.__liveMusicLastResult = songs;
        window.__liveMusicLastKeyword = keyword;
        showSearchResult(songs);
      });
    }).catch(function (e) {
      if (window.console && window.console.warn) window.console.warn('[liveMusic] 搜索失败:', e);
      window.__liveMusicDisplayMode = 'search';
      area.innerHTML = '<div class="text-center py-12 text-[11px] text-rose-500">请求失败：' + escapeHtml(e && e.message ? e.message : String(e)) + '<br/><span class="text-slate-400">检查 URL / 参数 / CORS</span></div>';
      window.__liveMusicLastResult = null;
    });
  }

  function showSearchResult(songs) {
    window.__liveMusicLastResult = songs;
    window.__liveMusicDisplayMode = 'search';
    var area = document.getElementById('liveMusicDisplayArea');
    if (!area) return;
    area.innerHTML = renderSearchResultHTML(songs);
  }

  // ---- 工具列表渲染 ---------------------------------------------------
  function renderToolListHTML() {
    if (!window.liveMusicTools || window.liveMusicTools.length === 0) {
      return '<div class="flex flex-col items-center justify-center py-10 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200">' +
        '<div class="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center mb-3">' +
          '<svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
        '</div>' +
        '<p class="text-sm font-black text-slate-900">还没有工具</p>' +
        '<p class="text-[11px] text-slate-500 mt-1.5 text-center">点状态卡右上角 ➕ 添加你的第一个工具</p>' +
      '</div>';
    }
    return window.liveMusicTools.map(function (t) {
      var isCurrent = t.id === window.liveMusicCurrentToolId;
      return '<div onclick="window.LM.openLiveMusicToolMenu(\'' + t.id + '\')" class="flex items-center gap-3 p-3 rounded-2xl bg-white border ' + (isCurrent ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200') + ' active:scale-[0.98] transition cursor-pointer">' +
        '<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">' +
          '<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(t.name) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(t.method || 'GET') + ' · ' + escapeHtml(t.url || '') + '</div>' +
        '</div>' +
        '<button onclick="event.stopPropagation();window.toggleLiveMusicTool(\'' + t.id + '\')" class="flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (isCurrent ? 'bg-fuchsia-500' : 'bg-slate-200') + '" aria-label="选中此工具">' +
          '<span class="absolute top-0.5 ' + (isCurrent ? 'left-[22px]' : 'left-0.5') + ' w-5 h-5 rounded-full bg-white shadow-sm transition-all"></span>' +
        '</button>' +
      '</div>';
    }).join('');
  }
  window.toggleLiveMusicTool = function (id) {
    window.liveMusicCurrentToolId = (window.liveMusicCurrentToolId === id) ? null : id;
    saveSettings().then(function () { renderLiveMusicPage(); });
  };

  // ---- 歌曲列表渲染 ---------------------------------------------------
  function renderSongListHTML() {
    if (!window.liveMusicSongs || window.liveMusicSongs.length === 0) {
      return '<div class="flex flex-col items-center justify-center py-10 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200">' +
        '<div class="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center mb-3">' +
          '<svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
        '</div>' +
        '<p class="text-sm font-black text-slate-900">歌曲库是空的</p>' +
        '<p class="text-[11px] text-slate-500 mt-1.5 text-center">搜索后点 ➕ 加入歌曲库</p>' +
      '</div>';
    }
    return window.liveMusicSongs.map(function (s) {
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 mb-2">' +
        '<button onclick="playLiveMusicSongFromLibrary(\'' + s.id + '\')" class="w-11 h-11 rounded-xl flex-shrink-0 bg-white border-2 border-fuchsia-400 text-fuchsia-500 flex items-center justify-center active:scale-90 transition" aria-label="播放" title="播放">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>' +
        '</button>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist) + '</div>' +
        '</div>' +
        '<button onclick="askRemoveLiveMusicSong(\'' + s.id + '\', \'' + escapeHtml(s.title).replace(/'/g, "\\'") + '\')" class="flex-shrink-0 px-2.5 h-8 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold active:scale-90 transition" aria-label="从歌曲库移除" title="删除">删除</button>' +
      '</div>';
    }).join('');
  }
  window.playLiveMusicSongFromLibrary = function (id) {
    if (window.console && window.console.log) window.console.log('[liveMusic] 歌曲库播放键占位：', id);
  };
  window.askRemoveLiveMusicSong = function (id, title) {
    if (window.LM && typeof window.LM.confirmRemoveLiveMusicSong === 'function') {
      window.LM.confirmRemoveLiveMusicSong(id, title);
    } else if (window.confirm('确定删除「' + title + '」？')) {
      window.removeLiveMusicSong(id);
    }
  };

  // ---- 添加歌曲 --------------------------------------------------------
  function mergeSong(s, m) {
    return {
      rawId: s.rawId || m.rawId,
      title: m.title || s.title,
      artist: m.artist || s.artist,
      lyric: m.lyric || s.lyric,
      playUrl: m.playUrl || s.playUrl
    };
  }

  function pushSongToLibrary(s, tool, skipUrlCheck) {
    var exists = (window.liveMusicSongs || []).some(function (x) {
      if (s.rawId && x.rawId && s.rawId === x.rawId) return true;
      return x.title === s.title && x.artist === s.artist;
    });
    if (exists) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已在歌曲库中');
      refreshAfterAdd();
      return;
    }
    window.liveMusicSongs.push({
      id: uid(),
      rawId: s.rawId,
      title: s.title,
      artist: s.artist,
      lyric: s.lyric || '',
      playUrl: s.playUrl,
      sourceToolId: tool ? tool.id : null,
      addedAt: Date.now()
    });
    saveSettings().then(function () {
      if (window.AiPhone && window.AiPhone.ui && window.AiPhone.ui.toast) {
        if (skipUrlCheck || !s.playUrl) {
          window.AiPhone.ui.toast('已加入（无 URL）');
        } else {
          window.AiPhone.ui.toast('已加入歌曲库');
        }
      } else if (window.api && window.api.ui && window.api.ui.toast) {
        if (skipUrlCheck || !s.playUrl) {
          window.api.ui.toast('已加入（无 URL）');
        } else {
          window.api.ui.toast('已加入歌曲库');
        }
      }
      refreshAfterAdd();
    });
  }

  function refreshAfterAdd() {
    if (window.__liveMusicDisplayMode === 'search') {
      var area = document.getElementById('liveMusicDisplayArea');
      if (area) area.innerHTML = renderSearchResultHTML(window.__liveMusicLastResult);
    } else {
      renderLiveMusicPage();
    }
  }

  window.addLiveMusicSong = function (i) {
    var songs = window.__liveMusicLastResult;
    if (!songs || !songs[i]) return;
    var s = songs[i];
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });

    if (s.playUrl) {
      pushSongToLibrary(s, tool);
      return;
    }
    if (!tool) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('未选工具，无法获取 URL');
      return;
    }
    var detailKey = (tool.detailKey || '').trim();
    if (!detailKey) {
      pushSongToLibrary(s, tool, true);
      return;
    }
    var lastKw = window.__liveMusicLastKeyword || '';
    var detailValue = s.n || s.rawId || '';
    if (!detailValue) {
      pushSongToLibrary(s, tool, true);
      return;
    }
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('正在获取「' + s.title + '」详情…');

    buildRequest(tool, lastKw, (function () {
      var o = {};
      o[detailKey] = detailValue;
      return o;
    })()).then(function (req) {
      return doFetchJson(req).then(function (json) {
        var detail = parseSongsFromResponse(json);
        var match = null;
        if (detail && detail.length > 0) {
          match = detail.find(function (d) { return d.title === s.title; }) ||
                  detail.find(function (d) { return d.title && s.title && d.title.indexOf(s.title) >= 0; }) ||
                  detail[0];
        } else {
          var d2 = json.data || json;
          if (d2 && (d2.name || d2.music_url)) {
            match = {
              rawId: '',
              title: d2.name || s.title,
              artist: d2.singer || s.artist,
              lyric: d2.lyric || '',
              playUrl: d2.music_url || ''
            };
          }
        }
        if (match && (match.playUrl || match.lyric)) {
          pushSongToLibrary(mergeSong(s, match), tool);
        } else {
          pushSongToLibrary(s, tool, true);
        }
      });
    }).catch(function (e) {
      if (window.console && window.console.warn) window.console.warn('[liveMusic] 详情获取失败:', e);
      pushSongToLibrary(s, tool, true);
    });
  };
})();
