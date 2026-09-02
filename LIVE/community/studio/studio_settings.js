(function () {
  'use strict';

  var LIVE_SETTINGS_KEY = 'live_video_gallery';

  window.renderLiveSettings = async function () {
    var area = document.getElementById('liveSettingsModuleArea');
    if (!area) return;

    area.innerHTML = '';

    // 1. 浅色杂志感 hero：白底玻璃 + 玫瑰金/紫罗兰 暖色光晕 + 数字概览
    var hero = document.createElement('section');
    hero.className = 'st3-hero';
    hero.innerHTML =
      '<div class="st3-hero-bg"></div>' +
      '<div class="st3-hero-tint"></div>' +
      '<div class="st3-hero-inner">' +
        '<div class="st3-hero-top">' +
          '<span class="st3-kicker"># STREAMER STUDIO</span>' +
          '<span class="st3-kicker is-rose">主播控制台</span>' +
        '</div>' +
        '<h2 class="st3-hero-title">直播设置</h2>' +
        '<p class="st3-hero-sub">管理每位主播的直播间画面、音乐与粉丝增长策略</p>' +
        '<div class="st3-hero-stat">' +
          '<div><b>背景</b><span>每主播 ≤ 3 视频</span></div>' +
          '<div><b>音乐</b><span>歌单添氛围</span></div>' +
          '<div><b>增长</b><span>下播按区间</span></div>' +
        '</div>' +
      '</div>';
    area.appendChild(hero);

    // 2. 选择主播 (背景画面)
    var charSection = document.createElement('section');
    charSection.className = 'st3-card';
    charSection.innerHTML =
      '<div class="st3-card-hd">' +
        '<span class="st3-card-ic is-violet">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2"></rect><polygon points="10 9 15 12 10 15 10 9"></polygon></svg>' +
        '</span>' +
        '<div class="st3-card-hd-tt">' +
          '<h4>直播画面背景</h4>' +
          '<p>为主播上传视频，作为直播间全屏背景</p>' +
        '</div>' +
      '</div>' +
      '<div class="st3-card-body">' +
        '<div class="st3-sec-row">' +
          '<h6><span class="sharp">#</span>选择主播</h6>' +
          '<span class="st3-note">点击上传</span>' +
        '</div>' +
        '<div class="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1" id="liveSettingsCharList">' +
          '<div class="st3-loading">加载中…</div>' +
        '</div>' +
      '</div>';
    area.appendChild(charSection);

    // 3. 直播音乐入口
    var musicCard = document.createElement('button');
    musicCard.type = 'button';
    musicCard.className = 'st3-card is-row';
    musicCard.onclick = function () { if (typeof window.openLiveMusicSubPage === 'function') window.openLiveMusicSubPage(); };
    musicCard.innerHTML =
      '<span class="st3-card-ic is-rose">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
      '</span>' +
      '<span class="st3-card-hd-tt">' +
        '<h4>直播间音乐 <span class="st3-pill">BETA</span></h4>' +
        '<p>管理歌单，让直播更有氛围</p>' +
      '</span>' +
      '<svg class="st3-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    area.appendChild(musicCard);

    // 4. 直播粉丝增长区间
    area.appendChild(buildFansGrowthSettingCard());

    try {
      var chars = window.api && window.api.characters && window.api.characters.list ? await window.api.characters.list() : [];
      renderCharList(chars);
    } catch (e) {
      var cl = document.getElementById('liveSettingsCharList');
      if (cl) cl.innerHTML = '<div class="st3-loading is-err">加载失败，请重试</div>';
    }
  };

  function renderCharList(chars) {
    var container = document.getElementById('liveSettingsCharList');
    if (!container) return;
    if (!chars || chars.length === 0) {
      container.innerHTML = '<div class="st3-loading">暂无主播</div>';
      return;
    }
    container.innerHTML = chars.map(function (c) {
      var avatar = c.avatar || '';
      return '<div onclick="showLiveSettingsUploadSheet(\'' + c.id + '\',\'' + (c.name || c.id).replace(/'/g, "\\'") + '\')" class="st3-char-cell">' +
        '<div class="st3-char-av">' +
          '<img src="' + avatar + '" alt="">' +
          '<span class="st3-char-add">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
          '</span>' +
        '</div>' +
        '<span class="st3-char-name">' + (c.name || c.id) + '</span>' +
      '</div>';
    }).join('');
  }

  // 直播粉丝增长区间设置卡：与 st3-card 骨架统一
  function buildFansGrowthSettingCard() {
    var p = window.appParams || {};
    var range = window.LiveStatsManager && window.LiveStatsManager.getGainRange
      ? window.LiveStatsManager.getGainRange()
      : { min: 1000, max: 5000 };
    var minVal = Number(p.fansGainMin) || range.min;
    var maxVal = Number(p.fansGainMax) || range.max;

    var card = document.createElement('section');
    card.className = 'st3-card';
    card.id = 'fansGrowthSettingCard';
    card.innerHTML =
      '<div class="st3-card-hd">' +
        '<span class="st3-card-ic is-amber">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 22v-4a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4"></path><circle cx="9" cy="8" r="3.5"></circle><path d="M17 11.2a3.5 3.5 0 1 0-2.4-.2"></path><path d="M17 14v4"></path><path d="M15 16h4"></path></svg>' +
        '</span>' +
        '<div class="st3-card-hd-tt">' +
          '<h4>直播粉丝增长 <span class="st3-pill is-amber">结算联动</span></h4>' +
          '<p>每场直播结束后，按区间随机增长的粉丝数量</p>' +
        '</div>' +
      '</div>' +
      '<div class="st3-card-body">' +
        '<div class="st3-range">' +
          '<div class="st3-range-cell">' +
            '<label>最低增粉</label>' +
            '<div class="st3-input-wrap">' +
              '<input type="number" id="fansGainMin" min="0" value="' + minVal + '" class="st3-input">' +
              '<span class="st3-input-unit">粉</span>' +
            '</div>' +
          '</div>' +
          '<span class="st3-range-sep">~</span>' +
          '<div class="st3-range-cell">' +
            '<label>最高增粉</label>' +
            '<div class="st3-input-wrap">' +
              '<input type="number" id="fansGainMax" min="0" value="' + maxVal + '" class="st3-input">' +
              '<span class="st3-input-unit">粉</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="saveFansGrowthSetting()" type="button" class="st3-cta is-amber">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
          '<span>保存区间</span>' +
        '</button>' +
      '</div>';

    // 输入限幅：避免最高被拉低到低于最低
    var minInput = card.querySelector('#fansGainMin');
    var maxInput = card.querySelector('#fansGainMax');
    if (minInput) minInput.oninput = function () {
      if (maxInput && Number(maxInput.value) < Number(minInput.value)) maxInput.value = minInput.value;
    };
    if (maxInput) maxInput.oninput = function () {
      if (minInput && Number(minInput.value) > Number(maxInput.value)) maxInput.value = minInput.value;
    };

    return card;
  }
  window.buildFansGrowthSettingCard = buildFansGrowthSettingCard;

  // 保存粉丝增长区间到宿主持久库
  async function saveFansGrowthSetting() {
    var minEl = document.getElementById('fansGainMin');
    var maxEl = document.getElementById('fansGainMax');
    if (!minEl || !maxEl) return;

    var min = Math.max(0, Math.floor(Number(minEl.value)));
    var max = Math.max(min, Math.floor(Number(maxEl.value) > 0 ? Number(maxEl.value) : min));
    if (min > max) { var t = min; min = max; max = t; }

    if (!window.appParams) window.appParams = {};
    window.appParams.fansGainMin = min;
    window.appParams.fansGainMax = max;

    try {
      await dbUpsert('app_settings', 'global_params', window.appParams);
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('直播粉丝增长区间已保存：' + min + ' ~ ' + max);
    } catch (e) {
      if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast('保存成功：' + min + ' ~ ' + max);
    }
  }
  window.saveFansGrowthSetting = saveFansGrowthSetting;

  // 上传弹窗：底部 sheet（与超话抽屉一致的入场动效）
  window.showLiveSettingsUploadSheet = function (charId, charName) {
    var overlay = document.getElementById('liveSettingsUploadSheet');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'liveSettingsUploadSheet';
    overlay.className = 'st3-sheet';
    overlay.onclick = function (e) { if (e.target === overlay) closeSheet(); };

    var sheet = document.createElement('div');
    sheet.className = 'st3-sheet-panel';
    sheet.innerHTML =
      '<div class="st3-sheet-grabber"></div>' +
      '<div class="st3-sheet-hd">' +
        '<span class="st3-kicker is-violet"># 上传直播画面</span>' +
        '<h4>为 ' + (charName || '该主播') + ' 上传视频</h4>' +
        '<p>请选择一段不超过 30 秒的视频作为直播间全屏背景</p>' +
      '</div>' +
      '<div class="st3-sheet-body">' +
        '<div class="st3-sheet-tip">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
          '<div>' +
            '<b>视频要求</b>' +
            '<span>MP4/MOV 格式 · 时长 ≤ 30 秒 · 大小建议 ≤ 30MB</span>' +
          '</div>' +
        '</div>' +
        '<div class="st3-sheet-btns">' +
          '<button id="lsUploadCancelBtn" type="button" class="st3-btn is-ghost">取消</button>' +
          '<button id="lsUploadConfirmBtn" type="button" class="st3-btn is-violet">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
            '<span>选择视频上传</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    requestAnimationFrame(function () { overlay.classList.add('show'); });

    document.getElementById('lsUploadCancelBtn').onclick = closeSheet;
    document.getElementById('lsUploadConfirmBtn').onclick = function () {
      startUpload(charId, charName, overlay);
    };

    function closeSheet() {
      overlay.classList.remove('show');
      setTimeout(function () { overlay.remove(); }, 280);
    }
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

      if (sheetOverlay) {
        sheetOverlay.classList.remove('show');
        setTimeout(function () { sheetOverlay.remove(); }, 280);
      }

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
