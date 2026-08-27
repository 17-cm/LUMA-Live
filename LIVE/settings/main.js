// =========================================================================
// 【模块四·初始化、路由与后台设置】LIVE/main.js
// 包含：主导航栏切换、底层设置手风琴、自定义API配置、数据导入导出、沙盒参数管理、全局初始化启动
// =========================================================================

var api = window.api || {};

// 1. 底部导航栏视图切换 (4 大主 Tab: 直播、社区、主页、设定)
function switchTab(tabId) {
  const tabs = ['live', 'trends', 'profile', 'settings'];
  tabs.forEach(t => {
    const view = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-btn-${t}`);
    if (view) {
      if (t === tabId) view.classList.remove('hidden');
      else view.classList.add('hidden');
    }
    if (navBtn) {
      if (t === tabId) {
        navBtn.classList.add('active');
      } else {
        navBtn.classList.remove('active');
      }
    }
  });

  // 动态同步原生顶部 Header 标识与状态
  const headerTitle = document.getElementById('mainAppHeaderTitle');
  const headerSubtitle = document.getElementById('mainAppHeaderSubtitle');
  const headerStatus = document.getElementById('mainAppHeaderStatusText');
  const headerIcon = document.getElementById('mainAppHeaderIconSvg');

  if (tabId === 'live') {
    if (headerTitle) headerTitle.textContent = 'LUMA LIVE';
    if (headerSubtitle) headerSubtitle.textContent = 'Cyber Live Ecosystem';
    if (headerStatus) headerStatus.textContent = '实时推流中';
    if (headerIcon) {
      headerIcon.innerHTML = `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`;
    }
    if (typeof renderLiveGrid === 'function') renderLiveGrid();
  } else if (tabId === 'trends') {
    if (headerTitle) headerTitle.textContent = '社区';
    if (headerSubtitle) headerSubtitle.textContent = 'Community · 探索与动态';
    if (headerStatus) headerStatus.textContent = '社区动态';
    if (headerIcon) {
      headerIcon.innerHTML = `<circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>`;
    }
    if (typeof renderTrends === "function") renderTrends();
  } else if (tabId === 'profile') {
    if (headerTitle) headerTitle.textContent = '个人中心';
    if (headerSubtitle) headerSubtitle.textContent = 'My Profile & Vault';
    if (headerStatus) headerStatus.textContent = '在线';
    if (headerIcon) {
      headerIcon.innerHTML = `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`;
    }
    if (typeof renderDualRankList === "function") renderDualRankList();
    if (typeof syncWalletDisplays === "function") syncWalletDisplays();
    if (typeof syncFollowCountDisplay === "function") syncFollowCountDisplay();
  } else if (tabId === 'settings') {
    if (headerTitle) headerTitle.textContent = '系统设定';
    if (headerSubtitle) headerSubtitle.textContent = 'Sandbox Configuration';
    if (headerStatus) headerStatus.textContent = '核心就绪';
    if (headerIcon) {
      headerIcon.innerHTML = `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`;
    }
    if (typeof syncParamDisplays === "function") syncParamDisplays();
    if (typeof renderPresetCategories === "function") renderPresetCategories();
    if (typeof renderImagePromptEntries === "function") renderImagePromptEntries();
    if (typeof syncCustomApiModalFields === "function") syncCustomApiModalFields();
  }
}
window.switchTab = switchTab;

// 2. 手风琴折叠交互
function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.accordion-item').forEach(item => {
    if (item.id !== id) item.classList.remove('open');
  });
  if (wasOpen) el.classList.remove('open');
  else el.classList.add('open');
}
window.toggleAccordion = toggleAccordion;

// 3. 沙盒参数实时调节与显隐同步
function updateParam(key, val) {
  const num = Number(val);
  if (!window.appParams) window.appParams = {};
  window.appParams[key] = num;

  if (key === 'maxLiveDuration') {
    const el = document.getElementById('valMaxLiveDuration');
    if (el) el.textContent = `${num}分钟`;
  } else if (key === 'maxRestDuration') {
    const el = document.getElementById('valMaxRestDuration');
    if (el) el.textContent = `${num}分钟`;
  } else if (key === 'replyRandomDanmakuRate') {
    const el = document.getElementById('valReplyRandomDanmakuRate');
    if (el) el.textContent = `${num}%`;
  } else if (key === 'mentionUserRate') {
    const el = document.getElementById('valMentionUserRate');
    if (el) el.textContent = `${num}%`;
  } else if (key === 'enterOtherLiveRate') {
    const el = document.getElementById('valEnterOtherLiveRate');
    if (el) el.textContent = `${num}%`;
  } else if (key === 'danmakuSpeed') {
    const el = document.getElementById('valDanmakuSpeed');
    const sec = num >= 70 ? '1.2' : num >= 50 ? '2.9' : num >= 30 ? '4.0' : '5.5';
    if (el) el.textContent = `${num} (约${sec}秒/条)`;
  } else if (key === 'giftFrequency') {
    const el = document.getElementById('valGiftFrequency');
    if (el) el.textContent = `${num}`;
  } else if (key === 'enterPlayerLiveRate') {
    const el = document.getElementById('valEnterPlayerLiveRate');
    if (el) el.textContent = `${num}%`;
  } else if (key === 'guestbookRate') {
    const el = document.getElementById('valGuestbookRate');
    if (el) el.textContent = `${num}%`;
  } else if (key === 'giftFullScreenEffect') {
    window.appParams.giftFullScreenEffect = (val === true || val === 'true' || val === 1);
  }
}
window.updateParam = updateParam;

// 每日直播场次上限设置
function setDailyLiveLimit(val) {
  const num = Number(val);
  if (!window.appParams) window.appParams = {};
  window.appParams.dailyLiveLimit = num;
  // 更新按钮选中状态
  document.querySelectorAll('.daily-limit-btn').forEach(btn => {
    const btnVal = Number(btn.dataset.value);
    if (btnVal === num) {
      btn.classList.add('bg-rose-500', 'text-white', 'border-rose-500');
      btn.classList.remove('border-slate-200', 'text-slate-600');
    } else {
      btn.classList.remove('bg-rose-500', 'text-white', 'border-rose-500');
      btn.classList.add('border-slate-200', 'text-slate-600');
    }
  });
  // 更新小标签显示
  const tagEl = document.getElementById('tagCharRate');
  const valEl = document.getElementById('valDailyLiveLimit');
  const label = num === 0 ? '不限制' : `${num}场`;
  if (tagEl) tagEl.textContent = `直播场次：${label}`;
  if (valEl) valEl.textContent = label;
}
window.setDailyLiveLimit = setDailyLiveLimit;

function syncParamDisplays() {
  const p = window.appParams || {};
  const setVal = (id, val, textId, suffix = '') => {
    const input = document.getElementById(id);
    const text = document.getElementById(textId);
    if (input && val !== undefined) input.value = val;
    if (text && val !== undefined) text.textContent = `${val}${suffix}`;
  };

  // 每日直播场次上限
  const dailyLimit = p.dailyLiveLimit !== undefined ? p.dailyLiveLimit : 0;
  const dailyLabel = dailyLimit === 0 ? '不限制' : `${dailyLimit}场`;
  const dailyValEl = document.getElementById('valDailyLiveLimit');
  const dailyTagEl = document.getElementById('tagCharRate');
  if (dailyValEl) dailyValEl.textContent = dailyLabel;
  if (dailyTagEl) dailyTagEl.textContent = `直播场次：${dailyLabel}`;
  document.querySelectorAll('.daily-limit-btn').forEach(btn => {
    const btnVal = Number(btn.dataset.value);
    if (btnVal === dailyLimit) {
      btn.classList.add('bg-rose-500', 'text-white', 'border-rose-500');
      btn.classList.remove('border-slate-200', 'text-slate-600');
    } else {
      btn.classList.remove('bg-rose-500', 'text-white', 'border-rose-500');
      btn.classList.add('border-slate-200', 'text-slate-600');
    }
  });

  setVal('paramMaxLiveDuration', p.maxLiveDuration || 240, 'valMaxLiveDuration', '分钟');
  setVal('paramMaxRestDuration', p.maxRestDuration || 480, 'valMaxRestDuration', '分钟');
  setVal('paramReplyRandomDanmakuRate', p.replyRandomDanmakuRate !== undefined ? p.replyRandomDanmakuRate : 25, 'valReplyRandomDanmakuRate', '%');
  setVal('paramMentionUserRate', p.mentionUserRate !== undefined ? p.mentionUserRate : 30, 'valMentionUserRate', '%');
  setVal('paramEnterOtherLiveRate', p.enterOtherLiveRate !== undefined ? p.enterOtherLiveRate : 35, 'valEnterOtherLiveRate', '%');
  
  const speed = p.danmakuSpeed || 50;
  const speedInput = document.getElementById('paramDanmakuSpeed');
  const speedText = document.getElementById('valDanmakuSpeed');
  if (speedInput) speedInput.value = speed;
  if (speedText) speedText.textContent = `${speed} (约${speed >= 70 ? '1.2' : speed >= 50 ? '2.9' : '4.0'}秒/条)`;

  setVal('paramGiftFrequency', p.giftFrequency || 30, 'valGiftFrequency', '');
  setVal('paramEnterPlayerLiveRate', p.enterPlayerLiveRate || 60, 'valEnterPlayerLiveRate', '%');
  setVal('paramGuestbookRate', p.guestbookRate || 75, 'valGuestbookRate', '%');

  // 后台轮询间隔显示
  const pollVal = p.opsPollInterval || 3;
  const pollInput = document.getElementById('paramOpsPollInterval');
  const pollText = document.getElementById('valOpsPollInterval');
  const pollTag = document.getElementById('tagOpsPollInterval');
  if (pollInput) pollInput.value = pollVal;
  if (pollText) pollText.textContent = `${pollVal} 分钟`;
  if (pollTag) pollTag.textContent = `${pollVal} 分钟`;

  const fxSwitch = document.getElementById('paramGiftFullScreenEffect');
  if (fxSwitch) {
    fxSwitch.checked = p.giftFullScreenEffect !== false;
  }

  const switchGlobal = document.getElementById('switchGlobalModel');
  const switchGlobalImg = document.getElementById('switchGlobalImageModel');
  const cfg = window.customApiConfig || {};
  if (switchGlobal) switchGlobal.checked = !!cfg.enableGlobalModel;
  if (switchGlobalImg) switchGlobalImg.checked = !!cfg.enableGlobalImageModel;

  const sizeSelect = document.getElementById('selectImageSize');
  const qualSelect = document.getElementById('selectImageQuality');
  const imgCfg = window.imageSettings || {};
  if (sizeSelect) sizeSelect.value = imgCfg.size || '1:1';
  if (qualSelect) qualSelect.value = imgCfg.quality || 'standard';
}
window.syncParamDisplays = syncParamDisplays;

async function saveAllParamsExplicitly() {
  try {
    await dbUpsert("app_settings", "global_params", window.appParams);
    api.ui.toast("系统运行参数已保存并落盘！");
  } catch (e) {
    api.ui.toast("保存成功");
  }
}
window.saveAllParamsExplicitly = saveAllParamsExplicitly;

// =========================================================================
// API 请求间隔设置
// =========================================================================
function updateApiIntervalDisplay(value) {
  const minutes = Number(value) || 5;
  const valEl = document.getElementById('valApiInterval');
  const tagEl = document.getElementById('tagApiInterval');
  if (valEl) valEl.textContent = `${minutes} 分钟`;
  if (tagEl) tagEl.textContent = `${minutes} 分钟`;
  if (!window.appParams) window.appParams = {};
  window.appParams.apiRequestInterval = minutes;
}
window.updateApiIntervalDisplay = updateApiIntervalDisplay;

// 后台轮询间隔显示更新
function updateOpsPollIntervalDisplay(value) {
  const minutes = Number(value) || 3;
  const valEl = document.getElementById('valOpsPollInterval');
  if (valEl) valEl.textContent = `${minutes} 分钟`;
  const tagEl = document.getElementById('tagOpsPollInterval');
  if (tagEl) tagEl.textContent = `${minutes} 分钟`;
  if (!window.appParams) window.appParams = {};
  window.appParams.opsPollInterval = minutes;
}
window.updateOpsPollIntervalDisplay = updateOpsPollIntervalDisplay;

// 重启 LUMA官方运营组定时器
function resetLumaOpsTimer() {
  if (window.__lumaLiveSyncInterval) {
    clearInterval(window.__lumaLiveSyncInterval);
    window.__lumaLiveSyncInterval = null;
  }
  const pollMins = (window.appParams && window.appParams.opsPollInterval) || 3;
  window.__lumaLiveSyncInterval = setInterval(() => {
    syncLiveSessions({ allowSpawn: true });
  }, pollMins * 60 * 1000);
}
window.resetLumaOpsTimer = resetLumaOpsTimer;

// 保存后台轮询间隔：落盘 + 重播开屏 + 重启定时器
async function saveOpsPollInterval() {
  try {
    if (!window.appParams) window.appParams = {};
    await dbUpsert("app_settings", "global_params", window.appParams);
    api.ui.toast("已保存，正在重启APP触发！");
    // 重播开屏动画
    if (typeof window.replaySplash === 'function') {
      window.replaySplash();
    }
    // 重启定时器（从头开始计算轮询时间）
    resetLumaOpsTimer();
  } catch (e) {
    api.ui.toast("保存成功");
    resetLumaOpsTimer();
  }
}
window.saveOpsPollInterval = saveOpsPollInterval;

// 轮询日志查看器
function openOpsLogViewer() {
  const modal = document.getElementById('opsLogModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderOpsLog();
  }
}
window.openOpsLogViewer = openOpsLogViewer;

function closeOpsLogViewer() {
  const modal = document.getElementById('opsLogModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}
window.closeOpsLogViewer = closeOpsLogViewer;

function renderOpsLog() {
  const container = document.getElementById('opsLogContent');
  if (!container) return;
  const log = window.lumaOpsLog || [];
  if (log.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-400 py-8">暂无日志，等待下一轮轮询...</div>';
    return;
  }
  container.innerHTML = log.map((cycle, idx) => {
    const p = cycle.params;
    const decisions = (cycle.decisions || []).map(d => {
      // 未被评估的角色：只显示状态，不投骰
      if (d.result === '持续直播中…' || d.result === '持续休息中…') {
        return `<div class="flex justify-between items-center py-0.5 border-b border-slate-50">
          <span class="text-slate-400">${d.char}</span>
          <span class="text-slate-300 text-[10px]">${d.state}</span>
          <span class="text-slate-400">${d.result}</span>
        </div>`;
      }
      const willColor = d.result === '开播' || d.result === '下播' ? 'text-rose-600' : d.result === '跳过' ? 'text-slate-400' : 'text-slate-500';
      const detail = d.state === '直播中'
        ? `已播${d.liveMins}分 下播倾向[${d.baseTendency}]+比例 总${d.stopTendency}% 骰${d.dice}`
        : `休息${d.restMins}分 开播倾向[${d.baseTendency}]+比例 总${d.spawnTendency}% 骰${d.dice}`;
      return `<div class="flex justify-between items-center py-0.5 border-b border-slate-50">
        <span class="text-slate-600">${d.char}</span>
        <span class="text-slate-400 text-[10px]">${detail}</span>
        <span class="${willColor} font-bold">${d.result}</span>
      </div>`;
    }).join('');
    const s = cycle.summary;
    return `<div class="bg-slate-50 rounded-xl p-2.5">
      <div class="flex justify-between items-center mb-1.5">
        <span class="font-bold text-slate-700">第${cycle.cycle || (log.length - idx)}轮 ${cycle.time}</span>
        <span class="text-[10px] text-slate-500">在播${s.streaming} 评估${s.evaluated || 0}人 开播${s.started} 下播${s.stopped}</span>
      </div>
      <div class="text-[9px] text-slate-400 mb-1.5">倾向值由角色状态栏驱动 | 直播上限${p.maxLiveMins}分 休息上限${p.maxRestMins}分</div>
      <div class="space-y-0.5">${decisions}</div>
    </div>`;
  }).join('');
}
window.renderOpsLog = renderOpsLog;

function toggleOpsLogRaw() {
  const content = document.getElementById('opsLogContent');
  const raw = document.getElementById('opsLogRaw');
  if (!content || !raw) return;
  const showing = raw.style.display !== 'none';
  if (showing) {
    raw.style.display = 'none';
    content.style.display = '';
  } else {
    raw.textContent = JSON.stringify(window.lumaOpsLog || [], null, 2);
    raw.style.display = '';
    content.style.display = 'none';
  }
}
window.toggleOpsLogRaw = toggleOpsLogRaw;

async function saveApiIntervalSetting() {
  try {
    if (!window.appParams) window.appParams = {};
    const minutes = window.appParams.apiRequestInterval || 5;
    await dbUpsert("app_settings", "global_params", window.appParams);
    api.ui.toast(`API请求间隔已保存为 ${minutes} 分钟`);
  } catch (e) {
    api.ui.toast("保存成功");
  }
}
window.saveApiIntervalSetting = saveApiIntervalSetting;

// 获取 API 请求间隔（分钟），默认 5 分钟
function getApiRequestIntervalMinutes() {
  if (window.appParams && window.appParams.apiRequestInterval) {
    return Number(window.appParams.apiRequestInterval) || 5;
  }
  return 5;
}
window.getApiRequestIntervalMinutes = getApiRequestIntervalMinutes;

// =========================================================================
// 直播间打包预设（代码只定义返回格式，具体生成数量和内容风格在预设里配置）
// =========================================================================
function getLivePackagePrompt() {
  // 从预设里读取直播间打包 prompt，如果没有就用默认基础模板
  // 预设里可以配置：生成多少条弹幕、多少条台词、内容风格、话题等
  const params = window.appParams || {};
  if (params.livePackagePrompt && params.livePackagePrompt.trim()) {
    return params.livePackagePrompt;
  }
  // 默认基础模板：只定义返回格式，不写死具体数量（数量在预设里调整）
  return `请生成观众弹幕（danmakus数组）和主播互动台词（hostSpeeches数组，每条包含speech和action字段）。返回JSON格式。`;
}
window.getLivePackagePrompt = getLivePackagePrompt;

// 保存直播间打包预设
async function saveLivePackagePrompt(promptText) {
  try {
    if (!window.appParams) window.appParams = {};
    window.appParams.livePackagePrompt = promptText;
    await dbUpsert("app_settings", "global_params", window.appParams);
    api.ui.toast("直播间打包预设已保存");
  } catch (e) {
    api.ui.toast("保存成功");
  }
}
window.saveLivePackagePrompt = saveLivePackagePrompt;

// 4. 数据备份、导出与导入
function downloadAppZipFile() {
  api.ui.toast("正在打包小手机应用离线运行包...");
  try {
    const dataBlob = new Blob([JSON.stringify({
      version: "2.0.0",
      bundle: "luma_live_app",
      params: window.appParams,
      presets: window.appPresets,
      imageSettings: window.imageSettings,
      customApiConfig: window.customApiConfig
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(dataBlob);
    a.download = 'luma-live-config.json';
    a.click();
    api.ui.toast("离线安装配置包已生成下载！");
  } catch (e) {
    api.ui.toast("安装包生成完成");
  }
}
window.downloadAppZipFile = downloadAppZipFile;



// 5. 自定义大模型 API 弹窗与设置
function openCustomApiModal() {
  const modal = document.getElementById('customApiModal');
  if (!modal) return;
  const cfg = window.customApiConfig || {};
  const selectType = document.getElementById('selectApiType');
  const inputUrl = document.getElementById('inputApiUrl');
  const inputKey = document.getElementById('inputApiKey');
  const selectModel = document.getElementById('selectApiModel');

  if (selectType) selectType.value = cfg.apiType || 'siliconflow';
  if (inputUrl) inputUrl.value = cfg.text?.url || '';
  if (inputKey) inputKey.value = cfg.text?.key || '';
  if (selectModel && cfg.text?.model) {
    selectModel.innerHTML = `<option value="${cfg.text.model}">${cfg.text.model}</option>`;
    selectModel.value = cfg.text.model;
  }
  modal.classList.remove('hidden');
}
window.openCustomApiModal = openCustomApiModal;

function closeCustomApiModal() {
  const modal = document.getElementById('customApiModal');
  if (modal) modal.classList.add('hidden');
}
window.closeCustomApiModal = closeCustomApiModal;

function handleApiTypeChange(val) {
  const inputUrl = document.getElementById('inputApiUrl');
  if (!inputUrl) return;
  if (val === 'siliconflow') {
    inputUrl.placeholder = 'https://api.siliconflow.cn/v1';
  } else if (val === 'deepseek') {
    inputUrl.placeholder = 'https://api.deepseek.com/v1';
  } else {
    inputUrl.placeholder = 'https://your-custom-endpoint/v1';
  }
}
window.handleApiTypeChange = handleApiTypeChange;

async function fetchOpenAIModels() {
  const inputUrl = document.getElementById('inputApiUrl');
  const inputKey = document.getElementById('inputApiKey');
  const selectType = document.getElementById('selectApiType');
  const selectModel = document.getElementById('selectApiModel');

  const type = selectType?.value || 'siliconflow';
  let url = inputUrl?.value.trim() || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    else if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = inputKey?.value.trim() || '';

  if (!url) {
    api.ui.toast("请先填写 API Base URL");
    return;
  }

  api.ui.toast("正在拉取可用模型列表...");
  try {
    const endpoint = (typeof formatOpenAIEndpoint === 'function') 
      ? formatOpenAIEndpoint(url, 'models') 
      : (url.replace(/\/+$/, '') + (url.endsWith('/v1') ? '/models' : '/v1/models'));

    const res = await window.robustNetworkRequest({
      url: endpoint,
      headers: { 'Authorization': key ? `Bearer ${key}` : '' }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const list = data?.data || [];
    if (list.length > 0 && selectModel) {
      selectModel.innerHTML = list.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
      api.ui.toast(`🎉 成功拉取 ${list.length} 个模型！`);
    } else {
      if (selectModel) selectModel.innerHTML = `<option value="gpt-3.5-turbo">gpt-3.5-turbo (默认)</option><option value="gpt-4o">gpt-4o</option><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-ai/DeepSeek-V3">deepseek-ai/DeepSeek-V3</option>`;
      api.ui.toast("已载入推荐常用模型列表");
    }
  } catch (err) {
    if (selectModel) selectModel.innerHTML = `<option value="gpt-3.5-turbo">gpt-3.5-turbo (默认)</option><option value="gpt-4o">gpt-4o</option><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-ai/DeepSeek-V3">deepseek-ai/DeepSeek-V3</option>`;
    api.ui.toast(`拉取模型受限 (${err.message || '网络连接异常'})，已载入常用预设`);
  }
}
window.fetchOpenAIModels = fetchOpenAIModels;

