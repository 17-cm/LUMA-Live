/**
 * ===================================================================
 * LUMA 离线生命周期因果推演引擎 (OfflineSimulationEngine)
 * 职责：
 * 1. 离线时间差快速推演 (Fast-Forward Timeline)
 * 2. 真实生命周期结算（超时硬兜底下播、历史场次持久化）
 * 3. 离线期间驱动热搜发帖，让社区动态与真实离线时长因果对应
 * ===================================================================
 */

(function () {
  const OfflineSimulationEngine = {
    /**
     * 执行离线时间差推演
     * 在 catchUpOfflinePolling（补跑轮询决策）之前调用，
     * 负责把离线前"仍在播"的场次按真实因果时间结算下播并归档历史，
     * 同时按离线时长驱动一次热搜发帖，让社区动态呈现"离线期间确实发生了事情"。
     */
    async simulateOfflineCatchup(context = {}) {
      const now = window.TimeKeeper ? window.TimeKeeper.now() : Date.now();
      const lastPollTime = await this._getLastPollTime();

      if (!lastPollTime || lastPollTime <= 0) {
        // 首次安装运行，记录时间戳直接返回
        await this._setLastPollTime(now);
        return { stepsRun: 0, reason: "INITIAL_START" };
      }

      const elapsedMs = now - lastPollTime;
      // 离线时间若小于 1 分钟，无需进行历史结算
      if (elapsedMs < 60 * 1000) {
        return { stepsRun: 0, reason: "DELTA_TOO_SHORT" };
      }

      console.log(`[Offline Engine] 检测到离线时间差: ${(elapsedMs / 60000).toFixed(1)} 分钟，开始结算离线期间的直播场次...`);

      // 1. 获取当前所有仍标记为在播的直播间与角色排班（真实持久化接口为 api.db）
      let liveSessions = [];
      let schedulesMap = {};
      try {
        if (window.api && api.db) {
          liveSessions = await api.db.list("live_sessions", { limit: 500 }) || [];
        }
      } catch (e) {
        console.warn("[Offline Engine] 获取直播场次列表失败:", e);
      }
      schedulesMap = window.charSchedulesMap || {};
      if (!schedulesMap || Object.keys(schedulesMap).length === 0) {
        try {
          const saved = await api.db.get("app_settings", "char_schedules").catch(() => null);
          if (saved && typeof saved === 'object') schedulesMap = saved;
        } catch (e) {}
      }

      // 2. 对离线前仍在播的直播间进行「因果时间结算与硬兜底下播」
      const closedHistoryRecords = [];

      for (const session of liveSessions) {
        if (!session) continue;
        const sessionStartTime = Number(session.startTime) || lastPollTime;
        const plannedEndTime = Number(session.endTime) || (sessionStartTime + 90 * 60 * 1000);

        // 离线期间该场直播已经超过了计划下播时刻，进行真实下播结算
        if (now >= plannedEndTime) {
          // 下播时间戳落在 [计划下播时刻] 与 [当前时间] 之间的真实因果位置，且不早于开播
          const calculatedEndTime = Math.min(now, Math.max(sessionStartTime + 10 * 60 * 1000, plannedEndTime));
          const actualDurationMin = Math.max(5, Math.floor((calculatedEndTime - sessionStartTime) / 60000));

          const historyRecord = {
            id: `show_${session.characterId}_${sessionStartTime}`,
            characterId: session.characterId,
            streamerName: session.name,
            title: session.topic || '日常直播',
            cover: session.cover || session.avatar || '',
            category: session.category || '随性杂谈',
            subTag: session.subTag || '日常唠嗑',
            startTime: sessionStartTime,
            endTime: calculatedEndTime,
            durationMin: actualDurationMin,
            peakViewers: session.viewers || Math.floor(Math.random() * 800 + 300),
            totalLikes: session.likes || Math.floor(Math.random() * 5000 + 1000),
            totalGifts: Math.floor(Math.random() * 200 + 50),
            fansGained: Math.floor(actualDurationMin * (Math.random() * 3 + 1)),
            isOfflineSimulated: true
          };
          closedHistoryRecords.push(historyRecord);

          // 从在播列表中移除该场次
          try {
            if (window.api && api.db) {
              await api.db.delete("live_sessions", session.id);
            }
          } catch (e) {
            console.warn("[Offline Engine] 移除已结束场次失败:", e);
          }

          // 更新该角色的排班：标记为已下播，进入冷却期
          if (!schedulesMap[session.characterId]) schedulesMap[session.characterId] = {};
          schedulesMap[session.characterId].isLive = false;
          schedulesMap[session.characterId].currentSessionId = null;
          schedulesMap[session.characterId].plannedEndTime = null;
          schedulesMap[session.characterId].lastEndTime = calculatedEndTime;
        }
        // 未超过计划下播时刻的场次维持在播，交由后续 catchUpOfflinePolling 正常轮询决策
      }

      // 3. 将已下播的场次持久化写入「主播历史记录集 (streamer_history)」
      if (closedHistoryRecords.length > 0) {
        try {
          if (window.api && api.db) {
            const existingHistory = await api.db.list("streamer_history", { limit: 500 }) || [];
            for (const rec of closedHistoryRecords) {
              await api.db.create("streamer_history", rec);
            }
            console.log(`[Offline Engine] 已完成 ${closedHistoryRecords.length} 场离线直播真实下播结算与历史归档。`);
          }
        } catch (e) {
          console.warn("[Offline Engine] 保存历史场次失败:", e);
        }

        try {
          await saveDbSetting("char_schedules", schedulesMap);
          window.charSchedulesMap = schedulesMap;
        } catch (e) {
          console.warn("[Offline Engine] 保存角色排班失败:", e);
        }
      }

      // 4. 离线时长足够长时，驱动一次热搜发帖，让社区动态与离线时长因果对应
      //    （离线越久，越应该在社区里"发生了点什么"；时间基准取离线窗口内偏近当前时刻）
      const OFFLINE_TRENDS_THRESHOLD_MS = 30 * 60 * 1000; // 离线 ≥30 分钟才触发
      if (elapsedMs >= OFFLINE_TRENDS_THRESHOLD_MS && typeof window.refreshTrendsWithAI === 'function') {
        try {
          console.log(`[Offline Engine] 离线时长达标，驱动热搜发帖...`);
          await window.refreshTrendsWithAI(now);
        } catch (e) {
          console.warn("[Offline Engine] 离线驱动热搜发帖失败:", e);
        }
      }

      console.log(`[Offline Engine] 离线推演完毕：结算下播 ${closedHistoryRecords.length} 场。`);
      return { closedCount: closedHistoryRecords.length };
    },

    async _getLastPollTime() {
      try {
        if (window.api && api.db) {
          const rec = await api.db.get("app_settings", "last_poll_time").catch(() => null);
          const val = window.readDbSettingValue ? window.readDbSettingValue(rec) : rec;
          if (val) return Number(val);
        }
      } catch (e) {}
      return null;
    },

    async _setLastPollTime(timestamp) {
      try {
        if (typeof window.saveDbSetting === 'function') {
          await window.saveDbSetting("last_poll_time", Number(timestamp));
        }
      } catch (e) {}
    }
  };

  // 全局挂载
  window.OfflineSimulationEngine = OfflineSimulationEngine;
})();
