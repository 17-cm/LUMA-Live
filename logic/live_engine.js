// =============================================================================
// LUMA Live · 开播机制引擎（纯计算版）
//
// 这套东西只有一个职责：**给定「她是谁 + 面板三个参数 + 一个时刻」，算出她此刻在不在播、
// 这一场从几点到几点**。没有定时器、没有随机数、没有"到点触发"这回事 ——
// 同一个问题，隔 1 分钟问、隔 3 天问，答案完全一样。
//
// ── 机制（链式，不用格子、不引入任何新参数）──────────────────────────────
//   从锚点（世界纪元）开始，一轮一轮往下长：
//     第 k 轮 = [歇 restMins 分钟] + [若开播则播 durMins 分钟]
//       · 是否开播：算出一个固定数，小于「开播概率」就开播（0 就永远不开播＝维护）
//       · 歇多久  ：在 [法定最低休息, 休息时长上限] 之间由固定数算出
//       · 播多久  ：在 [最短单场, 直播时长上限] 之间由固定数算出
//     nextStart = start + restMins + (开播 ? durMins : 0)，如此往下链。
//
// ── 谁问谁算 ────────────────────────────────────────────────────────────
//   · 问"此刻她在播吗"：把链推到此刻即可，不需要任何后台运行；
//   · 离线补演：把这段时间覆盖的轮次列出来，逐轮算出真实起止时刻
//     （纯加法，不是掷骰子、不是触发）。
//
// ── 三个参数从哪来 ──────────────────────────────────────────────────────
//   全部取自设置面板：charSpawnRate（开播概率 0~80）、maxLiveDuration（直播时长上限）、
//   maxRestDuration（休息时长上限），外加沿用现有的 minRestDuration（法定最低休息）。
//   本引擎不设默认值、不写死任何数：面板是多少就用多少。
// =============================================================================

