// =========================================================================
// 【直播间音乐·共享工具】studio_music_utils.js
// 职责：跨子文件共享的工具函数 + 模块级常量
// 依赖：无（最先加载）
// =========================================================================
(function () {
  'use strict';

  // ---- HTML 转义 -------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- ID 生成 ---------------------------------------------------------
  function uid() {
    return 'sg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---- 时间格式化 ------------------------------------------------------
  function fmtTs(t) {
    if (!t) return '';
    var d = new Date(t);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ---- 字段启发式候选名（兜底用） ------------------------------------
  var FIELD_GUESS = {
    title:   ['name', 'title', 'songName', 'song_name', 'trackName', 'song', 'musicName', 'music_name'],
    artist:  ['artists', 'singer', 'ar_name', 'artist', 'singerName', 'author', 'singer_name', 'artist_name'],
    playUrl: ['url', 'playUrl', 'play_url', 'mp3Url', 'mp3_url', 'src', 'audioUrl', 'audio', 'music_url', 'link'],
    lyric:   ['lyric', 'lyricContent', 'lyric_text', 'lrc', 'lrcContent', 'lyric_url', 'lyricUrl'],
    duration: ['duration', 'durationMs', 'duration_ms', 'dur', 'dt', 'seconds', 'interval', 'playTime', 'time', 'len'],
    cover:   ['pic', 'picUrl', 'pic_url', 'cover', 'coverUrl', 'cover_url', 'img', 'imgUrl', 'img_url', 'image', 'imageUrl', 'image_url', 'picture', 'albumPic', 'albumPicUrl', 'album_pic', 'songPic', 'songPicUrl', 'artPic', 'artistPic', 'thumbnail', 'thumb', 'thumbUrl', 'logo', 'icon']
  };

  // ---- 图片 URL 识别：按常见图片后缀或 data:image 判断 -----------------
  var IMG_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?.*)?$/i;
  var IMG_DATA_RE = /^data:image\//i;
  var MEDIA_EXT_RE = /\.(mp3|m4a|aac|flac|wav|ogg|opus|mp4|avi|mov|mkv|flv|wmv|webm)(\?.*)?$/i;

  function isImageUrl(v) {
    return typeof v === 'string' && (IMG_EXT_RE.test(v) || IMG_DATA_RE.test(v));
  }

  // 像图片资源的链接：http(s)/协议相对链接且不是音视频
  function isImageLikeUrl(v) {
    if (typeof v !== 'string') return false;
    if (isImageUrl(v)) return true;
    return /^(https?:)?\/\//i.test(v) && !MEDIA_EXT_RE.test(v);
  }

  // ---- 任意链接判断：http(s) 或协议相对 //（歌词/音频/封面都可能返回链接）
  function isUrlLike(v) {
    return typeof v === 'string' && /^(https?:)?\/\//i.test(v);
  }

  // ---- LRC 歌词解析：'[mm:ss.xx]文本' → [{t(ms), text}] -------------------
  // 无时间戳的纯文本 → 单条 [{t:0, text}]；空 → []
  function parseLrc(lrc) {
    if (!lrc || typeof lrc !== 'string') return [];
    var out = [];
    var lineRe = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    var lines = lrc.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      var times = [];
      var m;
      lineRe.lastIndex = 0;
      while ((m = lineRe.exec(line)) !== null) {
        var min = parseInt(m[1], 10) || 0;
        var sec = parseInt(m[2], 10) || 0;
        var msRaw = m[3] ? String(m[3]) : '';
        var ms = 0;
        if (msRaw.length === 1) ms = parseInt(msRaw, 10) * 100;
        else if (msRaw.length === 2) ms = parseInt(msRaw, 10) * 10;
        else if (msRaw.length >= 3) ms = parseInt(msRaw.slice(0, 3), 10);
        times.push(min * 60000 + sec * 1000 + ms);
      }
      if (times.length === 0) continue;
      var text = line.replace(lineRe, '').trim();
      if (!text) continue;
      for (var j = 0; j < times.length; j++) {
        out.push({ t: times[j], text: text });
      }
    }
    out.sort(function (a, b) { return a.t - b.t; });
    if (out.length === 0) {
      var plain = String(lrc).trim();
      if (plain) out.push({ t: 0, text: plain });
    }
    return out;
  }

  // ---- 封面提取（内置启发式）：字段名命中封面关键词即采用，否则递归扫图片 ----
  // 字段名匹配：先精确匹配候选名，再按子串匹配（pic/cover/img/thumb 等变体）
  var COVER_KEY_RE = /(pic|cover|img|image|thumb|avatar|album|art|poster|logo)/i;

  function pickCover(item) {
    if (!item || typeof item !== 'object') return '';
    var found = '';
    var coverKeys = FIELD_GUESS.cover;
    (function walk(node, depth) {
      if (found || depth > 4) return;
      if (!node || typeof node !== 'object') return;
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v = node[k];
        if (typeof v === 'string') {
          if (coverKeys.indexOf(k) >= 0 && isImageLikeUrl(v)) { found = v; return; }
          if (isImageUrl(v)) { found = v; return; }
          if (COVER_KEY_RE.test(k) && isImageLikeUrl(v)) { found = v; return; }
        } else if (typeof v === 'object') {
          walk(v, depth + 1);
        }
      }
    })(item, 0);
    return found;
  }

  // ---- 递归找 JSON 里第一个数组（深度优先） ---------------------------
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

  // ---- 简单字段查找：递归找 obj 第一个 key 命中 candidates 的值 -------
  function pickField(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < candidates.length; i++) {
      var k = candidates[i];
      if (obj[k] != null && String(obj[k]).length > 0) return String(obj[k]);
    }
    return '';
  }

  // ---- 点路径解析：'data.name' → obj.data.name -------------------------
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

  // ---- 暴露到全局（跨文件共享） ---------------------------------------
  window.LM = window.LM || {};
  window.LM.escapeHtml = escapeHtml;
  window.LM.uid = uid;
  window.LM.fmtTs = fmtTs;
  window.LM.FIELD_GUESS = FIELD_GUESS;
  window.LM.findFirstArray = findFirstArray;
  window.LM.pickField = pickField;
  window.LM.pickByPath = pickByPath;
  window.LM.pickCover = pickCover;
  window.LM.isImageUrl = isImageUrl;
  window.LM.isImageLikeUrl = isImageLikeUrl;
  window.LM.isUrlLike = isUrlLike;
  window.LM.parseLrc = parseLrc;
})();