async function testCustomApiConnection() {
  const inputUrl = document.getElementById('inputApiUrl');
  const inputKey = document.getElementById('inputApiKey');
  const selectType = document.getElementById('selectApiType');
  const selectModel = document.getElementById('selectApiModel');

  const type = selectType?.value || 'siliconflow';
  let url = inputUrl?.value.trim() || '';
  if (!url) {
    if (type === 'siliconflow') url = 'https://api.siliconflow.cn/v1';
    else if (type === 'deepseek') url = 'https://api.deepseek.com/v1';
  }
  const key = inputKey?.value.trim() || '';
  const model = selectModel?.value || 'gpt-3.5-turbo';

  if (!url) {
    api.ui.toast("请先填写完整接口地址");
    return;
  }

  api.ui.toast("正在测试连接外部大模型...");
  try {
    const endpoint = (typeof formatOpenAIEndpoint === 'function') 
      ? formatOpenAIEndpoint(url, 'chat') 
      : (url.replace(/\/+$/, '') + (url.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions'));

    const res = await window.robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: {
        model: model,
        messages: [{ role: 'user', content: 'Ping! Test connection.' }],
        max_tokens: 10
      }
    });
    if (res.ok) {
      api.ui.toast("🎉 大模型 API 连接测试成功！");
    } else {
      const errMsg = res.json?.error?.message || `HTTP 状态码 ${res.status}`;
      api.ui.toast(`❌ 连接失败：${errMsg}`);
    }
  } catch (err) {
    api.ui.toast(`❌ 连接异常: ${err.message || '网络不通'}`);
  }
}
window.testCustomApiConnection = testCustomApiConnection;

