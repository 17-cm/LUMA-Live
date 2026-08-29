(function () {
  'use strict';

  var LIVE_SETTINGS_KEY = 'live_video_gallery';

  window.renderLiveSettings = async function () {
    var area = document.getElementById('liveSettingsModuleArea');
    if (!area) return;

    area.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'p-4 bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 rounded-3xl text-white shadow-md space-y-2';
    header.innerHTML =
      '<div class="flex items-center gap-2">' +
        '<span class="text-base">&#x1F3AC;</span>' +
        '<h4 class="text-sm font-black">直播画面背景</h4>' +
      '</div>' +
      '<p class="text-xs text-purple-100 leading-relaxed">选择主播，上传视频作为直播间全屏背景。每位主播最多 3 个视频。</p>';
    area.appendChild(header);

    var charSection = document.createElement('div');
    charSection.className = 'luxe-card p-3 bg-white';
    charSection.innerHTML =
      '<label class="text-[10px] font-bold text-slate-500 mb-2 block">选择主播</label>' +
      '<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1" id="liveSettingsCharList"><div class="text-[11px] text-slate-400 py-4 text-center w-full">加载中…</div></div>';
    area.appendChild(charSection);

    try {
      var chars = window.api && window.api.characters && window.api.characters.list ? await window.api.characters.list() : [];
      renderCharList(chars);
    } catch (e) {
      var cl = document.getElementById('liveSettingsCharList');
      if (cl) cl.innerHTML = '<div class="text-[11px] text-slate-400 py-4 text-center w-full">加载失败，请重试</div>';
    }
  };

  function renderCharList(chars) {
    var container = document.getElementById('liveSettingsCharList');
    if (!container) return;
    if (!chars || chars.length === 0) {
      container.innerHTML = '<div class="text-[11px] text-slate-400 py-4 text-center w-full">暂无主播</div>';
      return;
    }
    container.innerHTML = chars.map(function (c) {
      var avatar = c.avatar || '';
      return '<div onclick="showLiveSettingsUploadSheet(\'' + c.id + '\',\'' + (c.name || c.id).replace(/'/g, "\\'") + '\')" class="flex-shrink-0 w-16 text-center cursor-pointer active:scale-95 transition">' +
        '<div class="w-14 h-14 mx-auto rounded-full overflow-hidden ring-1 ring-slate-200">' +
          '<img src="' + avatar + '" class="w-full h-full object-cover">' +
        '</div>' +
        '<span class="text-[10px] font-bold text-slate-700 mt-1 block truncate">' + (c.name || c.id) + '</span>' +
      '</div>';
    }).join('');
  }

  window.showLiveSettingsUploadSheet = function (charId, charName) {
    var overlay = document.getElementById('liveSettingsUploadSheet');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'liveSettingsUploadSheet';
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center px-4';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.45)';
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    var sheet = document.createElement('div');
    sheet.className = 'w-full max-w-[400px] bg-white rounded-3xl px-6 pt-6 pb-7 space-y-4 shadow-2xl';
    sheet.innerHTML =
      '<h4 class="text-base font-black text-slate-900 text-center">为 ' + charName + ' 上传视频</h4>' +
      '<p class="text-[11px] text-slate-500 text-center leading-relaxed">请选择一段不超过 30 秒的视频作为直播间全屏背景</p>' +
      '<div class="flex gap-3 pt-2">' +
        '<button id="lsUploadCancelBtn" class="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 transition">取消</button>' +
        '<button id="lsUploadConfirmBtn" class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-bold shadow-md active:scale-95 transition">上传</button>' +
      '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    document.getElementById('lsUploadCancelBtn').onclick = function () { overlay.remove(); };
    document.getElementById('lsUploadConfirmBtn').onclick = function () {
      startUpload(charId, charName, overlay);
    };
  };

  async function startUpload(charId, charName, sheetOverlay) {
    var data = await loadVideoGallery(charId);
    if (data.videos.length >= 3) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('每位主播最多上传 3 个视频');
      return;
    }

    try {
      var picked = window.api && window.api.media && window.api.media.pick ? await window.api.media.pick({ accept: 'video/*' }) : null;
      if (!picked || !picked.file || !picked.file.dataUrl) {
        if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('未选择视频');
        return;
      }

      var dataUrl = picked.file.dataUrl;

      var valid = await checkVideoDuration(dataUrl);
      if (!valid) {
        if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('视频时长超过 30 秒，请选择更短的视频');
        return;
      }

      var stored = window.api && window.api.media && window.api.media.put ? await window.api.media.put({ dataUrl: dataUrl }) : null;
      if (!stored || !stored.ref) {
        if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('视频上传失败');
        return;
      }

      data.videos.push({ ref: stored.ref, mime: stored.mime || 'video/mp4', uploadedAt: Date.now() });
      await saveVideoGallery(charId, data);

      if (sheetOverlay) sheetOverlay.remove();

      if (window.api && window.api.ui && window.api.ui.toast) {
        window.api.ui.toast('已上传至 ' + charName + ' 主页相册，可前往查看，或在直播间点击「画面比例」切换');
      }
    } catch (e) {
      console.error('[liveSettings] upload error:', e);
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('上传失败，请重试');
    }
  }

  function checkVideoDuration(dataUrl) {
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        var dur = video.duration;
        video.remove();
        resolve(dur <= 31);
      };
      video.onerror = function () {
        video.remove();
        resolve(true);
      };
      video.src = dataUrl;
    });
  }

  async function loadVideoGallery(charId) {
    try {
      var data = window.api && window.api.db && window.api.db.get ? await window.api.db.get(LIVE_SETTINGS_KEY, charId) : null;
      return data || { videos: [] };
    } catch (e) {
      return { videos: [] };
    }
  }

  async function saveVideoGallery(charId, data) {
    if (window.api && window.api.db) {
      var existing = await window.api.db.get(LIVE_SETTINGS_KEY, charId).catch(function () { return null; });
      if (existing) {
        await window.api.db.update(LIVE_SETTINGS_KEY, charId, data);
      } else {
        await window.api.db.create(LIVE_SETTINGS_KEY, { id: charId, videos: data.videos || [] });
      }
    }
  }

  window.getLiveSettingsVideoGallery = async function (charId) {
    return loadVideoGallery(charId);
  };
})();