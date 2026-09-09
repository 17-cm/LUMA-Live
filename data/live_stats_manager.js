// =========================================================================
// 【数据中心·直播结算数据体系】LIVE/数据/live_stats_manager.js
// 直播场次 + 真实粉丝数量 的权威持久化层，全部走宿主 SDK（api.db），不使用 localStorage
// （iframe 沙盒里 localStorage 存不住）。
//
// 核心设计：以【单场结算台账】为准，保证数字自洽——
//   · 粉丝总数  === 台账里所有场次的 增粉数 累加和
//   · 累计直播场次 === 台账条数
//   · 主播主页"直播场次"列表 与 头部粉丝总数 完全对得上
// 每结算完一场直播：台账追加一条（含 增粉数），场次 +1、粉丝 += 增粉数，并同步排行榜/直播间。
// =========================================================================

(function initLiveStatsManager() {
  'use strict';

  // 宿主私有库集合名（只属于当前 APP，卸载删数据才清掉）
  const COLLECTION = 'luma_live_stats';

  // 配置区间默认值（可在直播设置里由用户修改，纳入 appParams）
  const DEFAULT_GAIN_MIN = 1000;
  const DEFAULT_GAIN_MAX = 5000;

  function getCharId(id) {
    if (id === 'user' || id === 'player' || id === 'current_user') return 'user';
    return String(id || '');
  }

  // 读取配置区间的安全取值（保证 min <= max）
  function getGainRange() {
    const p = window.appParams || {};
    let min = Math.floor(Number(p.fansGainMin));
    let max = Math.floor(Number(p.fansGainMax));
    if (!Number.isFinite(min) || min < 0) min = DEFAULT_GAIN_MIN;
    if (!Number.isFinite(max) || max < 0) max = DEFAULT_GAIN_MAX;
    if (min > max) { const t = min; min = max; max = t; }
    return { min, max };
  }

  // 按配置区间随机生成单场增粉数（含边界）
  function rollFansGain() {
    const { min, max } = getGainRange();
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // 为 count 场初始/迁移直播生成【错落、真实、严格无重叠】的每场开播/下播时刻。
  // 每天约一场、时间在晚高峰随机分布，杜绝“全为同一分钟(00:35)、只有日期不同”的假感。
  // 返回升序(早→晚)数组，每项 { start, end, ts }；end 一律严格早于当前时刻。
  function buildVariedSeedTimes(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const out = [];
    if (n === 0) return out;
    const now = Date.now();
    // 最新一场结束在上线前 ~0.3h~1.3h，往前每隔一场拉开 16h~30h（约一天）
    let upper = now - (20 + Math.floor(Math.random() * 60)) * 60 * 1000;
    const ends = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      ends[i] = upper;
      upper -= (16 * 60 + Math.floor(Math.random() * 14 * 60)) * 60 * 1000; // 16h~30h 间隔
    }
    for (let i = 0; i < n; i++) {
      const end = ends[i];
      const durMin = 30 + Math.floor(Math.random() * 121); // 30~150 分钟
      const start = end - durMin * 60 * 1000;
      out.push({ start, end, ts: end });
    }
    out.sort((a, b) => a.end - b.end);
    return out;
  }

  // 检测“种子味”：某 char 的全部场次都卡在同一个 时/分（初始种子用哨兵扩容时的固化分钟）。
  // 真实结算场次时间各异，不会触发；只有历史种子才会被判定并自动重排。
  function hasSeedSmell(shows) {
    if (!Array.isArray(shows) || shows.length < 2) return false;
    const hh = new Set(), mm = new Set();
    shows.forEach(s => {
      const d = new Date(Math.floor(Number(s.end) || Number(s.ts) || 0));
      if (isNaN(d.getTime())) return;
      hh.add(d.getHours());
      mm.add(d.getMinutes());
    });
    return hh.size === 1 && mm.size === 1;
  }

  // 保持增益不变，仅把“同分钟”的种子时刻重排成错落的真实时间（顺序与总数不变）
  function variegateSeedTimes(shows) {
    const n = Array.isArray(shows) ? shows.length : 0;
    if (n === 0) return [];
    const gains = shows.map(s => Math.max(Math.floor(Number(s.gain)) || 0, 0));
    const times = buildVariedSeedTimes(n);
    return times.map((t, i) => ({ ts: t.ts, start: t.start, end: t.end, gain: gains[i] }));
  }

  // 从宿主持久库读取该 char 的直播数据记录
  async function load(charId) {
    const id = getCharId(charId);
    if (!id) return null;
    try {
      const rec = await api.db.get(COLLECTION, id).catch(() => null);
      return rec || null;
    } catch (e) {
      return null;
    }
  }

  async function persist(rec) {
    if (!rec || !rec.id) return;
    rec.updatedAt = Date.now();
    try {
      await dbUpsert(COLLECTION, rec.id, rec);
    } catch (e) {
      console.warn('[LiveStats] persist failed:', rec.id, e);
    }
  }

  // 归一化既有台账：按时间升序排列 → 去重(同一下播时刻只保留一条) →
  // 丢弃重叠/侵蚀场次(开场早于上一场下播的"插播")，保证 一场一时段、严格单调无重叠。
  // 返回 { shows, changed }；changed 为 true 时调用方应持久化。
  function normalizeShows(shows) {
    if (!Array.isArray(shows) || shows.length === 0) return { shows: [], changed: false };
    const list = shows.map(x => {
      const end = Math.max(Math.floor(Number(x.end) || Number(x.ts) || 0), 0);
      const start = Math.max(Math.min(Math.floor(Number(x.start) || (end - 90 * 60000)), end - 1), 0);
      const realEnd = Math.max(start + 1, end);
      return { ts: realEnd, start, end: realEnd, gain: Math.max(Math.floor(Number(x.gain) || 0), 0) };
    }).sort((a, b) => a.end - b.end);
    const out = [];
    for (const s of list) {
      const prev = out[out.length - 1];
      // 完全重复(同下播时刻) → 跳过
      if (prev && prev.end === s.end) continue;
      // 开场早于/等于上一场下播 → 重叠/侵蚀，丢弃
      if (prev && s.start < prev.end) continue;
      out.push(s);
    }
    return { shows: out, changed: out.length !== list.length };
  }

  // 首次接触某 char：初始化 0~10 场初始直播场次（每场随机增粉），并据此固化初始粉丝
  async function ensureInitialized(charId) {
    const id = getCharId(charId);
    if (!id) return null;
    let rec = await load(id);

    // 已有台账：先做一次即时归一化清洗（自动修正历史写入的重叠/重复场次）
    if (rec && Array.isArray(rec.shows)) {
      let changed = false;
      const norm = normalizeShows(rec.shows);
      if (norm.changed) {
        rec.shows = norm.shows;
        changed = true;
      }
      // 若现存场次全是“同一时钟分钟”的初始种子（如 00:35 假感），自动重排成错落的真实时刻
      if (rec.shows.length > 0 && hasSeedSmell(rec.shows)) {
        rec.shows = variegateSeedTimes(rec.shows);
        changed = true;
      }
      if (changed) {
        rec.liveShowCount = rec.shows.length;
        rec.fans = rec.shows.reduce((s, x) => s + Math.floor(Number(x.gain) || 0), 0);
        await persist(rec);
      }
      return rec;
    }

    // 旧结构迁移：老记录只有 {liveShowCount, fans}，没有逐场台账
    if (rec && (Number(rec.liveShowCount) > 0 || Number(rec.fans) > 0)) {
      const count = Math.max(Math.floor(Number(rec.liveShowCount) || 0), 0);
      let fans = Math.max(Math.floor(Number(rec.fans) || 0), 0);
      const shows = [];
      if (count > 0) {
        const base = Math.floor(fans / count);
        let rem = fans - base * count;
        const times = buildVariedSeedTimes(count);
        times.forEach((t) => {
          shows.push({ ts: t.ts, start: t.start, end: t.end, gain: base + (rem > 0 ? (rem--, 1) : 0) });
        });
      }
      rec.shows = shows;
      rec.liveShowCount = count;
      rec.fans = fans;
      rec.initializedAt = rec.initializedAt || Date.now();
      await persist(rec);
      return rec;
    }

    // 全新初始化：生成 0~10 场初始直播场次，每场按配置区间随机增粉
    const liveShowCount = Math.floor(Math.random() * 11); // 0 ~ 10
    const shows = [];
    let fans = 0;
    buildVariedSeedTimes(liveShowCount).forEach((t) => {
      const gain = rollFansGain();
      shows.push({ ts: t.ts, start: t.start, end: t.end, gain });
      fans += gain;
    });
    rec = { id, shows, liveShowCount, fans, initializedAt: Date.now() };
    await persist(rec);
    return rec;
  }

  // 读取角色真实直播场次与粉丝（以宿主持久库为准）
  async function getStats(charId) {
    return await ensureInitialized(charId);
  }

  // 返回该角色的逐场结算台账（降序：最新在前）
  async function getLedger(charId) {
    const rec = await ensureInitialized(charId);
    if (!rec) return [];
    const shows = Array.isArray(rec.shows) ? rec.shows.slice() : [];
    shows.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    return shows;
  }

  // 单场直播结算上报：台账 +1 条、场次 +1，按配置区间随机增粉，持久化并同步 FansManager/排行榜
  // startTs/endTs 为该场直播的真实开播/下播时间戳（在线与离线补跑都由 closeAndArchive 传入）
  //
  // 【严格护栏】一个时间段只能有一场直播；直播时段内/休息期内不得出现下一场——
  //   1. 幂等去重：同一场(以下播时刻 end 判定)被重复上报 → 只更新该场，绝不重复追加
  //   2. 重叠/侵蚀拦截：新场的开播时刻不得早于台账最后一场的下播时刻；
  //      若被已有场次区间吞没，或开播落在上一场直播时段内(还没下播就"开"了下一场)，
  //      均判定为重复/幽灵场，一场只算一次，直接丢弃，保证台账严格单调、无重叠。
  async function onShowSettled(charId, fansGained, startTs, endTs) {
    const id = getCharId(charId);
    if (!id) return null;
    const rec = await ensureInitialized(id);

    const gainRaw = Math.floor(Number(fansGained));
    const gain = Number.isFinite(gainRaw) && gainRaw >= 0 ? gainRaw : rollFansGain();

    let end = Math.floor(Number(endTs)) || Date.now();
    let start = Math.floor(Number(startTs)) || (end - 90 * 60000);
    if (start >= end) start = end - 90 * 60000; // 脏数据防御：绝对禁止零时长/负时长场次

    if (!Array.isArray(rec.shows)) rec.shows = [];
    const shows = rec.shows;

    const syncFans = () => {
      rec.liveShowCount = shows.length;
      rec.fans = shows.reduce((s, x) => s + (Math.floor(Number(x.gain)) || 0), 0);
    };

    // 1) 幂等去重：同一下播时刻 end 已在台账 → 只更新该场，不重复追加
    const dupIdx = shows.findIndex(
      x => Math.floor(Number(x.ts) || 0) === end || Math.floor(Number(x.end) || 0) === end
    );
    if (dupIdx >= 0) {
      const cur = shows[dupIdx];
      cur.start = Math.max(0, Math.min(start, Math.floor(Number(cur.start) || start)));
      cur.end = end;
      cur.ts = end;
      cur.gain = gain;
    } else if (shows.length) {
      // 2) 重叠/侵蚀拦截：新场开场时刻必须晚于台账最后一场的下播时刻
      const latest = shows.reduce((m, x) => (!m || (Number(x.end) || 0) > (Number(m.end) || 0)) ? x : m, null);
      const lEnd = Math.max(Math.floor(Number(latest && (latest.end || latest.ts))) || 0, 0);
      // 被已有区间完全吞没(下播不晚于旧场)，或开场早于上一场下播(直播时段内插播)：
      // 一律视为重复/幽灵场，一场只记一次，丢弃，不再往台账写。
      if (lEnd > 0 && (end <= lEnd || start < lEnd)) {
        syncFans();
        await persist(rec);
        if (window.LumaFansManager && typeof window.LumaFansManager.setFans === 'function') {
          try { window.LumaFansManager.setFans(id, rec.fans); } catch (e) {}
        }
        return { liveShowCount: shows.length, fans: rec.fans, fansGained: 0 };
      }
      shows.push({ ts: end, start, end, gain });
    } else {
      shows.push({ ts: end, start, end, gain });
    }

    syncFans();
    await persist(rec);

    // 同步粉丝展示 + 排行榜体系（FansManager.setFans 内部会广播并刷新人气榜）
    if (window.LumaFansManager && typeof window.LumaFansManager.setFans === 'function') {
      try { window.LumaFansManager.setFans(id, rec.fans); } catch (e) {}
    }

    return { liveShowCount: rec.liveShowCount, fans: rec.fans, fansGained: gain };
  }

  // 启动时把宿主持久库的真实粉丝回灌进 FansManager，保证直播间/排行榜展示与持久层一致
  async function hydrateAll() {
    try {
      const chars = window.allCharacters || [];
      for (const c of chars) {
        if (!c || !c.id) continue;
        try {
          // 先确保台账就绪（生成 0~10 场初始直播场次），再回灌真实累加粉丝
          const rec = await ensureInitialized(c.id);
          if (rec && window.LumaFansManager && typeof window.LumaFansManager.setFans === 'function') {
            window.LumaFansManager.setFans(c.id, rec.fans);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[LiveStats] hydrateAll failed:', e);
    }
  }

  const LiveStatsManager = {
    COLLECTION,
    DEFAULT_GAIN_MIN,
    DEFAULT_GAIN_MAX,
    getGainRange,
    rollFansGain,
    load,
    persist,
    ensureInitialized,
    getStats,
    getLedger,
    onShowSettled,
    hydrateAll
  };

  window.LiveStatsManager = LiveStatsManager;
})();