async function saveCustomApiSettingsModal() {
  const selectType = document.getElementById('selectApiType');
  const inputUrl = document.getElementById('inputApiUrl');
  const inputKey = document.getElementById('inputApiKey');
  const selectModel = document.getElementById('selectApiModel');

  if (!window.customApiConfig) window.customApiConfig = {};
  if (!window.customApiConfig.text) window.customApiConfig.text = {};

  window.customApiConfig.apiType = selectType?.value || 'siliconflow';
  window.customApiConfig.text.url = inputUrl?.value.trim() || '';
  window.customApiConfig.text.key = inputKey?.value.trim() || '';
  window.customApiConfig.text.model = selectModel?.value || 'gpt-3.5-turbo';

  if (typeof saveDbSetting === 'function') {
    await saveDbSetting("custom_api_config", window.customApiConfig);
  } else {
    try {
      await dbUpsert("app_settings", "custom_api_config", window.customApiConfig);
    } catch (e) {}
  }

  closeCustomApiModal();
  syncCustomApiModalFields();
  api.ui.toast("自定义文本 API 配置已保存并实时生效！");
}
window.saveCustomApiSettingsModal = saveCustomApiSettingsModal;

// 6. 自定义生图 API 弹窗与设置 (兼容 New API / OpenAI / One API 标准)
let isManualImageModelMode = false;

