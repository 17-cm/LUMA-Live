// =========================================================================
// 【直播设置·直播间音乐】LIVE/community/module_live_music.js
// 职责：直播间音乐子页（页面栈第二级）
//   1) 顶部状态卡（右上 ➕）
//   2) 搜索框：触发当前工具的请求，展示解析后的歌曲列表
//   3) 工具列表：每个 API 工具配置（URL/方法/参数/返回格式）
//   4) 我的歌曲列表：把搜索结果中的歌加入此处
// 数据：localStorage
//   - live_music_tools: { list, current }
//   - live_music_songs: [ { id, title, artist, pic, playUrl, sourceToolId, addedAt } ]
// =========================================================================
(function () {
  'use strict';

  // ---- 数据层 ---------------------------------------------------------
  var TOOLS_KEY = 'live_music_tools';
  var SONGS_KEY = 'live_music_songs';
  var KEYWORD_PLACEHOLDER = '__KEYWORD__';

  window.liveMusicTools = window.liveMusicTools || [];
  window.liveMusicCurrentToolId = window.liveMusicCurrentToolId || null;
  window.liveMusicSongs = window.liveMusicSongs || [];

  function loadTools() {
    try {
      var raw = localStorage.getItem(TOOLS_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        window.liveMusicTools = Array.isArray(data.list) ? data.list : [];
        window.liveMusicCurrentToolId = data.current || null;
      }
    } catch (e) {}
  }
  function saveTools() {
    try {
      localStorage.setItem(TOOLS_KEY, JSON.stringify({
        list: window.liveMusicTools,
        current: window.liveMusicCurrentToolId
      }));
    } catch (e) {}
  }
  function loadSongs() {
    try {
      var raw = localStorage.getItem(SONGS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        window.liveMusicSongs = Array.isArray(arr) ? arr : [];
      }
    } catch (e) {}
  }
  function saveSongs() {
    try {
      localStorage.setItem(SONGS_KEY, JSON.stringify(window.liveMusicSongs || []));
    } catch (e) {}
  }
  loadTools();
  loadSongs();

  // ---- 工具函数 -------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() {
    return 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  function fmtTs(t) {
    if (!t) return '';
    var d = new Date(t);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // 字段启发式匹配：按候选名顺序找第一个命中的
  var FIELD_GUESS = {
    title:   ['name', 'title', 'songName', 'song_name', 'trackName', 'song', 'musicName', 'music_name'],
    artist:  ['artists', 'singer', 'ar_name', 'artist', 'singerName', 'author', 'singer_name', 'artist_name'],
    pic:     ['picUrl', 'pic', 'cover', 'pic_img', 'album_pic', 'picurl', 'coverUrl', 'coverImgUrl', 'image', 'pic_url'],
    playUrl: ['url', 'playUrl', 'play_url', 'mp3Url', 'mp3_url', 'src', 'audioUrl', 'audio']
  };
  function pickField(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < candidates.length; i++) {
      var k = candidates[i];
      if (obj[k] != null && String(obj[k]).length > 0) return String(obj[k]);
    }
    return '';
  }

  // 递归找 JSON 里第一个数组（深度优先）
  function findFirstArray(node) {
    if (Array.isArray(node)) return node;
    if (node && typeof node === 'object') {
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v = node[k];
        if (Array.isArray(v) && v.length > 0) return v;
        if (v && typeof v === 'object') {
          var sub = findFirstArray(v);
          if (sub) return sub;
        }
      }
    }
    return null;
  }

  // 启发式把 API 返回解析成歌曲数组 [{title, artist, pic, playUrl, rawId}]
  function parseSongsFromResponse(json) {
    var arr = findFirstArray(json);
    if (!arr) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it || typeof it !== 'object') continue;
      var title = pickField(it, FIELD_GUESS.title);
      if (!title) continue;
      out.push({
        rawId: pickField(it, ['id', 'songId', 'song_id', 'mid', 'trackId']) || '',
        title: title,
        artist: pickField(it, FIELD_GUESS.artist) || '未知歌手',
        pic: pickField(it, FIELD_GUESS.pic) || '',
        playUrl: pickField(it, FIELD_GUESS.playUrl) || ''
      });
      if (out.length >= 50) break;
    }
    return out;
  }

  // ---- 页面栈：进入 / 返回直播间音乐子页 ----------------------------
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
  // 当前显示区模式：null=空 | 'search' | 'songs' | 'tools' | 'char_playlist'
  window.__liveMusicDisplayMode = window.__liveMusicDisplayMode || null;

  function renderLiveMusicPage() {
    var box = document.getElementById('liveMusicContent');
    if (!box) return;

    var currentTool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    var placeholder = currentTool ? ('搜索 · 当前工具：' + (currentTool.name || '未命名')) : '请先在"我的工具"中选中一个工具';

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
        '<button onclick="openLiveMusicAddModal()" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white shadow-md active:scale-90 transition z-10" aria-label="添加工具">' +
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

      // 快捷入口 3 卡（点击切换显示区）
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

      // 搜索框（始终可见）
      '<div class="relative mb-3">' +
        '<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
        '<input id="liveMusicSearchInput" type="text" placeholder="' + escapeHtml(placeholder) + '" ' +
               'class="w-full h-10 pl-10 pr-4 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 transition" />' +
        '<button id="liveMusicSearchBtn" class="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-xl bg-slate-900 text-white text-[10px] font-black active:scale-95 transition">搜索</button>' +
      '</div>' +
      '<p class="text-[10px] text-slate-400 mb-4 leading-relaxed">提示：工具参数中用 <code class="px-1 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">__KEYWORD__</code> 表示搜索框内容</p>' +

      // 唯一显示区
      '<div id="liveMusicDisplayArea" class="min-h-[200px]">' + renderDisplayHTML() + '</div>';
  }
  window.renderLiveMusicPage = renderLiveMusicPage;

  // 显示区内容（互斥：搜索结果/歌曲库/工具/空）
  function renderDisplayHTML() {
    var mode = window.__liveMusicDisplayMode;
    if (!mode) return ''; // 空
    if (mode === 'search') {
      if (window.__liveMusicLastResult && window.__liveMusicLastResult.length > 0) return renderSearchResultHTML(window.__liveMusicLastResult);
      return '<div class="text-center py-12 text-[11px] text-slate-400">输入关键词开始搜索</div>';
    }
    if (mode === 'songs') return renderSongListHTML();
    if (mode === 'tools') return renderToolListHTML();
    if (mode === 'char_playlist') return renderCharPlaylistHTML();
    return '';
  }
  window.renderDisplayHTML = renderDisplayHTML;

  function renderCharPlaylistHTML() {
    return '<div class="flex flex-col items-center justify-center py-12 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200">' +
      '<div class="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center mb-3">' +
        '<svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
      '</div>' +
      '<p class="text-sm font-black text-slate-900">为 char 建造歌单</p>' +
      '<p class="text-[11px] text-slate-500 mt-1.5 text-center">等后续接入</p>' +
    '</div>';
  }

  // 切换显示区
  window.switchLiveMusicDisplay = function (key) {
    window.__liveMusicDisplayMode = (window.__liveMusicDisplayMode === key) ? null : key;
    renderLiveMusicPage();
  };

  function renderSearchResultHTML(songs) {
    if (!songs || songs.length === 0) return '<div class="text-center py-12 text-[11px] text-slate-400">没有匹配的歌曲</div>';
    return songs.map(function (s, i) {
      var pic = s.pic;
      var cover = pic
        ? '<img src="' + escapeHtml(pic) + '" class="w-full h-full object-cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="w-full h-full hidden items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'
        : '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>';
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 mb-2">' +
        '<div class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">' + cover + '</div>' +
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

  // 用当前选中的工具跑请求
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
      return fetch(req.url, req.options).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (json) {
        var songs = parseSongsFromResponse(json);
        window.__liveMusicLastResult = songs;
        showSearchResult(songs);
      });
    }).catch(function (e) {
      console.warn('[liveMusic] 搜索失败:', e);
      area.innerHTML = '<div class="text-center py-12 text-[11px] text-rose-500">请求失败：' + escapeHtml(e && e.message ? e.message : String(e)) + '<br/><span class="text-slate-400">检查 URL / 参数 / CORS</span></div>';
      window.__liveMusicLastResult = null;
    });
  }

  // 把工具的 url+params 组装成 fetch 请求，__KEYWORD__ 替换为搜索词
  function buildRequest(tool, keyword) {
    var url = tool.url || '';
    var method = (tool.method || 'GET').toUpperCase();
    var params = Array.isArray(tool.params) ? tool.params : [];

    // GET：参数拼到 query
    var qs = params
      .filter(function (p) { return p && (p.key || p.value); })
      .map(function (p) {
        var v = (p.value || '').replace(new RegExp(KEYWORD_PLACEHOLDER, 'g'), keyword);
        return encodeURIComponent(p.key) + '=' + encodeURIComponent(v);
      })
      .join('&');

    var fullUrl = url;
    if (qs) {
      fullUrl += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
    }

    var options = { method: method, headers: {} };
    if (method === 'POST') {
      // POST 同时发 form body 兼容旧 API
      var form = params
        .filter(function (p) { return p && (p.key || p.value); })
        .map(function (p) {
          return encodeURIComponent(p.key) + '=' + encodeURIComponent((p.value || '').replace(new RegExp(KEYWORD_PLACEHOLDER, 'g'), keyword));
        })
        .join('&');
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = form;
    }
    return Promise.resolve({ url: fullUrl, options: options });
  }

  // 搜索结果写入唯一显示区（不重渲染整个页面，保留输入框焦点）
  function showSearchResult(songs) {
    window.__liveMusicLastResult = songs;
    window.__liveMusicDisplayMode = 'search';
    var area = document.getElementById('liveMusicDisplayArea');
    if (!area) return;
    area.innerHTML = renderSearchResultHTML(songs);
  }

  // ---- 工具 / 歌曲 列表渲染 ------------------------------------------
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
      return '<div class="flex items-center gap-3 p-3 rounded-2xl bg-white border ' + (isCurrent ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200') + '">' +
        '<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">' +
          '<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(t.name) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(t.method || 'GET') + ' · ' + escapeHtml(t.url || '') + '</div>' +
        '</div>' +
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
      var pic = s.pic;
      var cover = pic
        ? '<img src="' + escapeHtml(pic) + '" class="w-full h-full object-cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" /><div class="w-full h-full hidden items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'
        : '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>';
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200">' +
        '<div class="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">' + cover + '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist) + '</div>' +
        '</div>' +
        '<button onclick="removeLiveMusicSong(\'' + s.id + '\')" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 active:scale-90 transition" aria-label="从歌曲库移除" title="移除">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  }
  window.removeLiveMusicSong = function (id) {
    window.liveMusicSongs = (window.liveMusicSongs || []).filter(function (s) { return s.id !== id; });
    saveSongs();
    renderLiveMusicPage();
  };

  // ---- 添加歌曲（从搜索结果索引 i） -----------------------------------
  window.addLiveMusicSong = function (i) {
    var songs = window.__liveMusicLastResult;
    if (!songs || !songs[i]) return;
    var s = songs[i];
    // 去重：同 rawId 或同 title+artist
    var exists = (window.liveMusicSongs || []).some(function (x) {
      if (s.rawId && x.rawId && s.rawId === x.rawId) return true;
      return x.title === s.title && x.artist === s.artist;
    });
    if (exists) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已在歌曲库中');
      return;
    }
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    window.liveMusicSongs.push({
      id: uid(),
      rawId: s.rawId,
      title: s.title,
      artist: s.artist,
      pic: s.pic,
      playUrl: s.playUrl,
      sourceToolId: tool ? tool.id : null,
      addedAt: Date.now()
    });
    saveSongs();
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已加入歌曲库');
    // 如果当前显示的是搜索结果，保留 mode 不重渲染整页（避免输入框失焦）
    if (window.__liveMusicDisplayMode === 'search') {
      var area = document.getElementById('liveMusicDisplayArea');
      if (area) area.innerHTML = renderSearchResultHTML(window.__liveMusicLastResult);
    } else {
      renderLiveMusicPage();
    }
  };

  // ---- ➕ 弹窗（同上版本，方法切换 className replace） -----------------
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
        '<div class="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">' +
          '<h4 class="text-base font-black text-slate-900">添加工具</h4>' +
          '<button id="lmAddCloseBtn" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition" aria-label="关闭">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
        '<div class="px-5 pt-3 pb-2 flex gap-2">' +
          '<button id="lmModeLocalBtn" class="flex-1 py-2 rounded-2xl text-xs font-black transition bg-slate-100 text-slate-500 active:scale-95">本地导入</button>' +
          '<button id="lmModeApiBtn" class="flex-1 py-2 rounded-2xl text-xs font-black transition bg-slate-900 text-white active:scale-95">设置接口导入</button>' +
        '</div>' +
        '<div id="lmAddContent" class="flex-1 overflow-y-auto px-5 py-3"></div>' +
        '<div class="px-5 py-3 border-t border-slate-100 flex gap-2">' +
          '<button id="lmAddCancelBtn" class="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
          '<button id="lmAddSaveBtn" class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-md active:scale-95 transition">保存</button>' +
        '</div>' +
      '</div>';

    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);

    var mode = 'api';
    var currentMethod = 'GET';
    var paramRows = [{ key: '', value: '' }];

    function renderMode() {
      var localBtn = dlg.querySelector('#lmModeLocalBtn');
      var apiBtn = dlg.querySelector('#lmModeApiBtn');
      localBtn.className = 'flex-1 py-2 rounded-2xl text-xs font-black transition active:scale-95 ' + (mode === 'local' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500');
      apiBtn.className = 'flex-1 py-2 rounded-2xl text-xs font-black transition active:scale-95 ' + (mode === 'api' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500');
      dlg.querySelector('#lmAddSaveBtn').style.display = mode === 'api' ? '' : 'none';
      if (mode === 'local') renderLocalPanel(); else renderApiPanel();
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
      var rows = paramRows.map(function (r, i) {
        return '<div class="flex items-center gap-2 mb-2" data-param-row="' + i + '">' +
          '<input type="text" data-param-key placeholder="参数名" value="' + escapeHtml(r.key) + '" ' +
                 'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '<input type="text" data-param-value placeholder="值(可用 __KEYWORD__)" value="' + escapeHtml(r.value) + '" ' +
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
            '<input id="lmToolName" type="text" placeholder="例：我的网易云歌单" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求地址</label>' +
            '<input id="lmToolUrl" type="text" placeholder="https://api.example.com/api.php" ' +
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
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">添加参数</label>' +
              '<button id="lmParamAddBtn" class="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center shadow-sm active:scale-90 transition" aria-label="增加参数">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
              '</button>' +
            '</div>' +
            '<div id="lmParamRows">' + rows + '</div>' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">返回格式（可选）</label>' +
            '<input id="lmToolFormat" type="text" placeholder="留空则用启发式（自动找第一个数组）" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
            '<p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">不填 = 自动从返回 JSON 找第一个数组，按 name/artists/picUrl/url 等字段名启发式匹配歌名/歌手/封面/链接</p>' +
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
      var name = ((dlg.querySelector('#lmToolName') || {}).value || '').trim();
      var url = ((dlg.querySelector('#lmToolUrl') || {}).value || '').trim();
      var format = ((dlg.querySelector('#lmToolFormat') || {}).value || '').trim();
      if (!name) { flashError(dlg, 'lmToolName', '请填写备注'); return; }
      if (!url) { flashError(dlg, 'lmToolUrl', '请填写请求地址'); return; }
      var cleanParams = paramRows
        .filter(function (p) { return p.key.trim() || p.value.trim(); })
        .map(function (p) { return { key: p.key.trim(), value: p.value.trim() }; });
      var tool = {
        id: 'tool_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name,
        url: url,
        method: currentMethod,
        params: cleanParams,
        format: format,
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
