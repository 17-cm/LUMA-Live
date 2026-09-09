/* ==========================================================================
   超话帖子存储层  (supertopic_store.js)

   为什么单独一层
   ─────────────
   原来用户发帖只写 localStorage，而沙盒 iframe 里 localStorage 不可用
   （data/guard_manager.js:235 就写着这件事）。代码里另外两个"兜底"调用
   —— LumaDataHub.put() 和 persistPostToDb() —— 这两个函数在整个工程里
   根本不存在，全被 `typeof x === 'function'` 守卫静默跳过。结果就是：
   发帖看起来成功了，退出重进一条不剩。

   这里统一改走宿主 api.db，用热搜已经验证可用的 create / list 范式
   （见 LIVE/community/trends.js:18 与 module_trends.js:252）。

   图片按 SDK 5.10 的要求先 media.put 换成 media-store:// 引用再入库，
   db 记录里不留 dataURL —— 否则每次改动都要重新序列化几 MB。
   显示时再 media.get 换回来（objectURL 在沙盒里会被同源规则拒载）。
   ========================================================================== */
(function () {
  'use strict';

  const COLL = 'luma_supertopic_posts';
  const byChar = {};
  let ready = false;
  let loading = null;

  function dbOk() {
    return !!(window.api && api.db && typeof api.db.list === 'function');
  }

  // ── 图片：dataURL ⇄ 媒体引用 ────────────────────────────
  async function detachImage(post) {
    const p = Object.assign({}, post);
    const img = p.image;
    // 超过 ~20KB 的 dataURL 才值得转引用，小图标直接存库更省事
    if (typeof img === 'string' && img.indexOf('data:') === 0 && img.length > 20000) {
      try {
        if (api.media && typeof api.media.put === 'function') {
          const stored = await api.media.put({ dataUrl: img });
          if (stored && stored.ref) { p.imageRef = stored.ref; p.image = ''; }
        }
      } catch (e) { console.warn('[st2s] 图片转引用失败，降级直存:', e); }
    }
    return p;
  }
  async function attachImage(post) {
    if (!post || !post.imageRef || post.image) return post;
    try {
      if (api.media && typeof api.media.get === 'function') {
        const got = await api.media.get({ ref: post.imageRef });
        if (got && got.dataUrl) post.image = got.dataUrl;
      }
    } catch (e) { /* 取不到就无图显示，不影响正文 */ }
    return post;
  }

  // ── 读 ──────────────────────────────────────────────────
  function load() {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = (async function () {
      try {
        if (!dbOk()) { ready = true; return; }
        const rows = (await api.db.list(COLL, { limit: 500 })) || [];
        rows.forEach(function (r) {
          if (!r || !r.id || !r.charId) return;
          (byChar[r.charId] = byChar[r.charId] || []).push(r);
        });
        Object.keys(byChar).forEach(function (k) {
          byChar[k].sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        });
        window.__SUPERTOPIC_POSTS__ = byChar;
        ready = true;

        // 只解析当前超话的图，别整库预加载（SDK 明确要求按需取）
        const cur = window.currentActiveSuperTopicCharId;
        if (cur && byChar[cur]) {
          await Promise.all(byChar[cur].slice(0, 20).map(attachImage));
        }
        // 载入完成时若正停在超话页，重绘一次，否则看到的还是空列表
        if (cur && typeof window.renderSuperTopicView === 'function') {
          try { window.renderSuperTopicView(cur); } catch (e) {}
        }
      } catch (e) {
        console.warn('[st2s] 帖子载入失败:', e);
        ready = true;
      }
    })();
    return loading;
  }

  // ── 写 ──────────────────────────────────────────────────
  function save(post) {
    if (!post || !post.id || !post.charId) return Promise.resolve(false);
    const arr = byChar[post.charId] = byChar[post.charId] || [];
    const i = arr.findIndex(function (x) { return String(x.id) === String(post.id); });
    if (i >= 0) arr[i] = post; else arr.unshift(post);
    window.__SUPERTOPIC_POSTS__ = byChar;

    return (async function () {
      try {
        if (!window.api || !api.db || typeof window.dbUpsert !== 'function') return false;
        const payload = await detachImage(post);
        // 评论树整棵存进去，点赞数、删除状态都靠它复原
        await window.dbUpsert(COLL, String(post.id), payload);
        return true;
      } catch (e) {
        console.warn('[st2s] 帖子入库失败:', e);
        return false;
      }
    })();
  }

  function postsOf(charId) { return byChar[String(charId)] || []; }

  window.st2sStore = {
    load: load,
    save: save,
    postsOf: postsOf,
    attachImage: attachImage,
    isReady: function () { return ready; }
  };

  // 启动即拉一次；宿主 db 未就绪时 load() 内部会安静返回
  load();
})();
