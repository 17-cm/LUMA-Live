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

  if (tabId === 'live') {
    if (typeof renderLiveGrid === 'function') renderLiveGrid();
  } else if (tabId === 'trends') {
    if (typeof renderTrends === 'function') renderTrends();
  } else if (tabId === 'profile') {
    if (typeof renderDualRankList === 'function') renderDualRankList();
    if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
  } else if (tabId === 'settings') {
    syncParamDisplays();
    renderPresetCategories();
    renderImagePromptEntries();
    syncCustomApiModalFields();
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

function syncParamDisplays() {
  const p = window.appParams || {};
  const setVal = (id, val, textId, suffix = '') => {
    const input = document.getElementById(id);
    const text = document.getElementById(textId);
    if (input && val !== undefined) input.value = val;
    if (text && val !== undefined) text.textContent = `${val}${suffix}`;
  };

  setVal('paramMaxLiveDuration', p.maxLiveDuration || 120, 'valMaxLiveDuration', '分钟');
  setVal('paramMaxRestDuration', p.maxRestDuration || 360, 'valMaxRestDuration', '分钟');
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
    await api.db.create("app_settings", { id: "global_params", ...window.appParams }).catch(() => {
      api.db.update("app_settings", "global_params", window.appParams).catch(() => {});
    });
    api.ui.toast("系统运行参数已保存并落盘！");
  } catch (e) {
    api.ui.toast("保存成功");
  }
}
window.saveAllParamsExplicitly = saveAllParamsExplicitly;

