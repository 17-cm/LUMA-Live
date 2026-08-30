// =========================================================================
// 【直播间音乐·持久化】studio_music_storage.js
// 职责：宿主 AiPhone.db 私有数据库 + localStorage 兜底
// 依赖：utils.js（先加载）
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;

  // ---- 全局数据（持久化在 db / localStorage） ---------------------------
  window.liveMusicTools = window.liveMusicTools || [];
  window.liveMusicCurrentToolId = window.liveMusicCurrentToolId || null;
  window.liveMusicSongs = window.liveMusicSongs || [];

  // ---- db / localStorage 句柄 -------------------------------------------
  function getDb() {
    return (window.AiPhone && window.AiPhone.db) || (window.AiPhoneApp && window.AiPhoneApp.db) || (window.api && window.api.db) || null;
  }
  function getLsBackup() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  var _dbSettingsId = null;
  var _dbLoaded = false;

  // ---- 字段补齐（旧数据迁移） ------------------------------------------
  function migrateToolsInPlace() {
    window.liveMusicTools.forEach(function (t) {
      if (typeof t.searchKey === 'undefined') t.searchKey = '';
      if (typeof t.detailKey === 'undefined') t.detailKey = '';
      if (typeof t.params === 'undefined') t.params = [];
      if (typeof t.fmtTitle === 'undefined') t.fmtTitle = '';
      if (typeof t.fmtArtist === 'undefined') t.fmtArtist = '';
      if (typeof t.fmtLyric === 'undefined') t.fmtLyric = '';
      if (typeof t.fmtPlayUrl === 'undefined') t.fmtPlayUrl = '';
      if (typeof t.headers === 'undefined') t.headers = '';
      if (typeof t.mode === 'undefined') t.mode = 'search';
    });
    window.liveMusicSongs.forEach(function (s) {
      if (typeof s.lyric === 'undefined') s.lyric = s.pic || '';
    });
  }

  // ---- 从 db 加载 -------------------------------------------------------
  function loadSettings() {
    if (_dbLoaded) return;
    _dbLoaded = true;
    var db = getDb();
    if (db && typeof db.list === 'function') {
      db.list('live_music_settings', { limit: 1 }).then(function (list) {
        if (list && list.length > 0) {
          _dbSettingsId = list[0].id;
          var data = list[0].payload || {};
          window.liveMusicTools = Array.isArray(data.list) ? data.list : [];
          window.liveMusicCurrentToolId = data.current || null;
          window.liveMusicSongs = Array.isArray(data.songs) ? data.songs : [];
          migrateToolsInPlace();
        }
        if (window.LM && window.LM.renderLiveMusicPage) window.LM.renderLiveMusicPage();
      }).catch(function (e) {
        if (window.console && window.console.warn) window.console.warn('[liveMusic] db.list failed, fallback to localStorage', e);
        loadFromLocalStorage();
      });
    } else {
      loadFromLocalStorage();
    }
  }

  // ---- 从 localStorage 加载（兜底） ------------------------------------
  function loadFromLocalStorage() {
    var ls = getLsBackup();
    if (!ls) return;
    try {
      var raw = ls.getItem('live_music_tools');
      if (raw) {
        var data = JSON.parse(raw);
        window.liveMusicTools = Array.isArray(data.list) ? data.list : [];
        window.liveMusicCurrentToolId = data.current || null;
        migrateToolsInPlace();
      }
      var raw2 = ls.getItem('live_music_songs');
      if (raw2) {
        var arr = JSON.parse(raw2);
        window.liveMusicSongs = Array.isArray(arr) ? arr : [];
      }
    } catch (e) {}
  }

  // ---- 保存 -----------------------------------------------------------
  function saveSettings() {
    var payload = {
      list: window.liveMusicTools,
      current: window.liveMusicCurrentToolId,
      songs: window.liveMusicSongs
    };
    // 兜底同步写一份 localStorage
    var ls = getLsBackup();
    if (ls) {
      try { ls.setItem('live_music_tools', JSON.stringify({ list: window.liveMusicTools, current: window.liveMusicCurrentToolId })); } catch (e) {}
      try { ls.setItem('live_music_songs', JSON.stringify(window.liveMusicSongs || [])); } catch (e) {}
    }
    // 主路径：宿主 db
    var db = getDb();
    if (!db) return Promise.resolve();
    var p;
    if (_dbSettingsId) {
      p = db.update('live_music_settings', _dbSettingsId, { payload: payload });
    } else {
      p = db.create('live_music_settings', { payload: payload });
    }
    return p.then(function (rec) {
      if (!_dbSettingsId && rec && rec.id) _dbSettingsId = rec.id;
    }).catch(function (e) { if (window.console && window.console.warn) window.console.warn('[liveMusic] db save failed', e); });
  }

  // ---- 暴露 -----------------------------------------------------------
  L.loadSettings = loadSettings;
  L.saveSettings = saveSettings;
  L.migrateToolsInPlace = migrateToolsInPlace;
  L._newToolFmtTitle = '';
  L._newToolFmtArtist = '';
  L._newToolFmtLyric = '';
  L._newToolFmtPlayUrl = '';

  // 启动时立即加载
  loadSettings();
})();
