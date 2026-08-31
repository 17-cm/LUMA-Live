// =========================================================================
// 【直播间音乐·播放器核心】studio_music_player.js
// 职责：宿主 AiPhone.voice 音频代播（ambience 通道）+ 模拟计时 + 播放状态机
// 依赖：utils.js, storage.js, request.js（先加载）
//
// 要点：
//  - 用 ambience 通道播放音乐（背景音乐形式），voice 通道留给后续其他音频，
//    两者互不打断，播放音乐再播其他音频不会暂停音乐。
//  - 宿主不提供进度/时长事件，这里用本地 Date.now() 模拟进度与计时。
//  - 点击落点：playLiveMusicSong 被连续调用时，只有最后一次落点生效，
//    先 stop 再播新歌，避免形成一个"队列"各自播几秒。
//  - 播放同一首歌 = 暂停/恢复切换，避免每次点击都走宿主代播造成卡顿。
// =========================================================================
(function () {
  'use strict';

  // ---- 全局播放状态 -----------------------------------------------------
  window.__liveMusicPlayback = {
    currentSongId: null,   // 当前歌曲（歌曲库中的 id）
    playing: false,         // 是否正在播放（未暂停)
    pending: false,         // 是否正在 fetch 音频/准备播放中
    inited: false,          // 本曲音频 dataUrl 是否就绪
    audioRef: null,         // media-store 引用 或 dataUrl（宿主可播的源）
    iter: 0                 // 播放代次（用于作废旧落点）
  };

  // ---- 模拟计时（宿主无进度回调，本地 Date.now 推演）---------------------
  var _tickTimer = null;
  var _fakeElapsedMs = 0;     // 本曲模拟已播放毫秒
  var _fakePlayStart = 0;     // 本段连续播放的起始时间点
  var _fakeDurationMs = 0;    // 本曲总时长（优先取歌曲 durationMs）
  var _onTimer = null;        // 每 500ms 回调（进度条 / 歌词刷新）
  var _endedDriven = false;   // 是否已因时长到点触发切歌（防重复）

  function _clearTick() {
    if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
  }

  function _startTick() {
    _clearTick();
    _fakePlayStart = Date.now();
    _endedDriven = false;
    _tickTimer = setInterval(function () {
      if (window.__liveMusicPlayback.playing) {
        _fakeElapsedMs += (Date.now() - _fakePlayStart);
        _fakePlayStart = Date.now();
        if (_onTimer) _onTimer(_fakeElapsedMs, _fakeDurationMs);
        // 播完自动切下一首（模拟器按播放模式兜底；宿主播完也会驱动 next）
        if (_fakeDurationMs > 0 && _fakeElapsedMs >= _fakeDurationMs && !_endedDriven) {
          _endedDriven = true;
          stopAndNextOnEnd();
        }
      } else {
        _fakePlayStart = Date.now();
      }
    }, 500);
  }

  // ---- 宿主语音 API（兼容 AiPhoneA/aiPhone/api 三种通道）-----------------
  function _voice() {
    return (window.AiPhone && window.AiPhone.voice) ||
           (window.aiPhoneApp && window.aiPhoneApp.voice) ||
           (window.api && window.api.voice) || null;
  }

  function _hostPlay(src) {
    var v = _voice();
    if (!v || typeof v.play !== 'function') return Promise.reject(new Error('宿主 voice.play 不可用'));
    // ambience 通道（背景音乐），不打断 voice 通道的其他音频
    return Promise.resolve(v.play({ channel: 'ambience', dataUrl: src }));
  }

  function _hostStop() {
    var v = _voice();
    if (!v) return;
    if (typeof v.stopPlayback === 'function') { try { v.stopPlayback({ channel: 'ambience' }); } catch (e) {} }
    else if (typeof v.stop === 'function') { try { v.stop(); } catch (e) {} }
  }

  function _hostPause() {
    var v = _voice();
    if (!v) return;
    if (typeof v.pausePlayback === 'function') { try { v.pausePlayback({ channel: 'ambience' }); } catch (e) {} }
    else if (typeof v.pause === 'function') { try { v.pause(); } catch (e) {} }
  }

  function _hostResume() {
    var v = _voice();
    if (!v) return;
    if (typeof v.resumePlayback === 'function') { try { v.resumePlayback({ channel: 'ambience' }); } catch (e) {} }
    else if (typeof v.resume === 'function') { try { v.resume(); } catch (e) {} }
  }

  // ---- 取当前歌曲（歌曲库）----------------------------------------------
  function _currentSong() {
    var st = window.__liveMusicPlayback;
    if (!st.currentSongId) return null;
    return (window.liveMusicSongs || []).find(function (s) { return s.id === st.currentSongId; }) || null;
  }

  // ---- 播放模式（与 main.js 的三态一致，这里复用文案）--------------------
  function _modeLabel() {
    var list = window.__liveMusicModeList || [];
    var idx = window.__liveMusicPlayMode || 0;
    return (list[idx] && list[idx].label) || '单曲循环';
  }

  // ---- 播放前数据准备：playUrl 是链接，需 fetch 转 dataUrl；
  //      已转过的存 audioRef 直接复用 --------------------------------------
  var _urlCache = {};   // playUrl -> dataUrl

  function _prepareSource(song) {
    var st = window.__liveMusicPlayback;
    return Promise.resolve().then(function () {
      if (st.inited && st.audioRef) return st.audioRef;
      if (song.audioRef && song.audioRef.indexOf('media-store://') === 0) {
        st.audioRef = song.audioRef;
        st.inited = true;
        return st.audioRef;
      }
      var url = song.playUrl || '';
      if (!url) return Promise.reject(new Error('该歌曲没有播放链接'));
      if (_urlCache[url]) {
        st.audioRef = _urlCache[url];
        st.inited = true;
        return st.audioRef;
      }
      return window.LM.fetchAudioDataUrl(url).then(function (dataUrl) {
        _urlCache[url] = dataUrl;
        st.audioRef = dataUrl;
        st.inited = true;
        return dataUrl;
      });
    });
  }

  // ---- 入库即后台预取：拿到音频 dataUrl 缓存，播放时命中缓存直接播 --------
  window.LM.prefetchLiveMusicAudio = function (song) {
    if (!song || !song.playUrl) return Promise.resolve();
    if (song.audioRef && song.audioRef.indexOf('media-store://') === 0) return Promise.resolve();
    var url = song.playUrl;
    if (_urlCache[url]) return Promise.resolve();
    return window.LM.fetchAudioDataUrl(url).then(function (dataUrl) {
      _urlCache[url] = dataUrl;
      var st = window.__liveMusicPlayback;
      if (st.currentSongId && st.currentSongId === song.id) {
        st.audioRef = dataUrl;
        st.inited = true;
      }
      if (window.console && window.console.log) window.console.log('[liveMusic] 预取缓存完成:', url);
      return dataUrl;
    }).catch(function (e) {
      if (window.console && window.console.warn) window.console.warn('[liveMusic] 音频预取失败:', e);
    });
  };

  // ---- 开始播放一首歌（落点即时生效，旧迭代作废）-------------------------
  function playLiveMusicSong(songId) {
    var st = window.__liveMusicPlayback;
    var songs = window.liveMusicSongs || [];
    var song = songs.find(function (s) { return s.id === songId; });
    if (!song) return;

    st.iter++;
    var myIter = st.iter;

    // 同一首：暂停/恢复切换，不重新 fetch 不走宿主代播
    if (st.currentSongId === songId) {
      if (st.playing) { pauseLiveMusic(); return; }
      if (st.inited) { resumeLiveMusic(); return; }
      // 正在准备中途点击同一首：什么也不做，等准备完成
      return;
    }

    // 新的落点：先停掉当前宿主播放与计时
    st.currentSongId = songId;
    st.playing = false;
    st.pending = true;
    st.inited = false;
    st.audioRef = null;
    _clearTick();
    if (_onStopCurrent) {
      try { _onStopCurrent(); } catch (e) {}
    }

    var m = _modeLabel();
    _fakeDurationMs = parseInt(song.durationMs, 10) || 0;
    _fakeElapsedMs = 0;
    _endedDriven = false;

    _prepareSource(song).then(function (src) {
      if (myIter !== st.iter) return; // 已点别的歌，作废
      st.inited = true;
      st.pending = false;
      st.audioRef = src;
      st.playing = true;
      if (_onPlayStart) { try { _onPlayStart(song); } catch (e) {} }
      _startTick();
      _emitState();
      // 宿主代播不阻塞模拟计时：立即标记播放中并推进进度
      _hostPlay(src).then(function () {
        // 宿主自然播完（若有 resolve）：触发按模式切歌
        if (myIter === st.iter && window.__liveMusicPlayback.currentSongId === songId && !_endedDriven) {
          _endedDriven = true;
          stopAndNextOnEnd();
        }
      }).catch(function (err) {
        if (myIter !== st.iter) return;
        if (window.console && window.console.warn) window.console.warn('[liveMusic] 宿主播放失败:', err);
        st.playing = false;
        _clearTick();
        if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('播放失败');
        _emitState();
      });
    }).catch(function (err) {
      if (myIter !== st.iter) return;
      st.playing = false;
      st.pending = false;
      if (window.console && window.console.warn) window.console.warn('[liveMusic] 播放失败:', err);
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('播放失败：' + (err && err.message ? err.message : '未知错误'));
      _emitState();
    });
  }
  window.LM.playLiveMusicSong = playLiveMusicSong;

  function pauseLiveMusic() {
    var st = window.__liveMusicPlayback;
    if (!st.currentSongId) return;
    st.playing = false;
    _hostPause();
    _emitState();
  }
  window.LM.pauseLiveMusic = pauseLiveMusic;

  function resumeLiveMusic() {
    var st = window.__liveMusicPlayback;
    if (!st.currentSongId || !st.inited) return;
    st.playing = true;
    _hostResume();
    if (!_tickTimer) { _startTick(); }
    _emitState();
  }
  window.LM.resumeLiveMusic = resumeLiveMusic;

  // ---- 停止当前播放（保留 currentSongId，切歌用）--------------------------
  function stopLiveMusic() {
    var st = window.__liveMusicPlayback;
    _clearTick();
    _hostStop();
    st.playing = false;
    st.pending = false;
    _emitState();
  }
  window.LM.stopLiveMusic = stopLiveMusic;

  // ---- 上一首 / 下一首（按歌曲库顺序）-------------------------------------
  function playPrevSong() {
    var songs = window.liveMusicSongs || [];
    if (songs.length === 0) return;
    var st = window.__liveMusicPlayback;
    var idx = songs.findIndex(function (s) { return s.id === st.currentSongId; });
    if (idx < 0) idx = 0;
    var next = (idx - 1 + songs.length) % songs.length;
    playLiveMusicSong(songs[next].id);
  }
  window.LM.playPrevSong = playPrevSong;

  function playNextSong() {
    var songs = window.liveMusicSongs || [];
    if (songs.length === 0) return;
    var st = window.__liveMusicPlayback;
    var label = _modeLabel();
    if (label === '随机播放') {
      var r = Math.floor(Math.random() * songs.length);
      playLiveMusicSong(songs[r].id);
      return;
    }
    var idx = songs.findIndex(function (s) { return s.id === st.currentSongId; });
    if (idx < 0) idx = 0;
    var next = (idx + 1) % songs.length;
    playLiveMusicSong(songs[next].id);
  }
  window.LM.playNextSong = playNextSong;

  // 模拟播完/宿主播完 → 按模式决定下一首
  function stopAndNextOnEnd() {
    var mode = _modeLabel();
    if (mode === '单曲循环') {
      // 单曲循环：重置进度重新播放同一首
      var st = window.__liveMusicPlayback;
      if (!st.currentSongId) return;
      _clearTick();
      _fakeElapsedMs = 0;
      _fakePlayStart = Date.now();
      _endedDriven = false;
      if (st.inited) {
        _hostStop();
        st.playing = true;
        _startTick();
        _hostPlay(st.audioRef).catch(function () {
          if (window.console && window.console.warn) window.console.warn('[liveMusic] 循环重播失败');
          st.playing = false;
          _emitState();
        });
      }
      _emitState();
      return;
    }
    // 列表循环 / 随机 → 切下一首
    playNextSong();
  }

  // ---- 播放/暂停切换（顶部卡播放键用）-----------------------------------
  function toggleLiveMusicPlay() {
    var st = window.__liveMusicPlayback;
    var songs = window.liveMusicSongs || [];
    if (!st.currentSongId) {
      if (songs.length > 0) { playLiveMusicSong(songs[0].id); }
      return;
    }
    if (st.pending) return; // 正在准备，忽略
    if (st.playing) { pauseLiveMusic(); }
    else if (st.inited) { resumeLiveMusic(); }
    else { playLiveMusicSong(st.currentSongId); }
  }
  window.LM.toggleLiveMusicPlay = toggleLiveMusicPlay;

  // ---- 外部状态钩子（main.js 注册）---------------------------------------
  var _onTick, _onState, _onPlayStart, _onStopCurrent;

  window.LM.onLiveMusicTick = function (fn) { _onTick = fn; _onTimer = fn; };
  window.LM.onLiveMusicState = function (fn) { _onState = fn; };
  window.LM.onLiveMusicPlayStart = function (fn) { _onPlayStart = fn; };
  window.LM.onLiveMusicStopCurrent = function (fn) { _onStopCurrent = fn; };

  function _emitState() {
    if (_onState) {
      try { _onState(); } catch (e) {}
    }
  }

  // 供 main.js 读取模拟进度
  window.LM.getLiveMusicPlaybackInfo = function () {
    return {
      songId: window.__liveMusicPlayback.currentSongId,
      playing: window.__liveMusicPlayback.playing,
      pending: window.__liveMusicPlayback.pending,
      inited: window.__liveMusicPlayback.inited,
      elapsedMs: _fakeElapsedMs,
      durationMs: _fakeDurationMs,
      mode: _modeLabel()
    };
  };

  // 退出界面时外部调用：保留进度到下次进入，仅暂停宿主
  window.LM.pauseLiveMusicForExit = function () {
    pauseLiveMusic();
  };
})();