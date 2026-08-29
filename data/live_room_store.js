// =========================================================================
// 【直播间临时存储】data/live_room_store.js
// 为每个直播间(按 roomId)独立维护一份临时数据：
//   1. 不可见层：历史消息环形队列（上限 LIVE_ROOM_HISTORY_MAX 条），
//      记录弹幕 / char台词 / 礼物 / user发言，带时间戳，超过上限自动覆盖最旧。
//   2. 可见层：公屏弹幕列表快照（含时间戳），退出房间后再次进入仍可恢复。
//   直播间结束（下播）时清空该房号数据，避免无止境累积占用存储。
// 底层统一走 api.db（集合 live_room_records）+ dbUpsert 持久化。
// =========================================================================

(function initLiveRoomStore() {
  'use strict';

  const COLLECTION = 'live_room_records';
  const HISTORY_MAX = 200;      // 历史消息上限（非 AI 生成条数，是弹幕/char/礼物/user 消息）
  const SCREEN_DANMAKU_MAX = 50; // 可见弹幕列表快照保留条数（仅用于恢复公屏）

  // 内存缓存：roomId -> store
  const memoryStore = {};

  function roomKey(roomId) {
    return 'room_' + String(roomId);
  }

  function normalizeRoomId(currentRoom, explicitRoomId) {
    if (explicitRoomId) return explicitRoomId;
    if (currentRoom) {
      return currentRoom.roomId || currentRoom.id || currentRoom.characterId;
    }
    return null;
  }

  async function loadStore(roomId) {
    const key = roomKey(roomId);
    if (memoryStore[key]) return memoryStore[key];
    let raw = null;
    try {
      raw = await api.db.get(COLLECTION, key).catch(() => null);
    } catch (e) {}
    if (raw && typeof raw === 'object' && raw.history) {
      memoryStore[key] = raw;
    } else {
      memoryStore[key] = {
        id: key,
        roomId: String(roomId),
        history: [],       // [{ ts, type, sender, text, extra }]
        screenDanmaku: [], // [{ ts, type, sender, text }]
        createdAt: Date.now(),
        ended: false
      };
    }
    return memoryStore[key];
  }

  async function persist(roomId) {
    const key = roomKey(roomId);
    const store = memoryStore[key];
    if (!store) return;
    try {
      await dbUpsert(COLLECTION, key, store);
    } catch (e) {
      console.warn('[LiveRoomStore] persist failed:', roomId, e);
    }
  }

  async function appendHistory(roomId, record) {
    if (!roomId) return;
    const store = await loadStore(roomId);
    store.history.push(record);
    // 超过上限，覆盖最旧
    if (store.history.length > HISTORY_MAX) {
      store.history = store.history.slice(store.history.length - HISTORY_MAX);
    }
    await persist(roomId);
  }

  async function appendScreenDanmaku(roomId, record) {
    if (!roomId) return;
    const store = await loadStore(roomId);
    store.screenDanmaku.push(record);
    if (store.screenDanmaku.length > SCREEN_DANMAKU_MAX) {
      store.screenDanmaku = store.screenDanmaku.slice(store.screenDanmaku.length - SCREEN_DANMAKU_MAX);
    }
    await persist(roomId);
  }

  async function getHistory(roomId) {
    if (!roomId) return [];
    const store = await loadStore(roomId);
    return store.history.slice();
  }

  async function getScreenDanmaku(roomId) {
    if (!roomId) return [];
    const store = await loadStore(roomId);
    return store.screenDanmaku.slice();
  }

  // 将历史消息转换为 AI 上下文的纯文本（多轮历史）
  async function buildHistoryContextText(roomId, limit) {
    const history = await getHistory(roomId);
    const n = limit && limit > 0 ? Math.min(limit, history.length) : history.length;
    const slice = history.slice(-n);
    if (slice.length === 0) return '';
    const lines = slice.map(h => {
      const time = new Date(h.ts).toLocaleTimeString('zh-CN', { hour12: false });
      const who = h.sender || '观众';
      const roleTag = h.type === 'char' ? '[主播]' : h.type === 'gift' ? '[礼物]' : h.type === 'user' ? '[我]' : '[弹幕]';
      return `[${time}]${roleTag}${who}: ${h.text || ''}`;
    });
    return lines.join('\n');
  }

  // 直播间结束，清空该房号数据
  async function clearRoom(roomId) {
    if (!roomId) return;
    const key = roomKey(roomId);
    delete memoryStore[key];
    try {
      if (api && api.db && typeof api.db.delete === 'function') {
        await api.db.delete(COLLECTION, key).catch(() => {});
      }
    } catch (e) {}
  }

  // 判断某房是否已有历史
  async function hasHistory(roomId) {
    if (!roomId) return false;
    const store = await loadStore(roomId);
    return store.history && store.history.length > 0;
  }

  const LiveRoomStore = {
    COLLECTION,
    HISTORY_MAX,
    SCREEN_DANMAKU_MAX,
    normalizeRoomId,
    loadStore,
    appendHistory,
    appendScreenDanmaku,
    getHistory,
    getScreenDanmaku,
    buildHistoryContextText,
    clearRoom,
    hasHistory
  };

  window.LiveRoomStore = LiveRoomStore;
})();