function toggleManualImageModelInput(forceShow) {
  const manualInput = document.getElementById('inputManualImageModel');
  const selectBox = document.getElementById('selectImageApiModel');
  if (!manualInput || !selectBox) return;

  if (typeof forceShow === 'boolean') {
    isManualImageModelMode = forceShow;
  } else {
    isManualImageModelMode = !isManualImageModelMode;
  }

  if (isManualImageModelMode) {
    manualInput.classList.remove('hidden');
    manualInput.focus();
  } else {
    manualInput.classList.add('hidden');
  }
}
window.toggleManualImageModelInput = toggleManualImageModelInput;

function handleImageModelSelect(val) {
  const manualInput = document.getElementById('inputManualImageModel');
  if (manualInput) {
    manualInput.value = val;
  }
}
window.handleImageModelSelect = handleImageModelSelect;

function openCustomImageApiModal() {
  const modal = document.getElementById('customImageApiModal');
  if (!modal) return;
  const cfg = window.customApiConfig?.image || {};
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');
  const manualInput = document.getElementById('inputManualImageModel');

  if (inputUrl) inputUrl.value = cfg.url || '';
  if (inputKey) inputKey.value = cfg.key || '';
  if (selectModel && cfg.model) {
    selectModel.innerHTML = `<option value="${cfg.model}">${cfg.model}</option>`;
    selectModel.value = cfg.model;
  }
  if (manualInput && cfg.model) {
    manualInput.value = cfg.model;
  }
  modal.classList.remove('hidden');
}
window.openCustomImageApiModal = openCustomImageApiModal;

function closeCustomImageApiModal() {
  const modal = document.getElementById('customImageApiModal');
  if (modal) modal.classList.add('hidden');
}
window.closeCustomImageApiModal = closeCustomImageApiModal;

