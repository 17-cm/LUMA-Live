// =========================================================================
// 【模块二·社区子文档5·官方论坛与Bug反馈】LIVE/社区/module_forum.js
// 包含：
// 1. 官方更新日志与重大版本公告
// 2. 用户建议与 Bug 反馈工单系统（本地存储持久化与处理状态展示）
// =========================================================================

var api = window.api || {};
let currentForumTab = 'news'; // 'news' | 'feedback'

const OFFICIAL_NEWS_LOG = [
  {
    version: 'v3.6.0',
    date: '2026-08-20',
    title: '社区 7 架构模块化拆分与列表虚拟化重构',
    content: '1. 重构社区引擎为 7 个独立模块文档，架构解耦更易扩展。\n2. 对今日热搜瀑布流与超话动态引入 Virtual Scroller 虚拟化视口渲染，海量动态毫秒级滑动零卡顿！\n3. 全局每日签到、主播打榜贡献值与排行榜实现多端与跨页面实时双向同步！'
  },
  {
    version: 'v3.5.0',
    date: '2026-08-19',
    title: '微博热搜与超话 4 大专属分类系统全面升级',
    content: '1. 微博热搜全新升级为实时 TOP 50 榜单与话题动态广场。\n2. 超话引入 4 大微博专属分类：动态、贡献榜、签到榜、打榜应援！\n3. 全场景给主播消费打榜实时计入 Char 贡献总榜与超话热度！'
  },
  {
    version: 'v3.4.0',
    date: '2026-08-18',
    title: '社区 2.0 全新架构上线',
    content: '重构六大专区，引入真实时间戳连续签到打卡生态！'
  }
];

function switchForumTab(tabType) {
  currentForumTab = tabType;
  renderOfficialForum(tabType);
}
window.switchForumTab = switchForumTab;

function renderOfficialForum(tabType = 'news') {
  const container = document.getElementById('communityForumContent');
  if (!container) return;

  const btnNews = document.getElementById('btnForumTabNews');
  const btnFeedback = document.getElementById('btnForumTabFeedback');
  if (btnNews) btnNews.className = `flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition ${tabType === 'news' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}`;
  if (btnFeedback) btnFeedback.className = `flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition ${tabType === 'feedback' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}`;

  if (tabType === 'news') {
    container.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl text-white shadow-sm space-y-1">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">📢</span>
            <h4 class="text-xs font-black">LUMA 官方公告栏</h4>
          </div>
          <p class="text-[10px] text-purple-100 leading-relaxed">欢迎来到 LUMA 官方论坛！这里是开发团队发布最新版本说明与更新日志的第一阵地。</p>
        </div>

        ${OFFICIAL_NEWS_LOG.map(item => `
          <div class="luxe-card p-4 space-y-2 bg-white">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">${item.version}</span>
              <span class="text-[9px] text-slate-400">${item.date}</span>
            </div>
            <h5 class="text-xs font-black text-slate-900">${item.title}</h5>
            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-2.5 rounded-xl">${item.content}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    const savedFeedback = JSON.parse(localStorage.getItem('luma_user_feedback_list') || '[]');
    container.innerHTML = `
      <div class="space-y-3">
        <div class="luxe-card p-4 space-y-3 bg-white">
          <div>
            <h4 class="text-xs font-black text-slate-900">提交建议或 Bug 反馈</h4>
            <p class="text-[10px] text-slate-400 mt-0.5">你的每条留言都会安全记录并直接反馈给开发者！</p>
          </div>

          <div class="space-y-2">
            <select id="selectFeedbackType" class="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none">
              <option value="bug">🐛 问题与 Bug 反馈</option>
              <option value="feature">💡 新功能与玩法建议</option>
              <option value="experience">🎮 直播与互动体验吐槽</option>
              <option value="other">💬 其他求助与留言</option>
            </select>

            <textarea id="textFeedbackContent" rows="4" placeholder="请详细描述你在应用中遇到的问题或你的脑洞想法..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none resize-none leading-relaxed"></textarea>
            
            <button onclick="submitCommunityFeedback()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow-md">
              <span>立即提交给 LUMA 官方</span>
            </button>
          </div>
        </div>

        ${savedFeedback.length > 0 ? `
          <div class="space-y-2 pt-2">
            <h5 class="text-[11px] font-black text-slate-700 px-1">我的历史反馈 (${savedFeedback.length})</h5>
            ${savedFeedback.map(f => `
              <div class="luxe-card p-3 space-y-1.5 bg-white text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded">${f.typeLabel}</span>
                  <span class="text-[9px] text-slate-400">${f.time}</span>
                </div>
                <p class="text-slate-800 leading-relaxed">${f.content}</p>
                <div class="mt-1 p-2 bg-emerald-50 rounded-lg text-[10px] text-emerald-700 font-bold flex items-center gap-1.5">
                  <span>✓ 官方处理状态: 已收到并归档，感谢你的支持！</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}
window.renderOfficialForum = renderOfficialForum;

function submitCommunityFeedback() {
  const select = document.getElementById('selectFeedbackType');
  const textarea = document.getElementById('textFeedbackContent');
  if (!textarea || !textarea.value.trim()) {
    if (api.ui && api.ui.toast) api.ui.toast("请输入反馈内容后再提交哦！");
    return;
  }

  const typeMap = {
    bug: '🐛 Bug反馈',
    feature: '💡 功能建议',
    experience: '🎮 体验吐槽',
    other: '💬 其他求助'
  };

  const list = JSON.parse(localStorage.getItem('luma_user_feedback_list') || '[]');
  const item = {
    id: `fb_${Date.now()}`,
    type: select.value,
    typeLabel: typeMap[select.value] || '反馈',
    content: textarea.value.trim(),
    time: new Date().toLocaleString()
  };

  list.unshift(item);
  localStorage.setItem('luma_user_feedback_list', JSON.stringify(list));

  if (api.ui && api.ui.toast) {
    api.ui.toast("🎉 反馈提交成功！官方已收悉，非常感谢你的建议！");
  }
  textarea.value = '';
  renderOfficialForum('feedback');
}
window.submitCommunityFeedback = submitCommunityFeedback;
