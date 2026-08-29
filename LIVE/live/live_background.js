(function () {
  'use strict';

  var videoMode = false;

  window.switchBackgroundMode = async function (charId) {
    if (videoMode) {
      exitVideoMode();
      return;
    }
    await enterVideoMode(charId);
  };

  function getRoom() {
    return document.getElementById('liveRoomModal');
  }

  function getVideo() {
    return document.getElementById('bgFullscreenVideo');
  }

  function exitVideoMode() {
    var v = getVideo();
    if (v) { v.pause(); v.remove(); }
    getRoom() && getRoom().classList.remove('live-bg-video');
    videoMode = false;
  }

  async function enterVideoMode(charId) {
    var data = window.getLiveSettingsVideoGallery ? await window.getLiveSettingsVideoGallery(charId) : null;
    if (!data || !data.videos || data.videos.length === 0) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('请先在社区-直播设置上传视频');
      }
      return;
    }

    // 创建加载状态
    var loading = createLoadingEl();
    getRoom().appendChild(loading);

    try {
      var idx = Math.floor(Math.random() * data.videos.length);
      var item = data.videos[idx];
      var media = window.api && window.api.media && window.api.media.get ? await window.api.media.get({ ref: item.ref }) : null;
      if (!media || !media.dataUrl) throw new Error('media.get failed');

      var video = document.createElement('video');
      video.id = 'bgFullscreenVideo';
      video.className = 'bg-fullscreen-video';
      video.muted = true;
      video.loop = true;
      video.playsinline = true;
      video.src = media.dataUrl;
      video.currentTime = 0;

      video.onloadeddata = function () {
        loading.remove();
        getRoom().appendChild(video);
        getRoom().classList.add('live-bg-video');
        videoMode = true;
        video.play().catch(function () {});
      };
      video.onerror = function () { loading.remove(); };
      setTimeout(function () {
        if (loading.parentNode) loading.remove();
      }, 6000);
    } catch (e) {
      loading.remove();
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('视频加载失败');
      }
    }
  }

  function createLoadingEl() {
    var el = document.createElement('div');
    el.className = 'bg-video-loading';
    el.innerHTML =
      '<div class="bg-video-loading-spinner"></div>' +
      '<span class="bg-video-loading-text">正在切换背景视频…</span>';
    return el;
  }

  window.clearVideoBg = function () {
    exitVideoMode();
  };
})();