async function fetchImageApiModels() {
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');
  const manualInput = document.getElementById('inputManualImageModel');

  let url = inputUrl?.value.trim() || '';
  const key = inputKey?.value.trim() || '';

  if (!url) {
    api.ui.toast("请先填写生图 API Base URL");
    return;
  }

  api.ui.toast("正在向中转站获取模型列表...");
  try {
    const endpoint = (typeof formatOpenAIEndpoint === 'function') 
      ? formatOpenAIEndpoint(url, 'models') 
      : (url.replace(/\/+$/, '') + (url.endsWith('/v1') ? '/models' : '/v1/models'));

    const res = await window.robustNetworkRequest({
      url: endpoint,
      headers: { 'Authorization': key ? `Bearer ${key}` : '' }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const list = data?.data || [];

    if (list.length > 0 && selectModel) {
      // 智能排序：优先将包含 dall-e, flux, sd, stable-diffusion, image, mj, midjourney, cogview 等关键字的模型排在前面
      const imageKeywords = ['dall', 'flux', 'sd', 'stable-diffusion', 'image', 'mj', 'midjourney', 'cogview', 'kolors', 'paint', 'draw'];
      const sorted = [...list].sort((a, b) => {
        const idA = String(a.id || '').toLowerCase();
        const idB = String(b.id || '').toLowerCase();
        const aIsImg = imageKeywords.some(k => idA.includes(k));
        const bIsImg = imageKeywords.some(k => idB.includes(k));
        if (aIsImg && !bIsImg) return -1;
        if (!aIsImg && bIsImg) return 1;
        return idA.localeCompare(idB);
      });

      selectModel.innerHTML = sorted.map(m => {
        const isLikelyImg = imageKeywords.some(k => String(m.id || '').toLowerCase().includes(k));
        return `<option value="${m.id}">${m.id}${isLikelyImg ? ' 🎨' : ''}</option>`;
      }).join('');

      if (sorted.length > 0 && manualInput) {
        manualInput.value = sorted[0].id;
      }
      api.ui.toast(`🎉 成功从中转站拉取 ${list.length} 个可用模型！`);
    } else {
      if (selectModel) {
        selectModel.innerHTML = `
          <option value="dall-e-3">dall-e-3</option>
          <option value="dall-e-2">dall-e-2</option>
          <option value="flux-schnell">flux-schnell</option>
          <option value="flux-dev">flux-dev</option>
          <option value="stable-diffusion-3">stable-diffusion-3</option>
          <option value="midjourney">midjourney</option>
        `;
      }
      api.ui.toast("中转站未返回模型列表，已载入常见生图模型名称");
    }
  } catch (err) {
    if (selectModel) {
      selectModel.innerHTML = `
        <option value="dall-e-3">dall-e-3</option>
        <option value="flux-schnell">flux-schnell</option>
        <option value="stable-diffusion-3">stable-diffusion-3</option>
      `;
    }
    api.ui.toast(`获取受限 (${err.message || '网络异常'})，支持点击上方【手动输入】直接填写`);
  }
}
window.fetchImageApiModels = fetchImageApiModels;

async function testCustomImageApiConnection() {
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');
  const manualInput = document.getElementById('inputManualImageModel');

  const url = inputUrl?.value.trim() || '';
  const key = inputKey?.value.trim() || '';
  const model = (manualInput && !manualInput.classList.contains('hidden') && manualInput.value.trim()) 
    ? manualInput.value.trim() 
    : (selectModel?.value || 'dall-e-3');

  if (!url) {
    api.ui.toast("请先填写生图 API Base URL");
    return;
  }

  api.ui.toast("正在向中转站测试生图连通性...");
  try {
    const endpoint = (typeof formatOpenAIEndpoint === 'function') 
      ? formatOpenAIEndpoint(url, 'images') 
      : (url.replace(/\/+$/, '') + (url.endsWith('/v1') ? '/images/generations' : '/v1/images/generations'));

    const res = await window.robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, prompt: 'A cute cat avatar, high quality', n: 1, size: '1024x1024' }
    });
    if (res.ok) {
      api.ui.toast("🎉 生图 API 连接测试成功！");
    } else {
      const errMsg = res.json?.error?.message || `HTTP ${res.status}`;
      api.ui.toast(`❌ 中转站返回: ${errMsg}`);
    }
  } catch (err) {
    api.ui.toast(`❌ 生图网络异常: ${err.message || '地址不通'}`);
  }
}
window.testCustomImageApiConnection = testCustomImageApiConnection;

async function saveCustomImageApiSettingsModal() {
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');
  const manualInput = document.getElementById('inputManualImageModel');

  if (!window.customApiConfig) window.customApiConfig = {};
  if (!window.customApiConfig.image) window.customApiConfig.image = {};

  const modelVal = (manualInput && !manualInput.classList.contains('hidden') && manualInput.value.trim())
    ? manualInput.value.trim()
    : (selectModel?.value || 'dall-e-3');

  window.customApiConfig.image.url = inputUrl?.value.trim() || '';
  window.customApiConfig.image.key = inputKey?.value.trim() || '';
  window.customApiConfig.image.model = modelVal;

  if (typeof saveDbSetting === 'function') {
    await saveDbSetting("custom_api_config", window.customApiConfig);
  } else {
    try {
      await dbUpsert("app_settings", "custom_api_config", window.customApiConfig);
    } catch (e) {}
  }

  closeCustomImageApiModal();
  syncCustomApiModalFields();
  api.ui.toast(`生图模型 [${modelVal}] 配置已保存并实时生效！`);
}
window.saveCustomImageApiSettingsModal = saveCustomImageApiSettingsModal;

async function toggleGlobalModelSwitch(checked) {
  if (!window.customApiConfig) window.customApiConfig = {};
  window.customApiConfig.enableGlobalModel = !!checked;
  if (typeof saveDbSetting === 'function') {
    await saveDbSetting("custom_api_config", window.customApiConfig);
  } else {
    dbUpsert("app_settings", "custom_api_config", window.customApiConfig);
  }
  syncCustomApiModalFields();
  api.ui.toast(checked ? "已实时启用全局文本大模型" : "已实时切换为自定义文本API");
}
window.toggleGlobalModelSwitch = toggleGlobalModelSwitch;

async function toggleGlobalImageModelSwitch(checked) {
  if (!window.customApiConfig) window.customApiConfig = {};
  window.customApiConfig.enableGlobalImageModel = !!checked;
  if (typeof saveDbSetting === 'function') {
    await saveDbSetting("custom_api_config", window.customApiConfig);
  } else {
    dbUpsert("app_settings", "custom_api_config", window.customApiConfig);
  }
  syncCustomApiModalFields();
  api.ui.toast(checked ? "已实时启用全局生图大模型" : "已实时切换为自定义生图API");
}
window.toggleGlobalImageModelSwitch = toggleGlobalImageModelSwitch;

