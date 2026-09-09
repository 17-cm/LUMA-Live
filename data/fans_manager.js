// =========================================================================
// 【数据中心·粉丝管理与人气榜系统】LIVE/数据/fans_manager.js
// 统一管理玩家与所有 Char 主播的粉丝数据源、粉丝增长计算逻辑，以及全服人气榜单
// =========================================================================

(function initFansManager() {
  const hub = window.LumaDataHub;

  // 默认初始粉丝库 (当未持久化时计算并初始化)
  function getBaseFansSeed(entityId, charObj) {
    if (entityId === 'user' || entityId === 'player') {
      return (window.userProfileData && window.userProfileData.fans) || 0;
    }
    const idStr = String(entityId || 'char_1');
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) hash += idStr.charCodeAt(i) * (i + 17);
    
    // 如果角色对象本身有 followers 则优先读取
    if (charObj && (charObj.followers || charObj.fans)) {
      return Number(charObj.followers || charObj.fans);
    }
    
    const base = 15000 + (hash % 45000);
    return base;
  }

  const FansManager = {
    // 1. 获取指定实体（主播或玩家）的当前绝对粉丝数量
    getFans(entityId, entityObj) {
      if (!entityId) return 0;
      const id = String(entityId);
      
      // 玩家专属 ID 映射
      if (id === 'user' || id === 'player' || id === 'current_user') {
        const stored = hub.getFans('user');
        if (stored !== null) return stored;
        const initial = (window.userProfileData && window.userProfileData.fans) || 0;
        hub.setFans('user', initial);
        return initial;
      }

      // 主播 Char 逻辑
      let fans = hub.getFans(id);
      if (fans === null) {
        fans = getBaseFansSeed(id, entityObj);
        hub.setFans(id, fans);
      }

      // 如果玩家关注了该主播（仅直播间关注 followedHosts），额外加 1
      // 注意：超话关注 followedSuperTopics 是帖子级别的，不等于主播关注，不计入粉丝
      const followedHosts = window.followedHosts || [];
      const isFollowed = followedHosts.includes(id);
      return fans + (isFollowed ? 1 : 0);
    },

    // 2. 增加粉丝（支持传入正数增加或负数脱粉，并可记录原因）
    addFans(entityId, amount, reason = '互动增长') {
      if (!entityId) return 0;
      const id = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId);
      const current = this.getFans(id);
      const next = Math.max(0, current + Number(amount));
      hub.setFans(id, next);

      // 如果是玩家，同步更新 userProfileData
      if (id === 'user') {
        if (window.userProfileData) {
          window.userProfileData.fans = next;
          const fansEl = document.getElementById('displayUserFans') || document.getElementById('statUserFansCount');
          if (fansEl) fansEl.textContent = hub.formatNumber(next);
        }
      }

      // 触发全局广播，同步所有界面的粉丝展示
      this.syncAllFansDisplays(id);
      return next;
    },

    // 3. 设置指定实体的粉丝数量
    setFans(entityId, count) {
      if (!entityId) return;
      const id = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId);
      const val = Math.max(0, Math.floor(Number(count) || 0));
      hub.setFans(id, val);
      if (id === 'user' && window.userProfileData) {
        window.userProfileData.fans = val;
      }
      this.syncAllFansDisplays(id);
    },

    // 4. 直播后/日常互动粉丝增长计算模型 (后续扩展接口)
    calculateLiveGrowth({ characterId, durationMins, heat, giftIncome, userInteractions }) {
      const baseGain = Math.floor((durationMins || 60) * 2.5);
      const heatGain = Math.floor((heat || 10000) / 2500);
      const giftGain = Math.floor((giftIncome || 0) / 80);
      const interactGain = (userInteractions || 0) * 5;
      const randomVariance = Math.floor(Math.random() * 20) - 10;
      const totalGrowth = Math.max(5, baseGain + heatGain + giftGain + interactGain + randomVariance);

      this.addFans(characterId, totalGrowth, '直播推流吸粉');
      return totalGrowth;
    },

    // 5. 获取全员粉丝数据列表 (包含所有 Chars + 玩家)，用于生成排行榜
    getAllEntitiesPopularityList() {
      const chars = (typeof window.getAvailableCharsList === 'function') 
        ? window.getAvailableCharsList() 
        : (window.allCharacters || []);
      
      const list = [];

      // 加入所有 Char
      chars.forEach(c => {
        const id = String(c.id || c.characterId);
        const fans = this.getFans(id, c);
        list.push({
          id: id,
          name: c.name || '主播',
          avatar: c.avatar || c.cover || getAvatar((c && (c.name || c.id)) || null, 'first'),
          tag: (c.tags && c.tags[0]) || c.tag || c.category || '人气主播',
          category: c.category || '随性杂谈',
          fans: fans,
          isLive: (window.liveList || []).some(l => (l.characterId === id || l.id === id) && l.isLive !== false),
          isUser: false
        });
      });

      // 加入玩家 User
      const uName = (window.currentUser && window.currentUser.name) || '玩家';
      const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');
      const uProfile = window.userProfileData || {};
      const uFans = this.getFans('user');

      list.push({
        id: 'user',
        name: `${uName} (你)`,
        avatar: uAvatar,
        tag: uProfile.tag || '新人主播',
        category: '个人主页',
        fans: uFans,
        isLive: false,
        isUser: true
      });

      // 严格按粉丝数量降序排列
      list.sort((a, b) => b.fans - a.fans);
      return list;
    },

    // 6. 同步刷新全应用各处的粉丝展示 DOM
    syncAllFansDisplays(targetId) {
      // 1. 直播间当前主播粉丝展示
      if (window.currentRoom) {
        const curCharId = String(window.currentRoom.characterId || window.currentRoom.id);
        if (!targetId || targetId === curCharId) {
          const fanEl = document.getElementById('hostFanCount');
          if (fanEl) {
            const fans = this.getFans(curCharId, window.currentRoom);
            fanEl.textContent = hub.formatNumber(fans);
          }
        }
      }

      // 2. 主播空间页展示
      if (window.currentViewingProfile) {
        const curSpId = String(window.currentViewingProfile.characterId);
        if (!targetId || targetId === curSpId) {
          const spFansEl = document.getElementById('spFansCount');
          if (spFansEl) {
            const fans = this.getFans(curSpId);
            spFansEl.textContent = hub.formatNumber(fans);
          }
        }
      }

      // 3. 个人主页玩家粉丝数展示
      const myFans = this.getFans('user');
      if (!targetId || targetId === 'user') {
        const userFanEl = document.getElementById('displayUserFans');
        if (userFanEl) userFanEl.textContent = hub.formatNumber(myFans);
      }

      // 4. 社区人气排行榜如果正在展示，触发重新渲染
      if (typeof window.renderCommunityRanking === 'function') {
        const btnFans = document.getElementById('btnRankTabFans');
        if (btnFans && btnFans.classList.contains('active')) {
          window.renderCommunityRanking('fans');
        }
      }

      // 5. 我的专属超话 (module_mytopic.js)
      if (typeof window.renderMyTopicView === 'function') {
        const myTopicEl = document.getElementById('communityMyTopicView');
        if (myTopicEl && !myTopicEl.classList.contains('hidden')) {
          window.renderMyTopicView();
        }
      }

      // 6. 超话详情页玩家粉丝数展示 (module_supertopic.js)
      if (!targetId || targetId === 'user') {
        const userFansInSuperTopic = document.getElementById('displayUserFans');
        if (userFansInSuperTopic) {
          userFansInSuperTopic.textContent = hub.formatNumber(myFans);
        }
      }
    }
  };

  // 挂载到全局与 DataHub
  window.LumaFansManager = FansManager;
  window.FansManager = FansManager;

  // 桥接兼容原先接口
  window.getHostBaseFans = function(characterId, room) {
    return FansManager.getFans(characterId, room);
  };
})();
