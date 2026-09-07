(function () {
  'use strict';

  // =========================================================================
  // 直播设置 · 主播控制台
  //
  // 界面：紧凑标题条 + 三格图标网格。tile 全部由下面的 MODULES 注册表生成 ——
  //   以后加第四个设置项，只往数组里推一个对象即可：网格是 grid，会自动换行，
  //   渲染函数和 style.css 的 .ls3-* 一行都不用改。
  //
  // 「舞台」走一个 sheet 两级（选主播 → 管理该主播的视频背景）。
  //   旧版把 char 头像横滚在卡片里，头像本身就是「给谁设置」的选择器；
  //   收成单个 tile 之后这一步会凭空消失，必须在 sheet 第一级显式补回来。
  //
  // 数据契约保持不变（下游依赖，动不得）：
  //   · collection  live_video_gallery · 主键 charId · { videos:[{ref,mime,uploadedAt}] }
  //     → live/live/live_background.js 开播时按 charId 随机取一条作全屏背景
  //     → home/streamer_profile.js 主页相册读同一份
  //   · window.appParams.fansGainMin / fansGainMax
  //     → data/live_stats_manager.js getGainRange() / rollFansGain()
  //   · window.getLiveSettingsVideoGallery(charId) 对外只读入口
  // =========================================================================

  var LIVE_SETTINGS_KEY = 'live_video_gallery';
  var MAX_VIDEOS_PER_CHAR = 3;
  var MAX_VIDEO_SECONDS = 30;
  var SHEET_ID = 'liveSettingsSheet';
  // 页面栈是 100 + index，sheet 挂在 body 上必须压过它（超话那次就是被 90 压住的）
  var SHEET_Z = 9999;

  // -------------------------------------------------------------------------
  // 小工具
  // -------------------------------------------------------------------------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toast(msg) {
    if (window.api && window.api.ui && window.api.ui.toast) window.api.ui.toast(msg);
  }

  function icon(inner, cls) {
    return '<svg class="' + (cls || 'ls3-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  function avatarOf(name, raw) {
    if (raw) return raw;
    if (typeof window.getAvatar === 'function') return window.getAvatar(name || null, 'first');
    return '';
  }

  function fmtNum(v) {
    return (Number(v) || 0).toLocaleString();
  }

  // 线性图标，与音乐页快捷入口同一套描边语言
  var ICON = {
    stage: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M10.3 9.2v5.6l4.7-2.8z"></path>',
    bgm: '<path d="M9 18V5.5l11-2V15"></path><circle cx="6.2" cy="18" r="2.8"></circle><circle cx="17.2" cy="15" r="2.8"></circle>',
    fans: '<circle cx="9.6" cy="8" r="3.4"></circle><path d="M3.8 20v-1.5a5 5 0 0 1 5-5h1.6a5 5 0 0 1 5 5V20"></path><path d="M18.2 5.6h4.4"></path><path d="M20.4 3.4v4.4"></path>',
    back: '<polyline points="14.5 5.5 8 12 14.5 18.5"></polyline>',
    plus: '<line x1="12" y1="5.5" x2="12" y2="18.5"></line><line x1="5.5" y1="12" x2="18.5" y2="12"></line>',
    trash: '<polyline points="3.5 6.5 6 6.5 20.5 6.5"></polyline><path d="M18.5 6.5 17.6 19.3a1.6 1.6 0 0 1-1.6 1.4H8a1.6 1.6 0 0 1-1.6-1.4L5.5 6.5"></path><path d="M9.3 6.5V4.6A1.3 1.3 0 0 1 10.6 3.3h2.8a1.3 1.3 0 0 1 1.3 1.3v1.9"></path><line x1="10" y1="10.5" x2="10" y2="17"></line><line x1="14" y1="10.5" x2="14" y2="17"></line>',
    info: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16.4"></line><line x1="12" y1="7.7" x2="12.01" y2="7.7"></line>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7.5 8 12 3.5 16.5 8"></polyline><line x1="12" y1="3.5" x2="12" y2="15"></line>',
    check: '<polyline points="20 6.5 9.2 17.4 4 12.3"></polyline>',
    film: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M2.5 15.6 7.6 11l4 3.6 3.2-2.8 6.7 5.8"></path><circle cx="8.6" cy="8.9" r="1.3"></circle>'
  };

  // -------------------------------------------------------------------------
  // 模块注册表 —— 加内容只改这里
  // -------------------------------------------------------------------------
  var MODULES = [
    { key: 'stage', name: '舞台', sub: '直播画面背景', tone: 'violet', glyph: ICON.stage, open: openStageSheet },
    { key: 'bgm', name: 'BGM', sub: '直播间音乐', tone: 'rose', glyph: ICON.bgm, open: openBgmPage },
    { key: 'fans', name: '粉丝体系', sub: '下播增粉区间', tone: 'amber', glyph: ICON.fans, open: openFansSheet }
  ];

  // 每格右下角的实时状态：让人不点进去也知道配没配过
  var BADGE = {
    stage: function () {
      return loadGalleryMap().then(function (map) {
        var people = Object.keys(map).length;
        if (!people) return { text: '还没设置', on: false };
        var total = 0;
        Object.keys(map).forEach(function (k) { total += map[k]; });
        return { text: people + ' 人 · ' + total + ' 段', on: true };
      });
    },
    bgm: function () {
      var n = (window.liveMusicSongs || []).length;
      return Promise.resolve(n ? { text: n + ' 首歌', on: true } : { text: '还没加歌', on: false });
    },
    fans: function () {
      var r = currentGainRange();
      return Promise.resolve({ text: '+' + fmtNum(r.min) + '~' + fmtNum(r.max), on: true });
    }
  };

  // -------------------------------------------------------------------------
  // 主渲染
  // -------------------------------------------------------------------------
  window.renderLiveSettings = function () {
    var area = document.getElementById('liveSettingsModuleArea');
    if (!area) return;

    area.innerHTML =
      '<div class="ls3-head">' +
        '<div>' +
          '<h4>直播设置</h4>' +
          '<p>管理每位主播的直播间画面、音乐与增粉策略</p>' +
        '</div>' +
        '<span class="ls3-head-k">Studio</span>' +
      '</div>' +
      '<div class="ls3-grid">' +
        MODULES.map(function (m) {
          return '<button type="button" class="ls3-tile" data-tile="' + m.key + '">' +
            '<span class="ls3-tile-ic is-' + m.tone + '">' + icon(m.glyph) + '</span>' +
            '<span class="ls3-tile-name">' + esc(m.name) + '</span>' +
            '<span class="ls3-tile-sub">' + esc(m.sub) + '</span>' +
            '<span class="ls3-tile-badge" data-badge="' + m.key + '">···</span>' +
          '</button>';
        }).join('') +
      '</div>';

    MODULES.forEach(function (m) {
      var tile = area.querySelector('[data-tile="' + m.key + '"]');
      if (tile) tile.onclick = function () { m.open(); };
    });

    refreshBadges(area);
    // 角色列表由宿主异步给，先预热缓存，点「舞台」时就不用干等
    loadChars();
  };

  function refreshBadges(area) {
    MODULES.forEach(function (m) {
      var el = area.querySelector('[data-badge="' + m.key + '"]');
      if (!el || typeof BADGE[m.key] !== 'function') return;
      Promise.resolve().then(BADGE[m.key]).then(function (b) {
        if (!b || !el.isConnected) return;
        el.textContent = b.text;
        el.classList.toggle('is-on', !!b.on);
      }).catch(function () {
        if (el.isConnected) el.textContent = '—';
      });
    });
  }

  // -------------------------------------------------------------------------
  // 数据读写
  // -------------------------------------------------------------------------
  var _charsCache = null;

  function loadChars(force) {
    if (_charsCache && !force) return Promise.resolve(_charsCache);
    var api = (window.api && window.api.characters && window.api.characters.list)
      ? window.api.characters
      : (window.AiPhone && window.AiPhone.characters);
    if (!api || !api.list) return Promise.resolve([]);
    return api.list().then(function (list) {
      _charsCache = list || [];
      return _charsCache;
    }).catch(function (e) {
      console.warn('[liveSettings] 角色列表读取失败:', e);
      return [];
    });
  }

  function loadGallery(charId) {
    if (!window.api || !window.api.db || !window.api.db.get) return Promise.resolve({ videos: [] });
    return window.api.db.get(LIVE_SETTINGS_KEY, charId)
      .then(function (data) { return data && data.videos ? data : { videos: [] }; })
      .catch(function () { return { videos: [] }; });
  }

  // 一次取回整份 gallery：既给 tile 角标用，也给选主播网格的 n/3 用，
  // 避免按 char 逐个 db.get 打出一串请求。
  function loadGalleryMap() {
    if (!window.api || !window.api.db || !window.api.db.list) return Promise.resolve({});
    return window.api.db.list(LIVE_SETTINGS_KEY, { limit: 500 }).then(function (rows) {
      var map = {};
      (rows || []).forEach(function (r) {
        if (r && r.id != null) map[String(r.id)] = (r.videos || []).length;
      });
      return map;
    }).catch(function () { return {}; });
  }

  function saveGallery(charId, data) {
    // 走 dbUpsert：宿主 db.create 撞 ID 不报错而是 prepend，
    // 自己写 create().catch(update) 会造出重复记录（见 logic/core.js 注释）
    if (typeof window.dbUpsert !== 'function') return Promise.resolve(null);
    return window.dbUpsert(LIVE_SETTINGS_KEY, String(charId), { videos: data.videos || [] });
  }

  function currentGainRange() {
    if (window.LiveStatsManager && typeof window.LiveStatsManager.getGainRange === 'function') {
      return window.LiveStatsManager.getGainRange();
    }
    // 兜底必须按 live_stats_manager 同样的规则去读 appParams，
    // 不能写死 1000/5000 —— 那样用户存过的区间会被静默显示成默认值
    var p = window.appParams || {};
    var min = Math.floor(Number(p.fansGainMin));
    var max = Math.floor(Number(p.fansGainMax));
    if (!isFinite(min) || min < 0) min = 1000;
    if (!isFinite(max) || max < 0) max = 5000;
    if (min > max) { var t = min; min = max; max = t; }
    return { min: min, max: max };
  }

  // 对外只读入口，签名保持不变：live_background.js / streamer_profile.js 在用
  window.getLiveSettingsVideoGallery = function (charId) {
    return loadGallery(charId);
  };

  // -------------------------------------------------------------------------
  // sheet 骨架：一个浮层，内容可整体替换（两级翻页共用同一个 sheet）
  // -------------------------------------------------------------------------
  function mountSheet() {
    closeSheet();
    var overlay = document.createElement('div');
    overlay.id = SHEET_ID;
    overlay.className = 'ls3-sheet';
    overlay.style.zIndex = SHEET_Z;
    overlay.innerHTML = '<div class="ls3-sheet-panel"><div class="ls3-sheet-grabber"></div></div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSheet(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    return overlay;
  }

  function sheetParts() {
    var overlay = document.getElementById(SHEET_ID);
    if (!overlay) return null;
    var panel = overlay.querySelector('.ls3-sheet-panel');
    var hd = panel.querySelector('.ls3-sheet-hd');
    var body = panel.querySelector('.ls3-sheet-body');
    return { overlay: overlay, panel: panel, hd: hd, body: body };
  }

  // 换一级就整体重写 hd + body，并给 body 一次入场动画
  function paintSheet(hdHtml, bodyHtml) {
    var p = sheetParts();
    if (!p) return null;
    var hd = p.panel.querySelector('.ls3-sheet-hd');
    if (!hd) {
      hd = document.createElement('div');
      hd.className = 'ls3-sheet-hd';
      p.panel.appendChild(hd);
    }
    var body = p.panel.querySelector('.ls3-sheet-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'ls3-sheet-body';
      p.panel.appendChild(body);
    }
    hd.innerHTML = hdHtml;
    body.innerHTML = bodyHtml;
    body.classList.remove('is-flip');
    void body.offsetWidth;          // 重启动画
    body.classList.add('is-flip');
    return body;
  }

  function closeSheet() {
    var overlay = document.getElementById(SHEET_ID);
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
  window.closeLiveSettingsSheet = closeSheet;

  function sheetHead(title, sub) {
    return '<h4>' + esc(title) + '</h4>' + (sub ? '<p>' + esc(sub) + '</p>' : '');
  }

  // -------------------------------------------------------------------------
  // 舞台 · 第一级：选主播
  // -------------------------------------------------------------------------
  var stage = { chars: [], map: {}, charId: '', charName: '' };

  function openStageSheet() {
    mountSheet();
    paintSheet(sheetHead('舞台', '选一位主播，设置她的直播间画面'),
      '<div class="ls3-loading">读取主播列表…</div>');

    Promise.all([loadChars(), loadGalleryMap()]).then(function (res) {
      stage.chars = res[0] || [];
      stage.map = res[1] || {};
      renderStagePicker();
    }).catch(function () {
      var b = sheetParts();
      if (b) b.body.innerHTML = '<div class="ls3-loading is-err">读取失败，关掉再试一次</div>';
    });
  }

  function renderStagePicker() {
    if (!stage.chars.length) {
      paintSheet(sheetHead('舞台', '选一位主播，设置她的直播间画面'),
        '<div class="ls3-loading">还没有可设置的主播</div>');
      return;
    }
    var body = paintSheet(
      sheetHead('舞台', '选一位主播，设置她的直播间画面'),
      '<div class="ls3-chargrid">' +
        stage.chars.map(function (c) {
          var cid = String(c.id || c.characterId || '');
          if (!cid) return '';
          var name = c.name || c.characterName || '主播';
          var n = stage.map[cid] || 0;
          return '<button type="button" class="ls3-charcell' + (n ? ' is-set' : '') + '" data-char="' + esc(cid) + '">' +
            '<span class="ls3-char-av">' +
              '<img src="' + esc(avatarOf(name, c.avatar)) + '" alt="">' +
              '<span class="ls3-char-n">' + n + '/' + MAX_VIDEOS_PER_CHAR + '</span>' +
            '</span>' +
            '<span class="ls3-char-name">' + esc(name) + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      hint(ICON.info, '直播间开播时，会从这位主播已上传的视频里<b>随机取一段</b>作全屏背景；每人最多 ' + MAX_VIDEOS_PER_CHAR + ' 段。')
    );
    if (!body) return;
    body.querySelectorAll('[data-char]').forEach(function (btn) {
      btn.onclick = function () { openStageChar(btn.getAttribute('data-char')); };
    });
  }

  // -------------------------------------------------------------------------
  // 舞台 · 第二级：管理该主播的视频
  // -------------------------------------------------------------------------
  function openStageChar(charId) {
    var c = null;
    for (var i = 0; i < stage.chars.length; i++) {
      var id = String(stage.chars[i].id || stage.chars[i].characterId || '');
      if (id === String(charId)) { c = stage.chars[i]; break; }
    }
    if (!c) return;
    stage.charId = String(charId);
    stage.charName = c.name || c.characterName || '主播';
    stage.armed = null;

    paintSheet(stageHead2(), '<div class="ls3-loading">读取视频…</div>');

    loadGallery(stage.charId).then(function (data) {
      stage.videos = (data && data.videos) || [];
      renderStageVideos();
    });
  }

  function stageHead2() {
    return '<div class="ls3-subhd">' +
      '<button type="button" class="ls3-back" data-act="back" aria-label="返回主播列表">' + icon(ICON.back) + '</button>' +
      '<span class="ls3-subhd-av"><img src="' + esc(avatarOf(stage.charName, findAvatar(stage.charId))) + '" alt=""></span>' +
      '<span class="ls3-subhd-t"><b>' + esc(stage.charName) + '</b>' +
        '<span>' + ((stage.videos || []).length) + ' / ' + MAX_VIDEOS_PER_CHAR + ' 段 · 开播时随机播放</span>' +
      '</span>' +
    '</div>';
  }

  function findAvatar(charId) {
    for (var i = 0; i < stage.chars.length; i++) {
      if (String(stage.chars[i].id || stage.chars[i].characterId || '') === String(charId)) {
        return stage.chars[i].avatar;
      }
    }
    return '';
  }

  function renderStageVideos() {
    var vids = stage.videos || [];
    var full = vids.length >= MAX_VIDEOS_PER_CHAR;

    var inner = vids.length
      ? '<div class="ls3-videos" id="ls3VideoList"></div>'
      : '<div class="ls3-vempty">' + icon(ICON.film) +
          '<b>还没有画面</b><span>上传一段短视频，开播时它就是全屏背景</span>' +
        '</div>';

    var body = paintSheet(
      stageHead2(),
      inner +
      '<button type="button" class="ls3-cta is-violet" data-act="upload"' + (full ? ' disabled' : '') + '>' +
        icon(full ? ICON.check : ICON.upload) +
        '<span>' + (full ? '已传满 ' + MAX_VIDEOS_PER_CHAR + ' 段' : '上传视频') + '</span>' +
      '</button>' +
      hint(ICON.info, '建议 MP4 / MOV，时长不超过 ' + MAX_VIDEO_SECONDS + ' 秒。画面只作背景，不影响主播立绘与弹幕层。')
    );
    if (!body) return;

    var back = body.parentNode.querySelector('[data-act="back"]');
    if (back) back.onclick = renderStagePicker;

    var up = body.querySelector('[data-act="upload"]');
    if (up && !full) up.onclick = function () { uploadVideo(stage.charId, stage.charName); };

    if (vids.length) hydrateVideos(body.querySelector('#ls3VideoList'), vids);
  }

  // 视频只存 ref，播放前要换成宿主媒体地址；逐条换、换好一条显示一条，
  // 免得三条一起转 dataUrl 时整屏干等
  function hydrateVideos(box, vids) {
    if (!box) return;
    box.innerHTML = vids.map(function (v, i) {
      return '<div class="ls3-video" data-i="' + i + '">' +
        '<div class="ls3-video-slot" data-slot="' + i + '">' +
          '<div class="ls3-video-load">加载中…</div>' +
        '</div>' +
        '<div class="ls3-video-bar">' +
          '<span class="ls3-video-meta">' + esc(v.mime || 'video') + ' · ' + esc(whenText(v.uploadedAt)) + '</span>' +
          '<button type="button" class="ls3-vbtn is-del" data-del="' + i + '">' + icon(ICON.trash) + '<span>删除</span></button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.onclick = function () { armDelete(btn); };
    });

    vids.forEach(function (v, i) {
      var slot = box.querySelector('[data-slot="' + i + '"]');
      if (!slot) return;
      if (!v.ref) { slot.innerHTML = '<div class="ls3-video-load is-err">记录缺失</div>'; return; }
      resolveMedia(v.ref).then(function (src) {
        if (!slot.isConnected) return;
        if (!src) { slot.innerHTML = '<div class="ls3-video-load is-err">取不到媒体</div>'; return; }
        slot.innerHTML = '<video src="' + esc(src) + '" controls playsinline preload="metadata"></video>';
      });
    });
  }

  function resolveMedia(ref) {
    if (!window.api || !window.api.media || !window.api.media.get) return Promise.resolve(null);
    return window.api.media.get({ ref: ref })
      .then(function (m) { return (m && (m.url || m.dataUrl)) || null; })
      .catch(function () { return null; });
  }

  function whenText(ts) {
    if (!ts) return '未知时间';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '未知时间';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // 删除是毁数据的操作，但再弹一层确认框在手机上很烦 —— 用「二次点击确认」：
  // 第一次点把按钮变红并改文案，3 秒内再点才真删
  function armDelete(btn) {
    var i = Number(btn.getAttribute('data-del'));
    var v = (stage.videos || [])[i];
    if (!v) return;
    if (!btn.classList.contains('is-armed')) {
      (stage._timers || []).forEach(clearTimeout);
      stage._timers = [setTimeout(function () {
        var live = document.querySelector('[data-del="' + i + '"]');
        if (live) { live.classList.remove('is-armed'); live.querySelector('span').textContent = '删除'; }
      }, 3200)];
      btn.classList.add('is-armed');
      btn.querySelector('span').textContent = '再点一次确认删除';
      return;
    }
    doDeleteVideo(i);
  }

  function doDeleteVideo(i) {
    var v = (stage.videos || [])[i];
    if (!v) return;
    stage.videos.splice(i, 1);
    saveGallery(stage.charId, { videos: stage.videos }).then(function () {
      if (window.api && window.api.media && window.api.media.delete && v.ref) {
        window.api.media.delete({ ref: v.ref }).catch(function () { return null; });
      }
      stage.map[stage.charId] = stage.videos.length;
      toast('已删除，剩 ' + stage.videos.length + ' 段');
      renderStageVideos();
    });
  }

  // -------------------------------------------------------------------------
  // 上传：选片 → 校验时长 → 转媒体引用 → 追加入库 → 就地刷新第二级
  // -------------------------------------------------------------------------
  function uploadVideo(charId, charName) {
    if ((stage.videos || []).length >= MAX_VIDEOS_PER_CHAR) {
      toast('每位主播最多 ' + MAX_VIDEOS_PER_CHAR + ' 段');
      return;
    }
    if (!window.api || !window.api.media || !window.api.media.pick) {
      toast('当前环境不支持选视频');
      return;
    }
    var btn = document.querySelector('[data-act="upload"]');
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = '上传中…'; }

    window.api.media.pick({ accept: 'video/*' }).then(function (picked) {
      if (!picked || !picked.file || !picked.file.dataUrl) {
        toast('未选择视频');
        return null;
      }
      var dataUrl = picked.file.dataUrl;
      return checkVideoDuration(dataUrl).then(function (ok) {
        if (!ok) { toast('视频超过 ' + MAX_VIDEO_SECONDS + ' 秒，换一段更短的'); return null; }
        if (!window.api.media.put) { toast('当前环境不支持上传'); return null; }
        return window.api.media.put({ dataUrl: dataUrl }).then(function (stored) {
          if (!stored || !stored.ref) { toast('视频上传失败'); return null; }
          stage.videos = stage.videos || [];
          stage.videos.push({ ref: stored.ref, mime: stored.mime || 'video/mp4', uploadedAt: Date.now() });
          return saveGallery(charId, { videos: stage.videos }).then(function () {
            stage.map[charId] = stage.videos.length;
            toast(charName + ' 已有 ' + stage.videos.length + ' 段画面');
            renderStageVideos();
            refreshTiles();
          });
        });
      });
    }).catch(function (e) {
      console.warn('[liveSettings] 上传失败:', e);
      toast('上传失败，请重试');
      var b = document.querySelector('[data-act="upload"]');
      if (b) { b.disabled = false; b.querySelector('span').textContent = '上传视频'; }
    });
  }

  function checkVideoDuration(dataUrl) {
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        var dur = video.duration;
        video.remove();
        // 拿不到时长（部分容器返回 Infinity）时放行，别把用户挡在外面
        resolve(!isFinite(dur) || dur <= MAX_VIDEO_SECONDS + 1);
      };
      video.onerror = function () { video.remove(); resolve(true); };
      video.src = dataUrl;
    });
  }

  function refreshTiles() {
    var area = document.getElementById('liveSettingsModuleArea');
    if (area) refreshBadges(area);
  }

  // -------------------------------------------------------------------------
  // BGM：直接路由到既有音乐子页，内部逻辑不动
  // -------------------------------------------------------------------------
  function openBgmPage() {
    if (typeof window.openLiveMusicSubPage === 'function') window.openLiveMusicSubPage();
    else toast('音乐模块还没准备好');
  }

  // -------------------------------------------------------------------------
  // 粉丝体系：区间编辑器（原先摊在卡片里，现在收进 sheet）
  // -------------------------------------------------------------------------
  function openFansSheet() {
    var r = currentGainRange();
    mountSheet();
    var body = paintSheet(
      sheetHead('粉丝体系', '每场直播下播结算时，按这个区间随机增粉'),
      '<div class="ls3-fans-sum"><span>每场预计增粉</span><b id="ls3FansSum">+' + fmtNum(r.min) + ' ~ ' + fmtNum(r.max) + '</b></div>' +
      '<div class="ls3-fields">' +
        '<div class="ls3-field"><label>最低</label>' +
          '<div class="ls3-inputwrap"><input type="number" id="fansGainMin" min="0" value="' + r.min + '"><span>粉</span></div>' +
        '</div>' +
        '<div class="ls3-field"><label>最高</label>' +
          '<div class="ls3-inputwrap"><input type="number" id="fansGainMax" min="0" value="' + r.max + '"><span>粉</span></div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="ls3-cta is-amber" data-act="save-fans">' + icon(ICON.check) + '<span>保存区间</span></button>' +
      hint(ICON.info, '只影响<b>之后</b>每场下播的随机增粉幅度，已经涨上来的粉丝不会被回改。')
    );
    if (!body) return;

    var minEl = body.querySelector('#fansGainMin');
    var maxEl = body.querySelector('#fansGainMax');
    var sumEl = body.querySelector('#ls3FansSum');

    function clamp(src, other) {
      // 防止把最高拉到最低以下后，结算区间反过来被 getGainRange 交换
      var a = Math.max(0, Math.floor(Number(src.value) || 0));
      var b = Math.max(0, Math.floor(Number(other.value) || 0));
      if (src === minEl && b < a) other.value = a;
      if (src === maxEl && a > b) other.value = b;
      var lo = Math.min(Math.floor(Number(minEl.value) || 0), Math.floor(Number(maxEl.value) || 0));
      var hi = Math.max(Math.floor(Number(minEl.value) || 0), Math.floor(Number(maxEl.value) || 0));
      sumEl.textContent = '+' + fmtNum(lo) + ' ~ ' + fmtNum(hi);
    }
    if (minEl) minEl.oninput = function () { clamp(minEl, maxEl); };
    if (maxEl) maxEl.oninput = function () { clamp(maxEl, minEl); };

    body.querySelector('[data-act="save-fans"]').onclick = function () {
      var min = Math.max(0, Math.floor(Number(minEl.value) || 0));
      var max = Math.max(0, Math.floor(Number(maxEl.value) || 0));
      if (min > max) { var t = min; min = max; max = t; }
      if (!window.appParams) window.appParams = {};
      window.appParams.fansGainMin = min;
      window.appParams.fansGainMax = max;
      var done = function () {
        toast('增粉区间已保存：' + fmtNum(min) + ' ~ ' + fmtNum(max));
        refreshTiles();
        closeSheet();
      };
      if (typeof window.dbUpsert === 'function') {
        window.dbUpsert('app_settings', 'global_params', window.appParams).then(done).catch(done);
      } else {
        done();
      }
    };
  }

  // 统一的信息条
  function hint(glyph, html) {
    return '<div class="ls3-hint">' + icon(glyph) + '<div>' + html + '</div></div>';
  }
})();