function syncCustomApiModalFields() {
  const cfg = window.customApiConfig || {};
  const statusText = document.getElementById('statusCustomApi');
  const statusImg = document.getElementById('statusCustomImageApi');
  const switchGlobal = document.getElementById('switchGlobalModel');
  const switchGlobalImg = document.getElementById('switchGlobalImageModel');

  if (switchGlobal) switchGlobal.checked = !!cfg.enableGlobalModel;
  if (switchGlobalImg) switchGlobalImg.checked = !!cfg.enableGlobalImageModel;

  if (statusText) {
    if (cfg.enableGlobalModel) {
      statusText.textContent = '当前模式: 宿主全局大模型 (实时生效)';
    } else if (cfg.text?.model) {
      statusText.textContent = `当前模型: ${cfg.text.model} (${cfg.apiType || '自定义'})`;
    } else {
      statusText.textContent = '支持硅基流动 / DeepSeek / 自定义接口 (点击配置)';
    }
  }
  if (statusImg) {
    if (cfg.enableGlobalImageModel) {
      statusImg.textContent = '当前模式: 宿主全局生图模型 (实时生效)';
    } else if (cfg.image?.model) {
      statusImg.textContent = `当前生图模型: ${cfg.image.model}`;
    } else {
      statusImg.textContent = 'SD / DALL-E / FLUX 格式支持 (点击配置)';
    }
  }
}

// 7. 生图参数与修饰词管理
function handleImageSizeChange(val) {
  if (!window.imageSettings) window.imageSettings = {};
  window.imageSettings.size = val;
  const ratioEntry = (window.imageSettings.prompts || []).find(p => p.id === 'ratio_prompt');
  if (ratioEntry) {
    ratioEntry.content = val === '9:16' ? '竖屏 9:16 构图，vertical 9:16 composition' : val === '16:9' ? '横屏 16:9 构图，widescreen 16:9 composition' : '正方形 1:1 构图，square 1:1 composition';
    if (typeof renderImagePromptEntries === "function") renderImagePromptEntries();
  }
}
window.handleImageSizeChange = handleImageSizeChange;

function handleImageQualityChange(val) {
  if (!window.imageSettings) window.imageSettings = {};
  window.imageSettings.quality = val;
}
window.handleImageQualityChange = handleImageQualityChange;

function renderImagePromptEntries() {
  const box = document.getElementById('imagePromptEntriesContainer');
  if (!box) return;
  const prompts = window.imageSettings?.prompts || [];

  box.innerHTML = prompts.map((p, idx) => `
    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
      <div class="flex items-center justify-between">
        <input value="${p.title}" oninput="updateImagePromptTitle(${idx}, this.value)" class="font-bold text-xs bg-transparent border-b border-transparent focus:border-rose-400 focus:outline-none text-slate-800">
        ${p.id !== 'ratio_prompt' ? `<button onclick="removeImagePromptEntry(${idx})" class="text-rose-500 text-xs font-bold hover:underline">删除</button>` : '<span class="text-[9px] text-slate-400">尺寸联动</span>'}
      </div>
      <textarea oninput="updateImagePromptContent(${idx}, this.value)" rows="2" class="input-ins text-xs">${p.content}</textarea>
    </div>
  `).join('');
}
window.renderImagePromptEntries = renderImagePromptEntries;

function updateImagePromptTitle(idx, val) {
  if (window.imageSettings?.prompts?.[idx]) {
    window.imageSettings.prompts[idx].title = val;
  }
}
window.updateImagePromptTitle = updateImagePromptTitle;

function updateImagePromptContent(idx, val) {
  if (window.imageSettings?.prompts?.[idx]) {
    window.imageSettings.prompts[idx].content = val;
  }
}
window.updateImagePromptContent = updateImagePromptContent;

function addNewImagePromptEntry() {
  if (!window.imageSettings) window.imageSettings = { prompts: [] };
  if (!window.imageSettings.prompts) window.imageSettings.prompts = [];
  window.imageSettings.prompts.push({
    id: `img_p_${Date.now()}`,
    title: '自定义修饰词',
    content: 'masterpiece, best quality, ultra-detailed, anime lighting'
  });
  renderImagePromptEntries();
}
window.addNewImagePromptEntry = addNewImagePromptEntry;

function removeImagePromptEntry(idx) {
  if (window.imageSettings?.prompts) {
    window.imageSettings.prompts.splice(idx, 1);
    if (typeof renderImagePromptEntries === "function") renderImagePromptEntries();
  }
}
window.removeImagePromptEntry = removeImagePromptEntry;

async function saveImageSettingsExplicitly() {
  try {
    await dbUpsert("app_settings", "image_settings", window.imageSettings);
    api.ui.toast("生图参数与提示词已保存！");
  } catch (e) {
    api.ui.toast("生图参数已保存");
  }
}
window.saveImageSettingsExplicitly = saveImageSettingsExplicitly;

// 8. 预设提示词分类管理
let currentActivePresetCatKey = null;

function renderPresetCategories() {
  const box = document.getElementById('presetCategoryList');
  if (!box) return;
  const cats = window.appPresets || {};

  box.innerHTML = Object.entries(cats).map(([key, cat]) => `
    <div onclick="openPresetCategoryModal('${key}')" class="luxe-card p-3 flex items-center justify-between cursor-pointer active:scale-98 transition bg-white">
      <div>
        <h5 class="text-xs font-black text-slate-800">${cat.name}</h5>
        <p class="text-[9px] text-slate-400 mt-0.5">${cat.desc || ''}</p>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-rose-600 font-bold">${cat.entries?.length || 0}条预设</span>
        <span class="text-slate-400 text-xs">›</span>
      </div>
    </div>
  `).join('');
}
window.renderPresetCategories = renderPresetCategories;

function openPresetCategoryModal(catKey) {
  currentActivePresetCatKey = catKey;
  const modal = document.getElementById('presetCategoryModal');
  const title = document.getElementById('presetModalCategoryTitle');
  const cat = window.appPresets?.[catKey];
  if (!modal || !cat) return;

  if (title) title.textContent = `${cat.name} · 条目管理`;
  renderCurrentCategoryPromptEntries();
  modal.classList.remove('hidden');
}
window.openPresetCategoryModal = openPresetCategoryModal;

function closePresetCategoryModal() {
  const modal = document.getElementById('presetCategoryModal');
  if (modal) modal.classList.add('hidden');
  currentActivePresetCatKey = null;
}
window.closePresetCategoryModal = closePresetCategoryModal;

function renderCurrentCategoryPromptEntries() {
  const box = document.getElementById('promptEntriesContainer');
  if (!box || !currentActivePresetCatKey) return;
  const cat = window.appPresets[currentActivePresetCatKey];
  const entries = cat?.entries || [];

  box.innerHTML = entries.map((entry, idx) => `
    <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
      <div class="flex items-center justify-between">
        <input value="${entry.title}" oninput="updateCurrentCategoryEntryTitle(${idx}, this.value)" class="font-bold text-xs bg-transparent border-b border-transparent focus:border-rose-400 focus:outline-none text-slate-800">
        <button onclick="removeCurrentCategoryEntry(${idx})" class="text-rose-500 text-xs font-bold hover:underline">删除</button>
      </div>
      <textarea oninput="updateCurrentCategoryEntryContent(${idx}, this.value)" rows="4" class="input-ins text-xs leading-relaxed font-mono">${entry.content}</textarea>
    </div>
  `).join('');
}

