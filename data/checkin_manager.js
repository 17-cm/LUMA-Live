// =========================================================================
// 【数据中心·全员签到与超话关注体系】LIVE/数据/checkin_manager.js
// 统一管理 User 与各 Char 的超话关注、每日打卡签到、连续天数、经验等级数据储存
// =========================================================================

(function initCheckinManager() {
  const hub = window.LumaDataHub;

  function getCheckinKey(entityId, topicId) {
    return `${entityId}_TOPIC_${topicId}`;
  }

  // 默认 Char 们的初始签到生态种子
  const DEFAULT_CHAR_CHECKINS = {
    'char_1_TOPIC_default_1': { streakDays: 18, totalExp: 5400, totalDays: 32, level: 6 },
    'char_2_TOPIC_default_1': { streakDays: 25, totalExp: 7500, totalDays: 45, level: 8 },
    'char_3_TOPIC_default_1': { streakDays: 12, totalExp: 3600, totalDays: 20, level: 4 },
    'char_4_TOPIC_default_1': { streakDays: 36, totalExp: 10800, totalDays: 60, level: 11 }
  };

  const CheckinManager = {
    // 1. 获取指定实体在指定超话的签到详情
    getCheckinInfo(entityId, topicId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const tId = String(topicId || 'default_1');
      const key = getCheckinKey(eId, tId);
      const map = hub.getCheckinsMap();
      const today = hub.getTodayDateStr();

      let info = map[key];
      if (!info) {
        // 如果是 Char 且有默认种子，赋初值
        if (DEFAULT_CHAR_CHECKINS[`${eId}_TOPIC_${tId}`]) {
          info = {
            entityId: eId,
            topicId: tId,
            lastDate: '',
            ...DEFAULT_CHAR_CHECKINS[`${eId}_TOPIC_${tId}`]
          };
        } else {
          info = {
            entityId: eId,
            topicId: tId,
            lastDate: '',
            streakDays: 0,
            totalDays: 0,
            totalExp: 0,
            level: 1
          };
        }
      }

      const isCheckedToday = (info.lastDate === today);
      const exp = info.totalExp || 0;
      const level = Math.min(16, Math.floor(exp / 300) + 1);

      return {
        entityId: eId,
        topicId: tId,
        isCheckedToday,
        lastDate: info.lastDate || '',
        streakDays: info.streakDays || 0,
        totalDays: info.totalDays || 0,
        totalExp: exp,
        level: level,
        totalCheckins: info.totalDays || 0
      };
    },

    // 2. 执行签到打卡 (支持玩家 User 以及任意 Char)
    performCheckIn(entityId, topicId, entityName = '', entityAvatar = '') {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const tId = String(topicId || 'default_1');
      const key = getCheckinKey(eId, tId);
      const today = hub.getTodayDateStr();
      const info = this.getCheckinInfo(eId, tId);

      if (info.isCheckedToday) {
        return { success: false, reason: 'already_checked', data: info };
      }

      // 计算是否为连续签到 (比对昨天日期)
      const yesterday = new Date(Date.now() - 86400000);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      
      let newStreak = 1;
      if (info.lastDate === yStr) {
        newStreak = (info.streakDays || 0) + 1;
      } else if (info.lastDate === today) {
        newStreak = info.streakDays;
      }

      const newTotalDays = (info.totalDays || 0) + 1;
      const newExp = (info.totalExp || 0) + 100;
      const newLevel = Math.min(16, Math.floor(newExp / 300) + 1);

      const map = hub.getCheckinsMap();
      map[key] = {
        entityId: eId,
        entityName: entityName || (eId === 'user' ? ((window.currentUser && window.currentUser.name) || '玩家') : '主播'),
        entityAvatar: entityAvatar || (eId === 'user' ? ((window.currentUser && window.currentUser.avatar) || '') : ''),
        topicId: tId,
        lastDate: today,
        streakDays: newStreak,
        totalDays: newTotalDays,
        totalExp: newExp,
        level: newLevel
      };

hub.saveCheckinsMap(map);

      // 直接写入 localStorage 备份 (用 api.db 同款前缀 luma_db_，确保同步落盘)
      const backupKey = 'luma_checkin_records';
      try {
        const existing = JSON.parse(localStorage.getItem(`luma_db_${backupKey}`) || '[]');
        const idx = existing.findIndex(r => r.id === key);
        if (idx >= 0) existing[idx] = { id: key, ...map[key] };
        else existing.push({ id: key, ...map[key] });
        localStorage.setItem(`luma_db_${backupKey}`, JSON.stringify(existing));
      } catch (e) {}

      // 同步到 api.db 持久层 (沙盒真实落盘)
      try {
        dbUpsert("luma_checkin_records", key, map[key]);
      } catch (e) {}

      // 兼容历史 LocalStorage 格式
      try {
        localStorage.setItem(`luma_checkin_${tId}`, JSON.stringify(map[key]));
      } catch (e) {}

      return {
        success: true,
        data: map[key]
      };
    },

    // 3. 实体（User 或 Char）关注超话
    followTopic(entityId, topicId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const tId = String(topicId);
      const follows = hub.getEntityFollows();
      if (!follows[eId]) follows[eId] = [];

      if (!follows[eId].includes(tId)) {
        follows[eId].push(tId);
        hub.saveEntityFollows(follows);
      }
      return follows[eId];
    },

    // 4. 实体取消关注超话
    unfollowTopic(entityId, topicId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const tId = String(topicId);
      const follows = hub.getEntityFollows();
      if (follows[eId]) {
        follows[eId] = follows[eId].filter(id => id !== tId);
        hub.saveEntityFollows(follows);
      }
      return follows[eId] || [];
    },

    // 5. 获取实体已关注的所有超话 ID 列表
    getEntityFollowedTopics(entityId) {
      const eId = (entityId === 'user' || entityId === 'player') ? 'user' : String(entityId || 'user');
      const follows = hub.getEntityFollows();
      return follows[eId] || [];
    },

    // 6. 获取特定超话的连续签到排行榜 (融合 User 和 Char 真实数据)
    getTopicCheckInRankList(topicId) {
      const tId = String(topicId || 'default_1');
      const map = hub.getCheckinsMap();
      const allChars = window.allCharacters || [];
      const uName = (window.currentUser && window.currentUser.name) || '玩家';
      const uAvatar = (window.currentUser && window.currentUser.avatar) || getAvatar((window.currentUser && window.currentUser.name) || null, 'first');

      const userCheckIn = this.getCheckinInfo('user', tId);
      const list = [];

      // 玩家数据
      list.push({
        id: 'user',
        name: `${uName} (你)`,
        avatar: uAvatar,
        days: userCheckIn.streakDays,
        total: userCheckIn.totalExp,
        badge: userCheckIn.isCheckedToday ? '今日已打卡' : '等待打卡',
        level: userCheckIn.level,
        isUser: true
      });

      // 遍历所有 Char
      allChars.forEach(c => {
        const cId = String(c.id || c.characterId);
        const cInfo = this.getCheckinInfo(cId, tId);
        list.push({
          id: cId,
          name: c.name,
          avatar: c.avatar || c.cover || getAvatar((c && (c.name || c.id)) || null, 'first'),
          days: cInfo.streakDays,
          total: cInfo.totalExp,
          badge: `Lv.${cInfo.level} 活跃打卡`,
          level: cInfo.level,
          isUser: false
        });
      });

      // 补充超话后援会专属预设打卡榜成员
      const seedMembers = [
        { id: 'fan_group_1', name: '全服元老粉丝团', avatar: getAvatar('全服元老粉丝团', 'first'), days: 128, total: 38400, badge: '开山元老', level: 16, isUser: false },
        { id: 'fan_group_2', name: '每日必打卡协会', avatar: getAvatar('每日必打卡协会', 'first'), days: 95, total: 28500, badge: '连续满勤', level: 14, isUser: false }
      ];

      seedMembers.forEach(s => list.push(s));

      list.sort((a, b) => b.days - a.days);
      return list;
    }
  };

  window.LumaCheckinManager = CheckinManager;
  window.CheckinManager = CheckinManager;

  // 桥接兼容原先接口
  window.getSuperTopicCheckInInfo = function(targetKey) {
    return CheckinManager.getCheckinInfo('user', targetKey);
  };

  window.handleSuperTopicCheckIn = function(targetKey, targetName = '该超话') {
    const res = CheckinManager.performCheckIn('user', targetKey);
    if (!res.success) {
      if (window.api && window.api.ui) {
        window.api.ui.toast(`今日已在【${targetName}】打卡完成，明天再来哦！`);
      }
      return;
    }
    const info = res.data;
    if (window.api && window.api.ui) {
      window.api.ui.toast(`🎉 签到成功！+100 经验，连续打卡第 ${info.streakDays} 天！`);
    }
    // 广播数据变动
    window.LumaDataHub.emit('checkin', { targetKey, storeData: info });
  };
})();
