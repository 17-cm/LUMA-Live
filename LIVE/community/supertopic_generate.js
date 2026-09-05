/* ==========================================================================
   超话内容生成引擎  (supertopic_generate.js)

   两阶段生成
   ─────────
   一次让模型吐「5~7 条帖子 × 每条 20 条评论」约 150 个对象，必然被截断。
   所以拆成：阶段一只出帖子骨架，阶段二逐条出评论区。
   两条路径通过 aiGenerate 的 presetIds 精确点名预设。

   职责边界（用户明确要求）
     我们只规范 风格 / 语言 / 整体趋势，不规范题材。
     primaryTag 由模型自己挑 —— 一批 5~7 条铺给所有超话，不是只给当前这个。

   身份铁律
     NPC 绝不能占用任何一个 char 的名字（整份名单，不只是当前这位）。
     反过来，模型一旦以 char 本人身份发言，必须回查宿主 SDK 取真名与真头像，
     绝不允许用昵称哈希出来的占位头像冒充本人。
   ========================================================================== */
(function () {
  'use strict';

  const IP_POOL = ['北京', '上海', '广东', '浙江', '江苏', '四川', '山东', '湖北',
    '湖南', '河南', '福建', '辽宁', '陕西', '黑龙江', '云南', '贵州', '广西', '赛博星云'];
  const BADGE_POOL = ['Lv.1 新粉', 'Lv.8 铁粉', 'Lv.23 老粉', '超话主持人', '后援会成员',
    '签到500天', '优质粉丝', '大粉', '路人', '', '', ''];
  // 兜底昵称池：模型给的名字撞了角色名、或干脆没给名字时用
  const NPC_POOL = ['糖渍青柠', '夜航西飞', '起名废', '先睡为敬', 'momo', '在逃观众',
    '半糖去冰', '荔枝罐头', '白开', '廿三', '专业蹲坑二十年', '摆烂一级选手',
    '屿', '九块', '蒜香法棍', '路过打个卡', '今天也不想说话', '拾柒'];

  const busy = { feed: false, posts: {} };
  const avatarCache = {};   // charId → 已解析出的真实头像

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function roster() { try { return window.getAvailableCharsList() || []; } catch (e) { return []; } }
  function charNames() { return roster().map(c => String(c.name || '').trim()).filter(Boolean); }
  // 禁用名 = 全部角色名 + 当前用户名。
  // 冒名顶替真人用户比冒名角色更恶劣：角色是虚构的，用户是被冒充的那一个。
  function meName() {
    try { return String((typeof window.getCurrentUser === 'function' && window.getCurrentUser() || {}).name || '').trim(); }
    catch (e) { return ''; }
  }
  function forbiddenNames() {
    const list = charNames();
    const me = meName();
    if (me && list.indexOf(me) < 0) list.push(me);
    return list;
  }
  function findCharByName(n) {
    const key = String(n || '').trim();
    if (!key) return null;
    return roster().find(c => String(c.name || '').trim() === key) || null;
  }
  function fmtTime(ts) {
    try { return window.formatDynamicTime ? window.formatDynamicTime(ts) : '刚刚'; } catch (e) { return '刚刚'; }
  }
  function toast(msg, kind) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info'); } catch (e) {}
  }
  function npcAvatar(name) {
    try { return (window.getAvatar && window.getAvatar(name, 'first')) || ''; } catch (e) { return ''; }
  }
  function flatten(list, out) {
    (list || []).forEach(c => { out.push(c); if (c.replies) flatten(c.replies, out); });
    return out;
  }

  // ── 本人头像：必须走 SDK，拿不到就不认这条身份 ────────────
  async function realAvatar(ch) {
    if (!ch) return '';
    const id = String(ch.characterId || ch.id || '');
    if (avatarCache[id]) return avatarCache[id];
    let url = String(ch.avatar || ch.cover || '').trim();
    if (!url && window.api && api.characters && typeof api.characters.get === 'function') {
      try {
        const full = await api.characters.get(id);
        url = String((full && (full.avatar || full.avatarUrl || full.cover)) || '').trim();
      } catch (e) {}
    }
    if (url) avatarCache[id] = url;
    return url;
  }

  // ── NPC 命名守卫（代码层硬拦，不依赖模型自觉）─────────────
  // 完全等于任一角色名 → 直接弃用重造；含角色名 → 剥掉后太短也重造。
  function sanitizeNpcName(raw) {
    let n = String(raw || '').trim().slice(0, 24);
    const names = forbiddenNames();
    if (!n) return pick(NPC_POOL);
    // 只要含任一禁用名就整条重造：剥掉名字会留下「的老粉」这种残渣，
    // 而这类昵称本身就是假本人的变体，不该留
    if (names.some(cn => n === cn || n.indexOf(cn) >= 0)) return pick(NPC_POOL);
    if (n.length < 2) return pick(NPC_POOL);
    return n;
  }

  // ── 出场角色：从全名单随机挑，不局限本超话 ─────────────────────
  // 超话是平台广场：某位角色跑到别人地盘留一句话，才是生态。
  function pickAppearingChar(owner, prob) {
    if (Math.random() >= (prob === undefined ? 0.3 : prob)) return null;
    const list = roster();
    if (!list.length) return null;
    if (Math.random() < 0.6) return owner;          // 六成本超话那位
    const others = list.filter(c => String(c.id) !== String(owner.id));
    return others.length ? pick(others) : owner;    // 四成来串门
  }

  // ── 上下文：候选名单 + 世界书 + 各 char 人设 + 实时语境 ────
  async function st2sRosterText() {
    const list = roster().slice(0, 10);
    if (!list.length) return '';
    const rows = await Promise.all(list.map(async c => {
      let persona = '';
      try {
        if (window.api && api.characters && typeof api.characters.get === 'function') {
          const full = await api.characters.get(String(c.characterId || c.id));
          persona = String((full && (full.persona || full.description)) || '');
        }
      } catch (e) {}
      return { name: c.name, category: c.category || '', tag: c.tag || '',
               isLive: !!c.isLive, persona: persona.slice(0, 260) };
    }));
    return '【本次候选名单】primaryTag 只能从这里挑，名字一字不差：\n'
      + rows.map(r => `- ${r.name}（${r.category}${r.tag ? ' / ' + r.tag : ''}${r.isLive ? ' / 正在直播' : ''}）`
          + (r.persona ? `\n    人设：${r.persona}` : '\n    人设：（无）'))
        .join('\n');
  }

  async function st2sBuildContext(anchor, extra) {
    const parts = [];
    parts.push(`【本次锚定超话】#${anchor.name}超话#（用户是在这个超话点的刷新，`
      + `但这一批帖子不必都归它，primaryTag 由你按每条在写谁来定）`);
    const r = await st2sRosterText();
    if (r) parts.push(r);

    try {
      if (window.api && api.world && typeof api.world.list === 'function') {
        const ws = (await api.world.list()) || [];
        const wt = ws.slice(0, 4)
          .map(en => `${(en && en.title) || ''}：${(en && (en.content || en.text)) || ''}`)
          .join('\n').slice(0, 700);
        if (wt.trim()) parts.push(`【世界书摘要】\n${wt}`);
      }
    } catch (e) {}

    const d = new Date();
    const hh = d.getHours();
    const slot = hh < 6 ? '凌晨（发帖少而情绪化）' : hh < 11 ? '上午（零星人流，多为摸鱼）'
      : hh < 14 ? '午间（话多，吃饭时段）' : hh < 18 ? '下午（平稳）'
      : hh < 23 ? '晚间高峰（人流最大，话题最杂）' : '深夜（容易感性、容易吵架）';
    parts.push(`【当前时间】${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
      + `${String(hh).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}，${slot}`);

    if (extra) parts.push(extra);
    return parts.join('\n\n');
  }

  // 已有话题回喂，防止反复写同一件事（跨所有超话取样）
  function st2sAvoidEcho() {
    try {
      const seen = [];
      roster().slice(0, 6).forEach(c => {
        try {
          (window.topicPostsFor ? window.topicPostsFor(c) : []).slice(0, 4).forEach(p =>
            seen.push(String(p.content || '').replace(/\s+/g, ' ').slice(0, 26)));
        } catch (e) {}
      });
      if (!seen.length) return '';
      return `【已存在的话题，禁止重复或近似】\n${seen.slice(0, 18).map(x => '- ' + x).join('\n')}`;
    } catch (e) { return ''; }
  }

  // ── 评论归一化：身份解析在这里完成 ────────────────────────
  async function normComment(raw, baseTs, depth, ctx) {
    raw = raw || {};
    const claimed = String(raw.user || raw.name || '').trim();
    const isChar = !!raw.isChar && !!ctx.char;
    let name, avatar, charId = '';
    let isCharLike = false;

    if (isChar) {
      // 以本人身份发的，一律回查 SDK 取真名真头像；查不到就降级成普通网友
      const ch = findCharByName(claimed) || ctx.char;
      const url = await realAvatar(ch);
      if (ch && url) {
        name = String(ch.name).trim(); avatar = url;
        charId = String(ch.characterId || ch.id || '');
      } else { name = sanitizeNpcName(claimed); avatar = npcAvatar(name); }
    } else {
      name = sanitizeNpcName(claimed);
      avatar = npcAvatar(name);
    }

    const isAuthor = !!raw.isAuthor && !isChar;
    if (isAuthor && ctx.authorName) {
      name = ctx.authorName;
      if (ctx.authorAvatar) avatar = ctx.authorAvatar;
      // 楼主本身就是 char 时，他下场回帖仍是「本人发言」，
      // 不能只标 isAuthor —— 否则顶着角色名却配了张占位头像
      if (ctx.authorIsChar) { isCharLike = true; charId = ctx.authorCharId || ''; }
    }

    const out = {
      id: 'c' + baseTs.toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      user: name, name: name,
      avatar: avatar,
      ip: String(raw.ip || '').trim() || pick(IP_POOL),
      text: String(raw.text || raw.content || '').trim(),
      content: String(raw.text || raw.content || '').trim(),
      replyTo: String(raw.replyTo || '').trim(),
      createdAt: Number(raw.createdAt) || baseTs,
      time: fmtTime(baseTs),
      likes: Number(raw.likes) >= 0 ? Number(raw.likes) : rnd(0, 40),
      isLiked: false,
      isChar: !!charId, charId: charId,
      isAuthor: isAuthor
    };
    const kids = Array.isArray(raw.replies) ? raw.replies : [];
    out.replies = [];
    if (depth < 2) {
      for (const k of kids) {
        out.replies.push(await normComment(k, out.createdAt + rnd(20000, 90000), depth + 1, ctx));
      }
    }
    return out;
  }
  function countComments(list) {
    return (list || []).reduce((n, c) => n + 1 + countComments(c.replies), 0);
  }

  // ── 阶段二：给一条帖子生成评论区 ─────────────────────────
  async function st2sGenCommentSet(ownerChar, post, opts) {
    opts = opts || {};
    const authorName = (post.author && post.author.name) || '';
    const existing = (post.commentTree || []).slice(0, 12)
      .map(c => `${c.user || c.name}：${String(c.text || '').slice(0, 30)}`).join('\n');

    // 30% 概率有角色本人下场；是谁，从全名单随机挑
    const appearing = (opts.appearingChar !== undefined)
      ? opts.appearingChar
      : (opts.focusMyComment ? null : pickAppearingChar(ownerChar, 0.3));
    const me = (typeof window.getCurrentUser === 'function' && window.getCurrentUser()) || {};
    const guest = appearing && String(appearing.id) !== String(ownerChar.id);
    const allNames = charNames().join('、');

    const extra = [
      `【帖子所在超话】#${ownerChar.name}超话#`,
      `【帖子作者(楼主)】${authorName}`,
      `【在场角色】这些人是本广场的网友都认识的公众人物，提到时直接叫名字：${allNames}`,
      `【本人是否下场】` + (appearing
        ? `本次 ${appearing.name} 会在评论区出现 1~2 条，用 isChar:true 标记，`
          + `user 原样填「${appearing.name}」。他话很少很短，不解释自己，不挨个道谢。`
          + (guest
              ? `重点：他不是本超话（${ownerChar.name}）的人，是跑到别人地盘串门的 —— `
                + `必须有人对这件事本身做出反应：「你怎么跑这儿来了」、「抓到了」、`
                + `「你俩认识？」、有人开始磕、有人怀疑走错门、有人喊截图。`
                + `这些反应比他说什么更重要，而他本人一句不解释。`
              : `他是本超话的主角，他出现本身就是大事：有人不敢相信、有人喊截图、`
                + `有人故意装没看见、有人怀疑是运营顶号。`)
        : `本次没有任何角色本人出现：所有评论 isChar 必须为 false，`
          + '且任何昵称都不得等于名单里任何一个角色的名字。'),
      `【楼主是否下场】允许楼主本人下场回几条，用 isAuthor:true 标记。`
        + `但注意：“楼主”不是日常称呼，网友直接打 ID 或者说“你”。`,
      me.name ? `【当前用户】${me.name}。他可能已在下方已有评论里发过言。`
        + `本次允许他再出现 0~1 条；只要他出现，就必须有别的网友回复他、@ 他、`
        + `或者接他的话 —— 把他当空气是最不能接受的。` : '',
      `【帖子正文】\n${post.content || ''}`,
      post.imageDesc ? `【帖子配图说明】${post.imageDesc}` : '',
      existing ? `【已有评论，新评论必须与之衔接、不得重复语气与观点】\n${existing}` : '',
      opts.focusMyComment
        ? `【本次任务】当前用户 ${me.name} 刚在这条帖子下发了一条评论：`
          + `「${opts.focusMyComment}」。生成 4~8 条围着他这句话的回应：`
          + `必须至少 2 条 replyTo 指向 ${me.name}，可以是接话、反驳、补充、`
          + `把话带偏、或者只是笑一下。不许把他当空气，也不许一味附和。`
          + `其余楼层可以继续聊帖子本身。`
        : (opts.more
        ? `【本次任务】这条帖子已有评论区，请新增 20~30 条评论（含楼中楼）。`
          + '时间必须晚于已有评论；新评论既可以开新楼，也可以挂在上面「已有评论」里的某条下面'
          + '（replyTo 直接指向那些旧昵称）。允许出现新话题、新分歧、以及旧评论的后续。'
        : `【本次任务】这是新帖，生成约 20 条评论（含楼中楼）。`)
    ].filter(Boolean).join('\n\n');

    const res = await window.aiGenerate({
      characterId: String(ownerChar.characterId || ownerChar.id),
      appTags: ['supertopic'],
      // ③ 必须一起点名：梗密度与 AI 口癖黑名单写在 ③ 里，
      // 只给 ⑤⑥ 的话，那套要求永远作用不到评论区
      presetIds: ['luma_st_voice_corpus', 'luma_st_comment_tree', 'luma_st_comments_protocol'],
      instruction: await st2sBuildContext(ownerChar, extra)
    });
    const parsed = window.extractJsonFromText && res && res.text
      ? window.extractJsonFromText(res.text) : null;
    let raw = parsed && Array.isArray(parsed.comments) ? parsed.comments
      : (Array.isArray(parsed) ? parsed : null);
    if (!raw || !raw.length) return { added: 0, charJoined: false };

    const now = Date.now();
    const span = opts.more ? 8 * 3600 * 1000 : 3 * 3600 * 1000;
    const start = opts.more ? now - rnd(30, 180) * 60000 : (post.createdAt || now) + 60000;
    const step = raw.length > 1 ? Math.max(60000, Math.floor(span / raw.length)) : 60000;

    const ctx = { char: ownerChar, authorName: authorName,
                  authorAvatar: (post.author && post.author.avatar) || '',
                  authorIsChar: !!(post.author && post.author.isChar),
                  authorCharId: (post.author && post.author.charId) || '' };
    const made = [];
    for (let i = 0; i < raw.length; i++) {
      made.push(await normComment(raw[i], start + i * step + rnd(0, 30000), 0, ctx));
    }

    post.commentTree = (post.commentTree || []).concat(made);
    post.commentTree.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    post.stats = post.stats || {};
    post.stats.comments = countComments(post.commentTree);
    const who = flatten(made, []).find(c => c.isChar);
    return { added: made.length, charJoined: !!who, charName: who ? who.user : '' };
  }

  // ── 生图（可选，约三成）──────────────────────────────────
  async function st2sMaybeImage(owner, post) {
    const prompt = String(post.imagePrompt || '').trim();
    if (!prompt) return;
    try {
      if (!window.api || !api.ai || typeof api.ai.generateImage !== 'function') return;
      const got = await window.aiGenerateImage({
        prompt: prompt, characterId: String(owner.characterId || owner.id)
      });
      const url = got && (got.dataUrl || got.url || got.imageUrl);
      if (url) post.image = url;
    } catch (e) { console.warn('[st2s] 生图失败，帖子降级为无图:', e); }
  }

  // ── 按主 tag 投递 ───────────────────────────────────────
  function st2sRouteByTag(primaryTag, fallback) {
    const tag = String(primaryTag || '').replace(/#/g, '').trim();
    if (!tag) return fallback;
    const list = roster();
    return list.find(c => tag === `${c.name}超话` || tag === String(c.name).trim()) || fallback;
  }

  // ── 阶段一：刷新广场（跨所有超话）────────────────────────
  async function st2sGenFeed(anchorCharId) {
    const list = roster();
    const anchor = list.find(c => String(c.id) === String(anchorCharId)) || list[0];
    if (!anchor) return;
    if (busy.feed) { toast('正在生成中，稍等一下', 'warn'); return; }
    busy.feed = true;
    try { if (window.api && api.ui) api.ui.setLoading(true); } catch (e) {}
    toast('正在生成超话新动态…');

    try {
      const extra = [
        st2sAvoidEcho(),
        `【本次任务】生成 5~7 条超话帖子（具体几条你定），primaryTag 从候选名单里自由分配，`
        + '不必都落在锚定超话上。约三成帖子由名单里的角色本人亲自发出'
        + '（author.isChar 标记）—— 是谁随机，他可以去别人超话发，也可以在自己超话发。'
        + 'comments 一律给空数组。'
      ].filter(Boolean).join('\n\n');

      const res = await window.aiGenerate({
        characterId: String(anchor.characterId || anchor.id),
        appTags: ['supertopic'],
        presetIds: ['luma_st_plaza_ecosystem', 'luma_st_persona_pool',
                    'luma_st_voice_corpus', 'luma_st_posts_protocol'],
        instruction: await st2sBuildContext(anchor, extra)
      });
      const parsed = window.extractJsonFromText && res && res.text
        ? window.extractJsonFromText(res.text) : null;
      let raw = parsed && Array.isArray(parsed.posts) ? parsed.posts
        : (Array.isArray(parsed) ? parsed : null);
      if (!raw || !raw.length) { toast('生成格式异常，请再试一次', 'warn'); return; }

      const now = Date.now();
      const made = [];
      for (let i = 0; i < raw.length; i++) {
        const p = raw[i] || {};
        if (!(p.content || '').trim()) continue;
        const owner = st2sRouteByTag(p.primaryTag, anchor);
        const ar = p.author || {};

        // 作者可以是 char 本人：他既能在自己超话发，也能去别人超话发
        let aName, aAvatar, aCharId = '', aBadge, aVerified = false;
        if (ar.isChar) {
          const ch = findCharByName(ar.name) || owner;
          const url = await realAvatar(ch);
          if (ch && url) {
            aName = String(ch.name).trim(); aAvatar = url;
            aCharId = String(ch.characterId || ch.id || '');
            aBadge = '本人'; aVerified = true;
          } else { aName = sanitizeNpcName(ar.name); aAvatar = npcAvatar(aName); aBadge = pick(BADGE_POOL); }
        } else {
          aName = sanitizeNpcName(ar.name);
          aAvatar = npcAvatar(aName);
          aBadge = (typeof ar.badge === 'string' && ar.badge && forbiddenNames().indexOf(ar.badge) < 0)
            ? ar.badge : pick(BADGE_POOL);
          aVerified = !!ar.verified;
        }

        const ts = now - i * rnd(9, 26) * 60000 - rnd(0, 7) * 60000;
        const wantImage = !!p.needImage;   // 一次性决策，不入库
        const post = {
          id: 'st_ai_' + ts.toString(36) + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
          charId: owner.id,
          author: { name: aName, avatar: aAvatar, badge: aBadge, verified: aVerified,
                    isChar: !!aCharId, charId: aCharId },
          createdAt: ts,
          primaryTag: p.primaryTag || `#${owner.name}超话#`,
          subTags: Array.isArray(p.subTags) ? p.subTags.filter(Boolean).slice(0, 2) : [],
          mentions: Array.isArray(p.mentions) ? p.mentions.filter(Boolean).slice(0, 1) : [],
          content: String(p.content).trim(),
          image: '',
          imagePrompt: String(p.imagePrompt || '').slice(0, 400),
          imageDesc: String(p.imageDesc || '').slice(0, 120),
          device: null,
          stats: {
            reposts: Number(p.reposts) >= 0 ? Number(p.reposts) : rnd(0, 30),
            comments: 0,
            likes: Number(p.likes) >= 0 ? Number(p.likes) : rnd(5, 300),
            isLiked: false, isDownloaded: false
          },
          commentTree: []
        };
        if (wantImage) await st2sMaybeImage(owner, post);
        made.push({ post: post, owner: owner });
      }
      if (!made.length) { toast('没生成出有效内容', 'warn'); return; }

      for (let i = 0; i < made.length; i++) {
        try { await st2sGenCommentSet(made[i].owner, made[i].post, {}); }
        catch (e) { console.warn('[st2s] 评论区生成失败，帖子仍入库:', e); }
        window.st2sStore.save(made[i].post);
      }

      const spread = new Set(made.map(x => x.post.charId)).size;
      toast(`已生成 ${made.length} 条新动态 · 分布在 ${spread} 个超话`, 'ok');
      if (typeof window.renderSuperTopicView === 'function' && window.currentActiveSuperTopicCharId) {
        window.renderSuperTopicView(window.currentActiveSuperTopicCharId);
      }
    } catch (e) {
      console.error('[st2s] 广场生成失败:', e);
      toast('生成失败，请检查模型配置', 'warn');
    } finally {
      busy.feed = false;
      try { if (window.api && api.ui) api.ui.setLoading(false); } catch (e) {}
    }
  }

  // ── 详情页追加评论 ──────────────────────────────────────
  async function st2sGenMoreComments(postId) {
    const found = (typeof window.findSuperTopicPost === 'function') ? window.findSuperTopicPost(postId) : null;
    if (!found) { toast('帖子不存在', 'warn'); return; }
    if (busy.posts[postId]) { toast('这条正在生成评论，稍等', 'warn'); return; }
    const owner = roster().find(c => String(c.id) === String(found.charId));
    if (!owner) return;
    busy.posts[postId] = true;
    if (typeof window.rerenderSuperTopicDetail === 'function') window.rerenderSuperTopicDetail();
    try {
      const r = await st2sGenCommentSet(owner, found.post, { more: true });
      if (!r.added) { toast('这次没生成出评论，再试一次', 'warn'); return; }
      window.st2sStore.save(found.post);
      toast(`新增 ${r.added} 条评论` + (r.charName ? ` · ${r.charName} 来了` : ''), 'ok');
    } catch (e) {
      console.error('[st2s] 追加评论失败:', e);
      toast('生成失败，请重试', 'warn');
    } finally {
      delete busy.posts[postId];
      if (typeof window.rerenderSuperTopicDetail === 'function') window.rerenderSuperTopicDetail();
    }
  }

  // ── 用户发帖后主动生成回应 ───────────────────────────────
  async function st2sRespondToUserPost(post) {
    const owner = roster().find(c => String(c.id) === String(post.charId));
    if (!owner) return;
    try {
      const r = await st2sGenCommentSet(owner, post, {});
      if (r.added) {
        window.st2sStore.save(post);
        if (String(window.superTopicDetailPostId) === String(post.id)
            && typeof window.rerenderSuperTopicDetail === 'function') {
          window.rerenderSuperTopicDetail();
        }
      }
    } catch (e) { console.warn('[st2s] 用户帖回应生成失败:', e); }
  }

  // 用户自己发了条评论 → 必须有人接话，不能让他沉底
  async function st2sReplyToMyComment(postId, myText) {
    const found = (typeof window.findSuperTopicPost === 'function') ? window.findSuperTopicPost(postId) : null;
    if (!found) return;
    const owner = roster().find(c => String(c.id) === String(found.charId));
    if (!owner) return;
    try {
      const r = await st2sGenCommentSet(owner, found.post, { more: true, focusMyComment: String(myText || '').slice(0, 120) });
      if (r.added) {
        window.st2sStore.save(found.post);
        if (typeof window.rerenderSuperTopicDetail === 'function') window.rerenderSuperTopicDetail();
      }
    } catch (e) { console.warn('[st2s] 评论回应生成失败:', e); }
  }

  window.st2sGen = {
    feed: st2sGenFeed,
    moreComments: st2sGenMoreComments,
    replyToMyComment: st2sReplyToMyComment,
    respondToUserPost: st2sRespondToUserPost,
    isBusy: function (postId) { return postId ? !!busy.posts[postId] : busy.feed; },
    // 供渲染层判定「这条是不是本人 / 是不是我」，以及取真实头像
    isMe: function (name) {
      const me = (typeof window.getCurrentUser === 'function' && window.getCurrentUser()) || {};
      return !!me.name && String(name || '').trim() === String(me.name).trim();
    },
    charAvatar: realAvatar,
    findCharByName: findCharByName,
    npcName: sanitizeNpcName
  };
})();