function updateCurrentCategoryEntryTitle(idx, val) {
  if (currentActivePresetCatKey && window.appPresets[currentActivePresetCatKey]?.entries?.[idx]) {
    window.appPresets[currentActivePresetCatKey].entries[idx].title = val;
  }
}
window.updateCurrentCategoryEntryTitle = updateCurrentCategoryEntryTitle;

function updateCurrentCategoryEntryContent(idx, val) {
  if (currentActivePresetCatKey && window.appPresets[currentActivePresetCatKey]?.entries?.[idx]) {
    window.appPresets[currentActivePresetCatKey].entries[idx].content = val;
  }
}
window.updateCurrentCategoryEntryContent = updateCurrentCategoryEntryContent;

function addNewPromptEntryToCurrentCategory() {
  if (!currentActivePresetCatKey || !window.appPresets[currentActivePresetCatKey]) return;
  if (!window.appPresets[currentActivePresetCatKey].entries) {
    window.appPresets[currentActivePresetCatKey].entries = [];
  }
  window.appPresets[currentActivePresetCatKey].entries.push({
    id: `entry_${Date.now()}`,
    title: '新增提示词条目',
    content: '请根据设定执行输出。\\n输出格式 JSON：{\\n  "text": "内容"\\n}'
  });
  renderCurrentCategoryPromptEntries();
}
window.addNewPromptEntryToCurrentCategory = addNewPromptEntryToCurrentCategory;

function removeCurrentCategoryEntry(idx) {
  if (currentActivePresetCatKey && window.appPresets[currentActivePresetCatKey]?.entries) {
    window.appPresets[currentActivePresetCatKey].entries.splice(idx, 1);
    renderCurrentCategoryPromptEntries();
  }
}
window.removeCurrentCategoryEntry = removeCurrentCategoryEntry;

async function saveCurrentCategoryPresets() {
  try {
    await dbUpsert("app_settings", "app_presets", { data: window.appPresets });
    api.ui.toast("当前分类提示词已保存！");
  } catch (e) {
    api.ui.toast("提示词已更新");
  }
  closePresetCategoryModal();
  renderPresetCategories();
}
window.saveCurrentCategoryPresets = saveCurrentCategoryPresets;

// 9. 清除本地缓存确认
function openResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.remove('hidden');
}
window.openResetConfirmModal = openResetConfirmModal;

function closeResetConfirmModal() {
  const modal = document.getElementById('resetConfirmModal');
  if (modal) modal.classList.add('hidden');
}
window.closeResetConfirmModal = closeResetConfirmModal;

async function executeConfirmResetAppData() {
  try {
    localStorage.clear();
    await api.ui.toast("本地缓存已彻底清除，正在重新加载...");
    setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (e) {
    window.location.reload();
  }
}
window.executeConfirmResetAppData = executeConfirmResetAppData;

// =========================================================================
// 11. 数据备份与离线导出系统
// =========================================================================
function exportAppDataFile() {
  try {
    const backupData = {
      version: '',
      exportTime: new Date().toISOString(),
      appParams: window.appParams || {},
      customApiConfig: window.customApiConfig || {},
      imageSettings: window.imageSettings || {},
      appPresets: window.appPresets || {},
      userProfile: window.userProfileData || {},
      walletBalance: window.currentWalletBalance || 0,
      charSchedules: window.charSchedulesMap || {},
      followedHosts: window.followedHosts || []
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luma-live-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (api.ui?.toast) api.ui.toast("运行数据导出成功！");
  } catch (e) {
    if (api.ui?.toast) api.ui.toast("导出失败: " + e.message);
  }
}
window.exportAppDataFile = exportAppDataFile;

function triggerImportAppDataFile() {
  const input = document.getElementById('fileInputData');
  if (input) input.click();
}
window.triggerImportAppDataFile = triggerImportAppDataFile;

async function handleFileImportData(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.appParams) {
      window.appParams = data.appParams;
      await dbUpsert("app_settings", "global_params", data.appParams);
    }
    if (data.appPresets) {
      window.appPresets = data.appPresets;
      await dbUpsert("app_settings", "app_presets", { data: data.appPresets });
    }
    if (data.customApiConfig) {
      window.customApiConfig = data.customApiConfig;
      await dbUpsert("app_settings", "custom_api_config", data.customApiConfig);
    }
    if (data.imageSettings) {
      window.imageSettings = data.imageSettings;
      await dbUpsert("app_settings", "image_settings", data.imageSettings);
    }
    if (api.ui?.toast) api.ui.toast("数据导入成功！正在重载...");
    setTimeout(() => window.location.reload(), 600);
  } catch (err) {
    if (api.ui?.toast) api.ui.toast("数据文件解析失败");
  }
  e.target.value = '';
}
window.handleFileImportData = handleFileImportData;

