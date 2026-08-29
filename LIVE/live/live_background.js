(function () {
  'use strict';

  var isVideoMode = false;

  window.switchBackgroundMode = async function (charId) {
    var room = document.getElementById('liveRoomModal');
    var bg = document.getElementById('stageLiveBg');
    var loading = document.getElementById('stageVideoLoading');

    if (!room || !bg) return;

    if (isVideoMode) {
      // 模式2 → 模式1：切换回头像+公屏背景
      enterMode1(room, bg, loading);
      return;
    }

    // 模式1 → 模式2：切换到全屏视频背景
    var videoItem = await getRandomBgVideo(charId);
    if (!videoItem || !videoItem.ref) {
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('请先在社区-直播设置上传视频');
      }
      return;
    }

    loading.classList.remove('hidden');

    try {
      var media = window.api && window.api.media && window.api.media.get ? await window.api.media.get({ ref: videoItem.ref }) : null;
      if (!media || !media.dataUrl) throw new Error('media.get failed');

      enterMode2(room, bg, loading, media.dataUrl);
    } catch (e) {
      loading.classList.add('hidden');
      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('视频加载失败');
      }
    }
  };

  function enterMode1(room, bg, loading) {
    if (loading) loading.classList.add('hidden');
    bg.innerHTML = '';
    room.classList.remove('live-bg-video');
    isVideoMode = false;
  }

  function enterMode2(room, bg, loading, dataUrl) {
    bg.innerHTML = '<video id="stageFullscreenVideo" class="stage-fullscreen-video" muted loop playsinline autoplay></video>';
    var video = document.getElementById('stageFullscreenVideo');
    if (!video) return;

    video.src = dataUrl;
    video.currentTime = 0;

    var playPromise = video.play();
    if (playPromise) playPromise.catch(function () {
      video.muted = true;
      video.play();
    });

    video.onloadeddata = function () {
      if (loading) loading.classList.add('hidden');
      room.classList.add('live-bg-video');
      isVideoMode = true;
    };
    video.onerror = function () {
      enterMode1(room, bg, loading);
    };
    setTimeout(function () {
      if (loading && !loading.classList.contains('hidden')) {
        enterMode1(room, bg, loading);
      }
    }, 5000);
  }

  async function getRandomBgVideo(charId) {
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
    var room = document.getElementById('liveRoomModal');
    var bg = document.getElementById('stageLiveBg');
    var loading = document.getElementById('stageVideoLoading');
    if (bg) bg.innerHTML = '';
    if (loading) loading.classList.add('hidden');
    if (room) room.classList.remove('live-bg-video');
    isVideoMode = false;
  };
})();