// 4. 数据备份、导出与导入
function downloadAppZipFile() {
  api.ui.toast("正在打包小手机应用离线运行包...");
  try {
    const dataBlob = new Blob([JSON.stringify({
      version: "2.0.0",
      bundle: "luma_live_app",
      params: window.appParams,
      presets: window.presetCategories,
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

function exportAppDataFile() {
  const exportData = {
    exportTime: new Date().toISOString(),
    appParams: window.appParams,
    customApiConfig: window.customApiConfig,
    imageSettings: window.imageSettings,
    userProfileData: window.userProfileData,
    currentWalletBalance: window.currentWalletBalance,
    followedHosts: window.followedHosts,
    transactionLedger: window.transactionLedger,
    guestbookData: window.guestbookData
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `luma_live_data_${Date.now()}.json`;
  a.click();
  api.ui.toast("运行数据已导出为 JSON 文件");
}
window.exportAppDataFile = exportAppDataFile;

function triggerImportAppDataFile() {
  const input = document.getElementById('fileInputData');
  if (input) input.click();
}
window.triggerImportAppDataFile = triggerImportAppDataFile;

async function handleFileImportData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.appParams) Object.assign(window.appParams, data.appParams);
    if (data.customApiConfig) Object.assign(window.customApiConfig, data.customApiConfig);
    if (data.imageSettings) Object.assign(window.imageSettings, data.imageSettings);
    if (data.userProfileData) Object.assign(window.userProfileData, data.userProfileData);
    if (data.currentWalletBalance !== undefined) window.currentWalletBalance = data.currentWalletBalance;
    if (data.followedHosts) window.followedHosts = data.followedHosts;
    if (data.transactionLedger) window.transactionLedger = data.transactionLedger;
    if (data.guestbookData) window.guestbookData = data.guestbookData;

    try {
      await api.db.create("app_settings", { id: "global_params", ...window.appParams }).catch(() => {});
      await api.db.create("app_settings", { id: "custom_api_config", ...window.customApiConfig }).catch(() => {});
      await api.db.create("app_settings", { id: "image_settings", ...window.imageSettings }).catch(() => {});
      await api.db.create("app_wallet", { id: "vault_data", balance: window.currentWalletBalance }).catch(() => {});
      await api.db.create("app_profile", { id: "user_profile", ...window.userProfileData }).catch(() => {});
    } catch (dbErr) {}

    syncParamDisplays();
    if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
    if (typeof renderDualRankList === 'function') renderDualRankList();
    api.ui.toast("🎉 运行数据导入并恢复成功！");
  } catch (err) {
    api.ui.toast(`导入失败: ${err.message || '格式错误'}`);
  } finally {
    event.target.value = '';
  }
}
window.handleFileImportData = handleFileImportData;

function exportPresetsDataFile() {
  const exportData = {
    exportTime: new Date().toISOString(),
    presetCategories: window.presetCategories,
    imageSettings: window.imageSettings
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `luma_live_presets_${Date.now()}.json`;
  a.click();
  api.ui.toast("提示词预设已导出");
}
window.exportPresetsDataFile = exportPresetsDataFile;

function triggerImportPresetsDataFile() {
  const input = document.getElementById('fileInputPresets');
  if (input) input.click();
}
window.triggerImportPresetsDataFile = triggerImportPresetsDataFile;

async function handleFileImportPresets(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.presetCategories) window.presetCategories = data.presetCategories;
    if (data.imageSettings) window.imageSettings = data.imageSettings;

    try {
      await api.db.create("app_settings", { id: "preset_categories", data: window.presetCategories }).catch(() => {});
      await api.db.create("app_settings", { id: "image_settings", ...window.imageSettings }).catch(() => {});
    } catch (e) {}

    renderPresetCategories();
    renderImagePromptEntries();
    api.ui.toast("🎉 提示词预设导入成功！");
  } catch (err) {
    api.ui.toast(`导入失败: ${err.message || '格式错误'}`);
  } finally {
    event.target.value = '';
  }
}
window.handleFileImportPresets = handleFileImportPresets;

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
    const endpoint = url.replace(/\/+$/, '') + '/models';
    const res = await window.robustNetworkRequest({
      url: endpoint,
      headers: { 'Authorization': key ? `Bearer ${key}` : '' }
    });
    const data = res.json || (res.text ? JSON.parse(res.text) : null);
    const list = data?.data || [];
    if (list.length > 0 && selectModel) {
      selectModel.innerHTML = list.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
      api.ui.toast(`成功拉取 ${list.length} 个模型！`);
    } else {
      if (selectModel) selectModel.innerHTML = `<option value="gpt-3.5-turbo">gpt-3.5-turbo (默认)</option><option value="gpt-4o">gpt-4o</option><option value="deepseek-chat">deepseek-chat</option>`;
      api.ui.toast("已加载推荐模型列表");
    }
  } catch (err) {
    if (selectModel) selectModel.innerHTML = `<option value="gpt-3.5-turbo">gpt-3.5-turbo (默认)</option><option value="gpt-4o">gpt-4o</option><option value="deepseek-chat">deepseek-chat</option>`;
    api.ui.toast("接口响应超时，已载入标准预设模型");
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
    const endpoint = url.replace(/\/+$/, '') + '/chat/completions';
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
      api.ui.toast(`❌ 连接失败：HTTP 状态码 ${res.status}`);
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

  try {
    await api.db.create("app_settings", { id: "custom_api_config", ...window.customApiConfig }).catch(() => {
      api.db.update("app_settings", "custom_api_config", window.customApiConfig).catch(() => {});
    });
  } catch (e) {}

  closeCustomApiModal();
  syncCustomApiModalFields();
  api.ui.toast("自定义文本 API 配置已保存！");
}
window.saveCustomApiSettingsModal = saveCustomApiSettingsModal;

// 6. 自定义生图 API 弹窗与设置
function openCustomImageApiModal() {
  const modal = document.getElementById('customImageApiModal');
  if (!modal) return;
  const cfg = window.customApiConfig?.image || {};
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');

  if (inputUrl) inputUrl.value = cfg.url || '';
  if (inputKey) inputKey.value = cfg.key || '';
  if (selectModel && cfg.model) {
    selectModel.innerHTML = `<option value="${cfg.model}">${cfg.model}</option>`;
    selectModel.value = cfg.model;
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
  const selectModel = document.getElementById('selectImageApiModel');
  if (selectModel) {
    selectModel.innerHTML = `
      <option value="dall-e-3">dall-e-3 (OpenAI 官方)</option>
      <option value="stabilityai/stable-diffusion-3-5-large">SD 3.5 Large (硅基流动)</option>
      <option value="black-forest-labs/FLUX.1-schnell">FLUX.1 Schnell (硅基流动)</option>
    `;
    api.ui.toast("已加载常用生图模型预设");
  }
}
window.fetchImageApiModels = fetchImageApiModels;

async function testCustomImageApiConnection() {
  const inputUrl = document.getElementById('inputImageApiUrl');
  const inputKey = document.getElementById('inputImageApiKey');
  const selectModel = document.getElementById('selectImageApiModel');

  const url = inputUrl?.value.trim() || '';
  const key = inputKey?.value.trim() || '';
  const model = selectModel?.value || 'dall-e-3';

  if (!url) {
    api.ui.toast("请先填写生图 API URL");
    return;
  }

  api.ui.toast("正在测试连接生图模型接口...");
  try {
    const endpoint = url.replace(/\/+$/, '') + '/images/generations';
    const res = await window.robustNetworkRequest({
      url: endpoint,
      method: 'POST',
      headers: { 'Authorization': key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' },
      body: { model: model, prompt: 'A cute anime cat avatar', n: 1, size: '1024x1024' }
    });
    if (res.ok) {
      api.ui.toast("🎉 生图 API 连接测试成功！");
    } else {
      api.ui.toast(`❌ 生图连接响应: HTTP ${res.status}`);
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

  if (!window.customApiConfig) window.customApiConfig = {};
  if (!window.customApiConfig.image) window.customApiConfig.image = {};

  window.customApiConfig.image.url = inputUrl?.value.trim() || '';
  window.customApiConfig.image.key = inputKey?.value.trim() || '';
  window.customApiConfig.image.model = selectModel?.value || 'dall-e-3';

  try {
    await api.db.create("app_settings", { id: "custom_api_config", ...window.customApiConfig }).catch(() => {
      api.db.update("app_settings", "custom_api_config", window.customApiConfig).catch(() => {});
    });
  } catch (e) {}

  closeCustomImageApiModal();
  syncCustomApiModalFields();
  api.ui.toast("自定义生图 API 配置已保存！");
}
window.saveCustomImageApiSettingsModal = saveCustomImageApiSettingsModal;

function toggleGlobalModelSwitch(checked) {
  if (!window.customApiConfig) window.customApiConfig = {};
  window.customApiConfig.enableGlobalModel = !!checked;
  api.db.create("app_settings", { id: "custom_api_config", ...window.customApiConfig }).catch(() => {});
  api.ui.toast(checked ? "已启用全局文本模型" : "已切换为自定义文本模型");
}
window.toggleGlobalModelSwitch = toggleGlobalModelSwitch;

function toggleGlobalImageModelSwitch(checked) {
  if (!window.customApiConfig) window.customApiConfig = {};
  window.customApiConfig.enableGlobalImageModel = !!checked;
  api.db.create("app_settings", { id: "custom_api_config", ...window.customApiConfig }).catch(() => {});
  api.ui.toast(checked ? "已启用全局生图模型" : "已切换为自定义生图模型");
}
window.toggleGlobalImageModelSwitch = toggleGlobalImageModelSwitch;

function syncCustomApiModalFields() {
  const cfg = window.customApiConfig || {};
  const statusText = document.getElementById('statusCustomApi');
  const statusImg = document.getElementById('statusCustomImageApi');

  if (statusText) {
    if (cfg.enableGlobalModel) statusText.textContent = '当前模式: 全局宿主模型';
    else if (cfg.text?.model) statusText.textContent = `当前模型: ${cfg.text.model}`;
    else statusText.textContent = '支持硅基流动 / DeepSeek / 自定义接口';
  }
  if (statusImg) {
    if (cfg.enableGlobalImageModel) statusImg.textContent = '当前模式: 全局生图模型';
    else if (cfg.image?.model) statusImg.textContent = `当前生图模型: ${cfg.image.model}`;
    else statusImg.textContent = 'SD / DALL-E / FLUX 格式支持';
  }
}

// 7. 生图参数与修饰词管理
function handleImageSizeChange(val) {
  if (!window.imageSettings) window.imageSettings = {};
  window.imageSettings.size = val;
  const ratioEntry = (window.imageSettings.prompts || []).find(p => p.id === 'ratio_prompt');
  if (ratioEntry) {
    ratioEntry.content = val === '9:16' ? '竖屏 9:16 构图，vertical 9:16 composition' : val === '16:9' ? '横屏 16:9 构图，widescreen 16:9 composition' : '正方形 1:1 构图，square 1:1 composition';
    renderImagePromptEntries();
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
    renderImagePromptEntries();
  }
}
window.removeImagePromptEntry = removeImagePromptEntry;

async function saveImageSettingsExplicitly() {
  try {
    await api.db.create("app_settings", { id: "image_settings", ...window.imageSettings }).catch(() => {
      api.db.update("app_settings", "image_settings", window.imageSettings).catch(() => {});
    });
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
  const cats = window.presetCategories || {};

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
  const cat = window.presetCategories?.[catKey];
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
  const cat = window.presetCategories[currentActivePresetCatKey];
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
  if (currentActivePresetCatKey && window.presetCategories[currentActivePresetCatKey]?.entries?.[idx]) {
    window.presetCategories[currentActivePresetCatKey].entries[idx].title = val;
  }
}
window.updateCurrentCategoryEntryTitle = updateCurrentCategoryEntryTitle;

function updateCurrentCategoryEntryContent(idx, val) {
  if (currentActivePresetCatKey && window.presetCategories[currentActivePresetCatKey]?.entries?.[idx]) {
    window.presetCategories[currentActivePresetCatKey].entries[idx].content = val;
  }
}
window.updateCurrentCategoryEntryContent = updateCurrentCategoryEntryContent;

function addNewPromptEntryToCurrentCategory() {
  if (!currentActivePresetCatKey || !window.presetCategories[currentActivePresetCatKey]) return;
  if (!window.presetCategories[currentActivePresetCatKey].entries) {
    window.presetCategories[currentActivePresetCatKey].entries = [];
  }
  window.presetCategories[currentActivePresetCatKey].entries.push({
    id: `entry_${Date.now()}`,
    title: '新增提示词条目',
    content: '请根据设定执行输出。\\n输出格式 JSON：{\\n  "text": "内容"\\n}'
  });
  renderCurrentCategoryPromptEntries();
}
window.addNewPromptEntryToCurrentCategory = addNewPromptEntryToCurrentCategory;

function removeCurrentCategoryEntry(idx) {
  if (currentActivePresetCatKey && window.presetCategories[currentActivePresetCatKey]?.entries) {
    window.presetCategories[currentActivePresetCatKey].entries.splice(idx, 1);
    renderCurrentCategoryPromptEntries();
  }
}
window.removeCurrentCategoryEntry = removeCurrentCategoryEntry;

async function saveCurrentCategoryPresets() {
  try {
    await api.db.create("app_settings", { id: "preset_categories", data: window.presetCategories }).catch(() => {
      api.db.update("app_settings", "preset_categories", { data: window.presetCategories }).catch(() => {});
    });
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
// 10. 【版本更新与 Git 仓库直连系统】
// =========================================================================
const APP_CURRENT_VERSION = 'v3.4.1';
const DEFAULT_GIT_REPO = '17-cm/LUMA-Live';
const DEFAULT_GIT_BRANCH = 'main';

let gitUpdateState = {
  currentVersion: APP_CURRENT_VERSION,
  latestVersion: APP_CURRENT_VERSION,
  localCommit: 'v3.4.1-main',
  remoteCommit: '',
  hasUpdate: false,
  updateLog: '',
  repoUrl: DEFAULT_GIT_REPO,
  branch: DEFAULT_GIT_BRANCH,
  lastCheckTime: null,
  isChecking: false
};
window.gitUpdateState = gitUpdateState;

function renderGitUpdateButton() {
  const btn = document.getElementById('btnVersionUpdateCard');
  const btnText = document.getElementById('versionUpdateBtnText');
  const badge = document.getElementById('versionUpdateBadge');
  if (!btn) return;

  if (gitUpdateState.isChecking) {
    btn.className = 'luxe-card relative w-full py-3.5 text-center text-xs font-black text-slate-400 border-slate-200/60 active:bg-slate-50 transition cursor-pointer';
    if (btnText) btnText.textContent = '版本更新';
    if (badge) {
      badge.className = 'absolute right-3 bottom-1.5 text-[9px] font-mono text-slate-400 font-normal';
      badge.textContent = '检测中...';
    }
    return;
  }

  if (gitUpdateState.hasUpdate) {
    // 发现更新：绿色文字，绿色边框与点击反馈，右下角小版本号也呈绿色
    btn.className = 'luxe-card relative w-full py-3.5 text-center text-xs font-black text-emerald-600 border-emerald-200/60 active:bg-emerald-50 transition cursor-pointer';
    if (btnText) {
      btnText.textContent = '版本更新';
    }
    if (badge) {
      badge.className = 'absolute right-3 bottom-1.5 text-[9px] font-mono text-emerald-600 font-bold';
      badge.textContent = gitUpdateState.latestVersion;
    }
  } else {
    // 无更新：与清除缓存完全一致的玫瑰红文字与淡边框
    btn.className = 'luxe-card relative w-full py-3.5 text-center text-xs font-black text-rose-600 border-rose-200/60 active:bg-rose-50 transition cursor-pointer';
    if (btnText) {
      btnText.textContent = '版本更新';
    }
    if (badge) {
      badge.className = 'absolute right-3 bottom-1.5 text-[9px] font-mono text-rose-400 font-normal';
      badge.textContent = gitUpdateState.currentVersion;
    }
  }
}
window.renderGitUpdateButton = renderGitUpdateButton;

async function checkGitRepoUpdate(silent = false) {
  if (gitUpdateState.isChecking) return;
  gitUpdateState.isChecking = true;
  renderGitUpdateButton();

  const repo = (gitUpdateState.repoUrl || DEFAULT_GIT_REPO).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const branch = (gitUpdateState.branch || DEFAULT_GIT_BRANCH).trim();
  
  try {
    let remoteVer = null;
    let remoteCommit = null;
    let updateMessage = '';
    let fetchErrorReason = '';

    const reqHeaders = {
      'Accept': 'application/vnd.github.v3+json'
    };

    // 1. 尝试从 GitHub Commits 接口拉取指定 branch 的最新 Commit
    try {
      const comRes = await robustNetworkRequest({
        url: `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
        method: 'GET',
        headers: reqHeaders
      });
      if (comRes && comRes.ok && comRes.json && Array.isArray(comRes.json) && comRes.json[0]) {
        const c = comRes.json[0];
        remoteCommit = c.sha ? c.sha.slice(0, 7) : null;
        updateMessage = c.commit?.message || `最新提交代码更新`;
      } else if (comRes && comRes.status === 404) {
        fetchErrorReason = '404_private_or_not_found';
      }
    } catch (e) {}

    // 2. 尝试从 GitHub Contents API 或 raw content 拉取指定 branch 的 manifest.json
    try {
      // 方式 A: GitHub Contents API
      const contentRes = await robustNetworkRequest({
        url: `https://api.github.com/repos/${repo}/contents/manifest.json?ref=${encodeURIComponent(branch)}`,
        method: 'GET',
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
      });
      let mData = contentRes?.json;
      if (!mData && contentRes?.text) {
        try { mData = JSON.parse(contentRes.text); } catch (e) {}
      }
      
      // 方式 B: raw content
      if (!mData || !mData.version) {
        const manifestRes = await robustNetworkRequest({
          url: `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/manifest.json`,
          method: 'GET'
        });
        mData = manifestRes?.json || (manifestRes?.text ? JSON.parse(manifestRes.text) : null);
      }

      if (mData && mData.version) {
        const rawVer = String(mData.version).trim();
        remoteVer = rawVer.startsWith('v') ? rawVer : `v${rawVer}`;
        if (mData.description) {
          updateMessage = mData.description;
        }
      }
    } catch (e) {}

    // 3. 备用：若未读取到则尝试从 metadata.json 解析
    if (!remoteVer) {
      try {
        const metaRes = await robustNetworkRequest({
          url: `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/metadata.json`,
          method: 'GET'
        });
        const metaData = metaRes?.json || (metaRes?.text ? JSON.parse(metaRes.text) : null);
        if (metaData && metaData.description) {
          const match = String(metaData.description).match(/v\d+\.\d+\.\d+/i);
          if (match) remoteVer = match[0];
        }
      } catch (e) {}
    }

    // 4. 尝试从 Releases 接口拉取最新 Release
    if (!remoteVer) {
      try {
        const relRes = await robustNetworkRequest({
          url: `https://api.github.com/repos/${repo}/releases/latest`,
          method: 'GET',
          headers: reqHeaders
        });
        if (relRes && relRes.ok && relRes.json) {
          remoteVer = relRes.json.tag_name || relRes.json.name;
          if (!updateMessage) updateMessage = relRes.json.body || relRes.json.name || '';
        }
      } catch (e) {}
    }

    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    gitUpdateState.lastCheckTime = nowStr;

    if (remoteVer || remoteCommit) {
      gitUpdateState.remoteCommit = remoteCommit ? `${remoteCommit} (${branch})` : (remoteVer ? `${remoteVer}-${branch}` : branch);
      gitUpdateState.latestVersion = remoteVer || (remoteCommit ? `v3.4.${remoteCommit}` : APP_CURRENT_VERSION);
      gitUpdateState.updateLog = updateMessage || '检测到更新。';

      // 判定是否有新版本 (版本号不同 或 Commit 产生变化)
      const isNewVer = remoteVer && remoteVer.trim() !== APP_CURRENT_VERSION;
      const isNewCommit = remoteCommit && gitUpdateState.localCommit && !gitUpdateState.localCommit.includes(remoteCommit);
      
      gitUpdateState.hasUpdate = Boolean(isNewVer || isNewCommit);

      if (gitUpdateState.hasUpdate) {
        if (!silent && api.ui?.toast) {
          api.ui.toast(`🎉 发现新版本 ${gitUpdateState.latestVersion}！`);
        }
      } else {
        if (!silent && api.ui?.toast) {
          api.ui.toast(`当前已是最新版本 (${gitUpdateState.currentVersion})`);
        }
      }
    } else {
      gitUpdateState.latestVersion = APP_CURRENT_VERSION;
      gitUpdateState.hasUpdate = false;
      if (!silent && api.ui?.toast) {
        if (fetchErrorReason === '404_private_or_not_found') {
          api.ui.toast(`未找到仓库，若仓库为私有(Private)请设为公开(Public)`);
        } else {
          api.ui.toast(`当前已是最新版本 (${gitUpdateState.currentVersion})`);
        }
      }
    }
  } catch (err) {
    console.warn("检查 Git 更新异常:", err);
    if (!silent && api.ui?.toast) {
      api.ui.toast("检测更新超时，请稍后重试");
    }
  } finally {
    gitUpdateState.isChecking = false;
    renderGitUpdateButton();
  }
}
window.checkGitRepoUpdate = checkGitRepoUpdate;

async function handleVersionUpdateClick() {
  if (gitUpdateState.hasUpdate) {
    if (api.ui?.toast) api.ui.toast(`🎉 已检测到最新版本 (${gitUpdateState.latestVersion})！`);
    
    gitUpdateState.currentVersion = gitUpdateState.latestVersion;
    if (gitUpdateState.remoteCommit) {
      gitUpdateState.localCommit = gitUpdateState.remoteCommit;
    }
    gitUpdateState.hasUpdate = false;

    await api.db.create("app_settings", {
      id: "git_repo_config",
      repoUrl: gitUpdateState.repoUrl,
      branch: gitUpdateState.branch,
      installedVersion: gitUpdateState.currentVersion,
      installedCommit: gitUpdateState.localCommit,
      lastUpdated: Date.now()
    }).catch(() => {
      api.db.update("app_settings", "git_repo_config", {
        repoUrl: gitUpdateState.repoUrl,
        branch: gitUpdateState.branch,
        installedVersion: gitUpdateState.currentVersion,
        installedCommit: gitUpdateState.localCommit,
        lastUpdated: Date.now()
      }).catch(() => {});
    });

    renderGitUpdateButton();
  } else {
    // 没更新，直接提示已是最新并触发重新检测
    if (api.ui?.toast) api.ui.toast(`当前已是最新版本 (${gitUpdateState.currentVersion})`);
    checkGitRepoUpdate(true);
  }
}
window.handleVersionUpdateClick = handleVersionUpdateClick;

// =========================================================================
// 11. 数据备份与离线导出系统
// =========================================================================
function exportAppDataFile() {
  try {
    const backupData = {
      version: APP_CURRENT_VERSION,
      exportTime: new Date().toISOString(),
      appParams: window.appParams || {},
      customApiConfig: window.customApiConfig || {},
      imageSettings: window.imageSettings || {},
      presetCategories: window.presetCategories || {},
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
      await api.db.create("app_settings", { id: "global_params", ...data.appParams }).catch(() => {});
    }
    if (data.presetCategories) {
      window.presetCategories = data.presetCategories;
      await api.db.create("app_settings", { id: "preset_categories", data: data.presetCategories }).catch(() => {});
    }
    if (data.customApiConfig) {
      window.customApiConfig = data.customApiConfig;
      await api.db.create("app_settings", { id: "custom_api_config", ...data.customApiConfig }).catch(() => {});
    }
    if (data.imageSettings) {
      window.imageSettings = data.imageSettings;
      await api.db.create("app_settings", { id: "image_settings", ...data.imageSettings }).catch(() => {});
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
    const blob = new Blob([JSON.stringify(window.presetCategories || {}, null, 2)], { type: 'application/json' });
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
    window.presetCategories = data;
    await api.db.create("app_settings", { id: "preset_categories", data: data }).catch(() => {});
    renderPresetCategories();
    if (api.ui?.toast) api.ui.toast("提示词预设导入成功！");
  } catch (err) {
    if (api.ui?.toast) api.ui.toast("提示词文件解析失败");
  }
  e.target.value = '';
}
window.handleFileImportPresets = handleFileImportPresets;

function downloadAppZipFile() {
  exportAppDataFile();
}
window.downloadAppZipFile = downloadAppZipFile;

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
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof registerAiPhoneToolHandlers === 'function') {
    registerAiPhoneToolHandlers();
  }

  // 1. 初始化数据库及本地持久化
  try {
    const settingsRec = await api.db.get("app_settings", "global_params");
    if (settingsRec) Object.assign(window.appParams, settingsRec);

    const apiCfg = await api.db.get("app_settings", "custom_api_config");
    if (apiCfg) Object.assign(window.customApiConfig, apiCfg);

    const imgCfg = await api.db.get("app_settings", "image_settings");
    if (imgCfg) Object.assign(window.imageSettings, imgCfg);

    const catsRec = await api.db.get("app_settings", "preset_categories");
    if (catsRec?.data) window.presetCategories = catsRec.data;

    const followsRec = await api.db.list("follows") || [];
    window.followedHosts = followsRec.map(f => f.id);

    const walletRec = await api.db.get("app_wallet", "vault_data");
    if (walletRec) window.currentWalletBalance = walletRec.balance || 0;

    const profileRec = await api.db.get("app_profile", "user_profile");
    if (profileRec) Object.assign(window.userProfileData, profileRec);

    const ledgerRec = await api.db.list("app_ledger") || [];
    if (ledgerRec.length > 0) window.transactionLedger = ledgerRec;

    const gitCfg = await api.db.get("app_settings", "git_repo_config");
    if (gitCfg) {
      if (gitCfg.repoUrl) window.gitUpdateState.repoUrl = gitCfg.repoUrl;
      if (gitCfg.branch) window.gitUpdateState.branch = gitCfg.branch;
      if (gitCfg.installedVersion) window.gitUpdateState.currentVersion = gitCfg.installedVersion;
      if (gitCfg.installedCommit) window.gitUpdateState.localCommit = gitCfg.installedCommit;
    }

    const guestbookRec = await api.db.list("guestbook") || [];
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
      }
    } catch (e) {
      console.warn("读取角色列表异常:", e);
    }
  } catch (e) {
    console.warn("DB读取警告:", e);
  }

  // 2. 同步个人资料
  if (typeof syncUserProfile === 'function') await syncUserProfile();

  // 3. 加载社区动态
  if (typeof loadTrendsFromDb === 'function') await loadTrendsFromDb();

  // 4. 同步直播列表并渲染赛道
  if (typeof syncLiveSessions === 'function') await syncLiveSessions({ allowSpawn: true });

  // 5. 渲染各模块初始状态
  if (typeof selectMainCategory === 'function') selectMainCategory('all');
  if (typeof renderDualRankList === 'function') renderDualRankList();
  if (typeof renderTrends === 'function') renderTrends();
  if (typeof syncWalletDisplays === 'function') syncWalletDisplays();
  syncParamDisplays();
  renderPresetCategories();
  renderImagePromptEntries();
  renderGitUpdateButton();

  // 6. 检查分享直达参数 (Deep link)
  if (typeof checkDeepLinkParams === 'function') checkDeepLinkParams();

  // 7. 启动时后台静默检查 Git 仓库版本更新
  setTimeout(() => {
    checkGitRepoUpdate(true);
  }, 1200);

  // 8. 启动周期性作息推演定时器 (每 30 秒轮询)
  setInterval(() => {
    if (typeof syncLiveSessions === 'function') {
      syncLiveSessions({ allowSpawn: true });
    }
  }, 30000);
});