function exportPresetsDataFile() {
  try {
    const blob = new Blob([JSON.stringify(window.appPresets || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luma-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (api.ui?.toast) api.ui.toast("提示词预设导出成功！");
  } catch (e) {}
}
window.exportPresetsDataFile = exportPresetsDataFile;

function triggerImportPresetsDataFile() {
  const input = document.getElementById('fileInputPresets');
  if (input) input.click();
}
window.triggerImportPresetsDataFile = triggerImportPresetsDataFile;

async function handleFileImportPresets(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    window.appPresets = data;
    await dbUpsert("app_settings", "app_presets", { data: data });
    if (typeof renderPresetCategories === "function") renderPresetCategories();
    if (api.ui?.toast) api.ui.toast("提示词预设导入成功！");
  } catch (err) {
    if (api.ui?.toast) api.ui.toast("提示词文件解析失败");
  }
  e.target.value = '';
}
window.handleFileImportPresets = handleFileImportPresets;

// 12. 创作者直播间占位全屏
function openPlayerLiveView() {
  const view = document.getElementById('playerLiveRoomView');
  if (view) view.classList.remove('hidden');
}
window.openPlayerLiveView = openPlayerLiveView;

function closePlayerLiveView() {
  const view = document.getElementById('playerLiveRoomView');
  if (view) view.classList.add('hidden');
}
window.closePlayerLiveView = closePlayerLiveView;

// =========================================================================
// 11. 全局启动加载生命周期
// =========================================================================
async function lumaInitApp() {
  registerAiPhoneToolHandlers();

  // 1. 初始化数据库及本地持久化
  try {
    const settingsRec = await api.db.get("app_settings", "global_params");
    if (settingsRec) Object.assign(window.appParams, settingsRec);

    const apiCfg = await api.db.get("app_settings", "custom_api_config");
    if (apiCfg) Object.assign(window.customApiConfig, apiCfg);

    const imgCfg = await api.db.get("app_settings", "image_settings");
    if (imgCfg) Object.assign(window.imageSettings, imgCfg);

    const catsRec = await api.db.get("app_settings", "app_presets");
    if (catsRec?.data && catsRec.data.live?.entries?.length > 0) {
      window.appPresets = catsRec.data;
    }

    const followsRec = await api.db.list("follows", { limit: 500 }) || [];
    window.followedHosts = followsRec.map(f => f.id);
    if (typeof syncFollowCountDisplay === "function") syncFollowCountDisplay();

    // 加载超话关注列表
    try {
      const stRec = await api.db.get("luma_supertopic_follows", "user");
      if (stRec && Array.isArray(stRec.topics)) {
        window.followedSuperTopics = stRec.topics;
      } else {
        const localST = localStorage.getItem('luma_followed_supertopics');
        if (localST) window.followedSuperTopics = JSON.parse(localST);
      }
    } catch (e) {}
    if (!window.followedSuperTopics) window.followedSuperTopics = [];

    // 从 api.db 与 LocalStorage 恢复签到记录，合并进 LumaDataHub 内存
    try {
      let checkinDbRecs = [];
      // 优先从 api.db 读取
      try {
        checkinDbRecs = await api.db.list("luma_checkin_records", { limit: 500 }) || [];
      } catch (e) {}
      // 兜底从 localStorage 同步备份读取
      if (checkinDbRecs.length === 0) {
        try {
          const raw = localStorage.getItem('luma_db_luma_checkin_records');
          if (raw) checkinDbRecs = JSON.parse(raw);
        } catch (e) {}
      }
      if (checkinDbRecs.length > 0 && window.LumaDataHub) {
        const map = window.LumaDataHub.getCheckinsMap() || {};
        let changed = false;
        checkinDbRecs.forEach(rec => {
          if (rec && rec.id) {
            const key = rec.id;
            const record = { ...rec };
            delete record.id;
            map[key] = { ...map[key], ...record };
            changed = true;
          }
        });
        if (changed) window.LumaDataHub.saveCheckinsMap(map);
      }
    } catch (e) {}

    const walletRec = await api.db.get("app_wallet", "vault_data");
    if (walletRec) window.currentWalletBalance = walletRec.balance || 0;

    const profileRec = await api.db.get("app_profile", "user_profile");
    if (profileRec) Object.assign(window.userProfileData, profileRec);

    const ledgerRec = await api.db.list("app_ledger", { limit: 500 }) || [];
    if (ledgerRec.length > 0) window.transactionLedger = ledgerRec;

    const guestbookRec = await api.db.list("guestbook", { limit: 500 }) || [];
    guestbookRec.forEach(item => {
      if (item.hostId) {
        if (!window.guestbookData[item.hostId]) window.guestbookData[item.hostId] = [];
        window.guestbookData[item.hostId].push(item);
      }
    });

    try {
      const chars = await api.characters.list();
      if (chars && chars.length > 0) {
        window.allCharacters = chars;
        // characters.list() 不含 tags，需通过 readRelations() 补充赛道标签
        try {
          const rel = await api.characters.readRelations({});
          if (rel && rel.characters) {
            const tagMap = {};
            rel.characters.forEach(r => { tagMap[r.id] = r.tags || []; });
            window.allCharacters.forEach(c => { if (tagMap[c.id]) c.tags = tagMap[c.id]; });
          }
        } catch (e2) {
          console.warn("读取角色赛道标签异常:", e2);
        }
      }
    } catch (e) {
      console.warn("读取角色列表异常:", e);
    }

    // 读取角色作息调度持久化
    try {
      const savedSchedules = await api.db.get("app_settings", "char_schedules");
      if (savedSchedules && typeof savedSchedules === 'object') {
        window.charSchedulesMap = savedSchedules;
      } else {
        window.charSchedulesMap = {};
      }
    } catch (e) {
      window.charSchedulesMap = {};
    }

    // 检查是否需要世界冷启动初始化（全新安装或首次运行）
    const isBootstrapped = Object.keys(window.charSchedulesMap || {}).length > 0;
    if (!isBootstrapped && window.allCharacters && window.allCharacters.length > 0) {
      if (typeof bootstrapWorldInitialState === 'function') {
        await bootstrapWorldInitialState(window.allCharacters, window.appParams);
      }
    }

    // 启动时后台异步预读各角色状态栏倾向值，缓存本地供轮询快速使用
    if (window.allCharacters && Array.isArray(window.allCharacters) && typeof readCharTendency === 'function') {
      try {
        await Promise.all(window.allCharacters.map(c => c && c.id ? readCharTendency(c.id) : Promise.resolve()));
      } catch (e) {}
    }
  } catch (e) {
    console.warn("DB读取警告:", e);
  }

  // 2. 离线时间差推演（若用户离线超过轮询时间，按离开时长自动模拟后台多轮轮询与到期下播）
  // 顺序要求：先做「历史场次真实结算 + 离线驱动热搜发帖」，再做「补跑轮询决策」，
  // 因为后者会把 last_poll_time 刷新为当前时间，必须最后执行，否则前者会读到 elapsed=0。
  try {
    if (window.OfflineSimulationEngine && typeof window.OfflineSimulationEngine.simulateOfflineCatchup === 'function') {
      await window.OfflineSimulationEngine.simulateOfflineCatchup();
    }
  } catch (e) {
    console.warn("[LUMA Live] 离线历史结算失败:", e);
  }
  try {
    if (typeof catchUpOfflinePolling === 'function') {
      await catchUpOfflinePolling();
    }
  } catch (e) {
    console.warn("[LUMA Live] 离线时间差推演失败:", e);
  }

  // 3. 同步个人资料
  await syncUserProfile();

  // 4. 加载社区动态
  await loadTrendsFromDb();

  // 5. 同步直播列表并渲染赛道
  await syncLiveSessions({ allowSpawn: true });

  // 6. 渲染各模块初始状态
  selectMainCategory('all');
  renderDualRankList();
  renderTrends();
  syncWalletDisplays();
  syncParamDisplays();
  renderPresetCategories();
  renderImagePromptEntries();

  // 7. 检查分享直达参数 (Deep link)
  checkDeepLinkParams();

  // 8. 启动 LUMA官方运营组·定时器轮询
  if (!window.__lumaLiveSyncInterval) {
    const pollMins = (window.appParams && window.appParams.opsPollInterval) || 3;
    window.__lumaLiveSyncInterval = setInterval(() => {
      syncLiveSessions({ allowSpawn: true });
    }, pollMins * 60 * 1000);
  }

  // 9. 启动全局动态时间刷新器：让帖子/评论的相对时间（刚刚/5分钟前）随真实时间流动
  if (window.TimeKeeper && typeof window.TimeKeeper.startDynamicTimeRefresher === 'function') {
    window.TimeKeeper.startDynamicTimeRefresher();
  }

  console.log('[LUMA Live] ✅ 启动成功');
}

// 初始化：DOM 就绪后自动启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', lumaInitApp);
} else {
  lumaInitApp();
}
window.lumaInitApp = lumaInitApp;
