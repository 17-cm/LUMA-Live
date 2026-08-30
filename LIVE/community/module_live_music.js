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
        // 旧数据迁移：补 searchKey/detailKey 默认值
        window.liveMusicTools.forEach(function (t) {
          if (typeof t.searchKey === 'undefined') t.searchKey = 'name';
          if (typeof t.detailKey === 'undefined') t.detailKey = '';
          if (typeof t.params === 'undefined') t.params = [];
        });
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
    playUrl: ['url', 'playUrl', 'play_url', 'mp3Url', 'mp3_url', 'src', 'audioUrl', 'audio', 'music_url', 'link']
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

  // 解析 JSONPath 点路径：'data.music_url' → obj.data.music_url
  function pickByPath(obj, path) {
    if (!obj || !path) return '';
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return '';
      cur = cur[parts[i]];
    }
    return (cur == null) ? '' : String(cur);
  }

  // 解析用户在"返回格式"里填的多行 '字段=路径'
  // 例：
  //   title=data.name
  //   artist=data.singer
  //   pic=data.cover
  //   playUrl=data.music_url
  function parseFormatMap(formatStr) {
    var map = {};
    if (!formatStr) return map;
    var lines = String(formatStr).split(/[\r\n]+/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      var idx = line.indexOf('=');
      if (idx <= 0) continue;
      var key = line.slice(0, idx).trim();
      var val = line.slice(idx + 1).trim();
      if (key && val) map[key] = val;
    }
    return map;
  }

  // 从工具读取返回格式配置。空 → 启发式
  function getCurrentFormatMap() {
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    if (!tool) return {};
    return parseFormatMap(tool.format);
  }

  // 把 API 返回解析成歌曲数组 [{title, artist, pic, playUrl, rawId}]
  // 优先用工具的"返回格式"配置；空 → 启发式
  function parseSongsFromResponse(json) {
    if (json == null) return [];
    var fmtMap = getCurrentFormatMap();
    var useCustom = Object.keys(fmtMap).length > 0;

    var out = [];

    if (useCustom) {
      // 自定义 JSONPath：先看 json 本身是数组 / 是单个对象 / 数组在某个路径下
      var arr = pickByPath(json, fmtMap.__array || '');
      if (arr) {
        for (var j = 0; j < arr.length; j++) {
          var it0 = arr[j];
          if (!it0 || typeof it0 !== 'object') continue;
          var t0 = pickByPath(it0, fmtMap.title) || pickField(it0, FIELD_GUESS.title);
          if (!t0) continue;
          out.push({
            rawId: pickByPath(it0, fmtMap.rawId) || pickField(it0, ['n','id','songId','song_id','mid','trackId']) || '',
            n: it0.n || it0.N || '',
            title: t0,
            artist: pickByPath(it0, fmtMap.artist) || pickField(it0, FIELD_GUESS.artist) || '未知歌手',
            pic: pickByPath(it0, fmtMap.pic) || pickField(it0, FIELD_GUESS.pic) || '',
            playUrl: pickByPath(it0, fmtMap.playUrl) || pickField(it0, FIELD_GUESS.playUrl) || ''
          });
          if (out.length >= 50) break;
        }
        return out;
      }
      // 没在路径里找到数组 → 把整个 json 当单首
      var t1 = pickByPath(json, fmtMap.title) || pickField(json, FIELD_GUESS.title);
      if (t1) {
        out.push({
          rawId: pickByPath(json, fmtMap.rawId) || pickField(json, ['n','id','songId','song_id','mid','trackId']) || '',
          title: t1,
          artist: pickByPath(json, fmtMap.artist) || pickField(json, FIELD_GUESS.artist) || '未知歌手',
          pic: pickByPath(json, fmtMap.pic) || pickField(json, FIELD_GUESS.pic) || '',
          playUrl: pickByPath(json, fmtMap.playUrl) || pickField(json, FIELD_GUESS.playUrl) || ''
        });
      }
      return out;
    }

    // 启发式：找第一个数组
    var arr2 = findFirstArray(json);
    if (arr2) {
      for (var k = 0; k < arr2.length; k++) {
        var it1 = arr2[k];
        if (!it1 || typeof it1 !== 'object') continue;
        var title = pickField(it1, FIELD_GUESS.title);
        if (!title) continue;
        out.push({
          rawId: pickField(it1, ['n', 'id', 'songId', 'song_id', 'mid', 'trackId']) || '',
          n: it1.n || it1.N || '',
          title: title,
          artist: pickField(it1, FIELD_GUESS.artist) || '未知歌手',
          pic: pickField(it1, FIELD_GUESS.pic) || '',
          playUrl: pickField(it1, FIELD_GUESS.playUrl) || ''
        });
        if (out.length >= 50) break;
      }
      return out;
    }
    // 启发式兜底：把整个 json 当单首（你 API 格式就是这样：{code, data:{name,singer,...}, msg}）
    var singleTitle = pickField(json, FIELD_GUESS.title);
    if (singleTitle) {
      out.push({
        rawId: pickField(json, ['n', 'id', 'songId', 'song_id', 'mid', 'trackId']) || '',
        title: singleTitle,
        artist: pickField(json, FIELD_GUESS.artist) || '未知歌手',
        pic: pickField(json, FIELD_GUESS.pic) || '',
        playUrl: pickField(json, FIELD_GUESS.playUrl) || ''
      });
      return out;
    }
    // 终极兜底：json 里有 code/data/msg 这种 wrapper，剥掉 wrapper 再来一次
    if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
      var innerTitle = pickField(json.data, FIELD_GUESS.title);
      if (innerTitle) {
        out.push({
          rawId: pickField(json.data, ['n', 'id', 'songId', 'song_id', 'mid', 'trackId']) || '',
          title: innerTitle,
          artist: pickField(json.data, FIELD_GUESS.artist) || '未知歌手',
          pic: pickField(json.data, FIELD_GUESS.pic) || '',
          playUrl: pickField(json.data, FIELD_GUESS.playUrl) || ''
        });
      }
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
    mountFloatMusic();
  }
  window.openLiveMusicSubPage = openLiveMusicSubPage;

  function closeLiveMusicSubPage() {
    unmountFloatMusic();
    if (window.PageStack) {
      window.PageStack.back();
    } else {
      var el = document.getElementById('communityLiveMusicView');
      if (el) el.classList.add('hidden');
    }
  }
  window.closeLiveMusicSubPage = closeLiveMusicSubPage;

  // ---- 第三方悬浮音乐播放器（api.lsma.fun/float_music） ---------------
  var FLOAT_MUSIC_SRC = 'https://api.lsma.fun/float_music?embed=1';
  function mountFloatMusic() {
    if (document.getElementById('lsma-float-music-script')) return;
    var s = document.createElement('script');
    s.id = 'lsma-float-music-script';
    s.src = FLOAT_MUSIC_SRC;
    s.async = true;
    s.onload = function () { markFloatMusicStatus('loaded', '✅ 第三方脚本已加载（左下角应有 🎵 按钮）'); };
    s.onerror = function () { markFloatMusicStatus('error', '❌ 脚本加载失败（api.lsma.fun 网络不通）'); };
    document.body.appendChild(s);
    // 5 秒后如果还没触发 onload/onerror 也提示
    setTimeout(function () {
      if (!document.getElementById('lsma-float-music-status').dataset.state) {
        markFloatMusicStatus('timeout', '⏳ 脚本未响应（可能被拦截或网络慢）');
      }
    }, 5000);
  }
  function unmountFloatMusic() {
    var s = document.getElementById('lsma-float-music-script');
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var status = document.getElementById('lsma-float-music-status');
    if (status && status.parentNode) status.parentNode.removeChild(status);
    var candidates = document.querySelectorAll(
      '[id*="lsma"], [id*="float-music"], [id*="float_music"], [class*="lsma-float"], [class*="float-music"], [class*="float_music"]'
    );
    candidates.forEach(function (n) {
      try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch (e) {}
    });
  }
  function markFloatMusicStatus(state, msg) {
    var el = document.getElementById('lsma-float-music-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lsma-float-music-status';
      el.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:99999;padding:8px 14px;border-radius:14px;background:rgba(15,23,42,0.9);color:#fff;font-size:11px;font-weight:700;font-family:system-ui;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.dataset.state = state;
  }

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

      // 唯一显示区
      '<div id="liveMusicDisplayArea" class="min-h-[200px]">' + renderDisplayHTML() + '</div>';

    // 每次重渲染都重新绑搜索按钮（避免重渲染后事件丢失）
    bindSearchInput();
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
      var playUrl = s.playUrl;
      var playBtn = playUrl
        ? '<a href="' + escapeHtml(playUrl) + '" target="_blank" rel="noopener" class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 active:scale-90 transition" aria-label="播放" title="播放">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>' +
          '</a>'
        : '';
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 mb-2">' +
        '<div class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">' + cover + '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist) + '</div>' +
        '</div>' +
        playBtn +
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
        window.__liveMusicLastRawJson = json;
        window.__liveMusicDisplayMode = 'search';
        var songs = parseSongsFromResponse(json);
        if (!songs || songs.length === 0) {
          // 启发式+自定义都拿不到 → 兜底展示原始 JSON 让你看到 API 实际返回了什么
          area.innerHTML = renderRawJsonFallback(json);
          window.__liveMusicLastResult = null;
          return;
        }
        window.__liveMusicLastResult = songs;
        window.__liveMusicLastKeyword = keyword;
        showSearchResult(songs);
      });
    }).catch(function (e) {
      console.warn('[liveMusic] 搜索失败:', e);
      window.__liveMusicDisplayMode = 'search';
      area.innerHTML = '<div class="text-center py-12 text-[11px] text-rose-500">请求失败：' + escapeHtml(e && e.message ? e.message : String(e)) + '<br/><span class="text-slate-400">检查 URL / 参数 / CORS</span></div>';
      window.__liveMusicLastResult = null;
    });
  }

  // 把工具的 url+params 组装成 fetch 请求
  // 规则：
  //   - 搜索框的值补到 tool.searchKey 指定的参数上
  //   - tool.params 里其他参数按字面值
  //   - extraKv 可注入额外参数（如二级请求的 n=<序号>）
  //   - searchKey 为空 → 用「最后一个有 key 的参数」兜底
  function buildRequest(tool, keyword, extraKv) {
    var url = tool.url || '';
    var method = (tool.method || 'GET').toUpperCase();
    var params = Array.isArray(tool.params) ? tool.params : [];
    var searchKey = (tool.searchKey || '').trim();

    // 过滤出有 key 的参数
    var keyed = params.filter(function (p) { return p && p.key; });
    // 定位 searchKey 所在的参数；找不到则用最后一个
    var targetIdx = -1;
    if (searchKey) {
      targetIdx = keyed.findIndex(function (p) { return p.key === searchKey; });
    }
    if (targetIdx < 0) targetIdx = keyed.length - 1;

    function buildOne(p, idx) {
      var v = p.value || '';
      if (idx === targetIdx && keyword != null && String(keyword).length > 0) v = String(keyword);
      return encodeURIComponent(p.key) + '=' + encodeURIComponent(v);
    }

    var parts = keyed.map(function (p, idx) { return buildOne(p, idx); });

    // 注入 extraKv
    if (extraKv && typeof extraKv === 'object') {
      Object.keys(extraKv).forEach(function (k) {
        if (k == null) return;
        var v = extraKv[k];
        if (v == null) return;
        // 覆盖同 key
        var replaced = false;
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].split('=')[0] === encodeURIComponent(k)) { parts[i] = encodeURIComponent(k) + '=' + encodeURIComponent(v); replaced = true; break; }
        }
        if (!replaced) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      });
    }

    var qs = parts.join('&');
    var fullUrl = url;
    if (qs) fullUrl += (url.indexOf('?') >= 0 ? '&' : '?') + qs;

    var options = { method: method, headers: {} };
    if (method === 'POST') {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = qs;
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

  // 解析器拿不到任何歌曲时的兜底：直接把 API 原始 JSON 列出来
  // 标题/歌手/封面/链接四个字段，每行可点选哪个 JSON 字段 = 哪个
  // 选完点"应用映射"就把工具的 format 字段自动填好
  function renderRawJsonFallback(json) {
    // 收集所有 key 和 value（递归拍平）
    var flat = collectJsonPaths(json, '');
    if (flat.length === 0) {
      return '<div class="text-center py-12 text-[11px] text-slate-400">返回为空</div>';
    }
    // 字段名映射（按通用程度排序）
    var fieldRows = [
      { field: 'title',   label: '歌名',   guess: pickGuessFor(flat, FIELD_GUESS.title) },
      { field: 'artist',  label: '歌手',   guess: pickGuessFor(flat, FIELD_GUESS.artist) },
      { field: 'pic',     label: '封面',   guess: pickGuessFor(flat, FIELD_GUESS.pic) },
      { field: 'playUrl', label: '音频',   guess: pickGuessFor(flat, FIELD_GUESS.playUrl) }
    ];
    var header = '<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 mb-3">' +
      '<div class="text-xs font-black text-amber-900">未识别为歌曲列表</div>' +
      '<p class="text-[10px] text-amber-800 mt-1 leading-relaxed">API 返回了 JSON，但解析器没拿到歌曲。下面是返回的所有字段，挑 4 个对应到「歌名/歌手/封面/音频」，点「应用映射」保存到工具。</p>' +
    '</div>';

    var rows = fieldRows.map(function (r, idx) {
      var opts = '<option value="">— 选字段 —</option>' +
        flat.map(function (f) {
          var sel = (f.path === r.guess) ? ' selected' : '';
          return '<option value="' + escapeHtml(f.path) + '"' + sel + '>' + escapeHtml(f.path) + ' · ' + escapeHtml(f.sample) + '</option>';
        }).join('');
      return '<div class="flex items-center gap-2 mb-2">' +
        '<div class="w-14 text-[11px] font-black text-slate-700 flex-shrink-0">' + r.label + '</div>' +
        '<select data-field="' + r.field + '" class="flex-1 min-w-0 h-9 px-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:border-fuchsia-400">' + opts + '</select>' +
      '</div>';
    }).join('');

    var apply = '<button onclick="applyLiveMusicFormatFromFallback()" class="w-full mt-2 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-sm active:scale-95 transition">应用映射</button>';

    var dump = '<details class="mt-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">' +
      '<summary class="text-[11px] font-black text-slate-600 cursor-pointer">查看原始 JSON</summary>' +
      '<pre class="text-[10px] text-slate-700 mt-2 whitespace-pre-wrap break-all leading-relaxed font-mono">' + escapeHtml(JSON.stringify(json, null, 2).slice(0, 3000)) + '</pre>' +
    '</details>';

    return header + '<div class="rounded-2xl bg-white border border-slate-200 p-3">' + rows + apply + '</div>' + dump;
  }
  // 拍平 JSON：{path, sample, type}
  function collectJsonPaths(node, prefix) {
    var out = [];
    if (node == null) return out;
    if (Array.isArray(node)) {
      if (node.length === 0) return out;
      // 数组里看第一个元素的字段
      var first = node[0];
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        var sub = collectJsonPaths(first, prefix);
        out = out.concat(sub);
      } else {
        out.push({ path: prefix, sample: String(first), type: typeof first });
      }
      return out;
    }
    if (typeof node !== 'object') {
      out.push({ path: prefix, sample: String(node).slice(0, 30), type: typeof node });
      return out;
    }
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      var v = node[k];
      var p = prefix ? (prefix + '.' + k) : k;
      if (v == null) continue;
      if (typeof v === 'object') {
        var inner = collectJsonPaths(v, p);
        if (inner.length > 0) out = out.concat(inner);
        else out.push({ path: p, sample: '{}', type: 'object' });
      } else {
        out.push({ path: p, sample: String(v).slice(0, 30), type: typeof v });
      }
    }
    return out;
  }
  function pickGuessFor(flat, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      for (var j = 0; j < flat.length; j++) {
        // 路径最后一节匹配
        var lastSeg = flat[j].path.split('.').pop();
        if (lastSeg === c) return flat[j].path;
      }
    }
    return '';
  }
  // 点"应用映射" → 把 4 个 select 拼成多行字符串，写入当前工具的 format
  window.applyLiveMusicFormatFromFallback = function () {
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    if (!tool) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('请先选中工具');
      return;
    }
    var sels = document.querySelectorAll('#liveMusicDisplayArea select[data-field]');
    if (sels.length === 0) return;
    var lines = [];
    sels.forEach(function (sel) {
      var f = sel.getAttribute('data-field');
      var v = sel.value;
      if (v) lines.push(f + '=' + v);
    });
    if (lines.length === 0) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('请至少选一个字段');
      return;
    }
    tool.format = lines.join('\n');
    saveTools();
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已保存映射，请重新搜索');
  };

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
      return '<div onclick="openLiveMusicToolMenu(\'' + t.id + '\')" class="flex items-center gap-3 p-3 rounded-2xl bg-white border ' + (isCurrent ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200') + ' active:scale-[0.98] transition cursor-pointer">' +
        '<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">' +
          '<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(t.name) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(t.method || 'GET') + ' · ' + escapeHtml(t.url || '') + '</div>' +
        '</div>' +
        '<button onclick="event.stopPropagation();toggleLiveMusicTool(\'' + t.id + '\')" class="flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (isCurrent ? 'bg-fuchsia-500' : 'bg-slate-200') + '" aria-label="选中此工具">' +
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

  // 点工具行 → 居中弹窗：编辑 / 删除
  window.openLiveMusicToolMenu = function (id) {
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
      openLiveMusicAddModal(tool);
    };
    dlg.querySelector('#lmToolDeleteBtn').onclick = function () {
      dlg.remove();
      confirmDeleteTool(id);
    };
  };

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
      saveTools();
      dlg.remove();
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已删除');
      renderLiveMusicPage();
    };
  }

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
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });

    // 已有 URL / 封面 → 直接 push
    if (s.playUrl) {
      pushSongToLibrary(s, tool);
      return;
    }

    // 没 URL → 用 detailKey 发二级请求
    if (!tool) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('未选工具，无法获取 URL');
      return;
    }
    var detailKey = (tool.detailKey || '').trim();
    if (!detailKey) {
      // 没配 detailKey → 直接 push（无 URL）
      pushSongToLibrary(s, tool, true);
      return;
    }
    var lastKw = window.__liveMusicLastKeyword || '';
    var detailValue = s.n || s.rawId || '';
    if (!detailValue) {
      // 搜索结果里没有序号字段
      pushSongToLibrary(s, tool, true);
      return;
    }
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('正在获取「' + s.title + '」详情…');

    // 用 buildRequest：把 lastKw 当搜索词，detailValue 注入到 detailKey
    buildRequest(tool, lastKw, (function () {
      var o = {};
      o[detailKey] = detailValue;
      return o;
    })()).then(function (req) {
      return fetch(req.url, req.options).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (json) {
        var detail = parseSongsFromResponse(json);
        var match = null;
        if (detail && detail.length > 0) {
          match = detail.find(function (d) { return d.title === s.title; }) ||
                  detail.find(function (d) { return d.title && s.title && d.title.indexOf(s.title) >= 0; }) ||
                  detail[0];
        } else {
          // 单对象兜底
          var d2 = json.data || json;
          if (d2 && (d2.name || d2.music_url)) {
            match = {
              rawId: '',
              title: d2.name || s.title,
              artist: d2.singer || s.artist,
              pic: d2.cover || '',
              playUrl: d2.music_url || ''
            };
          }
        }
        if (match && (match.playUrl || match.pic)) {
          pushSongToLibrary(mergeSong(s, match), tool);
        } else {
          pushSongToLibrary(s, tool, true);
        }
      });
    }).catch(function (e) {
      console.warn('[liveMusic] 详情获取失败:', e);
      pushSongToLibrary(s, tool, true);
    });
  };

  function fetchByTool(tool, keyword, extraKv) {
    return buildRequest(tool, keyword, extraKv).then(function (req) {
      return fetch(req.url, req.options).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      });
    });
  }
  function pickBestMatch(detail, s) {
    if (!detail || detail.length === 0) return null;
    return detail.find(function (d) { return d.title === s.title; }) ||
           detail.find(function (d) { return d.title && s.title && d.title.indexOf(s.title) >= 0; }) ||
           detail[0];
  }
  function mergeSong(s, m) {
    return {
      rawId: s.rawId || m.rawId,
      title: m.title || s.title,
      artist: m.artist || s.artist,
      pic: m.pic || s.pic,
      playUrl: m.playUrl || s.playUrl
    };
  }

  // 实际写入歌曲库 + UI 刷新
  function pushSongToLibrary(s, tool, skipUrlCheck) {
    // 去重：同 rawId 或同 title+artist
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
      pic: s.pic,
      playUrl: s.playUrl,
      sourceToolId: tool ? tool.id : null,
      addedAt: Date.now()
    });
    saveSongs();
    if (window.api && window.api.ui && window.api.ui.toast) {
      if (skipUrlCheck || !s.playUrl) {
        window.api.ui.toast('已加入（无 URL）');
      } else {
        window.api.ui.toast('已加入歌曲库');
      }
    }
    refreshAfterAdd();
  }
  function refreshAfterAdd() {
    if (window.__liveMusicDisplayMode === 'search') {
      var area = document.getElementById('liveMusicDisplayArea');
      if (area) area.innerHTML = renderSearchResultHTML(window.__liveMusicLastResult);
    } else {
      renderLiveMusicPage();
    }
  }

  // ---- ➕ 弹窗（新增 / 编辑，编辑时传 editTool 预填） -----------------
  function openLiveMusicAddModal(editTool) {
    if (document.getElementById('liveMusicAddModal')) return;
    var isEdit = !!editTool;

    var dlg = document.createElement('div');
    dlg.id = 'liveMusicAddModal';
    dlg.className = 'fixed inset-0 z-[10000] flex items-center justify-center px-5';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.55)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';

    dlg.innerHTML =
      '<div class="w-full max-w-[400px] max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">' +
        '<div class="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">' +
          '<h4 class="text-base font-black text-slate-900">' + (isEdit ? '编辑工具' : '添加工具') + '</h4>' +
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
    var currentMethod = (editTool && editTool.method) || 'GET';
    var paramRows = (editTool && Array.isArray(editTool.params) && editTool.params.length > 0)
      ? editTool.params.map(function (p) { return { key: p.key || '', value: p.value || '' }; })
      : [{ key: '', value: '' }];
    var searchKeyVal = (editTool && editTool.searchKey) || 'name';
    var detailKeyVal = (editTool && editTool.detailKey) || '';

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
            '<input id="lmToolName" type="text" placeholder="例：我的网易云歌单" value="' + escapeHtml(editTool ? editTool.name : '') + '" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">请求地址</label>' +
            '<input id="lmToolUrl" type="text" placeholder="https://api.example.com/api.php" value="' + escapeHtml(editTool ? editTool.url : '') + '" ' +
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
            '<div class="flex items-center gap-1.5 mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">搜索框参数</label>' +
              '<button id="lmSearchKeyHelpBtn" class="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black active:scale-90 transition" aria-label="说明">?</button>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<input id="lmSearchKey" type="text" placeholder="例：name" value="' + escapeHtml(searchKeyVal) + '" ' +
                     'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
              '<div class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[10px] text-slate-400 flex items-center">请在搜索框输入</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="flex items-center gap-1.5 mb-1.5">' +
              '<label class="text-[10px] font-black text-slate-500 tracking-wider">二级请求参数（可选）</label>' +
              '<button id="lmDetailKeyHelpBtn" class="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black active:scale-90 transition" aria-label="说明">?</button>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<input id="lmDetailKey" type="text" placeholder="例：n（不填则跳过二级请求）" value="' + escapeHtml(detailKeyVal) + '" ' +
                     'class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
              '<div class="flex-1 h-9 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[10px] text-slate-400 flex items-center">序号</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="text-[10px] font-black text-slate-500 tracking-wider block mb-1.5">返回格式（可选）</label>' +
            '<input id="lmToolFormat" type="text" placeholder="留空则用启发式（自动找第一个数组）" value="' + escapeHtml(editTool ? (editTool.format || '') : '') + '" ' +
                   'class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />' +
            '<p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">不填 = 自动从返回 JSON 找第一个数组，按 name/singer/cover/music_url 等字段名启发式匹配歌名/歌手/封面/链接。<br/>支持多行 <b>字段=路径</b>，路径以返回 JSON 根为起点：<br/><span class="text-slate-500">title=data.name<br/>artist=data.singer<br/>pic=data.cover<br/>playUrl=data.music_url</span></p>' +
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

    // 帮助弹窗（searchKey / detailKey）
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
    dlg.querySelector('#lmModeLocalBtn').onclick = function () { mode = 'local'; renderMode(); };
    dlg.querySelector('#lmModeApiBtn').onclick = function () { mode = 'api'; renderMode(); };
    dlg.querySelector('#lmAddCloseBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#lmAddCancelBtn').onclick = function () { dlg.remove(); };
    var skHelp = dlg.querySelector('#lmSearchKeyHelpBtn');
    if (skHelp) skHelp.onclick = function () {
      openHelpModal('搜索框参数说明',
        '<p>这里填写的是「<b>搜索框内容会发到哪个参数名</b>」。</p>' +
        '<p class="mt-2">比如你的接口：<br/><span class="font-mono text-slate-900">?token=xxx&name=江辰</span></p>' +
        '<p class="mt-2">「name」就是要填的内容（搜索框输入「江辰」，请求就带上 <span class="font-mono text-slate-900">name=江辰</span>）。</p>' +
        '<p class="mt-2 text-slate-500">⚠️ 这个参数名必须已经在「添加参数」里填过。</p>' +
        '<p class="mt-3 pt-3 border-t border-slate-100"><b>例：</b>你想搜索歌手，接口是 <span class="font-mono">?singer=xx</span>，这里就填 <span class="font-mono text-fuchsia-600">singer</span>。</p>'
      );
    };
    var dkHelp = dlg.querySelector('#lmDetailKeyHelpBtn');
    if (dkHelp) dkHelp.onclick = function () {
      openHelpModal('二级请求参数说明',
        '<p>当你的接口需要「<b>分两次请求</b>」拿歌时配置：</p>' +
        '<p class="mt-2"><b>第 1 次：</b>搜索框输入关键词 → 接口返回歌曲<b>列表</b>（带序号）</p>' +
        '<p class="mt-2"><b>第 2 次：</b>点列表里某首后面的 ➕ → 自动用那首歌的序号再次请求 → 拿<b>详情</b>（含播放 URL / 封面）</p>' +
        '<p class="mt-2 pt-2 border-t border-slate-100">这里填的是「第 2 次请求时携带的<b>序号参数名</b>」。</p>' +
        '<p class="mt-2"><b>例：</b>你的接口是 <span class="font-mono">?token=xxx&name=江辰&n=1</span>，这里就填 <span class="font-mono text-fuchsia-600">n</span>。</p>' +
        '<p class="mt-2 text-slate-500">⚠️ 留空 = 不发二级请求，➕ 时直接用搜索结果入库（无 URL）。<br/>适用于接口一次性返回歌名+URL 的情况。</p>'
      );
    };
    dlg.querySelector('#lmAddSaveBtn').onclick = function () {
      if (mode === 'local') return;
      var name = ((dlg.querySelector('#lmToolName') || {}).value || '').trim();
      var url = ((dlg.querySelector('#lmToolUrl') || {}).value || '').trim();
      var format = ((dlg.querySelector('#lmToolFormat') || {}).value || '').trim();
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
        editTool.format = format;
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
          format: format,
          searchKey: searchKey,
          detailKey: detailKey,
          createdAt: Date.now()
        };
        window.liveMusicTools.push(tool);
        if (!window.liveMusicCurrentToolId) window.liveMusicCurrentToolId = tool.id;
      }
      saveTools();
      dlg.remove();
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast(isEdit ? '已保存' : '已添加工具');
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
