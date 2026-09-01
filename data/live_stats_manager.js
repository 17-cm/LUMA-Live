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

  // 首次接触某 char：初始化 0~10 场初始直播场次（每场随机增粉），并据此固化初始粉丝
  async function ensureInitialized(charId) {
    const id = getCharId(charId);
    if (!id) return null;
    let rec = await load(id);

    // 已有合法台账
    if (rec && Array.isArray(rec.shows)) return rec;

    // 旧结构迁移：老记录只有 {liveShowCount, fans}，没有逐场台账
    if (rec && (Number(rec.liveShowCount) > 0 || Number(rec.fans) > 0)) {
      const count = Math.max(Math.floor(Number(rec.liveShowCount) || 0), 0);
      let fans = Math.max(Math.floor(Number(rec.fans) || 0), 0);
      const shows = [];
      if (count > 0) {
        const base = Math.floor(fans / count);
        let rem = fans - base * count;
        const ts0 = Date.now() - count * 24 * 60 * 60 * 1000;
        for (let i = 0; i < count; i++) {
          shows.push({ ts: ts0 + i * 24 * 60 * 60 * 1000, gain: base + (rem > 0 ? (rem--, 1) : 0) });
        }
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
    const ts0 = Date.now() - (liveShowCount > 0 ? liveShowCount * 24 * 60 * 60 * 1000 : 0);
    for (let i = 0; i < liveShowCount; i++) {
      const gain = rollFansGain();
      shows.push({ ts: ts0 + i * 24 * 60 * 60 * 1000, gain });
      fans += gain;
    }
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
  async function onShowSettled(charId, fansGained) {
    const id = getCharId(charId);
    if (!id) return null;
    const rec = await ensureInitialized(id);

    const gainRaw = Math.floor(Number(fansGained));
    const gain = Number.isFinite(gainRaw) && gainRaw >= 0 ? gainRaw : rollFansGain();

    if (!Array.isArray(rec.shows)) rec.shows = [];
    rec.shows.push({ ts: Date.now(), gain });
    rec.liveShowCount = rec.shows.length;
    rec.fans = rec.shows.reduce((s, x) => s + (Math.floor(Number(x.gain)) || 0), 0);

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