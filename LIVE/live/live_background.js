(function () {
  'use strict';

  var currentVideoDataUrl = null;
  var isVideoMode = false;

  window.switchBackgroundMode = async function (charId) {
    var fullscreenVideo = document.getElementById('stageFullscreenVideo');
    var loading = document.getElementById('stageVideoLoading');
    var portrait = document.getElementById('stageHostPortrait');
    var room = document.getElementById('liveRoomModal');

    if (!fullscreenVideo || !loading) return;

    // 如果当前是视频模式，切回 1:1 头像
    if (isVideoMode) {
      fullscreenVideo.pause();
      fullscreenVideo.src = '';
      fullscreenVideo.classList.add('hidden');
      loading.classList.add('hidden');
      if (portrait) portrait.classList.remove('hidden');
      if (room) room.classList.remove('live-bg-video');
      isVideoMode = false;
      return;
    }

    // 切换到视频模式
    var videoItem = await getRandomBackgroundVideo(charId);
    if (!videoItem || !videoItem.ref) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('请先在社区-直播设置上传视频');
      }
      return;
    }

    loading.classList.remove('hidden');

    try {
      var media = window.api && window.api.media && window.api.media.get ? await window.api.media.get({ ref: videoItem.ref }) : null;
      if (!media || !media.dataUrl) throw new Error('media.get returned no dataUrl');

      currentVideoDataUrl = media.dataUrl;
      fullscreenVideo.src = currentVideoDataUrl;
      fullscreenVideo.currentTime = 0;

      var playPromise = fullscreenVideo.play();
      if (playPromise) playPromise.catch(function () {
        fullscreenVideo.muted = true;
        fullscreenVideo.play();
      });

      fullscreenVideo.onloadeddata = function () {
        loading.classList.add('hidden');
        fullscreenVideo.classList.remove('hidden');
        if (portrait) portrait.classList.add('hidden');
        if (room) room.classList.add('live-bg-video');
        isVideoMode = true;
      };
      fullscreenVideo.onerror = function () { fallback(); };
      setTimeout(function () {
        if (!loading.classList.contains('hidden')) fallback();
      }, 5000);
    } catch (e) {
      fallback();
    }
  };

  function fallback() {
    var loading = document.getElementById('stageVideoLoading');
    var fullscreenVideo = document.getElementById('stageFullscreenVideo');
    if (loading) loading.classList.add('hidden');
    if (fullscreenVideo) fullscreenVideo.classList.add('hidden');
    if (window.api && window.api.ui && window.api.ui.toast) {
      window.api.ui.toast('视频加载失败，已恢复默认背景');
    }
  }

  async function getRandomBackgroundVideo(charId) {
    try {
      var data = window.getLiveSettingsVideoGallery ? await window.getLiveSettingsVideoGallery(charId) : null;
      if (!data || !data.videos || data.videos.length === 0) return null;
      var idx = Math.floor(Math.random() * data.videos.length);
      return data.videos[idx];
    } catch (e) {
      return null;
    }
  }

  window.clearVideoBg = function () {
    var fullscreenVideo = document.getElementById('stageFullscreenVideo');
    var loading = document.getElementById('stageVideoLoading');
    var portrait = document.getElementById('stageHostPortrait');
    var room = document.getElementById('liveRoomModal');

    if (fullscreenVideo) {
      fullscreenVideo.pause();
      fullscreenVideo.src = '';
      fullscreenVideo.classList.add('hidden');
    }
    if (loading) loading.classList.add('hidden');
    if (portrait) portrait.classList.remove('hidden');
    if (room) room.classList.remove('live-bg-video');
    currentVideoDataUrl = null;
    isVideoMode = false;
  };
})();