(function () {
  'use strict';

  var currentVideoEl = null;

  window.toggleVideoBackground = async function (charId) {
    var room = document.getElementById('liveRoomModal');
    if (!room) return;

    if (room.classList.contains('video-bg-mode')) {
      // 关掉
      room.classList.remove('video-bg-mode');
      if (currentVideoEl) {
        currentVideoEl.pause();
        currentVideoEl.remove();
        currentVideoEl = null;
      }
      return;
    }

    var videoItem = await getRandomBgVideo(charId);
    if (!videoItem || !videoItem.ref) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('请先在社区-直播设置上传视频');
      }
      return;
    }

    var media = window.api && window.api.media && window.api.media.get
      ? await window.api.media.get({ ref: videoItem.ref })
      : null;

    var src = (media && (media.url || media.dataUrl)) || null;
    if (!src) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('视频加载失败');
      }
      return;
    }

    var video = document.createElement('video');
    video.className = 'live-bg-fullscreen-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.src = src;

    room.insertBefore(video, room.firstChild);
    currentVideoEl = video;

    room.classList.add('video-bg-mode');

    video.onerror = function () {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('视频播放失败');
      }
      room.classList.remove('video-bg-mode');
      if (currentVideoEl) { currentVideoEl.remove(); currentVideoEl = null; }
    };
  };

  window.clearVideoBackground = function () {
    var room = document.getElementById('liveRoomModal');
    if (room) room.classList.remove('video-bg-mode');
    if (currentVideoEl) {
      currentVideoEl.pause();
      currentVideoEl.remove();
      currentVideoEl = null;
    }
  };

  async function getRandomBgVideo(charId) {
    try {
      var data = window.getLiveSettingsVideoGallery
        ? await window.getLiveSettingsVideoGallery(charId)
        : null;
      if (!data || !data.videos || data.videos.length === 0) return null;
      var idx = Math.floor(Math.random() * data.videos.length);
      return data.videos[idx];
    } catch (e) {
      return null;
    }
  }
})();