// =========================================================================
// 【数据中心·直播结算数据体系】LIVE/数据/live_stats_manager.js
// 直播场次 + 真实粉丝数量 的权威持久化层，全部走宿主 SDK（api.db），
// 不使用 localStorage（iframe 沙盒里 localStorage 存不住）。
//   1. 每结算完一场直播：直播场次 +1，并按配置区间（粉丝增长最低~最高）随机增粉。
//   2. 直播场次 / 粉丝同时驱动 char 个人主页与排行榜体系的实时刷新。
//   3. 首次接触某 char 时初始化 0~10 场初始直播场次，并固化当前粉丝基数。
// =========================================================================

(function initLiveStatsManager() {
  'use strict';

  // 宿主私有库集合名（只属于当前 APP，卸载删除数据才会清掉）
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

  // 从宿主持久库读取该 char 的直播数据记录
  async function load(charId) {
    const id = getCharId(charId);
    if (!id) return null;
    try {
      const rec = await api.db.get(COLLECTION, id).catch(() => null);
      if (rec && (typeof rec.liveShowCount === 'number' || typeof rec.fans === 'number')) {
        return rec;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function persist(rec) {
    if (!rec || !rec.id) return;
    try {
      await dbUpsert(COLLECTION, rec.id, rec);
    } catch (e) {
      console.warn('[LiveStats] persist failed:', rec.id, e);
    }
  }

  // 首次接触：初始化 0~10 场初始直播场次，并固化当前粉丝基数到宿主持久库
  async function ensureInitialized(charId) {
    const id = getCharId(charId);
    if (!id) return null;
    let rec = await load(id);
    if (rec) return rec;

    const liveShowCount = Math.floor(Math.random() * 11); // 0 ~ 10
    let fans = 0;
    try {
      if (window.LumaFansManager && typeof window.LumaFansManager.getFans === 'function') {
        fans = Math.floor(Number(window.LumaFansManager.getFans(id))) || 0;
      }
    } catch (e) {}

    rec = { id, liveShowCount, fans, initializedAt: Date.now() };
    await persist(rec);
    return rec;
  }

  // 读取角色真实直播场次与粉丝（以宿主持久库为准）
  async function getStats(charId) {
    return await ensureInitialized(charId);
  }

  // 按配置区间随机生成单场增粉数（含边界）
  function rollFansGain() {
    const { min, max } = getGainRange();
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // 单场直播结算上报：场次 +1，按配置区间随机增粉，持久化并同步 FansManager/排行榜
  async function onShowSettled(charId, fansGained) {
    const id = getCharId(charId);
    if (!id) return null;
    const rec = await ensureInitialized(id);

    rec.liveShowCount = Math.floor(Number(rec.liveShowCount) || 0) + 1;

    const gainRaw = Math.floor(Number(fansGained));
    const gain = Number.isFinite(gainRaw) && gainRaw >= 0 ? gainRaw : rollFansGain();
    rec.fans = Math.max(0, Math.floor(Number(rec.fans) || 0) + gain);

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
          const rec = await load(c.id);
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
    load,
    persist,
    ensureInitialized,
    getStats,
    rollFansGain,
    onShowSettled,
    hydrateAll
  };

  window.LiveStatsManager = LiveStatsManager;
})();