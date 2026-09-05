/* ==========================================================================
   超话内容生成引擎  (supertopic_generate.js)

   两阶段生成
   ─────────
   一次让模型吐出「3~5 条帖子 + 每条 20 条评论」约 100 个对象，几乎必然被
   截断或偷工减料。所以拆成：
     阶段一  ①②③④ 预设 → 只出帖子骨架（comments 为空）
     阶段二  ⑤⑥ 预设 → 逐条帖子单独出评论区
   两条路径都通过 aiGenerate 的 presetIds 精确点名预设，不整册下发。

   上下文三件套（用户明确要求）
     1. 区域预设      —— appPresets.supertopic
     2. 上下文        —— 当前时间 / 是否在播 / 本超话已有话题（避免重复）
     3. 世界书与角色信息 —— api.characters.get + api.world.list
   ========================================================================== */
(function () {
  'use strict';

  const IP_POOL = ['北京', '上海', '广东', '浙江', '江苏', '四川', '山东', '湖北',
    '湖南', '河南', '福建', '辽宁', '陕西', '黑龙江', '云南', '贵州', '广西', '赛博星云'];
  const BADGE_POOL = ['Lv.1 新粉', 'Lv.8 铁粉', 'Lv.23 老粉', '超话主持人', '后援会成员',
    '签到500天', '优质粉丝', '大粉', '路人', '', '', ''];

  const busy = { feed: false, posts: {} };

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  // 按主 tag 投递：模型若判定这条其实在聊别人，就送到那个人的超话广场去
  function st2sRouteByTag(primaryTag, fallbackChar) {
    const tag = String(primaryTag || '').replace(/#/g, '').trim();
    if (!tag) return fallbackChar;
    const list = window.getAvailableCharsList() || [];
    const hit = list.find(c => tag === `${c.name}超话` || tag === c.name);
    return hit || fallbackChar;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function avatarOf(name) {
    try { return (window.getAvatar && window.getAvatar(name, 'first')) || ''; } catch (e) { return ''; }
  }
  function fmtTime(ts) {
    try { return window.formatDynamicTime ? window.formatDynamicTime(ts) : '刚刚'; } catch (e) { return '刚刚'; }
  }
  function toast(msg, kind) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info'); } catch (e) {}
  }

  // ── 上下文组装 ───────────────────────────────────────────
  async function st2sBuildContext(char, extra) {
    const parts = [];
    parts.push(`【当前超话】#${char.name}超话#　【主播】${char.name}　【分区】${char.category || '综合'}`);

    // 角色信息（人设是底线，生成内容不得与之冲突）
    try {
      if (window.api && api.characters && typeof api.characters.get === 'function') {
        const full = await api.characters.get(char.id);
        const persona = full && (full.persona || full.description);
        if (persona) parts.push(`【角色设定】\n${String(persona).slice(0, 700)}`);
      }
    } catch (e) {}

    // 世界书
    try {
      if (window.api && api.world && typeof api.world.list === 'function') {
        const ws = (await api.world.list()) || [];
        const wt = ws.slice(0, 4)
          .map(en => `${(en && en.title) || ''}：${(en && (en.content || en.text)) || ''}`)
          .join('\n').slice(0, 700);
        if (wt.trim()) parts.push(`【世界书摘要】\n${wt}`);
      }
    } catch (e) {}

    // 实时直播状态
    try {
      if (window.api && api.db && typeof api.db.list === 'function') {
        const sessions = (await api.db.list('live_sessions', { limit: 50 })) || [];
        const mine = sessions.filter(x => x && String(x.characterId) === String(char.id));
        const sess = mine.length ? mine[0] : (sessions.length ? sessions[Math.floor(Math.random() * sessions.length)] : null);
        if (sess) {
          const dur = sess.startTime ? Math.floor((Date.now() - sess.startTime) / 60000) : 0;
          parts.push(`【实时状态】${sess.name || char.name} 的直播：赛道 ${sess.category || '日常'}（${sess.subTag || '杂谈'}），`
            + `标题「${sess.topic || '无'}」，已播 ${dur} 分钟，热度 ${sess.heat || 0}。`
            + (dur > 0 ? '刚下播或正在播的内容可以直接成为话题。' : ''));
        } else {
          parts.push('【实时状态】当前没有进行中的直播，话题可来自往期内容、日常观察与粉丝之间的互动。');
        }
      }
    } catch (e) {}

    const d = new Date();
    const hh = d.getHours();
    const slot = hh < 6 ? '凌晨（发帖少而情绪化）' : hh < 11 ? '上午（零星人流，多为上班族摸鱼）'
      : hh < 14 ? '午间（话多，吃饭时段）' : hh < 18 ? '下午（平稳）'
      : hh < 23 ? '晚间高峰（人流最大，话题最杂）' : '深夜（容易感性、容易吵架）';
    parts.push(`【当前时间】${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
      + `${String(hh).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}，${slot}`);

    if (extra) parts.push(extra);
    return parts.join('\n\n');
  }

  // 把已有帖子标题列给模型，防止它反复写同一件事
  function st2sAvoidEcho(char) {
    try {
      const list = (typeof window.topicPostsFor === 'function' ? window.topicPostsFor(char) : [])
        .slice(0, 12)
        .map(p => String(p.content || '').replace(/\s+/g, ' ').slice(0, 28));
      if (!list.length) return '';
      return `【本超话已有话题，禁止重复或近似】\n${list.map(x => '- ' + x).join('\n')}`;
    } catch (e) { return ''; }
  }

  // ── 评论树归一化 ─────────────────────────────────────────
  function normComment(raw, baseTs, depth) {
    const name = (raw && (raw.user || raw.name)) || `网友_${rnd(1000, 9999)}`;
    const text = (raw && (raw.text || raw.content)) || '';
    const ts = Number(raw && raw.createdAt) || baseTs;
    const kids = Array.isArray(raw && raw.replies) ? raw.replies : [];
    return {
      id: 'c' + ts.toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      user: name, name: name,
      avatar: avatarOf(name),
      ip: (raw && raw.ip) || pick(IP_POOL),
      text: text, content: text,
      replyTo: (raw && raw.replyTo) || '',
      createdAt: ts,
      time: fmtTime(ts),
      likes: Number(raw && raw.likes) || rnd(0, 40),
      isLiked: false,
      // 只保留两层原始嵌套，第三层往后一律拍平上提 —— 前端本来就是拍平显示的
      replies: depth >= 2 ? [] : kids.map(k => normComment(k, ts + rnd(1000, 60000), depth + 1))
    };
  }
  function countComments(list) {
    return (list || []).reduce((n, c) => n + 1 + countComments(c.replies), 0);
  }

  // ── 阶段二：给一条帖子生成评论区 ─────────────────────────
  async function st2sGenCommentSet(char, post, opts) {
    opts = opts || {};
    const existing = (post.commentTree || []).slice(0, 10)
      .map(c => `${c.user || c.name}：${String(c.text || '').slice(0, 30)}`).join('\n');
    const extra = [
      `【帖子作者】${(post.author && post.author.name) || '匿名'}`,
      `【帖子正文】\n${post.content || ''}`,
      post.imageDesc ? `【帖子配图说明】${post.imageDesc}` : '',
      existing ? `【已有评论，新评论必须与之衔接、不得重复语气与观点】\n${existing}` : '',
      opts.more ? `【本次任务】这条帖子已有评论区，请再生成 ${rnd(6, 12)} 条新评论（含楼中楼），`
        + '时间必须晚于已有评论，允许出现新话题、新分歧、以及老评论的后续。' : ''
    ].filter(Boolean).join('\n\n');

    const instruction = await st2sBuildContext(char, extra);
    const res = await window.aiGenerate({
      characterId: char.id,
      appTags: ['supertopic'],
      presetIds: ['luma_st_comment_tree', 'luma_st_comments_protocol'],
      instruction: instruction
    });
    const parsed = window.extractJsonFromText && res && res.text
      ? window.extractJsonFromText(res.text) : null;
    let raw = parsed && Array.isArray(parsed.comments) ? parsed.comments
      : (Array.isArray(parsed) ? parsed : null);
    if (!raw || !raw.length) return 0;

    const now = Date.now();
    const span = opts.more ? 6 * 3600 * 1000 : 3 * 3600 * 1000;
    const start = opts.more ? now - rnd(60, 240) * 60000 : (post.createdAt || now) + 60000;
    const step = raw.length > 1 ? Math.max(60000, Math.floor(span / raw.length)) : 60000;
    const made = raw.map((c, i) => normComment(c, start + i * step + rnd(0, 30000), 0));

    post.commentTree = (post.commentTree || []).concat(made);
    post.commentTree.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    post.stats = post.stats || {};
    post.stats.comments = countComments(post.commentTree);
    return made.length;
  }

  // ── 生图（可选，约三成）──────────────────────────────────
  async function st2sMaybeImage(char, post) {
    const prompt = String(post.imagePrompt || '').trim();
    if (!prompt) return;
    try {
      if (!window.api || !api.ai || typeof api.ai.generateImage !== 'function') return;
      const got = await window.aiGenerateImage({ prompt: prompt, characterId: char.id });
      const url = got && (got.dataUrl || got.url || got.imageUrl);
      if (url) post.image = url;
    } catch (e) {
      console.warn('[st2s] 生图失败，帖子降级为无图:', e);
    }
  }

  // ── 阶段一：刷新广场 ─────────────────────────────────────
  async function st2sGenFeed(charId) {
    const char = (window.getAvailableCharsList() || []).find(c => String(c.id) === String(charId));
    if (!char) return;
    if (busy.feed) { toast('正在生成中，稍等一下', 'warn'); return; }
    if (window.api && api.ui && typeof api.ui.setLoading === 'function') {
      try { api.ui.setLoading(true); } catch (e) {}
    }
    busy.feed = true;
    toast('正在生成超话新动态…');
    try {
      const extra = [
        st2sAvoidEcho(char),
        `【本次任务】为 #${char.name}超话# 生成 3~5 条新帖子（条数你自己随机决定），`
        + 'comments 一律给空数组，评论区稍后单独生成。'
      ].filter(Boolean).join('\n\n');

      const res = await window.aiGenerate({
        characterId: char.id,
        appTags: ['supertopic'],
        presetIds: ['luma_st_plaza_ecosystem', 'luma_st_persona_pool',
                    'luma_st_voice_corpus', 'luma_st_posts_protocol'],
        instruction: await st2sBuildContext(char, extra)
      });
      const parsed = window.extractJsonFromText && res && res.text
        ? window.extractJsonFromText(res.text) : null;
      let list = parsed && Array.isArray(parsed.posts) ? parsed.posts
        : (Array.isArray(parsed) ? parsed : null);
      if (!list || !list.length) { toast('生成格式异常，请再试一次', 'warn'); return; }

      const now = Date.now();
      const made = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || !(p.content || '').trim()) continue;
        const author = p.author || {};
        const aName = String(author.name || p.user || '匿名').trim().slice(0, 24);
        // 时间倒序铺开：最新的刚发，最旧的在一两小时内
        const ts = now - i * rnd(9, 26) * 60000 - rnd(0, 7) * 60000;
        const owner = st2sRouteByTag(p.primaryTag, char);
        // needImage 是一次性决策，不入库：入库后重进超话不该又生一张
        const wantImage = !!p.needImage;
        const post = {
          id: 'st_ai_' + ts.toString(36) + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
          charId: owner.id,
          author: {
            name: aName,
            avatar: avatarOf(aName),
            badge: (typeof author.badge === 'string' && author.badge) || pick(BADGE_POOL),
            verified: !!author.verified
          },
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
        made.push({ post, owner });
      }
      if (!made.length) { toast('没生成出有效内容', 'warn'); return; }

      // 逐条补评论区：一条一次调用，失败不影响其他条
      for (let i = 0; i < made.length; i++) {
        try { await st2sGenCommentSet(made[i].owner, made[i].post, {}); }
        catch (e) { console.warn('[st2s] 评论区生成失败，帖子仍入库:', e); }
        window.st2sStore.save(made[i].post);
      }

      toast(`已生成 ${made.length} 条新动态`, 'ok');
      if (String(window.currentActiveSuperTopicCharId) === String(charId)
          && typeof window.renderSuperTopicView === 'function') {
        window.renderSuperTopicView(charId);
      }
    } catch (e) {
      console.error('[st2s] 广场生成失败:', e);
      toast('生成失败，请检查模型配置', 'warn');
    } finally {
      busy.feed = false;
      if (window.api && api.ui && typeof api.ui.setLoading === 'function') {
        try { api.ui.setLoading(false); } catch (e) {}
      }
    }
  }

  // ── 详情页小刷新：给这条帖子追加更多评论 ─────────────────
  async function st2sGenMoreComments(postId) {
    const found = (typeof window.findSuperTopicPost === 'function') ? window.findSuperTopicPost(postId) : null;
    if (!found) { toast('帖子不存在', 'warn'); return; }
    if (busy.posts[postId]) { toast('这条正在生成评论，稍等', 'warn'); return; }
    const char = (window.getAvailableCharsList() || []).find(c => String(c.id) === String(found.charId));
    if (!char) return;
    busy.posts[postId] = true;
    if (typeof window.rerenderSuperTopicDetail === 'function') window.rerenderSuperTopicDetail();
    try {
      const n = await st2sGenCommentSet(char, found.post, { more: true });
      if (!n) { toast('这次没生成出评论，再试一次', 'warn'); return; }
      window.st2sStore.save(found.post);
      toast(`新增 ${n} 条评论`, 'ok');
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
    const char = (window.getAvailableCharsList() || []).find(c => String(c.id) === String(post.charId));
    if (!char) return;
    try {
      const n = await st2sGenCommentSet(char, post, { more: false });
      if (n) {
        window.st2sStore.save(post);
        if (String(window.superTopicDetailPostId) === String(post.id)
            && typeof window.rerenderSuperTopicDetail === 'function') {
          window.rerenderSuperTopicDetail();
        }
      }
    } catch (e) { console.warn('[st2s] 用户帖回应生成失败:', e); }
  }

  window.st2sGen = {
    feed: st2sGenFeed,
    moreComments: st2sGenMoreComments,
    respondToUserPost: st2sRespondToUserPost,
    isBusy: function (postId) {
      return postId ? !!busy.posts[postId] : busy.feed;
    }
  };
})();
