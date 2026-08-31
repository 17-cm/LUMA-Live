// =========================================================================
// 【直播间音乐·解析器】studio_music_parser.js
// 职责：把 API 返回 JSON 解析成歌曲数组
// 依赖：utils.js
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;
  var escapeHtml = L.escapeHtml;
  var pickField = L.pickField;
  var pickByPath = L.pickByPath;
  var findFirstArray = L.findFirstArray;
  var pickCover = L.pickCover;
  var FIELD_GUESS = L.FIELD_GUESS;

  // ---- 时长提取：取到 duration 字段，统一转成毫秒 ------------------------
  function pickDurationMs(item) {
    var raw = pickField(item, FIELD_GUESS.duration);
    if (!raw) return '';
    var n = parseFloat(raw);
    if (!isFinite(n) || n <= 0) return '';
    // 常见接口 duration 是秒，网易云 dt 是毫秒；数值很大按毫秒处理
    if (n >= 1000) return String(Math.round(n));
    return String(Math.round(n * 1000));
  }

  // ---- 从当前工具读取返回格式配置（5 个字段名） ---------------------
  function getCurrentFormatMap() {
    var tool = (window.liveMusicTools || []).find(function (t) { return t.id === window.liveMusicCurrentToolId; });
    if (!tool) return {};
    return {
      title: (tool.fmtTitle || '').trim(),
      artist: (tool.fmtArtist || '').trim(),
      lyric: (tool.fmtLyric || '').trim(),
      playUrl: (tool.fmtPlayUrl || '').trim(),
      cover: (tool.fmtCover || '').trim(),
      rawId: (tool.detailKey || '').trim()
    };
  }

  // ---- 封面取值：配置了字段路径就直接用该值，否则启发式提取 -------
  function pickSongCover(item, coverPath) {
    if (coverPath) {
      var byPath = pickByPath(item, coverPath);
      if (byPath) return byPath;
    }
    return pickCover(item);
  }

  // ---- 把 API 返回解析成歌曲数组 ------------------------------------
  function parseSongsFromResponse(json) {
    if (json == null) return [];
    var fmtMap = getCurrentFormatMap();
    var useCustom = Object.keys(fmtMap).some(function (k) { return !!fmtMap[k]; });

    var out = [];

    if (useCustom) {
      var arr = findFirstArray(json);
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
            lyric: pickByPath(it0, fmtMap.lyric) || pickField(it0, FIELD_GUESS.lyric) || '',
            playUrl: pickByPath(it0, fmtMap.playUrl) || pickField(it0, FIELD_GUESS.playUrl) || '',
            durationMs: pickDurationMs(it0),
            cover: pickSongCover(it0, fmtMap.cover)
          });
          if (out.length >= 50) break;
        }
        return out;
      }
      var t1 = pickByPath(json, fmtMap.title) || pickField(json, FIELD_GUESS.title);
      if (t1) {
        out.push({
          rawId: pickByPath(json, fmtMap.rawId) || pickField(json, ['n','id','songId','song_id','mid','trackId']) || '',
          title: t1,
          artist: pickByPath(json, fmtMap.artist) || pickField(json, FIELD_GUESS.artist) || '未知歌手',
          lyric: pickByPath(json, fmtMap.lyric) || pickField(json, FIELD_GUESS.lyric) || '',
          playUrl: pickByPath(json, fmtMap.playUrl) || pickField(json, FIELD_GUESS.playUrl) || '',
          durationMs: pickDurationMs(json),
cover: pickSongCover(json, fmtMap.cover)
        });
      }
      return out;
    }

    // 启发式
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
          lyric: pickField(it1, FIELD_GUESS.lyric) || '',
          playUrl: pickField(it1, FIELD_GUESS.playUrl) || '',
          durationMs: pickDurationMs(it1),
          cover: pickSongCover(it1, fmtMap.cover)
        });
        if (out.length >= 50) break;
      }
      return out;
    }
    var singleTitle = pickField(json, FIELD_GUESS.title);
    if (singleTitle) {
      out.push({
        rawId: pickField(json, ['n', 'id', 'songId', 'song_id', 'mid', 'trackId']) || '',
        title: singleTitle,
        artist: pickField(json, FIELD_GUESS.artist) || '未知歌手',
        lyric: pickField(json, FIELD_GUESS.lyric) || '',
        playUrl: pickField(json, FIELD_GUESS.playUrl) || '',
        durationMs: pickDurationMs(json),
        cover: pickSongCover(json, fmtMap.cover)
      });
      return out;
    }
    if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
      var innerTitle = pickField(json.data, FIELD_GUESS.title);
      if (innerTitle) {
        out.push({
          rawId: pickField(json.data, ['n', 'id', 'songId', 'song_id', 'mid', 'trackId']) || '',
          title: innerTitle,
          artist: pickField(json.data, FIELD_GUESS.artist) || '未知歌手',
          lyric: pickField(json.data, FIELD_GUESS.lyric) || '',
          playUrl: pickField(json.data, FIELD_GUESS.playUrl) || '',
          durationMs: pickDurationMs(json.data),
          cover: pickSongCover(json.data, fmtMap.cover)
        });
      }
    }
    return out;
  }

  // ---- 拍平 JSON（兜底面板用） ----------------------------------------
  function collectJsonPaths(node, prefix) {
    var out = [];
    if (node == null) return out;
    if (Array.isArray(node)) {
      if (node.length === 0) return out;
      var first = node[0];
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        out = out.concat(collectJsonPaths(first, prefix));
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
        var lastSeg = flat[j].path.split('.').pop();
        if (lastSeg === c) return flat[j].path;
      }
    }
    return '';
  }

  function renderRawJsonFallback(json) {
    var flat = collectJsonPaths(json, '');
    if (flat.length === 0) {
      return '<div class="text-center py-12 text-[11px] text-slate-400">返回为空</div>';
    }
    var fieldRows = [
      { field: 'title',   label: '歌名',   guess: pickGuessFor(flat, FIELD_GUESS.title) },
      { field: 'artist',  label: '歌手',   guess: pickGuessFor(flat, FIELD_GUESS.artist) },
      { field: 'lyric',   label: '歌词',   guess: pickGuessFor(flat, FIELD_GUESS.lyric) },
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

    var apply = '<button onclick="window.LM.applyLiveMusicFormatFromFallback()" class="w-full mt-2 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-sm active:scale-95 transition">应用映射</button>';

    var dump = '<details class="mt-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">' +
      '<summary class="text-[11px] font-black text-slate-600 cursor-pointer">查看原始 JSON</summary>' +
      '<pre class="text-[10px] text-slate-700 mt-2 whitespace-pre-wrap break-all leading-relaxed font-mono">' + escapeHtml(JSON.stringify(json, null, 2).slice(0, 3000)) + '</pre>' +
    '</details>';

    return header + '<div class="rounded-2xl bg-white border border-slate-200 p-3">' + rows + apply + '</div>' + dump;
  }

  function applyLiveMusicFormatFromFallback() {
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
    L.saveSettings().then(function () { L.renderLiveMusicPage(); });
    if (window.AiPhone && window.AiPhone.ui && window.AiPhone.ui.toast) window.AiPhone.ui.toast('已保存映射');
    else if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('已保存映射');
  }

  L.getCurrentFormatMap = getCurrentFormatMap;
  L.parseSongsFromResponse = parseSongsFromResponse;
  L.renderRawJsonFallback = renderRawJsonFallback;
  L.applyLiveMusicFormatFromFallback = applyLiveMusicFormatFromFallback;
})();
