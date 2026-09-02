// =========================================================================
// 【数据中心·核心基座与总线】LIVE/数据/data_hub.js
// 统一管理粉丝、守护消费矩阵、全员签到、称号系统的本地持久化与跨模块数据广播
// =========================================================================

(function initDataHubModule() {
  const STORAGE_PREFIX = 'luma_data_';
  // 宿主持久化统一走 api.db（真机/沙盒均稳定落盘），localStorage 仅作浏览器兜底
  const HOST_COLLECTIONS = {
    fans: 'app_social_fans',
    spendingMatrix: 'app_social_spending',
    checkins: 'app_social_checkins',
    entityFollows: 'app_social_follows',
    userTitles: 'app_social_titles'
  };
  const HOST_DOC_ID = 'main';
  let _persistBusy = false;
  const _persistQueue = [];

  // 内存缓存
  const memoryStore = {
    fans: {},          // { [entityId]: number }
    transactions: [],  // 原始消费交易流水
    spendingMatrix: {},// { [`${fromId}->${toId}`]: { totalAmount, count, lastTimestamp, fromName, toName, ... } }
    checkins: {},      // { [`${entityId}_${topicId}`]: { lastDate, streakDays, totalExp, totalDays, level } }
    entityFollows: {}, // { [entityId]: [topicOrHostId...] }
    userTitles: {},    // { [entityId]: { activeTitleId, unlockedTitleIds: [] } }
    listenerCallbacks: []
  };

  function loadLocal(key, defaultValue) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  function saveLocal(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {}
  }

  // 异步落盘到宿主 api.db（串行化，避免并发覆盖）
  function persistNow() {
    if (_persistBusy || _persistQueue.length === 0) return;
    _persistBusy = true;
    const task = _persistQueue.shift();
    const { collection, data } = task;
    Promise.resolve()
      .then(() => {
        if (window.api && window.api.db && typeof window.dbUpsert === 'function') {
          return window.dbUpsert(collection, HOST_DOC_ID, { data: JSON.parse(JSON.stringify(data)) });
        }
        return null;
      })
      .catch(e => console.warn('[DataHub persist]', collection, e))
      .finally(() => {
        _persistBusy = false;
        if (_persistQueue.length) setTimeout(persistNow, 0);
      });
  }

  function queuePersist(key) {
    const collection = HOST_COLLECTIONS[key];
    if (!collection) return;
    _persistQueue.push({ collection, data: memoryStore[key] });
    if (_persistQueue.length > 80) _persistQueue.splice(0, _persistQueue.length - 80);
    setTimeout(persistNow, 0);
  }

  // 从宿主 api.db 拉取一份 map（未命中回退浏览器存）
  async function loadFromHost(key, defaultValue) {
    const collection = HOST_COLLECTIONS[key];
    if (!window.api || !window.api.db || !collection) return defaultValue;
    try {
      const doc = await window.api.db.get(collection, HOST_DOC_ID);
      if (doc && doc.data && typeof doc.data === 'object') return doc.data;
    } catch (e) {}
    return defaultValue;
  }

  // 统一同步初始化：先本地兜底，再异步宿主覆盖（宿主为权威持久层）
  function initStorage() {
    memoryStore.fans = loadLocal('fans_map', {});
    memoryStore.spendingMatrix = loadLocal('spending_matrix', {});
    memoryStore.checkins = loadLocal('checkin_map', {});
    memoryStore.entityFollows = loadLocal('entity_follows', {});
    memoryStore.userTitles = loadLocal('titles_map', {});
  }

  initStorage();

  // 异步以宿主数据为权威源回灌内存（关键：真机冷进不再被 localStorage 清空）
  // 注：内存对象被各管理器引用，回灌后通过广播触发界面统一刷新
  (function hydrateFromHost() {
    const keys = ['fans', 'spendingMatrix', 'checkins', 'entityFollows', 'userTitles'];
    const localKeys = { fans: 'fans_map', spendingMatrix: 'spending_matrix', checkins: 'checkin_map', entityFollows: 'entity_follows', userTitles: 'titles_map' };
    keys.forEach(k => {
      loadFromHost(k, {}).then(dbData => {
        if (dbData && typeof dbData === 'object' && Object.keys(dbData).length) {
          memoryStore[k] = dbData;
          saveLocal(localKeys[k], dbData);
          window.LumaDataHub.emit(k + '_synced', dbData);
        }
      }).catch(() => {});
    });
  })();

  const DataHub = {
    // 基础存储操作
    getFans(id) {
      if (!id) return 0;
      return memoryStore.fans[id] !== undefined ? memoryStore.fans[id] : null;
    },
    setFans(id, count) {
      if (!id) return;
      memoryStore.fans[id] = Math.max(0, Math.floor(Number(count) || 0));
      saveLocal('fans_map', memoryStore.fans);
      queuePersist('fans');
      this.emit('fans_changed', { id, count: memoryStore.fans[id] });
    },
    getAllFansMap() {
      return { ...memoryStore.fans };
    },

    // 消费矩阵
    getSpendingMatrix() {
      return { ...memoryStore.spendingMatrix };
    },
    saveSpendingMatrix(matrix) {
      memoryStore.spendingMatrix = matrix;
      saveLocal('spending_matrix', memoryStore.spendingMatrix);
      queuePersist('spendingMatrix');
      this.emit('spending_changed', matrix);
    },

    // 签到与关注
    getCheckinsMap() {
      return { ...memoryStore.checkins };
    },
    saveCheckinsMap(map) {
      memoryStore.checkins = map;
      saveLocal('checkin_map', memoryStore.checkins);
      queuePersist('checkins');
      this.emit('checkin_changed', map);
    },
    getEntityFollows() {
      return { ...memoryStore.entityFollows };
    },
    saveEntityFollows(follows) {
      memoryStore.entityFollows = follows;
      saveLocal('entity_follows', memoryStore.entityFollows);
      queuePersist('entityFollows');
      this.emit('follows_changed', follows);
    },

    // 称号系统
    getTitlesMap() {
      return { ...memoryStore.userTitles };
    },
    saveTitlesMap(titles) {
      memoryStore.userTitles = titles;
      saveLocal('titles_map', memoryStore.userTitles);
      queuePersist('userTitles');
      this.emit('titles_changed', titles);
    },

    // 事件订阅与派发
    on(event, callback) {
      if (typeof callback === 'function') {
        memoryStore.listenerCallbacks.push({ event, callback });
      }
    },
    emit(event, data) {
      memoryStore.listenerCallbacks.forEach(item => {
        if (item.event === '*' || item.event === event) {
          try {
            item.callback(event, data);
          } catch (e) {
            console.error(`[DataHub Event Error ${event}]:`, e);
          }
        }
      });
      // 兼容社区与各子系统现有广播
      if (typeof window.notifyCommunityDataChanged === 'function') {
        try {
          window.notifyCommunityDataChanged(event, data);
        } catch (err) {}
      }
    },

    // 格式化数字 (如 12.8万)
    formatNumber(num) {
      const n = Number(num) || 0;
      if (n >= 10000) {
        return (n / 10000).toFixed(1) + '万';
      }
      return n.toLocaleString();
    },

    // 获取标准日期字符串 YYYY-MM-DD
    getTodayDateStr() {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  window.LumaDataHub = DataHub;
  window.DataHub = DataHub;
})();
