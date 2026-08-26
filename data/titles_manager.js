// =========================================================================
// 【数据中心·称号与头衔体系】LIVE/数据/titles_manager.js
// 统一管理 User 与各 Char 的称号库配置、自动判定解锁逻辑、佩戴展示与未来称号扩展接口
// =========================================================================

(function initTitlesManager() {
  const hub = window.LumaDataHub;

  // 基础预设称号库 (后续可由用户/游戏规则自由扩展)
  const TITLES_CATALOG = [
    {
      id: 'title_newbie',
      name: '新人主播',
      icon: '🌱',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      badgeGradient: 'from-slate-100 to-slate-200 text-slate-800',
      description: '初入赛博世界开启直播与社区之旅',
      category: 'basic',
      checkUnlock: () => true
    },
    {
      id: 'title_top_guard',
      name: '👑 至尊榜一',
      icon: '👑',
      color: 'bg-gradient-to-r from-amber-400/20 to-rose-400/20 text-amber-900 border-amber-300',
      badgeGradient: 'from-amber-400 to-rose-500 text-slate-950 font-black',
      description: '累计为心仪主播或社区打榜消费达到 10,000 币',
      category: 'guard',
      checkUnlock: (entityId) => {
        const spent = window.LumaGuardManager?.getEntitySpentTotal(entityId) || 0;
        return spent >= 10000;
      }
    },
    {
      id: 'title_loyal_guard',
      name: '💖 铁杆守护',
      icon: '💖',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeGradient: 'from-rose-400 to-pink-500 text-white font-bold',
      description: '累计送出礼物达到 1,000 币',
      category: 'guard',
      checkUnlock: (entityId) => {
        const spent = window.LumaGuardManager?.getEntitySpentTotal(entityId) || 0;
        return spent >= 1000;
      }
    },
    {
      id: 'title_checkin_master',
      name: '🌟 超话劳模',
      icon: '🌟',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeGradient: 'from-emerald-400 to-teal-500 text-white font-bold',
      description: '在任意超话连续签到达到 7 天',
      category: 'checkin',
      checkUnlock: (entityId) => {
        const map = hub.getCheckinsMap();
        for (let key in map) {
          if (map[key].entityId === entityId && map[key].streakDays >= 7) {
            return true;
          }
        }
        return false;
      }
    },
    {
      id: 'title_super_star',
      name: '🔥 万人迷主播',
      icon: '🔥',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeGradient: 'from-purple-500 to-indigo-600 text-white font-bold',
      description: '自身粉丝数量突破 5,000 人',
      category: 'fans',
      checkUnlock: (entityId) => {
        const fans = window.LumaFansManager?.getFans(entityId) || 0;
        return fans >= 5000;
      }
    },
    {
      id: 'title_big_spender',
      name: '💎 荣耀金主',
      icon: '💎',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeGradient: 'from-amber-300 to-amber-500 text-slate-900 font-bold',
      description: '累计为他人打榜消费达到 50,000 币',
      category: 'guard',
      checkUnlock: (entityId) => {
        const spent = window.LumaGuardManager?.getEntitySpentTotal(entityId) || 0;
        return spent >= 50000;
      }
    }
  ];

  const TitlesManager = {
    // 1. 注册新称号 (开放后续自由添加更多称号)
    registerTitle(titleDef) {
      if (!titleDef || !titleDef.id) return;
      const idx = TITLES_CATALOG.findIndex(t => t.id === titleDef.id);
      if (idx !== -1) {
        TITLES_CATALOG[idx] = { ...TITLES_CATALOG[idx], ...titleDef };
      } else {
        TITLES_CATALOG.push(titleDef);
      }
    },

    // 2. 获取所有已定义称号列表
    getAllCatalog() {
      return [...TITLES_CATALOG];
    },

    // 3. 获取指定实体的称号状态（当前佩戴 + 已解锁列表）
    getEntityTitleState(entityId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const map = hub.getTitlesMap();
      let state = map[eId];
      if (!state) {
        state = {
          activeTitleId: 'title_newbie',
          unlockedTitleIds: ['title_newbie']
        };
        map[eId] = state;
        hub.saveTitlesMap(map);
      }
      return state;
    },

    // 4. 佩戴称号
    equipTitle(entityId, titleId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const state = this.getEntityTitleState(eId);
      if (!state.unlockedTitleIds.includes(titleId)) {
        return { success: false, error: '称号尚未解锁' };
      }
      state.activeTitleId = titleId;
      const map = hub.getTitlesMap();
      map[eId] = state;
      hub.saveTitlesMap(map);

      // 如果是玩家，更新主页展示 tag
      if (eId === 'user') {
        const titleObj = TITLES_CATALOG.find(t => t.id === titleId);
        if (titleObj && window.userProfileData) {
          window.userProfileData.tag = titleObj.name;
          const tagEl = document.getElementById('displayUserTag');
          if (tagEl) tagEl.textContent = titleObj.name;
        }
      }

      return { success: true, activeTitle: this.getTitleById(titleId) };
    },

    // 5. 检查并自动解锁符合条件的所有称号
    checkAndUnlockAllTitles(entityId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const state = this.getEntityTitleState(eId);
      let newlyUnlocked = [];

      TITLES_CATALOG.forEach(title => {
        if (!state.unlockedTitleIds.includes(title.id)) {
          if (typeof title.checkUnlock === 'function' && title.checkUnlock(eId)) {
            state.unlockedTitleIds.push(title.id);
            newlyUnlocked.push(title);
          }
        }
      });

      if (newlyUnlocked.length > 0) {
        const map = hub.getTitlesMap();
        map[eId] = state;
        hub.saveTitlesMap(map);

        if (eId === 'user' && window.api && window.api.ui) {
          newlyUnlocked.forEach(t => {
            window.api.ui.toast(`🎉 恭喜解锁新称号【${t.name}】！`);
          });
        }
      }

      return state;
    },

    // 6. 获取指定实体的当前佩戴称号对象
    getActiveTitle(entityId) {
      const state = this.getEntityTitleState(entityId);
      return this.getTitleById(state.activeTitleId) || TITLES_CATALOG[0];
    },

    getTitleById(titleId) {
      return TITLES_CATALOG.find(t => t.id === titleId) || null;
    }
  };

  window.LumaTitlesManager = TitlesManager;
  window.TitlesManager = TitlesManager;
})();
