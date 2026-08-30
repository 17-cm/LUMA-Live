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
    lyric:   ['lyric', 'lyricContent', 'lyric_text', 'lrc', 'lrcContent', 'lyric_url', 'lyricUrl']
  };

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
})();
