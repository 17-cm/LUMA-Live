(function () {
  'use strict';

  var currentVideoRef = null;

  window.getRandomBackgroundVideo = async function (charId) {
    try {
      var data = window.getLiveSettingsVideoGallery ? await window.getLiveSettingsVideoGallery(charId) : null;
      if (!data || !data.videos || data.videos.length === 0) return null;
      var idx = Math.floor(Math.random() * data.videos.length);
      return data.videos[idx];
    } catch (e) {
      return null;
    }
  };

  window.switchToRandomVideoBg = async function (charId) {
    var portrait = document.getElementById('stageHostPortrait');
    var videoEl = document.getElementById('stageHostVideo');
    var loading = document.getElementById('stageVideoLoading');
    var room = document.getElementById('liveRoomModal');

    if (!videoEl || !loading) return;

    var videoItem = await window.getRandomBackgroundVideo(charId);
    if (!videoItem || !videoItem.ref) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('请先在社区-直播设置上传视频');
      }
      return;
    }

    loading.classList.remove('hidden');
    videoEl.classList.add('hidden');
    if (portrait) portrait.classList.add('hidden');
    if (room) room.classList.add('live-bg-video');

    try {
      var media = window.api && window.api.media && window.api.media.get ? await window.api.media.get({ ref: videoItem.ref }) : null;
      if (!media || !media.dataUrl) {
        throw new Error('media.get returned no dataUrl');
      }
      videoEl.src = media.dataUrl;
      videoEl.currentTime = 0;

      var playPromise = videoEl.play();
      if (playPromise) {
        playPromise.catch(function () {
          videoEl.muted = true;
          videoEl.play();
        });
      }

      videoEl.onloadeddata = function () {
        loading.classList.add('hidden');
        videoEl.classList.remove('hidden');
      };
      videoEl.onerror = function () {
        fallbackToPortrait(portrait, videoEl, loading, room);
      };
      setTimeout(function () {
        if (!loading.classList.contains('hidden')) {
          fallbackToPortrait(portrait, videoEl, loading, room);
        }
      }, 5000);
    } catch (e) {
      fallbackToPortrait(portrait, videoEl, loading, room);
    }
  };

  function fallbackToPortrait(portrait, videoEl, loading, room) {
    if (loading) loading.classList.add('hidden');
    if (videoEl) videoEl.classList.add('hidden');
    if (portrait) portrait.classList.remove('hidden');
    if (room) room.classList.remove('live-bg-video');
    if (window.api && window.api.ui && window.api.ui.toast) {
      window.api.ui.toast('视频加载失败，已恢复默认背景');
    }
  }

  window.clearVideoBg = function () {
    var portrait = document.getElementById('stageHostPortrait');
    var videoEl = document.getElementById('stageHostVideo');
    var loading = document.getElementById('stageVideoLoading');
    var room = document.getElementById('liveRoomModal');

    if (videoEl) {
      videoEl.pause();
      videoEl.src = '';
      videoEl.classList.add('hidden');
    }
    if (loading) loading.classList.add('hidden');
    if (portrait) portrait.classList.remove('hidden');
    if (room) room.classList.remove('live-bg-video');
    currentVideoRef = null;
  };
})();