(function () {
  'use strict';

  // 沿用项目现有下限（不是本引擎发明的：原来排班里就是"最短 30 分钟、最低休息 10 分钟"）
  const FALLBACK_MIN_DUR = 30;
  const FALLBACK_MIN_REST = 10;
  // 世界纪元：链子从这个时刻开始长。它跟"玩家什么时候打开 APP"无关，
  // 所以第一次打开时广场上本来就有人，而不是"你来了大家才开始生活"。
  const WORLD_EPOCH_ISO = '2026-01-01T00:00:00+08:00';
  // 首次运行（还没游标）最多回补多久：避免第一次打开就灌进几百场"她其实播过"的历史。
  // 之后每次打开只从上次的游标往后补，所以你离开多久就补多久。
  const FIRST_RUN_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;
  // 单次推进的轮次上限（防参数极端小的时候卡住）；超了就把游标挪到最近这一段。
  const MAX_ROUNDS_PER_PASS = 2000;

  function hash01() {
    const s = Array.prototype.join.call(arguments, '|');
    let h = 0x811c9dc5 >>> 0;                 // FNV-1a：同样的输入永远同样的结果
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h / 4294967296;
  }

  // 面板参数归一化：面板是多少就用多少，缺省只兜底成"项目原有默认值"
  function normalizeParams(p) {
    const raw = p || {};
    const rate = Math.min(100, Math.max(0, Number(raw.charSpawnRate) || 0));
    const maxLive = Math.max(1, Math.round(Number(raw.maxLiveDuration) || 120));
    const maxRest = Math.max(1, Math.round(Number(raw.maxRestDuration) || 360));
    const minRest = Math.max(0, Math.round(Number(raw.minRestDuration) || FALLBACK_MIN_REST));
    const minDur = Math.min(FALLBACK_MIN_DUR, maxLive);
    return {
      rate,
      maxLive,
      maxRest: Math.max(maxRest, minRest),
      minRest,
      minDur: Math.max(1, minDur)
    };
  }

  function paramsFingerprint(params) {
    const p = normalizeParams(params);
    return `${p.rate}|${p.maxLive}|${p.maxRest}|${p.minRest}|${p.minDur}`;
  }

  // 第 k 轮长什么样（纯函数）
  function roundOf(charId, k, params) {
    const p = normalizeParams(params);
    const live = hash01(charId, k, 'live') < p.rate / 100;
    const restMins = p.minRest + Math.floor(hash01(charId, k, 'rest') * (p.maxRest - p.minRest));
    const durMins = p.minDur + Math.floor(hash01(charId, k, 'dur') * (p.maxLive - p.minDur));
    return {
      k,
      live,
      restMins,
      durMins,
      spanMins: restMins + (live ? durMins : 0)
    };
  }

  // 把一轮展开成绝对时间：轮起点 t → 开播时刻 t+rest、下播时刻 t+rest+dur
  function roundWindow(charId, k, t, params) {
    const r = roundOf(charId, k, params);
    const startTs = t + r.restMins * 60000;
    return Object.assign({}, r, {
      roundStartTs: t,
      startTs,
      endTs: startTs + (r.live ? r.durMins * 60000 : 0),
      nextStartTs: t + r.spanMins * 60000
    });
  }

  function worldEpoch() { return Date.parse(WORLD_EPOCH_ISO); }

  // 从纪元一路走到 t 所在的轮次，返回游标 { k, t, paramsFp }
  // 只在"第一次运行 / 改了参数 / 需要重新定锚"时调用，平时用存下来的游标。
  function cursorAt(charId, params, t) {
    const fp = paramsFingerprint(params);
    const epoch = worldEpoch();
    let k = 0, cur = epoch;
    let guard = 0;
    while (guard++ < 200000) {
      const w = roundWindow(charId, k, cur, params);
      if (w.nextStartTs > t) return { k, t: cur, paramsFp: fp };
      k += 1;
      cur = w.nextStartTs;
    }
    return { k, t: cur, paramsFp: fp };
  }

  // 从游标开始往后推，收集覆盖到 untilTs 的轮次；返回 { rounds, cursor }
  // rounds 里每一项都带真实起止时刻（补演直接用它写历史）
  function walk(charId, params, cursor, untilTs, options) {
    const p = normalizeParams(params);
    const fp = paramsFingerprint(params);
    const opts = options || {};
    const maxRounds = opts.maxRounds || MAX_ROUNDS_PER_PASS;
    let k = cursor ? cursor.k : 0;
    let t = cursor ? cursor.t : worldEpoch();
    const rounds = [];
    let guard = 0;
    let overflow = false;
    while (guard++ < maxRounds) {
      const w = roundWindow(charId, k, t, params);
      if (w.roundStartTs > untilTs) break;          // 已经越过"此刻"
      rounds.push(w);
      k += 1;
      t = w.nextStartTs;
      if (t > untilTs + 1) break;
    }
    if (guard >= maxRounds && t <= untilTs) overflow = true;   // 还有没走完的轮次
    // 不丢数据：游标停在"下一轮起点"，调用方下一次接着推就行（绝不跳锚、绝不清空）
    return { rounds, cursor: { k, t, paramsFp: fp }, overflow, paramsFp: fp, params: p };
  }

  // 单步：只取"游标所在的那一轮"，返回 { round, cursor }；走过 untilTs 就返回 null。
  // 补演逐场落库走这个接口（要一场一场过房管，不能一次吞一大把）。
  function stepRound(charId, params, cursor, untilTs) {
    const k = cursor ? cursor.k : 0;
    const t = cursor ? cursor.t : worldEpoch();
    const w = roundWindow(charId, k, t, params);
    if (w.roundStartTs > untilTs) return null;
    return { round: w, cursor: { k: k + 1, t: w.nextStartTs, paramsFp: paramsFingerprint(params) } };
  }

  // 此刻她在不在播（一次判断，不需要推历史）。
  // 游标允许落在"此刻之后"（推进落库后游标天然指向下一轮）：先按上一轮的长度往回退，
  // 再往前走，两条路都只是加法。
  function stateAt(charId, params, cursor, nowTs) {
    const p = normalizeParams(params);
    let k = cursor ? cursor.k : 0;
    let t = cursor ? cursor.t : worldEpoch();
    let guard = 0;
    while (t > nowTs && k > 0 && guard++ < MAX_ROUNDS_PER_PASS) {
      k -= 1;
      t -= roundOf(charId, k, params).spanMins * 60000;
    }
    guard = 0;
    while (guard++ < MAX_ROUNDS_PER_PASS) {
      const w = roundWindow(charId, k, t, params);
      if (w.nextStartTs > nowTs) {
        if (w.live && nowTs >= w.startTs && nowTs < w.endTs) {
          return { live: true, round: w, playedMin: Math.round((nowTs - w.startTs) / 60000), leftMin: Math.round((w.endTs - nowTs) / 60000) };
        }
        return { live: false, round: w, nextStartTs: w.live ? w.startTs : null };
      }
      k += 1;
      t = w.nextStartTs;
    }
    return { live: false, round: null, nextStartTs: null };
  }

  // 取"包含 ts 的那一轮"的游标（供查询/对账用）
  function cursorContaining(charId, params, cursor, ts) {
    let k = cursor ? cursor.k : 0;
    let t = cursor ? cursor.t : worldEpoch();
    let guard = 0;
    while (t > ts && k > 0 && guard++ < MAX_ROUNDS_PER_PASS) {
      k -= 1;
      t -= roundOf(charId, k, params).spanMins * 60000;
    }
    guard = 0;
    while (guard++ < MAX_ROUNDS_PER_PASS) {
      const w = roundWindow(charId, k, t, params);
      if (w.nextStartTs > ts) return { k, t, paramsFp: paramsFingerprint(params) };
      k += 1;
      t = w.nextStartTs;
    }
    return { k, t, paramsFp: paramsFingerprint(params) };
  }

  window.lumaLiveEngine = {
    WORLD_EPOCH_ISO,
    FIRST_RUN_BACKFILL_MS,
    hash01,
    normalizeParams,
    paramsFingerprint,
    roundOf,
    roundWindow,
    worldEpoch,
    cursorAt,
    cursorContaining,
    walk,
    stepRound,
    stateAt,
    MIN_DUR_FALLBACK: FALLBACK_MIN_DUR,
    MIN_REST_FALLBACK: FALLBACK_MIN_REST
  };
})();
