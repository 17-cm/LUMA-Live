// =============================================================================
// LUMA Live · 开播机制落库驱动（引擎 ⇄ 房管 之间那一层）
//
// 引擎只算时间（谁、几点到几点），落库一律过房管（开播/下播唯一出口）。
// 本文件干两件事，都用"问一次、推一次"的方式做，没有任何定时器触发：
//
//   1) 先把「此刻正在播」的主播挂上广场 —— 她是几点开的就用几点，不倒推成"刚刚"；
//   2) 再把「你离开期间已经播完」的场次逐场补进历史 —— 每场都带真实起止时刻，
//      计入她的直播场次/涨粉/档案，不补通知（那是过去的事，不该现在弹给你）。
//
// 补历史按预算分批做（每次最多 globalBudget 场），剩下的下一趟接着补，
// 所以长时间离线后再打开也不会卡住界面。
// =============================================================================

(function () {
  'use strict';

  const SCHEDULE_KEY = 'char_schedules';
  // 每趟预算：一次打开最多写多少场（含开播+下播两次房管调用）
  const DEFAULT_GLOBAL_BUDGET = 60;
  const DEFAULT_PER_CHAR_BUDGET = 12;
  // 第一次运行（还没有任何记录）最多回看多久：只为了让她"此刻在不在播"有个来由，
  // 不把几个月的历史一次性灌进来。之后每次打开只补"上次到这次"的真实空档。
  const FIRST_RUN_WINDOW_MS = 2 * 60 * 60 * 1000;

  function num(v, f) { const n = Number(v); return Number.isFinite(n) ? n : f; }

  function loadSchedules() {
    if (!window.charSchedulesMap) window.charSchedulesMap = {};
    return window.charSchedulesMap;
  }

  function ensureSched(map, charId, savedMap) {
    if (!map[charId] && savedMap && savedMap[charId]) map[charId] = savedMap[charId];
    if (!map[charId]) map[charId] = { characterId: charId };
    return map[charId];
  }

  function pickCourse(charId, k, fallbackName) {
    // 分类/标题也由"她是谁 + 第几轮"算出来，同一场问多少次都是同一个标题
    if (typeof window.lumaPickCourse === 'function') {
      try { return window.lumaPickCourse(charId, k, fallbackName); } catch (e) {}
    }
    return { category: '随性杂谈', subTag: '日常唠嗑', topic: `【${fallbackName}】的日常唠嗑直播` };
  }

  // 一趟推进。options: { now, globalBudget, perCharBudget, dryRun }
  async function runPass(options) {
    const opts = options || {};
    const engine = window.lumaLiveEngine;
    const gateway = window.lumaOpsGateway;
    if (!engine || !gateway) return { ok: false, reason: 'engine_or_gateway_missing' };

    const now = num(opts.now, Date.now());
    const params = window.appParams || {};
    const fp = engine.paramsFingerprint(params);
    const globalBudget = Math.max(0, num(opts.globalBudget, DEFAULT_GLOBAL_BUDGET));
    const perCharBudget = Math.max(0, num(opts.perCharBudget, DEFAULT_PER_CHAR_BUDGET));
    if (globalBudget <= 0) return { ok: true, skipped: 'no_budget' };

    const chars = Array.isArray(window.allCharacters) ? window.allCharacters.slice() : [];
    if (!chars.length) return { ok: true, skipped: 'no_chars' };

    const map = loadSchedules();
    let savedMap = null;
    try { savedMap = await api.db.get('app_settings', SCHEDULE_KEY); } catch (e) { savedMap = null; }

    let sessions = [];
    try { sessions = await api.db.list('live_sessions') || []; } catch (e) { sessions = []; }
    const liveIds = new Set(sessions.map(s => String(s.characterId || '')));

    // 幂等保险：已经在历史里的场次（id 由房管按 开播时刻 生成）绝不再补第二遍。
    // 这条跟"历史进度游标"互为兜底 —— 进程被杀、指针被写坏都不会重复记账。
    const archivedIds = new Set();
    try {
      const hist = await api.db.list('streamer_history') || [];
      hist.forEach(h => archivedIds.add(String(h.id || `${h.characterId}_${h.startTime}`)));
    } catch (e) {}
    const historyIdOf = (charId, startTs) => `show_${charId}_${startTs}`;

    // ── 先给每个人算一份"轻量计划"（纯计算，不落库），用来决定这趟先照顾谁 ──
    const items = [];
    for (const c of chars) {
      const charId = String(c.id);
      if (!charId) continue;
      if (liveIds.has(charId)) continue;            // 她真实在播（含角色自主开播）→ 机制让位
      const sched = ensureSched(map, charId, savedMap);
      let cursor = null;
      if (sched.chain && sched.chain.paramsFp === fp && Number.isFinite(num(sched.chain.k, NaN))) {
        cursor = { k: num(sched.chain.k, 0), t: num(sched.chain.t, 0) };
      } else {
        // 没记录 = 第一次运行；参数指纹对不上 = 你改了面板参数 → 从此刻按新参数重新定锚
        const anchorFrom = num(sched.historyToTs, now - FIRST_RUN_WINDOW_MS);
        cursor = engine.cursorContaining(charId, params, engine.cursorAt(charId, params, Math.min(anchorFrom, now)), now);
      }
      const st = engine.stateAt(charId, params, cursor, now);
      items.push({
        charId,
        name: c.name || '主播',
        sched,
        cursor,
        isLive: !!(st && st.live),
        liveRound: (st && st.live) ? st.round : null,
        historyToTs: num(sched.historyToTs, 0)
      });
    }

    // 排序：此刻在播的先进广场，其余按"历史补到哪儿"从旧到新排
    items.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0) || (a.historyToTs || 0) - (b.historyToTs || 0));

    let spent = 0, started = 0, archived = 0, touched = false, deferred = 0;

    for (const it of items) {
      if (spent >= globalBudget) { deferred++; continue; }
      const id = it.charId, sched = it.sched;

      // 注意：房管每次开播/下播都会用新对象替换排班表里的这一条，
      // 所以之后的写入一律写回"当前那一份"，不能继续写循环开头抓到的旧对象。
      const freshSched = () => window.charSchedulesMap[id] || sched;

      // ── 1) 此刻正在播：把房间挂上广场（开播时刻用她真实的开播时刻） ──
      let liveHandled = num(sched.liveRoundStartTs, 0);
      if (it.isLive && it.liveRound) {
        if (liveHandled !== it.liveRound.startTs) {
          const course = pickCourse(id, it.liveRound.k, it.name);
          const verdict = await gateway.requestStartLive({
            characterId: id,
            category: course.category,
            subTag: course.subTag,
            topic: course.topic,
            durationMins: it.liveRound.durMins,
            startAt: it.liveRound.startTs,      // "她其实几点开的" → 房管按真实时刻落库
            source: 'rollout'
          });
          spent++;
          if (verdict && verdict.success) {
            liveHandled = it.liveRound.startTs;
            freshSched().liveRoundStartTs = it.liveRound.startTs;
            started++; touched = true;
          }
        }
      }

      // ── 2) 离线补演：把已经播完的场次补进历史（真实起止时刻，不补通知） ──
      // 已经补到此刻的人直接跳过：不重复走链子，30 秒一次的问询几乎不花时间。
      const histFrom = num(sched.historyToTs, now - FIRST_RUN_WINDOW_MS);
      const alreadyCaughtUp = Number.isFinite(num(sched.historyToTs, NaN)) && histFrom >= now - 60000;
      let histCursor = null;
      if (!alreadyCaughtUp) {
        histCursor = engine.cursorContaining(id, params, engine.cursorAt(id, params, Math.min(histFrom, now)), histFrom);
        let used = 0;
        let guard = 0;
        while (spent < globalBudget && used < perCharBudget && guard++ < 2000) {
          const step = engine.stepRound(id, params, histCursor, now);
          if (!step) break;
          const r = step.round;
          const hid = historyIdOf(id, r.startTs);
          if (r.live && r.endTs <= now && liveHandled !== r.startTs && !archivedIds.has(hid)) {
            const course = pickCourse(id, r.k, it.name);
            const verdict = await gateway.requestStartLive({
              characterId: id,
              category: course.category,
              subTag: course.subTag,
              topic: course.topic,
              durationMins: r.durMins,
              startAt: r.startTs,
              source: 'rollout',
              silent: true                     // 过去的事：不弹通知、不写"她现在在播"的状态
            });
            spent++;
            if (verdict && verdict.success) {
              await gateway.requestStopLive({
                characterId: id,
                endedAt: r.endTs,              // 用真实下播时刻归档，不是"你现在打开的时刻"
                source: 'rollout',
                reason: '本轮直播自然结束'
              });
              archivedIds.add(hid);
              archived++; touched = true;
            }
          }
          used++;
          histCursor = step.cursor;
        }
      }

      // 历史进度落库（没补完的下趟接着补）。只增不减：指针绝不会往回退。
      const cur = freshSched();
      if (!alreadyCaughtUp) {
        const walkedTo = Math.min(num(histCursor.t, now), now);
        const prevTo = num(cur.historyToTs, NaN);
        if (!Number.isFinite(prevTo) || walkedTo > prevTo) cur.historyToTs = walkedTo;
      }
      cur.liveRoundStartTs = liveHandled || cur.liveRoundStartTs || null;
      cur.chain = { k: it.cursor.k, t: it.cursor.t, paramsFp: fp, updatedAt: now };
      cur.updatedAt = now;
      touched = true;
    }

    if (touched && !opts.dryRun) {
      try { await saveDbSetting(SCHEDULE_KEY, window.charSchedulesMap); } catch (e) {}
    }

    return { ok: true, started, archived, spent, deferred, considered: items.length };
  }

  window.lumaLiveRollout = { runPass, FIRST_RUN_WINDOW_MS };
})();
