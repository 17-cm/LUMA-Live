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
  var doFetchText = L.doFetchText;
  var isUrlLike = L.isUrlLike;
  var parseLrc = L.parseLrc;

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
    // 退出音乐界面直接暂停宿主代播（保留进度，回来可继续）
    if (window.LM && window.LM.pauseLiveMusicForExit) {
      try { window.LM.pauseLiveMusicForExit(); } catch (e) {}
    }
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
    var info = (window.LM.getLiveMusicPlaybackInfo && window.LM.getLiveMusicPlaybackInfo()) || {};
    var curSong = info.songId ? (window.liveMusicSongs || []).find(function (s) { return s.id === info.songId; }) : null;
    var cardTitle = curSong ? (curSong.title || '未知歌名') : '未知歌名';
    var cardArtist = curSong ? (curSong.artist || '未知歌手') : '未知歌手';
    var isPlaying = !!(info.playing);

    box.innerHTML =
      // 顶部状态卡（黑粗边框，参考手机播放器结构）
      '<div class="relative overflow-hidden rounded-3xl p-5 mb-4 bg-white/60 backdrop-blur-md border-2 border-black shadow-sm">' +
        // 主体：grid 三列 —— 封面 / 中间内容 / 右侧按键
        '<div class="relative grid grid-cols-[auto_1fr_auto] gap-4 items-stretch">' +
          // 封面（左侧上下居中，1:1 大尺寸，不被拉伸）——热搜同款 file 上传
          '<label class="relative aspect-square w-28 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 self-center flex-shrink-0 active:scale-95 transition cursor-pointer" aria-label="上传封面" title="点上传封面">' +
            '<img id="liveMusicCoverImg" src="' + escapeHtml(window.liveMusicCover || 'https://files.catbox.moe/d1jldl.png') + '" alt="" class="absolute inset-0 w-full h-full object-cover">' +
            '<input type="file" accept="image/*" style="display:none;" onchange="window.LM && window.LM.handleLiveMusicCoverUpload && window.LM.handleLiveMusicCoverUpload(event)">' +
          '</label>' +
          // 中间：按封面同高（h-full），三段按比例踩位置（顶/中/底）
          '<div class="min-w-0 h-full flex flex-col justify-between py-1">' +
            // 顶部：歌名（左对齐律动条头部）/ 歌手（右对齐律动条尾部）
            '<div class="min-w-0 flex flex-col">' +
              '<div id="liveMusicCardTitle" class="text-sm font-black text-slate-900 truncate text-left">' + escapeHtml(cardTitle) + '</div>' +
              '<div id="liveMusicCardArtist" class="text-[10px] text-slate-500 font-bold tracking-wider mt-0.5 truncate text-right">' + escapeHtml(cardArtist) + '</div>' +
            '</div>' +
            // 中部：黑粗线装饰（与卡片黑边框同粗 4px，纯视觉）
            '<div class="relative h-1 bg-black rounded-full" aria-hidden="true"></div>' +
            // 底部：上一首 / 播放(暂停切换) / 下一首（居中对称，向下偏移 2px）
            '<div class="flex items-center justify-center gap-4 mt-0.5">' +
              '<button onclick="window.LM && window.LM.playPrevSong && window.LM.playPrevSong()" class="w-[52px] h-[52px] rounded-full flex items-center justify-center text-black active:scale-90 transition" aria-label="上一首" title="上一首">' +
                '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z"/></svg>' +
              '</button>' +
              '<button id="liveMusicPlayBtn" onclick="window.LM && window.LM.toggleLiveMusicPlay && window.LM.toggleLiveMusicPlay()" class="w-[52px] h-[52px] rounded-full flex items-center justify-center text-black active:scale-90 transition" aria-label="播放/暂停" title="播放/暂停">' +
                (isPlaying ?
                  '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>' :
                  '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>'
                ) +
              '</button>' +
              '<button onclick="window.LM && window.LM.playNextSong && window.LM.playNextSong()" class="w-[52px] h-[52px] rounded-full flex items-center justify-center text-black active:scale-90 transition" aria-label="下一首" title="下一首">' +
                '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zm14-1h2v18h-2V3z"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          // 右侧：播放模式 + 添加工具（按封面高度按比例踩位置）
          '<div class="h-full flex flex-col justify-between items-stretch py-1">' +
            '<button id="liveMusicModeBtn" onclick="window.LM && window.LM.cycleLiveMusicPlayMode && window.LM.cycleLiveMusicPlayMode()" class="inline-flex items-center justify-center px-3 h-9 rounded-full border border-black bg-white text-black text-[10px] font-black tracking-wider active:scale-95 transition whitespace-nowrap" aria-label="切换播放模式">' +
              '<span id="liveMusicModeLabel">单曲循环</span>' +
            '</button>' +
            '<button onclick="window.LM && window.LM.openLiveMusicAddModal && window.LM.openLiveMusicAddModal()" class="inline-flex items-center justify-center px-3 h-9 rounded-full border border-black bg-white text-black text-[10px] font-black tracking-wider active:scale-95 transition whitespace-nowrap" aria-label="添加工具">' +
              '<span>添加工具</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        // 底部：歌词区（只显示当前播放到的一句，随进度自动切换）
        '<div class="mt-3 pt-2.5 border-t-2 border-dashed border-slate-200 min-h-[24px] flex items-center justify-center overflow-hidden">' +
          '<div id="liveMusicLyricBox" class="w-full">' +
            (curSong && curSong.lyric ? '' : '<div class="lm-lyric-line lm-lyric-on text-center">暂无歌词</div>') +
          '</div>' +
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
    applyLiveMusicModeBtn();
    updateLiveMusicCard();
  }
  L.renderLiveMusicPage = renderLiveMusicPage;

  // ---- 播放模式按键（单击循环切换）----------------------------------
  var LIVE_MUSIC_MODE_LIST = [
    { label: '单曲循环' },
    { label: '列表循环' },
    { label: '随机播放' }
  ];
  window.__liveMusicModeList = LIVE_MUSIC_MODE_LIST;
  window.__liveMusicPlayMode = (typeof window.__liveMusicPlayMode === 'number') ? window.__liveMusicPlayMode : 0;

  function applyLiveMusicModeBtn() {
    var labelEl = document.getElementById('liveMusicModeLabel');
    if (!labelEl) return;
    var m = LIVE_MUSIC_MODE_LIST[window.__liveMusicPlayMode] || LIVE_MUSIC_MODE_LIST[0];
    labelEl.textContent = m.label;
  }

  // ---- 封面图片应用：异步把 user cover dataURL 写入 img src ---------
  function applyLiveMusicCover() {
    var img = document.getElementById('liveMusicCoverImg');
    if (!img) return;
    if (window.liveMusicCover) img.src = window.liveMusicCover;
  }

  function cycleLiveMusicPlayMode() {
    window.__liveMusicPlayMode = (window.__liveMusicPlayMode + 1) % LIVE_MUSIC_MODE_LIST.length;
    applyLiveMusicModeBtn();
  }
  L.cycleLiveMusicPlayMode = cycleLiveMusicPlayMode;

  // ---- 播放器状态卡刷新：进度条 + 歌词 + 播放按钮图标 -------------------
  // 歌词支持 LRC 时间戳：按模拟进度定位当前行；纯文本取首行
  var _currentLyricLines = null;
  var _currentLyricPlain = '';

  function _updateLyricBox(elapsedMs) {
    var box = document.getElementById('liveMusicLyricBox');
    if (!box) return;
    if (_currentLyricLines && _currentLyricLines.length > 0) {
      var lines = _currentLyricLines;
      var idx = 0;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].t <= (elapsedMs || 0)) idx = i;
      }
      box.innerHTML = '<div class="lm-lyric-line lm-lyric-on text-center">' + escapeHtml(lines[idx].text) + '</div>';
      return;
    }
    if (_currentLyricPlain) {
      box.innerHTML = '<div class="lm-lyric-line lm-lyric-on text-center">' + escapeHtml(_currentLyricPlain) + '</div>';
      return;
    }
    box.innerHTML = '<div class="lm-lyric-line lm-lyric-on text-center">暂无歌词</div>';
  }

  // 歌曲切换时准备好歌词数据（LRC 解析 or 纯文本占位）
  function updateLiveMusicCard() {
    var info = (window.LM.getLiveMusicPlaybackInfo && window.LM.getLiveMusicPlaybackInfo()) || {};
    var curSong = info.songId ? (window.liveMusicSongs || []).find(function (s) { return s.id === info.songId; }) : null;

    var titleEl = document.getElementById('liveMusicCardTitle');
    if (titleEl) titleEl.textContent = curSong ? (curSong.title || '未知歌名') : '未知歌名';
    var artistEl = document.getElementById('liveMusicCardArtist');
    if (artistEl) artistEl.textContent = curSong ? (curSong.artist || '未知歌手') : '未知歌手';

    // 当前歌名/歌手变化时重新准备歌词行
    var id = curSong ? curSong.id : null;
    if (id !== window.LM._liveMusicCardSongId) {
      window.LM._liveMusicCardSongId = id;
      _currentLyricLines = null;
      _currentLyricPlain = '';
      if (curSong && curSong.lyric) {
        var lrc = parseLrc(curSong.lyric);
        if (lrc.length > 1 || (lrc.length === 1 && lrc[0].t > 0)) _currentLyricLines = lrc;
        else if (lrc.length === 1) _currentLyricPlain = lrc[0].text;
      }
    }

    // 歌词按当前模拟进度定位当前句（律动条为恒定律动装饰，无需在此更新）
    _updateLyricBox(info.elapsedMs || 0);

    // 播放/暂停图标
    var playBtn = document.getElementById('liveMusicPlayBtn');
    if (playBtn) {
      if (info.playing) {
        playBtn.innerHTML = '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';
      } else {
        playBtn.innerHTML = '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>';
      }
    }
  }
  L.updateLiveMusicCard = updateLiveMusicCard;

  // 注册播放器事件钩子（幂等，多次调用只覆盖回调）
  if (window.LM.onLiveMusicState) window.LM.onLiveMusicState(function () { updateLiveMusicCard(); });
  if (window.LM.onLiveMusicTick) window.LM.onLiveMusicTick(function (elapsedMs) {
    // 进度条不随播放移动，仅维持珠子律动；歌词按时间轴自动滚动切换
    _updateLyricBox(elapsedMs || 0);
  });
  if (window.LM.onLiveMusicPlayStart) window.LM.onLiveMusicPlayStart(function () { updateLiveMusicCard(); });

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

  // ---- char 歌单 -------------------------------------------------------
  // 从宿主拿到 char 列表（含头像/名字），按 id 匹配歌单数据
  function _loadCharList() {
    return Promise.resolve().then(function () {
      if (window.api && window.api.characters && typeof window.api.characters.list === 'function') {
        return window.api.characters.list();
      }
      if (window.AiPhone && window.AiPhone.characters && typeof window.AiPhone.characters.list === 'function') {
        return window.AiPhone.characters.list();
      }
      return null;
    }).then(function (chars) {
      if (chars && Array.isArray(chars) && chars.length > 0) {
        return chars;
      }
      // 兜底：用当前主播列表（liveList + allCharacters 聚合）
      if (typeof window.getAvailableCharsList === 'function') return window.getAvailableCharsList();
      return [];
    });
  }

  // 某个 char 的歌单歌曲对象列表（按 songIds 关联回全局歌曲库）
  function _charPlaylistSongs(charId) {
    var pl = (window.liveMusicCharPlaylists || {})[charId];
    if (!pl) return [];
    var ids = Array.isArray(pl.songIds) ? pl.songIds : [];
    return ids.map(function (id) {
      return (window.liveMusicSongs || []).find(function (s) { return s.id === id; }) || null;
    }).filter(Boolean);
  }

  window.__liveMusicCharDrawer = window.__liveMusicCharDrawer || null; // 当前展开抽屉的 charId

  function renderCharPlaylistHTML() {
    // 返回完整 HTML（说明 + char 列表骨架）；DOM 挂载后用 setTimeout 异步填充 char 列表
    var html =
      // 顶部说明
      '<div class="rounded-2xl bg-slate-900 text-white p-3 mb-3 flex items-start gap-2.5">' +
        '<svg class="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
        '<p class="text-[11px] font-bold leading-relaxed">建造歌单后，直播时只会播放该 char 的歌单；没有歌单则会随机播放歌曲列表。</p>' +
      '</div>' +
      // char 列表
      '<div id="charPlaylistList" class="space-y-2">' +
        '<div class="text-center py-10 text-[11px] text-slate-400">加载主播列表…</div>' +
      '</div>';
    setTimeout(function () { renderCharPlaylistList(); }, 0);
    return html;
  }
  L.renderCharPlaylistHTML = renderCharPlaylistHTML;

  function renderCharPlaylistList() {
    var listBox = document.getElementById('charPlaylistList');
    if (!listBox) return;
    _loadCharList().then(function (chars) {
      if (!chars || chars.length === 0) {
        listBox.innerHTML = '<div class="text-center py-10 text-[11px] text-slate-400">暂无可用主播</div>';
        return;
      }
      listBox.innerHTML = chars.map(function (c) {
        var cid = String(c.id || c.characterId || '');
        if (!cid) return '';
        var name = c.name || c.characterName || '主播';
        var avatar = c.avatar || (typeof window.getAvatar === 'function' ? window.getAvatar(name, 'first') : '');
        var pl = (window.liveMusicCharPlaylists || {})[cid];
        var cnt = (pl && Array.isArray(pl.songIds)) ? pl.songIds.filter(function (id) { return (window.liveMusicSongs || []).some(function (s) { return s.id === id; }); }).length : 0;
        var expanded = window.__liveMusicCharDrawer === cid;
        return renderCharRow(cid, name, avatar, cnt, expanded);
      }).join('');
      bindCharPlaylistRows();
    });
  }
  L.renderCharPlaylistList = renderCharPlaylistList;

  function renderCharRow(cid, name, avatar, cnt, expanded) {
    return (
      '<div class="rounded-2xl bg-white border border-slate-200 overflow-hidden">' +
        // 主行：头像 + {{char}}歌单 + 右侧向下小箭头
        '<div class="flex items-center gap-3 p-2.5">' +
          '<div class="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-slate-200 bg-slate-100">' +
            (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" class="w-full h-full object-cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                       '<div class="w-full h-full hidden items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><span class="text-xs font-black text-slate-500">' + escapeHtml(name.charAt(0)) + '</span></div>'
                     : '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-100 to-blue-100"><span class="text-xs font-black text-slate-500">' + escapeHtml(name.charAt(0)) + '</span></div>') +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(name) + ' · 歌单</div>' +
            '<div class="text-[10px] text-slate-500 mt-0.5">' + (cnt > 0 ? '已收录 ' + cnt + ' 首' : '还没有歌曲') + '</div>' +
          '</div>' +
          '<button data-char-toggle="' + escapeHtml(cid) + '" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition flex-shrink-0" aria-label="展开/收起歌单">' +
            '<svg class="w-4 h-4 ' + (expanded ? 'rotate-180' : '') + ' transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
          '</button>' +
        '</div>' +
        // 抽屉（下拉展开）
        (expanded ? renderCharDrawer(cid, name) : '') +
      '</div>'
    );
  }
  L.renderCharRow = renderCharRow;

  // 抽屉：第一个按键"添加歌曲"，下面显示已收录歌曲
  function renderCharDrawer(cid, name) {
    var songs = _charPlaylistSongs(cid);
    return (
      '<div class="border-t border-slate-100 bg-slate-50 px-2.5 pb-2.5 pt-2">' +
        '<button data-char-add="' + escapeHtml(cid) + '" data-char-name="' + escapeHtml(name || '') + '" class="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-900 text-white text-[11px] font-black active:scale-[0.98] transition">' +
          '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
          '添加歌曲' +
        '</button>' +
        '<div class="mt-2 space-y-1.5">' +
          (songs.length === 0
            ? '<div class="text-center py-4 text-[10px] text-slate-400">歌单还是空的，点上方「添加歌曲」收录几首吧</div>'
            : songs.map(function (s, i) {
                return '<div class="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100">' +
                  renderSongThumb(s.cover, 'w-8 h-8') +
                  '<div class="flex-1 min-w-0">' +
                    '<div class="text-[11px] font-bold text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
                    '<div class="text-[9px] text-slate-500 truncate">' + escapeHtml(s.artist || '') + '</div>' +
                  '</div>' +
                  '<button data-char-remove="' + escapeHtml(cid) + '" data-song-id="' + escapeHtml(s.id) + '" class="flex-shrink-0 px-2 h-7 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold active:scale-90 transition">移除</button>' +
                '</div>';
              }).join('')) +
        '</div>' +
      '</div>'
    );
  }
  L.renderCharDrawer = renderCharDrawer;

  // 请参阅指南：characters.list 获取角色信息 —— 见 _loadCharList()
  window.toggleCharPlaylistDrawer = function (cid) {
    window.__liveMusicCharDrawer = (window.__liveMusicCharDrawer === cid) ? null : cid;
    renderCharPlaylistList();
  };

  function bindCharPlaylistRows() {
    var listBox = document.getElementById('charPlaylistList');
    if (!listBox) return;
    listBox.querySelectorAll('[data-char-toggle]').forEach(function (btn) {
      btn.onclick = function () { window.toggleCharPlaylistDrawer(btn.getAttribute('data-char-toggle')); };
    });
    listBox.querySelectorAll('[data-char-add]').forEach(function (btn) {
      btn.onclick = function () {
        var cid = btn.getAttribute('data-char-add');
        var name = btn.getAttribute('data-char-name') || '';
        openCharPlaylistAddModal(cid, name);
      };
    });
    listBox.querySelectorAll('[data-char-remove]').forEach(function (btn) {
      btn.onclick = function () {
        var cid = btn.getAttribute('data-char-remove');
        var songId = btn.getAttribute('data-song-id');
        removeCharPlaylistSong(cid, songId);
      };
    });
  }

  // 移除 char 歌单中的一首
  function removeCharPlaylistSong(cid, songId) {
    var pl = (window.liveMusicCharPlaylists || {})[cid];
    if (!pl) return;
    pl.songIds = (pl.songIds || []).filter(function (id) { return id !== songId; });
    saveSettings().then(function () { renderCharPlaylistList(); });
  }
  window.removeCharPlaylistSong = removeCharPlaylistSong;

  // 添加歌曲弹窗：列出歌曲库所有歌曲，右侧选中开关，右上角全选/取消全选
  function openCharPlaylistAddModal(cid, charName) {
    if (document.getElementById('charPlaylistAddModal')) return;
    var songs = window.liveMusicSongs || [];
    if (songs.length === 0) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('歌曲库为空，请先搜索添加歌曲');
      return;
    }
    var pl = (window.liveMusicCharPlaylists || {})[cid] || { name: charName, songIds: [] };
    var selected = new Set(Array.isArray(pl.songIds) ? pl.songIds : []);

    var dlg = document.createElement('div');
    dlg.id = 'charPlaylistAddModal';
    dlg.className = 'fixed inset-0 z-[10003] flex items-center justify-center px-4';
    dlg.style.backgroundColor = 'rgba(0,0,0,0.55)';
    dlg.style.paddingTop = 'var(--ai-phone-app-safe-top, 88px)';
    dlg.style.paddingBottom = 'var(--ai-phone-app-safe-bottom, 24px)';
    dlg.innerHTML =
      '<div class="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">' +
        '<div class="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">' +
          '<div class="min-w-0">' +
            '<h4 class="text-sm font-black text-slate-900 truncate">为 ' + escapeHtml(charName || (pl.name || '')) + ' 添加歌曲</h4>' +
            '<p class="text-[10px] text-slate-500 mt-0.5">从歌曲库中勾选，加入该 char 的歌单</p>' +
          '</div>' +
          '<button id="charPlToggleAllBtn" class="flex-shrink-0 px-2.5 h-8 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black active:scale-95 transition">全选</button>' +
        '</div>' +
        '<div class="flex-1 overflow-y-auto no-scrollbar px-3 py-2 max-h-[46vh]">' +
          songs.map(function (s) {
            var checked = selected.has(s.id);
            return '<div class="flex items-center gap-3 p-2 rounded-2xl bg-white border border-slate-100 mb-2">' +
              renderSongThumb(s.cover, 'w-11 h-11') +
              '<div class="flex-1 min-w-0">' +
                '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
                '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist || '') + '</div>' +
              '</div>' +
              '<button data-pl-toggle="' + escapeHtml(s.id) + '" class="flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (checked ? 'bg-fuchsia-500' : 'bg-slate-200') + '" aria-label="选择此歌曲">' +
                '<span class="absolute top-0.5 ' + (checked ? 'left-[22px]' : 'left-0.5') + ' w-5 h-5 rounded-full bg-white shadow-sm transition-all"></span>' +
              '</button>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="px-4 py-3 border-t border-slate-100 flex gap-2">' +
          '<button id="charPlCancelBtn" class="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
          '<button id="charPlSaveBtn" class="flex-1 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-sm active:scale-95 transition">确定</button>' +
        '</div>' +
      '</div>';
    dlg.onclick = function (e) { if (e.target === dlg) dlg.remove(); };
    document.body.appendChild(dlg);

    var allSelected = selected.size === songs.length;

    function renderToggleAllLabel() {
      var btn = dlg.querySelector('#charPlToggleAllBtn');
      if (btn) btn.textContent = allSelected ? '取消全选' : '全选';
    }
    renderToggleAllLabel();

    dlg.querySelectorAll('[data-pl-toggle]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-pl-toggle');
        if (selected.has(id)) { selected.delete(id); } else { selected.add(id); }
        allSelected = selected.size === songs.length;
        var on = selected.has(id);
        btn.className = 'flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (on ? 'bg-fuchsia-500' : 'bg-slate-200');
        btn.querySelector('span').className = 'absolute top-0.5 ' + (on ? 'left-[22px]' : 'left-0.5') + ' w-5 h-5 rounded-full bg-white shadow-sm transition-all';
        renderToggleAllLabel();
      };
    });
    dlg.querySelector('#charPlToggleAllBtn').onclick = function () {
      if (allSelected) {
        selected.clear();
        allSelected = false;
      } else {
        songs.forEach(function (s) { selected.add(s.id); });
        allSelected = true;
      }
      dlg.querySelectorAll('[data-pl-toggle]').forEach(function (btn) {
        var id = btn.getAttribute('data-pl-toggle');
        var on = selected.has(id);
        btn.className = 'flex-shrink-0 w-11 h-6 rounded-full transition relative ' + (on ? 'bg-fuchsia-500' : 'bg-slate-200');
        btn.querySelector('span').className = 'absolute top-0.5 ' + (on ? 'left-[22px]' : 'left-0.5') + ' w-5 h-5 rounded-full bg-white shadow-sm transition-all';
      });
      renderToggleAllLabel();
    };
    dlg.querySelector('#charPlCancelBtn').onclick = function () { dlg.remove(); };
    dlg.querySelector('#charPlSaveBtn').onclick = function () {
      var current = (window.liveMusicCharPlaylists || {})[cid] || { name: charName, songIds: [] };
      current.songIds = songs.filter(function (s) { return selected.has(s.id); }).map(function (s) { return s.id; });
      current.name = charName || current.name || '';
      window.liveMusicCharPlaylists[cid] = current;
      dlg.remove();
      saveSettings().then(function () {
        if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已更新 ' + (charName || '') + ' 的歌单');
        renderCharPlaylistList();
      });
    };
  }
  L.openCharPlaylistAddModal = openCharPlaylistAddModal;

  window.switchLiveMusicDisplay = function (key) {
    window.__liveMusicDisplayMode = (window.__liveMusicDisplayMode === key) ? null : key;
    renderLiveMusicPage();
  };

  function renderSearchResultHTML(songs) {
    if (!songs || songs.length === 0) return '<div class="text-center py-12 text-[11px] text-slate-400">没有匹配的歌曲</div>';
    return songs.map(function (s, i) {
      return '<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 mb-2">' +
        renderSongThumb(s.cover, 'w-12 h-12') +
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

  // ---- 歌曲封面缩略图：封面是图片链接，直接用 <img> 展示；无链接才用图标占位 ----
  var LM_SONG_ICON = '<svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';

  function renderSongThumb(cover, sizeCls) {
    if (cover) {
      return '<div class="' + sizeCls + ' rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">' +
        '<img src="' + escapeHtml(cover) + '" alt="" loading="lazy" class="w-full h-full object-cover">' +
      '</div>';
    }
    return '<div class="' + sizeCls + ' rounded-xl flex-shrink-0 bg-gradient-to-br from-fuchsia-100 to-blue-100 flex items-center justify-center">' +
      LM_SONG_ICON +
    '</div>';
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

  // ---- 歌曲列表渲染（整行可点击播放；点当前播放歌曲 = 暂停/恢复） -------
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
    var curId = (window.LM.getLiveMusicPlaybackInfo && window.LM.getLiveMusicPlaybackInfo()) ? window.LM.getLiveMusicPlaybackInfo().songId : null;
    return window.liveMusicSongs.map(function (s) {
      var isCur = s.id === curId;
      var bar = isCur
        ? '<div class="flex items-end gap-[2px] h-3.5 flex-shrink-0" aria-hidden="true">' +
            '<span class="w-[3px] bg-fuchsia-500 rounded-full" style="height:6px;"></span>' +
            '<span class="w-[3px] bg-fuchsia-500 rounded-full" style="height:10px;"></span>' +
            '<span class="w-[3px] bg-fuchsia-500 rounded-full" style="height:14px;"></span>' +
          '</div>'
        : '';
      return '<div onclick="window.LM && window.LM.playLiveMusicSong && window.LM.playLiveMusicSong(\'' + s.id + '\')" class="flex items-center gap-3 p-2.5 rounded-2xl bg-white border mb-2 active:scale-[0.98] transition cursor-pointer ' + (isCur ? 'border-fuchsia-300 ring-2 ring-fuchsia-100' : 'border-slate-200') + '">' +
        renderSongThumb(s.cover, 'w-11 h-11') +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-xs font-black text-slate-900 truncate">' + escapeHtml(s.title) + '</div>' +
          '<div class="text-[10px] text-slate-500 mt-0.5 truncate">' + escapeHtml(s.artist) + '</div>' +
        '</div>' +
        bar +
        '<button onclick="event.stopPropagation();askRemoveLiveMusicSong(\'' + s.id + '\', \'' + escapeHtml(s.title).replace(/'/g, "\\'") + '\')" class="flex-shrink-0 px-2.5 h-8 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold active:scale-90 transition" aria-label="从歌曲库移除" title="删除">删除</button>' +
      '</div>';
    }).join('');
  }
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
      playUrl: m.playUrl || s.playUrl,
      cover: m.cover || s.cover,
      durationMs: m.durationMs || s.durationMs || ''
    };
  }

  // 歌词可能是 URL：入库前内置访问拿到歌词文本；拿不到就保留原值
  function resolveLyricText(lyric) {
    if (lyric && isUrlLike(lyric)) {
      return doFetchText(lyric).then(function (txt) {
        return (txt && txt.trim()) ? txt.trim() : lyric;
      }).catch(function (e) {
        if (window.console && window.console.warn) window.console.warn('[liveMusic] 歌词链接获取失败，保留原值:', e);
        return lyric;
      });
    }
    return Promise.resolve(lyric || '');
  }

  // durationMs 统一成毫秒：数值 >= 1000 视为毫秒，否则按秒换算
  function normalizeDurationMs(v) {
    if (!v) return '';
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return '';
    return String(n >= 1000 ? Math.round(n) : Math.round(n * 1000));
  }

  // 入库（返回 Promise；先解析歌词 URL 再入库）
  function pushSongToLibrary(s, tool, skipUrlCheck) {
    var exists = (window.liveMusicSongs || []).some(function (x) {
      if (s.rawId && x.rawId && s.rawId === x.rawId) return true;
      return x.title === s.title && x.artist === s.artist;
    });
    if (exists) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已在歌曲库中');
      refreshAfterAdd();
      return Promise.resolve();
    }
    return resolveLyricText(s.lyric).then(function (lyricText) {
      var songObj = {
        id: uid(),
        rawId: s.rawId,
        title: s.title,
        artist: s.artist,
        lyric: lyricText,
        playUrl: s.playUrl,
        cover: s.cover || '',
        durationMs: normalizeDurationMs(s.durationMs),
        sourceToolId: tool ? tool.id : null,
        addedAt: Date.now()
      };
      window.liveMusicSongs.push(songObj);
      // 入库即后台预取音频缓存：下次点播放命中缓存直接播，宿主不用再重新请求
      if (window.LM.prefetchLiveMusicAudio) {
        try { window.LM.prefetchLiveMusicAudio(songObj); } catch (e) {}
      }
      return saveSettings().then(function () {
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
              playUrl: d2.music_url || '',
              cover: d2.cover || d2.pic || d2.picUrl || '',
              durationMs: (d2.duration || d2.durationMs || d2.dt || '')
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
