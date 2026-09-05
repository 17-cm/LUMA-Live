/* ==========================================================================
   超话等级与权限体系  (supertopic_privilege.js)

   设计要点
   ─────────
   1. 等级 = 每 1w 贡献升 1 级。贡献本身就是「按角色」统计的
      (getCharContributionScore(charId) 读的是 user→char 的消费矩阵)，
      所以每个超话的等级天然独立，不需要额外存。

   2. 权限表驱动 UI：未达门槛的按键**直接不渲染**，达到才出现
      (垃圾桶、小铅笔就是这个机制)，而不是渲染出来再置灰。

   3. 删除走「墓碑」持久化。weiboPosts 里的种子评论每次启动都会从数据
      文件重建，只改内存对象的话退出重进就复活了 —— 所以必须记录
      「哪些 id 已被删掉」，渲染时过滤。帖子同理。

   4. 评论的稳定 key 用 postId + createdAt + 正文 做哈希。
      详情页的 f1 / f1r2 是按位置生成的，删掉一条后面全都会变号，
      拿它当删除凭据会误删，所以另算一个不随位置变化的 key。
   ========================================================================== */
(function () {
  'use strict';

  const CONTRIB_PER_LEVEL = 10000;      // 每 1w 贡献一级
  const DB_PRIV  = 'luma_supertopic_priv';
  const DB_RULES = 'luma_supertopic_rules';

  // ── 活动贡献产出 ─────────────────────────────────────────
  // 送礼保持 1:1（那是钱的语义，不动）；免费活动的产出必须够高，
  // 否则 Lv.10 要 90000 贡献 = 900 天签到，发帖就永远进不去了。
  // 现在：18 次签到 / 12 帖 / 45 评论 即可到 Lv.10，Lv.50 约 98 次签到。
  const ST2S_EARN = { checkin: 5000, post: 8000, comment: 2000 };

  // 记一笔贡献，顺带处理升级提示
  function st2sEarn(charId, kind) {
    const amt = ST2S_EARN[kind];
    if (!amt || typeof window.addCharContributionScore !== 'function') return null;
    const before = st2sLevel(charId);
    let after = before;
    try {
      window.addCharContributionScore(charId, amt);
      after = st2sLevel(charId);
    } catch (e) { return null; }
    if (after > before) {
      const msg = '超话等级提升至 Lv.' + after;
      try { (window.showToast || function (t) { api.ui.toast(t); })(msg, 'ok'); } catch (e) {}
    }
    return { before, after, amount: amt };
  }

  // ── 权限阶梯 ─────────────────────────────────────────────
  // lv: 需要的超话等级；follow: 是否必须先关注
  const ST2S_PERMS = {
    view:    { lv: 0,  follow: false, label: '浏览超话' },
    like:    { lv: 1,  follow: true,  label: '点赞' },
    comment: { lv: 1,  follow: true,  label: '评论' },
    checkin: { lv: 1,  follow: true,  label: '签到' },
    support: { lv: 1,  follow: true,  label: '送礼应援' },
    report:  { lv: 1,  follow: true,  label: '举报' },
    post:    { lv: 10, follow: true,  label: '发帖' },
    editOwn: { lv: 20, follow: true,  label: '编辑自己的帖子' },
    manage:  { lv: 50, follow: true,  label: '超话管理' }
  };

  // ── 等级 ─────────────────────────────────────────────────
  function st2sContrib(charId) {
    try { return Number(window.getCharContributionScore && window.getCharContributionScore(charId)) || 0; }
    catch (e) { return 0; }
  }
  function st2sLevelInfo(charId) {
    const contrib = st2sContrib(charId);
    const level = Math.floor(contrib / CONTRIB_PER_LEVEL) + 1;
    const into = contrib % CONTRIB_PER_LEVEL;
    return {
      level,
      contrib,
      perLevel: CONTRIB_PER_LEVEL,
      into,
      need: CONTRIB_PER_LEVEL - into,
      pct: Math.round((into / CONTRIB_PER_LEVEL) * 100),
      title: 'Lv.' + level
    };
  }
  function st2sLevel(charId) { return st2sLevelInfo(charId).level; }
  function st2sFollowed(charId) { return (window.followedSuperTopics || []).includes(String(charId)); }

  // ── 权限判定 ─────────────────────────────────────────────
  // 返回 { ok, reason, needLevel }
  function st2sCan(charId, action) {
    const p = ST2S_PERMS[action];
    if (!p) return { ok: true };
    // 只有标了 follow 的动作才受关注限制；浏览类永远放行
    if (p.follow && !st2sFollowed(charId)) {
      return { ok: false, reason: '未关注本超话，只能浏览', needFollow: true };
    }
    const lv = st2sLevel(charId);
    if (lv < p.lv) {
      return { ok: false, reason: p.label + ' 需要 Lv.' + p.lv + '（当前 Lv.' + lv + '）', needLevel: p.lv };
    }
    return { ok: true, level: lv };
  }
  // 拦截式：不通过就弹提示并返回 false
  function st2sGuard(charId, action) {
    const r = st2sCan(charId, action);
    if (!r.ok && r.reason) {
      try {
        if (typeof window.showToast === 'function') window.showToast(r.reason, 'warn');
        else if (window.api && api.ui) api.ui.toast(r.reason);
      } catch (e) {}
      return false;
    }
    return r.ok;
  }

  // ── 墓碑（已删除项） ─────────────────────────────────────
  const st2sTomb = { posts: {}, comments: {} };
  let st2sTombLoaded = false;

  function st2sHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }
  // 评论的稳定 key：不随楼层位置变化
  function st2sCommentKey(postId, c) {
    return st2sHash(String(postId) + '|' + (c && (c.createdAt || c.time) || '') + '|' + ((c && (c.text || c.content)) || ''));
  }
  function st2sIsDeletedPost(postId) { return !!st2sTomb.posts[String(postId)]; }
  function st2sIsDeletedComment(key) { return !!st2sTomb.comments[key]; }

  function st2sPersistTomb() {
    try {
      if (typeof dbUpsert === 'function') {
        dbUpsert(DB_PRIV, 'tombstones', { posts: st2sTomb.posts, comments: st2sTomb.comments });
      }
    } catch (e) { console.warn('[st2s] 墓碑持久化失败:', e); }
  }
  function st2sLoadTomb() {
    if (st2sTombLoaded) return;
    st2sTombLoaded = true;
    (async function () {
      try {
        if (!window.api || !api.db || typeof api.db.get !== 'function') return;
        const rec = await api.db.get(DB_PRIV, 'tombstones').catch(() => null);
        if (rec && rec.posts) st2sTomb.posts = rec.posts;
        if (rec && rec.comments) st2sTomb.comments = rec.comments;
        // 载入后若正停在超话页，重绘一次，让已删项立刻消失
        if (window.currentActiveSuperTopicCharId && typeof window.renderSuperTopicView === 'function') {
          try { window.renderSuperTopicView(window.currentActiveSuperTopicCharId); } catch (e) {}
        }
      } catch (e) { console.warn('[st2s] 墓碑载入失败:', e); }
    })();
  }
  function st2sDeletePost(postId) {
    st2sTomb.posts[String(postId)] = 1;
    st2sPersistTomb();
  }
  function st2sDeleteComment(key) {
    st2sTomb.comments[key] = 1;
    st2sPersistTomb();
  }
  function st2sTombStats() {
    return {
      posts: Object.keys(st2sTomb.posts).length,
      comments: Object.keys(st2sTomb.comments).length
    };
  }
  // 一键恢复：管理员误删还有回头路，不必清档
  function st2sRestoreAll() {
    st2sTomb.posts = {};
    st2sTomb.comments = {};
    st2sPersistTomb();
  }

  // ── 自定义守则（管理员可改） ─────────────────────────────
  const st2sRuleCache = {};
  function st2sLoadRules(charId) {
    if (st2sRuleCache[charId] !== undefined) return;
    st2sRuleCache[charId] = null;                       // 标记为「已在取」
    (async function () {
      try {
        if (!window.api || !api.db || typeof api.db.get !== 'function') return;
        const rec = await api.db.get(DB_RULES, String(charId)).catch(() => null);
        if (rec && Array.isArray(rec.rules)) st2sRuleCache[charId] = rec.rules;
        if (window.currentActiveSuperTopicCharId && String(window.currentActiveSuperTopicCharId) === String(charId)
            && typeof window.renderSuperTopicTab === 'function') {
          try { window.renderSuperTopicTab(); } catch (e) {}
        }
      } catch (e) { console.warn('[st2s] 守则载入失败:', e); }
    })();
  }
  function st2sHasCustomRules(charId) {
    return Array.isArray(st2sRuleCache[charId]) && st2sRuleCache[charId].length > 0;
  }
  function st2sRulesFor(charId, fallback) {
    st2sLoadRules(charId);
    return st2sRuleCache[charId] || fallback;
  }
  function st2sSaveRules(charId, rules) {
    if (!rules) { st2sRuleCache[charId] = null; }   // null → 回落默认守则
    else st2sRuleCache[charId] = rules;
    try { if (typeof dbUpsert === 'function') dbUpsert(DB_RULES, String(charId), { rules: rules }); }
    catch (e) { console.warn('[st2s] 守则保存失败:', e); }
  }

  // ── 通用弹窗（确认 / 多行编辑） ──────────────────────────
  function st2sCloseModal() {
    const m = document.getElementById('st2sConfirmModal');
    if (m) { if (m._st2sStopKb) m._st2sStopKb(); m.remove(); }
    document.removeEventListener('keydown', st2sEscHandler);
  }
  function st2sEscHandler(e) { if (e.key === 'Escape') st2sCloseModal(); }

  // ── 软键盘顶起弹窗 ──────────────────────────────────────
  // Android webview 默认 adjustResize 不生效，键盘是盖在页面之上的，
  // 居中的弹窗会被压在键盘底下看不见。用 visualViewport 量出键盘高度，
  // 把弹窗改成贴底并抬到键盘上沿。
  function st2sTrackKeyboard(wrap) {
    const vv = window.visualViewport;
    if (!vv) return function () {};
    const apply = function () {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (kb > 40) {
        wrap.style.bottom = kb + 'px';
        wrap.classList.add('is-kb');
      } else {
        wrap.style.bottom = '';
        wrap.classList.remove('is-kb');
      }
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    // 软键盘有弹出动画，部分 webview 的 resize 来得很慢，focus 后补测两次
    const onFocusIn = function () { setTimeout(apply, 150); setTimeout(apply, 420); };
    wrap.addEventListener('focusin', onFocusIn);
    apply();
    return function () {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      wrap.removeEventListener('focusin', onFocusIn);
    };
  }

  function st2sOpenModal(opt) {
    st2sCloseModal();
    const wrap = document.createElement('div');
    wrap.id = 'st2sConfirmModal';
    wrap.className = 'st2s-modal';
    const bodyHtml = opt.textarea
      ? `<textarea id="st2sModalText" class="st2s-modal-ta${opt.tall ? ' is-tall' : ''}" maxlength="${opt.maxlength || 500}">${opt.value || ''}</textarea>`
      : `<div class="st2s-modal-msg">${opt.body || ''}</div>`;
    wrap.innerHTML = `
      <div class="st2s-modal-box" onclick="event.stopPropagation()">
        <div class="st2s-modal-head">
          <span>${opt.title || '确认'}</span>
          <button type="button" class="st2s-modal-x" onclick="st2sCloseModal()" aria-label="关闭">&times;</button>
        </div>
        ${bodyHtml}
        ${opt.hint ? `<div class="st2s-modal-note">${opt.hint}</div>` : ''}
        <div class="st2s-modal-ft">
          <button type="button" class="st2s-modal-cancel" onclick="st2sCloseModal()">${opt.cancel || '取消'}</button>
          <button type="button" class="st2s-modal-ok ${opt.danger ? 'is-danger' : ''}" id="st2sModalOk">${opt.ok || '确定'}</button>
        </div>
      </div>`;
    wrap.addEventListener('click', st2sCloseModal);
    document.body.appendChild(wrap);
    const ok = document.getElementById('st2sModalOk');
    if (ok) ok.addEventListener('click', function () {
      const ta = document.getElementById('st2sModalText');
      const val = ta ? ta.value : null;
      if (opt.onOk) { if (opt.onOk(val) === false) return; }
      st2sCloseModal();
    });
    document.addEventListener('keydown', st2sEscHandler);
    const stopKb = st2sTrackKeyboard(wrap);
    wrap._st2sStopKb = stopKb;
    setTimeout(function () {
      const ta = document.getElementById('st2sModalText');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      else if (ok) ok.focus();
    }, 60);
  }

  // 危险操作确认框
  function st2sConfirmDelete(what, onOk) {
    st2sOpenModal({
      title: '永久删除',
      body: '确定删除这条' + what + '吗？删除后本超话内所有人都不再可见，<b>不可恢复</b>。',
      ok: '删除',
      cancel: '取消',
      danger: true,
      onOk: onOk
    });
  }

  window.ST2S_PERMS = ST2S_PERMS;
  window.CONTRIB_PER_LEVEL = CONTRIB_PER_LEVEL;
  window.st2sContrib = st2sContrib;
  window.st2sLevel = st2sLevel;
  window.st2sLevelInfo = st2sLevelInfo;
  window.st2sFollowed = st2sFollowed;
  window.st2sCan = st2sCan;
  window.st2sGuard = st2sGuard;
  window.ST2S_EARN = ST2S_EARN;
  window.st2sEarn = st2sEarn;
  window.st2sCommentKey = st2sCommentKey;
  window.st2sIsDeletedPost = st2sIsDeletedPost;
  window.st2sIsDeletedComment = st2sIsDeletedComment;
  window.st2sDeletePost = st2sDeletePost;
  window.st2sDeleteComment = st2sDeleteComment;
  window.st2sTombStats = st2sTombStats;
  window.st2sRestoreAll = st2sRestoreAll;
  window.st2sLoadTomb = st2sLoadTomb;
  window.st2sHasCustomRules = st2sHasCustomRules;
  window.st2sRulesFor = st2sRulesFor;
  window.st2sSaveRules = st2sSaveRules;
  window.st2sOpenModal = st2sOpenModal;
  window.st2sCloseModal = st2sCloseModal;
  window.st2sConfirmDelete = st2sConfirmDelete;
  window.st2sTrackKeyboard = st2sTrackKeyboard;

  // 贡献产出一句话摘要：所有对外文案都从这里取，避免数字散落各处改漏
  window.st2sEarnSummary = function () {
    const e = ST2S_EARN;
    return '直播间送礼 1:1 + 每日签到 +' + e.checkin.toLocaleString()
         + ' + 发帖 +' + e.post.toLocaleString()
         + ' + 评论 +' + e.comment.toLocaleString();
  };

  st2sLoadTomb();
})();
