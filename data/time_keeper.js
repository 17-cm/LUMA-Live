/**
 * ===================================================================
 * LUMA 真实时钟与时间因果格式化中心 (TimeKeeper)
 * 职责：
 * 1. 统一物理时间戳生成与校验
 * 2. 动态因果时间格式化（杜绝写死“刚刚”或“5分钟前”这类静态文字）
 * 3. 评论与子事件因果单调性校准（保证子事件绝对晚于主事件）
 * ===================================================================
 */

(function () {
  const TimeKeeper = {
    /**
     * 获取当前系统绝对物理时间戳 (毫秒)
     */
    now() {
      return Date.now();
    },

    /**
     * 规范化任何输入为合法的毫秒时间戳
     * @param {number|string|Date} val 
     * @param {number} fallback 
     */
    toTimestamp(val, fallback = Date.now()) {
      if (!val) return fallback;
      if (typeof val === 'number') {
        // 如果是秒级时间戳 (10位)，转为毫秒 (13位)
        if (val < 10000000000) return val * 1000;
        return val;
      }
      if (typeof val === 'string') {
        const parsed = Date.parse(val);
        if (!isNaN(parsed)) return parsed;
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          if (num < 10000000000) return num * 1000;
          return num;
        }
      }
      if (val instanceof Date) return val.getTime();
      return fallback;
    },

    /**
     * 格式化动态相对时间（相对于当前时刻的因果推移）
     * @param {number|string|Date} timestamp 目标事件的时间戳
     * @param {number} referenceNow 参考基准时间（默认为当前 Date.now()）
     * @returns {string} 如 "刚刚"、"3分钟前"、"2小时前"、"昨天 14:30"、"08-25"
     */
    formatRelative(timestamp, referenceNow = Date.now()) {
      const ts = this.toTimestamp(timestamp, referenceNow);
      const diffMs = referenceNow - ts;

      // 允许极其微小的时间漂移，小于 10 秒统一算刚刚
      if (diffMs < 10 * 1000 && diffMs >= -5000) {
        return '刚刚';
      }
      if (diffMs < 0) {
        // 未来时间兜底
        return '刚刚';
      }

      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffMin < 1) {
        return '刚刚';
      }
      if (diffMin < 60) {
        return `${diffMin}分钟前`;
      }
      if (diffHour < 24) {
        return `${diffHour}小时前`;
      }

      const targetDate = new Date(ts);
      const nowDate = new Date(referenceNow);

      const targetYear = targetDate.getFullYear();
      const nowYear = nowDate.getFullYear();

      const pad = (n) => String(n).padStart(2, '0');
      const hoursStr = pad(targetDate.getHours());
      const minStr = pad(targetDate.getMinutes());
      const monthStr = pad(targetDate.getMonth() + 1);
      const dayStr = pad(targetDate.getDate());

      if (diffDay === 1 || (diffDay <= 2 && nowDate.getDate() !== targetDate.getDate())) {
        return `昨天 ${hoursStr}:${minStr}`;
      }
      if (diffDay === 2) {
        return `前天 ${hoursStr}:${minStr}`;
      }

      if (targetYear === nowYear) {
        return `${monthStr}-${dayStr} ${hoursStr}:${minStr}`;
      }

      return `${targetYear}-${monthStr}-${dayStr}`;
    },

    /**
     * 格式化标准绝对时间 (YYYY-MM-DD HH:mm:ss)
     */
    formatAbsolute(timestamp) {
      const ts = this.toTimestamp(timestamp);
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },

    /**
     * 保证子事件时间戳（如评论、回复）严格在主事件（如发帖、开播）之后
     * 且按索引递增分布。时间窗取 [parentTimestamp, 当前时刻] 的可用区间，
     * 帖子刚发时评论贴近"刚刚"，帖子较老时评论在发帖之后合理分布。
     * @param {number} parentTimestamp 父级时间戳
     * @param {number} index 子事件序号
     * @param {number} totalCount 子事件总数
     * @param {number} maxSpanMs 子事件最大跨度（默认20分钟）
     */
    generateCausalChildTimestamp(parentTimestamp, index = 0, totalCount = 1, maxSpanMs = 20 * 60 * 1000) {
      const parentTs = this.toTimestamp(parentTimestamp);
      const nowTs = Date.now();
      const safeTotal = Math.max(1, Math.floor(totalCount || 1));
      const safeIndex = Math.max(0, Math.floor(index || 0));

      // 可用时间窗：主事件之后到当前时刻
      const availableSpan = Math.max(0, nowTs - parentTs);
      // 子事件总跨度不超过可用窗口与最大跨度
      const span = Math.min(availableSpan, maxSpanMs);
      // 按索引递增分布的基础位置
      const base = parentTs + (safeTotal > 0 ? (safeIndex * span) / safeTotal : 0);
      // 轻微抖动，但不越过当前时刻与因果顺序
      const step = safeTotal > 0 ? span / safeTotal : 0;
      const jitter = Math.floor(Math.random() * Math.max(1, Math.min(step * 0.5, 15 * 1000)));

      const childTs = base + jitter;
      // 因果单调（不早于主事件）且不超当前物理时间
      return Math.max(parentTs, Math.min(childTs, nowTs));
    },

    /**
     * 统一的动态时间显示入口：有真实时间戳则动态格式化，否则返回兜底文案。
     * @param {number|string|Date} timestamp 目标事件时间戳
     * @param {string} fallback 无时间戳时的兜底文案
     */
    getDisplayTime(timestamp, fallback = '刚刚') {
      if (!timestamp && timestamp !== 0) return fallback;
      return this.formatRelative(timestamp);
    },

    /**
     * 启动全局动态时间刷新器：周期性刷新页面上带 data-dynamic-time 的元素。
     * 渲染时把真实时间戳写入 data-ts，文案由本刷新器随时间推进自动更新。
     * @param {number} intervalMs 刷新间隔（默认30秒）
     */
    startDynamicTimeRefresher(intervalMs = 30 * 1000) {
      if (this._dynamicTimeRefresherStarted) return;
      this._dynamicTimeRefresherStarted = true;
      const refresh = () => {
        document.querySelectorAll('[data-dynamic-time]').forEach((el) => {
          const ts = el.getAttribute('data-ts');
          if (ts) el.textContent = TimeKeeper.formatRelative(TimeKeeper.toTimestamp(ts));
        });
      };
      setInterval(refresh, intervalMs);
    }
  };

  // 全局挂载
  window.TimeKeeper = TimeKeeper;
  window.formatDynamicTime = TimeKeeper.formatRelative.bind(TimeKeeper);
  window.formatAbsoluteTime = TimeKeeper.formatAbsolute.bind(TimeKeeper);
})();
