// =========================================================================
// 【弹窗层】所有弹窗 HTML 统一注入
// =========================================================================

(function injectModals() {
  const modalsHTML = `
<div id="giftTrayModal" class="gift-sheet-modal">
        <div class="flex justify-between items-center pb-2.5 border-b border-white/10 mb-2.5 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div>
              <h4 class="text-xs font-bold text-white">赠送支持礼物</h4>
              <p class="text-[10px] text-amber-300 font-bold mt-0.5" id="giftWalletBalance">💎 0 LUMA 币</p>
            </div>
            <button onclick="openRechargeModal()" class="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-black shadow-sm active:scale-95 transition flex items-center gap-1">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>充值</span>
            </button>
          </div>
          <button onclick="toggleGiftTray()" class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-black">✕</button>
        </div>

        <!-- 数量快捷选择框 (1, 10, 52, 99, 1314) -->
        <div class="grid grid-cols-5 gap-1.5 mb-2.5 flex-shrink-0">
          <button onclick="selectGiftQuantity(1)" id="gift-qty-1" class="gift-qty-btn active">1</button>
          <button onclick="selectGiftQuantity(10)" id="gift-qty-10" class="gift-qty-btn">10</button>
          <button onclick="selectGiftQuantity(52)" id="gift-qty-52" class="gift-qty-btn">52</button>
          <button onclick="selectGiftQuantity(99)" id="gift-qty-99" class="gift-qty-btn">99</button>
          <button onclick="selectGiftQuantity(1314)" id="gift-qty-1314" class="gift-qty-btn">1314</button>
        </div>

        <div class="gift-scroll-grid" id="giftScrollGrid"></div>
      </div>
<div id="editProfileModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 class="text-xs font-black text-slate-900">✏️ 编辑个人资料</h3>
          <p class="text-[9px] text-slate-400">修改后立即保存至本地数据库</p>
        </div>
        <button onclick="closeEditProfileModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>
      <div class="space-y-2.5">
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">星瞳 UID</label>
          <input id="editInputUID" value="88291048" class="input-ins text-xs">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">IP 属地</label>
          <input id="editInputIP" value="LUMA" class="input-ins text-xs">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">称号头衔</label>
          <input id="editInputTag" value="新人主播" class="input-ins text-xs font-bold text-rose-600">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">个性签名</label>
          <textarea id="editInputBio" rows="3" class="input-ins text-xs leading-relaxed">白天是理智社畜，深夜是某主播的头号榜一大哥。理性看播，感性砸车。</textarea>
        </div>
        <button onclick="saveUserProfileEdits()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow">
          保存资料
        </button>
      </div>
    </div>
  </div>
<div id="customApiModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 class="text-xs font-black text-slate-900">自定义文本API</h3>
          <p class="text-[9px] text-slate-400">支持硅基流动 / DeepSeek / 自定义接口</p>
        </div>
        <button onclick="closeCustomApiModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>
      <div class="space-y-2.5">
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">选择API类型</label>
          <select id="selectApiType" onchange="handleApiTypeChange(this.value)" class="input-ins text-xs font-bold">
            <option value="siliconflow">硅基流动</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">自定义接口</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">API Base URL</label>
          <input id="inputApiUrl" placeholder="不填则默认 (https://api.siliconflow.cn/v1)" class="input-ins text-xs">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">API Key</label>
          <input id="inputApiKey" type="password" placeholder="sk-..." class="input-ins text-xs">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">选择模型</label>
          <select id="selectApiModel" class="input-ins text-xs font-bold">
            <option value="">默认宿主模型</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button onclick="fetchOpenAIModels()" class="btn-action flex-1 justify-center !py-2 text-xs font-bold">拉取模型</button>
          <button onclick="testCustomApiConnection()" class="btn-action flex-1 justify-center !py-2 text-xs font-bold">🔗 测试连接</button>
        </div>
        <button onclick="saveCustomApiSettingsModal()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow">保存设置</button>
      </div>
    </div>
  </div>
<div id="customImageApiModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 class="text-xs font-black text-slate-900">自定义生图API</h3>
          <p class="text-[9px] text-slate-400">用于召唤野生主播</p>
        </div>
        <button onclick="closeCustomImageApiModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>
      <div class="space-y-2.5">
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">生图 API URL</label>
          <input id="inputImageApiUrl" placeholder="https://api.example.com/v1" class="input-ins text-xs">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 block mb-1">API Key</label>
          <input id="inputImageApiKey" type="password" placeholder="sk-..." class="input-ins text-xs">
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[10px] font-bold text-slate-500">生图模型 (选择或手动输入)</label>
            <span class="text-[9px] text-emerald-600 font-bold cursor-pointer" onclick="toggleManualImageModelInput()">手动输入</span>
          </div>
          <select id="selectImageApiModel" onchange="handleImageModelSelect(this.value)" class="input-ins text-xs font-bold">
            <option value="dall-e-3">dall-e-3 (默认)</option>
          </select>
          <input id="inputManualImageModel" placeholder="例如: flux-schnell / stable-diffusion-3" class="input-ins text-xs font-bold mt-1.5 hidden">
        </div>
        <div class="flex gap-2">
          <button onclick="fetchImageApiModels()" class="btn-action flex-1 justify-center !py-2 text-xs font-bold">拉取模型</button>
          <button onclick="testCustomImageApiConnection()" class="btn-action flex-1 justify-center !py-2 text-xs font-bold">🔗 测试连接</button>
        </div>
        <button onclick="saveCustomImageApiSettingsModal()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow">保存设置</button>
      </div>
    </div>
  </div>
<div id="sharePickerModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 class="text-xs font-black text-slate-900">分享给好友 / 群聊</h3>
          <p class="text-[9px] text-slate-400">点击头像即可直接将小卡片发给 TA</p>
        </div>
        <button onclick="closeSharePickerModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>
      <div id="shareTargetListContainer" class="max-h-60 overflow-y-auto space-y-2 no-scrollbar pr-1"></div>
    </div>
  </div>
<div id="profileEditModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3 max-h-[85vh] overflow-y-auto no-scrollbar">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-black text-slate-900">编辑主播档案</h3>
        <button onclick="closeProfileEditModal()" class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center active:scale-90 transition" title="关闭">
          <svg class="w-3.5 h-3.5 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div>
        <label class="text-[10px] font-bold text-slate-500">个人认证</label>
        <input id="peVerifyTitle" class="input-ins w-full mt-1" placeholder="如：LUMA 年度认证大V主播 · 音乐主唱">
      </div>
      <div>
        <label class="text-[10px] font-bold text-slate-500">个性签名</label>
        <input id="peBio" class="input-ins w-full mt-1" placeholder="一句话介绍自己">
      </div>
      <div>
        <label class="text-[10px] font-bold text-slate-500">IP属地</label>
        <input id="peIpLocation" class="input-ins w-full mt-1" placeholder="如：广东 / 赛博星云-新京都">
      </div>
      <div>
        <label class="text-[10px] font-bold text-slate-500">粉丝团（只能修改前缀，"粉丝团"三个字固定）</label>
        <div class="flex items-center gap-2 mt-1">
          <input id="peFanClubPrefix" class="input-ins flex-1" placeholder="粉丝团前缀">
          <span class="text-xs font-black text-rose-600 bg-rose-50 px-3 py-2.5 rounded-xl border border-rose-100 flex-shrink-0">粉丝团</span>
        </div>
      </div>
      <div>
        <label class="text-[10px] font-bold text-slate-500">四个标签（带 #）</label>
        <div class="space-y-2 mt-1">
          <input id="peTag1" class="input-ins w-full" placeholder="#标签一">
          <input id="peTag2" class="input-ins w-full" placeholder="#标签二">
          <input id="peTag3" class="input-ins w-full" placeholder="#标签三">
          <input id="peTag4" class="input-ins w-full" placeholder="#标签四">
        </div>
      </div>

      <button onclick="spSaveProfileEdit()" class="btn-brand w-full py-3">保存</button>
    </div>
  </div>
<div id="presetCategoryModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 class="text-xs font-black text-slate-900" id="presetModalCategoryTitle">预设条目管理</h3>
          <p class="text-[9px] text-slate-400">点击左侧箭头展开编辑，修改立即生效</p>
        </div>
        <button onclick="closePresetCategoryModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>
      <div id="promptEntriesContainer" class="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-2 no-scrollbar"></div>
      <button onclick="addNewPromptEntryToCurrentCategory()" class="btn-action w-full justify-center !py-2 text-xs !border-dashed !border-purple-300 text-purple-600">
        <span>+ 添加提示词条目</span>
      </button>
      <button onclick="saveCurrentCategoryPresets()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow">
        保存当前分类设置
      </button>
    </div>
  </div>
<div id="rechargeModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-4 max-w-sm">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-500">
            <svg class="w-5 h-5 fill-amber-400 stroke-amber-500 stroke-[1.5]" viewBox="0 0 24 24"><polygon points="6 3 18 3 22 9 12 22 2 9 6 3"></polygon></svg>
          </div>
          <div>
            <h3 class="text-xs font-black text-slate-900">LUMA 充值中心</h3>
            <p class="text-[9px] text-slate-400">即充即到 · 安全保障</p>
          </div>
        </div>
        <button onclick="closeRechargeModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold active:scale-90 transition">✕</button>
      </div>

      <!-- 当前余额卡片 -->
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 p-3.5 rounded-2xl text-white flex items-center justify-between border border-slate-700 shadow-sm">
        <div>
          <span class="text-[9px] text-amber-300 font-bold">当前账户余额</span>
          <div class="flex items-baseline gap-1 mt-0.5">
            <span class="text-lg font-black text-amber-400" id="rechargeModalBalance">0</span>
            <span class="text-[10px] text-slate-300">LUMA 币</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[8px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-400/30">1元 = 10币</span>
        </div>
      </div>

      <!-- 充值档位网格 -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-700">
          <span>选择充值面额</span>
          <span class="text-[9px] text-rose-500">限时赠送福利</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <!-- 60币 -->
          <div onclick="selectRechargeTier(60, 6, this)" class="recharge-tier-card active">
            <span class="text-xs font-black text-slate-900">60 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥6.00</span>
          </div>
          <!-- 300币 -->
          <div onclick="selectRechargeTier(300, 30, this)" class="recharge-tier-card">
            <span class="text-xs font-black text-slate-900">300 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥30.00</span>
          </div>
          <!-- 680币 -->
          <div onclick="selectRechargeTier(680, 68, this)" class="recharge-tier-card relative">
            <span class="absolute -top-1.5 -right-1 bg-rose-500 text-white text-[7px] font-black px-1 rounded-full">+30币</span>
            <span class="text-xs font-black text-slate-900">680 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥68.00</span>
          </div>
          <!-- 1280币 -->
          <div onclick="selectRechargeTier(1280, 128, this)" class="recharge-tier-card relative">
            <span class="absolute -top-1.5 -right-1 bg-rose-500 text-white text-[7px] font-black px-1 rounded-full">+80币</span>
            <span class="text-xs font-black text-slate-900">1280 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥128.00</span>
          </div>
          <!-- 3280币 -->
          <div onclick="selectRechargeTier(3280, 328, this)" class="recharge-tier-card relative">
            <span class="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[7px] font-black px-1 rounded-full">+280币</span>
            <span class="text-xs font-black text-slate-900">3280 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥328.00</span>
          </div>
          <!-- 6480币 -->
          <div onclick="selectRechargeTier(6480, 648, this)" class="recharge-tier-card relative">
            <span class="absolute -top-1.5 -right-1 bg-gradient-to-r from-purple-500 to-rose-500 text-white text-[7px] font-black px-1 rounded-full">+680币</span>
            <span class="text-xs font-black text-slate-900">6480 币</span>
            <span class="text-[10px] text-slate-500 font-bold">¥648.00</span>
          </div>
        </div>
      </div>

      <!-- 自定义金额 -->
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-700">自定义充值币数</label>
        <div class="flex gap-2">
          <input id="inputCustomRechargeAmount" type="number" min="1" placeholder="输入 LUMA 币数 (如 5000)" class="input-ins flex-1 text-xs" oninput="handleCustomRechargeInput(this.value)">
          <button onclick="applyCustomRechargeTier()" class="btn-action text-xs !py-1 px-3">确定</button>
        </div>
      </div>

      <!-- 支付方式选择 -->
      <div class="space-y-1.5 pt-1">
        <span class="text-[10px] font-bold text-slate-700">选择支付方式</span>
        <div class="grid grid-cols-2 gap-2">
          <label class="pay-method-radio active flex items-center gap-2 p-2 rounded-xl border border-emerald-500/40 bg-emerald-50/50 cursor-pointer">
            <input type="radio" name="pay_method" value="wechat" checked class="hidden">
            <span class="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold">✓</span>
            <span class="text-xs font-bold text-slate-800">微信支付</span>
          </label>
          <label class="pay-method-radio flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer">
            <input type="radio" name="pay_method" value="alipay" class="hidden">
            <span class="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">支</span>
            <span class="text-xs font-bold text-slate-800">支付宝</span>
          </label>
        </div>
      </div>

      <!-- 立即充值按钮 -->
      <div class="pt-2">
        <button onclick="submitExecuteRecharge()" class="btn-brand w-full py-2.5 justify-center text-xs font-black shadow-lg shadow-rose-200 flex items-center gap-1.5" id="btnSubmitRecharge">
          <span>确认充值 60 币 (¥6.00)</span>
        </button>
      </div>
    </div>
  </div>
<div id="resetConfirmModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-4 max-w-xs">
      <div class="flex items-center gap-3 text-rose-600">
        <div class="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 flex-shrink-0">
          <svg class="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div>
          <h3 class="text-xs font-black text-slate-900">清除缓存确认</h3>
          <p class="text-[9px] text-slate-400">操作提示·初始化应用</p>
        </div>
      </div>
      <div class="bg-rose-50/70 p-3 rounded-2xl border border-rose-100/80 text-xs text-rose-900 leading-relaxed">
        <p class="font-bold mb-1">是否清除所有本地缓存？建议先导出备份！</p>
        <p class="text-[10px] text-rose-700/80">此操作将清空所有直播间、私有预设、沙盒参数设置、生图配置与钱包数据，并将应用初始化为初始状态。</p>
      </div>
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button onclick="closeResetConfirmModal()" class="btn-action justify-center !py-2 text-xs font-bold text-slate-600">取消</button>
        <button onclick="executeConfirmResetAppData()" class="btn-brand justify-center !py-2 text-xs font-bold !bg-rose-600 shadow-rose-200">确认清除</button>
      </div>
    </div>
  </div>
<div id="forumAuthModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-4 max-w-sm" id="forumAuthModalBody"></div>
  </div>
<div id="voucherManageModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-4 max-w-sm" id="voucherManageModalBody"></div>
  </div>
<div id="adminManageModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-4 max-w-sm" id="adminManageModalBody"></div>
  </div>
<div id="trendDetailModal" class="full-page-view hidden !z-[110]">
    <div class="page-nav-bar">
      <button onclick="closeTrendDetail()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="text-center">
        <h3 class="text-xs font-black text-slate-900 leading-none">动态正文</h3>
        <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 block">POST DETAIL & COMMENTS</span>
      </div>
      <button onclick="handleShareCurrentPost()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm active:scale-90 transition">
        <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
      </button>
    </div>

    <!-- 详情主滚动区 -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-4 pb-28 space-y-3.5" id="trendDetailContent">
      <!-- 动态填充正文与评论树 -->
    </div>

    <!-- 底部常驻评论回复输入栏 -->
    <div class="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-slate-200/80 flex items-center gap-2 z-20 shadow-lg">
      <div class="flex-1 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
        <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <input id="inputTrendComment" placeholder="发条温暖善意的评论..." class="bg-transparent border-none outline-none text-xs w-full text-slate-800 placeholder-slate-400" onkeydown="if(event.key==='Enter') submitTrendComment()">
      </div>
      <button onclick="submitTrendComment()" class="btn-brand text-xs !py-1.5 !px-3.5 shadow-sm">
        发送
      </button>
    </div>
  </div>
<div id="superTopicSupportModal" class="hidden center-modal-backdrop !z-[120]">
    <div class="center-modal-card p-5 space-y-3.5 max-w-sm">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-base">🎁</span>
          <div>
            <h3 class="text-xs font-black text-slate-900" id="supportModalTitle">为主播打榜应援</h3>
            <p class="text-[9px] text-slate-400">消费计入主播专属贡献值与超话热度</p>
          </div>
        </div>
        <button onclick="closeSuperTopicSupportModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>

      <div class="p-3 bg-gradient-to-r from-rose-50 to-purple-50 rounded-2xl border border-rose-100 flex items-center justify-between">
        <div>
          <span class="text-[9px] font-bold text-slate-500">打榜目标</span>
          <h4 class="text-xs font-black text-slate-900" id="supportModalCharName">主播名字</h4>
        </div>
        <div class="text-right">
          <span class="text-[9px] font-bold text-slate-500">我的余额</span>
          <div class="text-xs font-black text-amber-600" id="supportModalUserBalance">0 币</div>
        </div>
      </div>

      <!-- 打榜道具档位选择 -->
      <div class="space-y-1.5 text-xs">
        <span class="text-[10px] font-bold text-slate-700">选择打榜应援物</span>
        <div class="grid grid-cols-2 gap-2" id="supportItemsGrid"></div>
      </div>

      <button onclick="executeSupportGift()" class="btn-brand w-full py-2.5 justify-center text-xs font-black shadow-md flex items-center gap-1.5" id="btnExecuteSupport">
        <span>确认打榜 (消耗 10 LUMA币)</span>
      </button>
    </div>
  </div>
<div id="communityCreatePostModal" class="hidden center-modal-backdrop">
    <div class="center-modal-card p-5 space-y-3.5 max-w-sm">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h3 class="text-xs font-black text-slate-900">发布社区动态</h3>
          <p class="text-[9px] text-slate-400">分享你在小手机中的吃瓜见闻与高光</p>
        </div>
        <button onclick="closeCreatePostModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold">✕</button>
      </div>

      <div class="space-y-2.5 text-xs">
        <div>
          <label class="text-[10px] font-bold text-slate-500">超话话题标签</label>
          <input id="inputPostTag" value="#社区热点#" class="input-ins mt-1">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500">艾特主播 (可选)</label>
          <input id="inputPostMention" placeholder="@主播名" class="input-ins mt-1">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500">动态正文内容</label>
          <textarea id="inputPostContent" rows="4" placeholder="写下你的吃瓜趣事、主播连麦神级操作或开播心得..." class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none resize-none leading-relaxed mt-1"></textarea>
        </div>
      </div>

      <button onclick="handlePublishNewPost()" class="btn-brand w-full py-2.5 justify-center text-xs font-bold shadow-md">
        <span>立即发布到社区动态流</span>
      </button>
    </div>
  </div>
<div id="imageSaveModal" class="hidden center-modal-backdrop" onclick="if(event.target === this) closeImageSaveModal()">
    <div class="center-modal-card p-4 space-y-3 max-w-sm" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 font-black text-xs">🖼️</div>
          <div>
            <h3 class="text-xs font-black text-slate-900">保存图片至相册</h3>
            <p class="text-[9px] text-slate-400">已触发下载 · 手机端可长按直接存图</p>
          </div>
        </div>
        <button onclick="closeImageSaveModal()" class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold active:scale-90 transition">✕</button>
      </div>

      <div class="relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[50vh] border border-slate-200/60 shadow-inner">
        <img id="imageSavePreviewImg" src="" alt="保存图片" class="max-h-[48vh] w-auto object-contain select-auto pointer-events-auto" style="-webkit-touch-callout: default !important; -webkit-user-select: auto !important; user-select: auto !important;">
      </div>

      <div class="bg-amber-50/80 border border-amber-200/60 rounded-xl p-2.5 flex items-start gap-2">
        <span class="text-xs">💡</span>
        <p class="text-[10px] text-amber-900/80 leading-relaxed">
          <span class="font-bold text-amber-900">保存提示：</span>系统已尝试自动调用浏览器下载。若在手机浏览器中，请<span class="font-bold text-rose-600 underline">长按上方图片</span>选择【存储图像】或【保存到相册】即可直接保存！
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <button id="imageSaveDirectDownloadBtn" onclick="triggerDirectSaveCurrentModalImage()" class="btn-brand py-2.5 justify-center text-xs font-bold shadow">
          <span>⬇️ 再次触发下载</span>
        </button>
        <button onclick="closeImageSaveModal()" class="btn-action py-2.5 justify-center text-xs font-bold text-slate-700 bg-slate-100 border-slate-200">
          <span>完成</span>
        </button>
      </div>
    </div>
  </div>

  <div id="opsLogModal" class="fixed inset-0 z-[99998] hidden items-center justify-center bg-black/50 p-4" onclick="if(event.target===this)closeOpsLogViewer()">
    <div class="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
      <div class="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 class="text-sm font-black text-slate-800">LUMA官方运营组·轮询日志</h3>
        <div class="flex items-center gap-2">
          <button onclick="renderOpsLog()" class="text-[10px] font-bold text-cyan-600 px-2 py-1 rounded-lg bg-cyan-50">刷新</button>
          <button onclick="closeOpsLogViewer()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
        </div>
      </div>
      <div id="opsLogContent" class="flex-1 overflow-y-auto p-3 space-y-2 text-[11px]">
        <div class="text-center text-slate-400 py-8">暂无日志，等待下一轮轮询...</div>
      </div>
      <div class="p-3 border-t border-slate-100 text-[9px] text-slate-400 text-center">
        保留最近 50 轮 · 控制台输入 lumaOpsLog 可查看原始数据
      </div>
    </div>
  </div
  `;

  function doInject() {
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
    console.log('[modals] 弹窗层已注入，共 16 个弹窗');
  }

  if (document.body) {
    doInject();
  } else {
    document.addEventListener('DOMContentLoaded', doInject);
  }
})();
