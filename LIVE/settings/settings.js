// 设定页面 - 静态HTML结构
(function () {
  'use strict';
  // 注入页面 HTML
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
<div id="tab-settings" class="tab-page hidden h-full overflow-y-auto no-scrollbar px-4 pb-44 space-y-3.5">
      <div class="pt-1 px-1">
        <h2 class="text-base font-black text-slate-900">系统设定</h2>
        <p class="text-[11px] text-slate-400 mt-0.5">低耗驱动与自定义接口统管</p>
      </div>

      <div class="space-y-2.5">
        <!-- 抽屉 1: 参数设置 (已将滑块上限限制为 0% - 80%) -->
        <div class="accordion-item" id="accItem1">
          <div class="accordion-header" onclick="toggleAccordion('accItem1')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">参数设置</h4>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded" id="tagCharRate">直播场次：不限制</span>
              <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div class="accordion-body space-y-3">
            <div class="h-[1px] bg-slate-100 mb-2"></div>

            <!-- 1. 每日直播场次上限 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>每日直播场次上限</span>
                <span id="valDailyLiveLimit" class="text-rose-600 font-bold">不限制</span>
              </div>
              <div class="flex gap-1.5" id="dailyLiveLimitButtons">
                <button onclick="setDailyLiveLimit(1)" class="daily-limit-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all" data-value="1">1场</button>
                <button onclick="setDailyLiveLimit(2)" class="daily-limit-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all" data-value="2">2场</button>
                <button onclick="setDailyLiveLimit(3)" class="daily-limit-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all" data-value="3">3场</button>
                <button onclick="setDailyLiveLimit(4)" class="daily-limit-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all" data-value="4">4场</button>
                <button onclick="setDailyLiveLimit(0)" class="daily-limit-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all" data-value="0">∞</button>
              </div>
            </div>

            <!-- 2. char单次直播时长上限 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>char单次直播时长上限</span>
                <span id="valMaxLiveDuration" class="text-rose-600 font-bold">240分钟</span>
              </div>
              <input type="range" id="paramMaxLiveDuration" min="30" max="720" step="10" value="240" oninput="updateParam('maxLiveDuration', this.value)" class="jelly-slider">
            </div>

            <!-- 3. char单次下播休息时长上限 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>char单次下播休息时长上限</span>
                <span id="valMaxRestDuration" class="text-rose-600 font-bold">480分钟</span>
              </div>
              <input type="range" id="paramMaxRestDuration" min="30" max="720" step="10" value="480" oninput="updateParam('maxRestDuration', this.value)" class="jelly-slider">
            </div>

            <!-- 4. char回复随机弹幕的概率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>char回复随机弹幕的概率</span>
                <span id="valReplyRandomDanmakuRate" class="text-rose-600 font-bold">25%</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">0不回复任何弹幕，50%回复概率高但不会条条回复</p>
              <input type="range" id="paramReplyRandomDanmakuRate" min="0" max="50" value="25" oninput="updateParam('replyRandomDanmakuRate', this.value)" class="jelly-slider">
            </div>

            <!-- 5. char主动提及你的概率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>char主动提及你的概率</span>
                <span id="valMentionUserRate" class="text-rose-600 font-bold">30%</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">打包弹幕时主动在公屏或台词艾特玩家的判定概率</p>
              <input type="range" id="paramMentionUserRate" min="0" max="100" value="30" oninput="updateParam('mentionUserRate', this.value)" class="jelly-slider">
            </div>

            <!-- 6. char进入其他直播间的概率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>char进入其他直播间的概率</span>
                <span id="valEnterOtherLiveRate" class="text-rose-600 font-bold">35%</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">char之间互相逛直播间查房的概率</p>
              <input type="range" id="paramEnterOtherLiveRate" min="0" max="70" value="35" oninput="updateParam('enterOtherLiveRate', this.value)" class="jelly-slider">
            </div>

            <!-- 7. 弹幕频率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>弹幕频率</span>
                <span id="valDanmakuSpeed" class="text-rose-600 font-bold">50 (约2.9秒/条)</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">屏幕滚动速度与公屏批处理节奏：20≈5秒/条，80≈1秒/条</p>
              <input type="range" id="paramDanmakuSpeed" min="20" max="80" value="50" oninput="updateParam('danmakuSpeed', this.value)" class="jelly-slider">
            </div>

            <!-- 8. 礼物频率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>礼物频率</span>
                <span id="valGiftFrequency" class="text-rose-600 font-bold">30</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">直播间路人刷礼物的频率节奏</p>
              <input type="range" id="paramGiftFrequency" min="10" max="80" value="30" oninput="updateParam('giftFrequency', this.value)" class="jelly-slider">
            </div>

            <!-- 9. char进入你直播间的概率 -->
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>char进入你直播间的概率</span>
                <span id="valEnterPlayerLiveRate" class="text-rose-600 font-bold">60%</span>
              </div>
              <input type="range" id="paramEnterPlayerLiveRate" min="0" max="100" value="60" oninput="updateParam('enterPlayerLiveRate', this.value)" class="jelly-slider">
            </div>

            <div class="h-[1px] bg-slate-100 my-2"></div>
            <div>
              <div class="flex justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>主播留言墙翻牌率</span>
                <span id="valGuestbookRate" class="text-rose-600 font-bold">75%</span>
              </div>
              <input type="range" id="paramGuestbookRate" min="10" max="100" value="75" oninput="updateParam('guestbookRate', this.value)" class="jelly-slider">
            </div>

            <div class="h-[1px] bg-slate-100 my-2"></div>
            <div class="flex items-center justify-between py-1">
              <span class="text-[11px] font-bold text-slate-700">礼物全屏特效</span>
              <label class="switch-toggle">
                <input type="checkbox" id="paramGiftFullScreenEffect" checked onchange="updateParam('giftFullScreenEffect', this.checked)">
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="pt-2">
              <button onclick="saveAllParamsExplicitly()" class="btn-brand w-full py-2 justify-center text-xs font-bold shadow-sm">
                <span>保存参数设置</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 抽屉 1.5: API请求时间 -->
        <div class="accordion-item" id="accItemApiInterval">
          <div class="accordion-header" onclick="toggleAccordion('accItemApiInterval')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">API请求时间</h4>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded" id="tagApiInterval">5 分钟</span>
              <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div class="accordion-body space-y-2">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-[11px] font-bold text-slate-700">直播间API请求间隔时间</span>
                <span id="valApiInterval" class="text-cyan-600 font-bold">5 分钟</span>
              </div>
              <p class="text-[9px] text-slate-400 mb-1.5">弹幕池内容快用完时，间隔多久请求一次AI打包新内容。间隔越长越省请求次数，越短实时感越强。</p>
              <input type="range" id="paramApiInterval" min="3" max="10" value="5" step="1" oninput="updateApiIntervalDisplay(this.value)" class="jelly-slider">
              <div class="flex justify-between text-[8px] text-slate-400 font-bold">
                <span>3 分钟（省请求）</span>
                <span>10 分钟（最省）</span>
              </div>
            </div>

            <div class="pt-2">
              <button onclick="saveApiIntervalSetting()" class="btn-brand w-full py-2 justify-center text-xs font-bold shadow-sm">
                <span>保存设置</span>
              </button>
            </div>
          </div>
        </div>


        <!-- 抽屉 1.6: 后台轮询时长间隔 -->
        <div class="accordion-item" id="accItemOpsPoll">
          <div class="accordion-header" onclick="toggleAccordion('accItemOpsPoll')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">后台轮询时长间隔</h4>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded" id="tagOpsPollInterval">3 分钟</span>
              <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div class="accordion-body space-y-2">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div class="flex justify-between items-center mb-1">
              <span class="text-[11px] font-bold text-slate-700">官方运营组轮询间隔</span>
              <span id="valOpsPollInterval" class="text-purple-600 font-bold">3 分钟</span>
            </div>
            <p class="text-[9px] text-slate-400 mb-1.5">官方运营组多久轮询一次。每轮评估3人：最久开播、最久休息、随机各一人。修改后保存会重启轮询。</p>
            <input type="range" id="paramOpsPollInterval" min="3" max="10" value="3" step="1" oninput="updateOpsPollIntervalDisplay(this.value)" class="jelly-slider">
            <div class="flex justify-between text-[8px] text-slate-400 font-bold">
              <span>3 分钟（活跃）</span>
              <span>10 分钟（佛系）</span>
            </div>
            <div class="pt-2">
              <button onclick="openOpsLogViewer()" class="btn-brand w-full py-2 justify-center text-xs font-bold shadow-sm">
                <span>后台轮询日志</span>
              </button>
            </div>
            <div class="pt-2">
              <button onclick="saveOpsPollInterval()" class="btn-brand w-full py-2 justify-center text-xs font-bold shadow-sm">
                <span>保存后台设置</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 抽屉 2: 自定义API -->
        <div class="accordion-item" id="accItem4">
          <div class="accordion-header" onclick="toggleAccordion('accItem4')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">自定义API</h4>
            </div>
            <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="accordion-body space-y-2.5">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div onclick="openCustomApiModal()" class="luxe-card p-3 flex items-center justify-between cursor-pointer active:scale-98 transition bg-white">
              <div>
                <h5 class="text-xs font-black text-slate-800">自定义文本API</h5>
                <p class="text-[9px] text-slate-400" id="statusCustomApi">支持硅基流动 / DeepSeek / 自定义接口</p>
              </div>
              <span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">配置 ›</span>
            </div>

            <div onclick="openCustomImageApiModal()" class="luxe-card p-3 flex items-center justify-between cursor-pointer active:scale-98 transition bg-white">
              <div>
                <h5 class="text-xs font-black text-slate-800">自定义生图API</h5>
                <p class="text-[9px] text-slate-400" id="statusCustomImageApi">SD / DALL-E 格式支持</p>
              </div>
              <span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">配置 ›</span>
            </div>

            <!-- 自定义文本模型开关 -->
            <div class="luxe-card p-3 flex items-center justify-between bg-white">
              <div>
                <h5 class="text-xs font-black text-slate-800">启用全局文本API</h5>
                <p class="text-[9px] text-slate-400">开启时使用全局模型，关闭时使用自定义模型</p>
              </div>
              <label class="switch-toggle">
                <input type="checkbox" id="switchGlobalModel" onchange="toggleGlobalModelSwitch(this.checked)">
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- 自定义生图模型开关 -->
            <div class="luxe-card p-3 flex items-center justify-between bg-white">
              <div>
                <h5 class="text-xs font-black text-slate-800">启用全局生图API</h5>
                <p class="text-[9px] text-slate-400">开启时使用全局模型，关闭时使用自定义模型</p>
              </div>
              <label class="switch-toggle">
                <input type="checkbox" id="switchGlobalImageModel" onchange="toggleGlobalImageModelSwitch(this.checked)">
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 抽屉 3: 数据储存 -->
        <div class="accordion-item" id="accItem3">
          <div class="accordion-header" onclick="toggleAccordion('accItem3')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">数据储存</h4>
            </div>
            <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="accordion-body space-y-2">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="exportAppDataFile()" class="btn-action justify-center text-[11px]">导出运行数据</button>
              <button onclick="triggerImportAppDataFile()" class="btn-action justify-center text-[11px]">导入运行数据</button>
              <button onclick="exportPresetsDataFile()" class="btn-action justify-center text-[11px]">导出提示词预设</button>
              <button onclick="triggerImportPresetsDataFile()" class="btn-action justify-center text-[11px]">导入提示词预设</button>
            </div>
          </div>
        </div>

        <!-- 抽屉 4: 预设设置 -->
        <div class="accordion-item" id="accItem2">
          <div class="accordion-header" onclick="toggleAccordion('accItem2')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">预设设置</h4>
            </div>
            <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="accordion-body space-y-2">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div class="grid grid-cols-1 gap-2" id="presetCategoryList"></div>
          </div>
        </div>

        <!-- 抽屉 5: 生图参数及提示词 -->
        <div class="accordion-item" id="accItem5">
          <div class="accordion-header" onclick="toggleAccordion('accItem5')">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <h4 class="text-xs font-black text-slate-900">生图参数及提示词</h4>
            </div>
            <svg class="accordion-chevron w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="accordion-body space-y-3">
            <div class="h-[1px] bg-slate-100 mb-2"></div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-bold text-slate-500 block mb-1">生图尺寸</label>
                <select id="selectImageSize" onchange="handleImageSizeChange(this.value)" class="input-ins !py-1 text-xs font-bold">
                  <option value="1:1">正方形 1:1 (1024x1024)</option>
                  <option value="9:16">竖屏 9:16 (1024x1792)</option>
                  <option value="16:9">横屏 16:9 (1792x1024)</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-500 block mb-1">生成质量</label>
                <select id="selectImageQuality" onchange="handleImageQualityChange(this.value)" class="input-ins !py-1 text-xs font-bold">
                  <option value="standard">标准 Standard</option>
                  <option value="hd">高清 HD</option>
                </select>
              </div>
            </div>
            <div class="space-y-2 pt-1" id="imagePromptEntriesContainer"></div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="addNewImagePromptEntry()" class="btn-action justify-center !py-2 text-xs !border-dashed !border-emerald-300 text-emerald-600">
                <span>+ 新增提示词</span>
              </button>
              <button onclick="saveImageSettingsExplicitly()" class="btn-brand justify-center !py-2 text-xs font-bold shadow-sm">
                <span>保存生图设置</span>
              </button>
            </div>
          </div>
        </div>

        <button onclick="openResetConfirmModal()" class="luxe-card w-full py-3.5 text-center text-xs font-black text-rose-600 border-rose-200/60 active:bg-rose-50 transition">
          清除缓存
        </button>

        <!-- 隐藏的文件导入控件 -->
        <input type="file" id="fileInputData" accept=".json" onchange="handleFileImportData(event)" class="hidden">
        <input type="file" id="fileInputPresets" accept=".json" onchange="handleFileImportPresets(event)" class="hidden">
      </div>
    </div>
  </main>

  <!-- ======================== 纯矢量 SVG 悬浮 Dock 栏 ======================== -->
  <div class="fixed bottom-0 left-0 right-0 z-30 pb-safe">
  `);
})();
