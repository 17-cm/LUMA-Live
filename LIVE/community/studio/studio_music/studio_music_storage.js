// =========================================================================
// 【直播间音乐·持久化】studio_music_storage.js
// 职责：宿主 AiPhone.db 私有数据库
// 依赖：utils.js（先加载）
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;

  window.liveMusicTools = window.liveMusicTools || [];
  window.liveMusicCurrentToolId = window.liveMusicCurrentToolId || null;
  window.liveMusicSongs = window.liveMusicSongs || [];

  function getDb() {
    return (window.AiPhone && window.AiPhone.db) || (window.AiPhoneApp && window.AiPhoneApp.db) || (window.api && window.api.db) || null;
  }

  var _dbSettingsId = null;
  var _dbLoaded = false;

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
    });
    window.liveMusicSongs.forEach(function (s) {
      if (typeof s.lyric === 'undefined') s.lyric = s.pic || '';
    });
  }

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
        if (window.console && window.console.warn) window.console.warn('[liveMusic] db.list failed', e);
      });
    }
  }

  function saveSettings() {
    var payload = {
      list: window.liveMusicTools,
      current: window.liveMusicCurrentToolId,
      songs: window.liveMusicSongs
    };
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

  L.loadSettings = loadSettings;
  L.saveSettings = saveSettings;
  L.migrateToolsInPlace = migrateToolsInPlace;
  L._newToolFmtTitle = '';
  L._newToolFmtArtist = '';
  L._newToolFmtLyric = '';
  L._newToolFmtPlayUrl = '';

  loadSettings();
})();
