// =========================================================================
// 【数据中心·核心基座与总线】LIVE/数据/data_hub.js
// 统一管理粉丝、守护消费矩阵、全员签到、称号系统的本地持久化与跨模块数据广播
// =========================================================================

(function initDataHubModule() {
  const STORAGE_PREFIX = 'luma_data_';

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

  // 初始化持久化数据
  function initStorage() {
    memoryStore.fans = loadLocal('fans_map', {});
    memoryStore.spendingMatrix = loadLocal('spending_matrix', {});
    memoryStore.checkins = loadLocal('checkin_map', {});
    memoryStore.entityFollows = loadLocal('entity_follows', {});
    memoryStore.userTitles = loadLocal('titles_map', {});
  }

  initStorage();

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
      this.emit('spending_changed', matrix);
    },

    // 签到与关注
    getCheckinsMap() {
      return { ...memoryStore.checkins };
    },
    saveCheckinsMap(map) {
      memoryStore.checkins = map;
      saveLocal('checkin_map', memoryStore.checkins);
      this.emit('checkin_changed', map);
    },
    getEntityFollows() {
      return { ...memoryStore.entityFollows };
    },
    saveEntityFollows(follows) {
      memoryStore.entityFollows = follows;
      saveLocal('entity_follows', memoryStore.entityFollows);
      this.emit('follows_changed', follows);
    },

    // 称号系统
    getTitlesMap() {
      return { ...memoryStore.userTitles };
    },
    saveTitlesMap(titles) {
      memoryStore.userTitles = titles;
      saveLocal('titles_map', memoryStore.userTitles);
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
