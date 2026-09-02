// =========================================================================
// 【数据中心·守护榜与消费矩阵管理】LIVE/数据/guard_manager.js
// 统一管理直播间礼物打赏、社区超话打榜消费、Char之间互赠打赏的消费矩阵与全服/主页排行榜
// =========================================================================

(function initGuardManager() {
  const hub = window.LumaDataHub;

  // 预设默认的 Char 互动打赏初始种子（保证初始主页和榜单有合理的生态数据）
  const DEFAULT_SEEDS = [];

  function getMatrixKey(fromId, toId) {
    return `${fromId}_TO_${toId}`;
  }

  const GuardManager = {
    // 1. 核心接口：记录一次打赏/打榜消费 (直播间送礼、超话打榜、Char互赠统一调用此处)
    recordSpending({ fromId, fromName, fromAvatar, toId, toName, toAvatar, amount, type = 'live_gift', itemName = '礼物', tag = '' }) {
      const fId = (fromId === 'user' || fromId === 'player') ? 'user' : String(fromId || 'user');
      const tId = (toId === 'user' || toId === 'player') ? 'user' : String(toId || 'char_1');
      const amt = Number(amount) || 0;
      if (amt <= 0) return;

      const matrix = hub.getSpendingMatrix();
      const key = getMatrixKey(fId, tId);

      const fName = fromName || (fId === 'user' ? ((window.currentUser && window.currentUser.name) || '玩家') : '主播');
      const fAvatar = fromAvatar || (fId === 'user' ? ((window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first')) : '');
      const tName = toName || (tId === 'user' ? ((window.currentUser && window.currentUser.name) || '玩家') : '主播');
      const tAvatar = toAvatar || (tId === 'user' ? ((window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first')) : '');

      if (!matrix[key]) {
        matrix[key] = {
          fromId: fId,
          fromName: fName,
          fromAvatar: fAvatar,
          toId: tId,
          toName: tName,
          toAvatar: tAvatar,
          tag: tag || (fId === 'user' ? '至尊守护' : '铁杆粉丝'),
          totalAmount: 0,
          giftCount: 0,
          lastTimestamp: Date.now(),
          records: []
        };
      }

      const item = matrix[key];
      item.totalAmount += amt;
      item.giftCount += 1;
      item.fromName = fName;
      if (fAvatar) item.fromAvatar = fAvatar;
      item.toName = tName;
      if (tAvatar) item.toAvatar = tAvatar;
      item.lastTimestamp = Date.now();

      item.records.unshift({
        id: `spend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        amount: amt,
        type,
        itemName,
        timestamp: Date.now()
      });

      // 保留最近 50 条明细
      if (item.records.length > 50) item.records.length = 50;

      hub.saveSpendingMatrix(matrix);

      // 触发数据同步更新
      this.syncRankings();
      return item;
    },

    // 2. 获取指定实体（例如某主播）收到的所有贡献总值（送礼 + 签到 + 打榜 汇总）
    getTargetReceivedTotal(toId) {
      const tId = String(toId);
      const matrix = hub.getSpendingMatrix();
      let sum = 0;
      Object.values(matrix).forEach(item => {
        if (item.toId === tId) {
          sum += Number(item.totalAmount) || 0;
        }
      });
      return sum;
    },

    // 3. 获取指定实体（例如玩家或某主播）为他人贡献的总值
    getEntitySpentTotal(fromId) {
      const fId = String(fromId);
      const matrix = hub.getSpendingMatrix();
      let sum = 0;
      Object.values(matrix).forEach(item => {
        if (item.fromId === fId) {
          sum += Number(item.totalAmount) || 0;
        }
      });
      return sum;
    },

    // 4. 【个人主页·粉丝榜】谁为我消费最多（纯 Char -> User 的消费排行）
    getTopFansSpentOnMe() {
      const matrix = hub.getSpendingMatrix();
      const list = [];

      // 提取所有 Char -> user 的条目
      Object.values(matrix).forEach(item => {
        if (item.toId === 'user' && item.fromId !== 'user') {
          list.push({ ...item });
        }
      });

      // 如果数据为空，注入初始种子保证初次体验
      if (list.length === 0) {
        DEFAULT_SEEDS.forEach(seed => {
          list.push({ ...seed });
        });
      }

      list.sort((a, b) => b.totalAmount - a.totalAmount);
      return list;
    },

    // 5. 【个人主页·我守护的榜】我为谁消费最多（User -> Char 的消费排行）
    getTopCharsISpentOn() {
      const matrix = hub.getSpendingMatrix();
      const list = [];

      Object.values(matrix).forEach(item => {
        if (item.fromId === 'user') {
          list.push({
            ...item,
            targetName: item.toName,
            avatar: item.toAvatar || this.getAvatarById(item.toId)
          });
        }
      });

      list.sort((a, b) => b.totalAmount - a.totalAmount);
      return list;
    },

    // 6. 获取谁为特定主播 Char 打榜最多的榜单 (User + 其他 Char -> Char)
    getTopSupportersForChar(charId) {
      const cId = String(charId);
      const matrix = hub.getSpendingMatrix();
      const list = [];

      Object.values(matrix).forEach(item => {
        if (item.toId === cId) {
          list.push({ ...item });
        }
      });

      list.sort((a, b) => b.totalAmount - a.totalAmount);
      return list;
    },

    // 7. 【社区·全服贡献总榜】按每个实体「收到的贡献值」降序排行（统一体系：玩家与所有主播都算）
    getAllCommunityGuardRankingList() {
      const chars = (typeof window.getAvailableCharsList === 'function')
        ? window.getAvailableCharsList()
        : (window.allCharacters || []);

      const list = [];

      // 遍历所有 Char：得分 = 收到贡献（送礼+签到+打榜统一矩阵）
      chars.forEach(c => {
        const id = String(c.id || c.characterId);
        const receivedFromAll = this.getTargetReceivedTotal(id);

        list.push({
          id: id,
          name: c.name,
          avatar: c.avatar || c.cover,
          badge: '全服打投',
          score: receivedFromAll,
          scoreLabel: '收到贡献',
          isUser: false
        });
      });

      // 玩家：得分 = 收到的贡献（其他主播给玩家的）
      const uName = (window.currentUser && window.currentUser.name) || '玩家';
      const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
      const userReceived = this.getTargetReceivedTotal('user');

      list.push({
        id: 'user',
        name: `${uName} (你)`,
        avatar: uAvatar,
        badge: '至尊榜一',
        score: userReceived,
        scoreLabel: '收到贡献',
        isUser: true
      });

      list.sort((a, b) => b.score - a.score);
      return list;
    },

    getAvatarById(id) {
      const chars = window.allCharacters || [];
      const fChar = chars.find(c => c.id === id || c.characterId === id);
      if (fChar && (fChar.avatar || fChar.cover)) return fChar.avatar || fChar.cover;
      const lives = window.liveList || [];
      const fLive = lives.find(l => l.id === id || l.characterId === id);
      if (fLive && (fLive.avatar || fLive.cover)) return fLive.avatar || fLive.cover;
      return getAvatar(null, 'emoji');
    },

    syncRankings() {
      if (typeof window.renderDualRankList === 'function') {
        window.renderDualRankList();
      }
      if (typeof window.renderCommunityRanking === 'function') {
        const btnGuard = document.getElementById('btnRankTabGuard');
        if (btnGuard && btnGuard.classList.contains('active')) {
          window.renderCommunityRanking('guard');
        }
      }
    }
  };

  window.LumaGuardManager = GuardManager;
  window.GuardManager = GuardManager;

  // 桥接兼容现有全局函数
  window.getCharContributionScore = function(charId) {
    const matrix = hub.getSpendingMatrix();
    const key = getMatrixKey('user', String(charId));
    if (matrix[key]) {
      return matrix[key].totalAmount || 0;
    }
    // 沙盒 iframe 无 allow-same-origin 权限，localStorage 不可用，直接返回 0
    return 0;
  };

  window.addCharContributionScore = function(charId, addAmount) {
    const chars = window.allCharacters || [];
    const char = chars.find(c => String(c.id) === String(charId));
    const toName = char ? char.name : '主播';
    const toAvatar = char ? (char.avatar || char.cover) : '';
    
    GuardManager.recordSpending({
      fromId: 'user',
      toId: charId,
      toName: toName,
      toAvatar: toAvatar,
      amount: addAmount,
      type: 'support_gift',
      itemName: '超话打榜'
    });
    const next = window.getCharContributionScore(charId);
    if (typeof window.notifyCommunityDataChanged === 'function') {
      try { window.notifyCommunityDataChanged('support', { charId, addAmount, next }); } catch (e) {}
    }
    if (window.LumaDataHub) {
      try { window.LumaDataHub.emit('contribution', { charId, addAmount, next }); } catch (e) {}
    }
    return next;
  };
})();
