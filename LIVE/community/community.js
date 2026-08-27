// 社区页面 - 静态HTML结构
(function () {
  'use strict';
  // 注入页面 HTML
  document.getElementById('pages-root').insertAdjacentHTML('beforeend', `
<div id="tab-trends" class="tab-page hidden h-full overflow-y-auto no-scrollbar px-4 pb-28 space-y-4">
      
      <!-- 探索·社区 导览大卡片 -->
      <div class="luxe-card p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-400 shadow-md flex-shrink-0">
              <div class="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-white">
                <svg class="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
              </div>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h3 class="text-sm font-black text-slate-900 leading-none">探索 · 社区</h3>
                <span class="text-[8px] bg-rose-50 text-rose-600 font-extrabold px-1.5 py-0.5 rounded border border-rose-200">COMMUNITY</span>
              </div>
              <span class="text-[9px] text-slate-400 font-bold tracking-wider mt-1 block">全服应援 · 粉丝超话 · 实时风向</span>
            </div>
          </div>
          <button onclick="openCreatePostModal()" class="btn-brand text-xs !py-1.5 !px-3.5 shadow-sm">
            <span>+ 发动态</span>
          </button>
        </div>

        <div class="flex gap-2 overflow-x-auto no-scrollbar py-0.5" id="hotTrendPills">
          <span class="text-[10px] bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full border border-rose-200 flex-shrink-0">🔥 活跃动态 1,840+ 条</span>
          <span class="text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full border border-amber-200 flex-shrink-0">🪐 超话今日待打卡</span>
          <span class="text-[10px] bg-purple-50 text-purple-700 font-bold px-2.5 py-1 rounded-full border border-purple-200 flex-shrink-0">🏆 全服榜单实时刷新</span>
        </div>
      </div>

      <!-- 6 大功能专区按键 (两列均分等宽排布) -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center px-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">COMMUNITY SECTORS · 专区导航</span>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-0.5">
          <!-- 按键 1: 今日热搜 -->
          <div onclick="openCommunitySubPage('trends')" class="new-key new-key-1">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">今日热搜</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">全网实时沸点 & 动态流</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>

          <!-- 按键 2: 超话专区 -->
          <div onclick="openCommunitySubPage('super_topic')" class="new-key new-key-2">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">超话专区</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">主播粉丝根据地 · 签到</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>

          <!-- 按键 3: 排行榜 -->
          <div onclick="openCommunitySubPage('ranking')" class="new-key new-key-3">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">排行榜</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">人气榜 · 守护榜 · 勤奋榜</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>

          <!-- 按键 4: 直播设置 -->
          <div onclick="openCommunitySubPage('live_settings')" class="new-key new-key-4">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">直播设置</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">开播偏好 · 筹备中</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>

          <!-- 按键 5: 官方论坛 -->
          <div onclick="openCommunitySubPage('forum')" class="new-key new-key-5">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">官方论坛</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">反馈信箱</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>

          <!-- 按键 6: 我的超话 -->
          <div onclick="openCommunitySubPage('my_topic')" class="new-key new-key-6">
            <div class="new-key-corner-tl"></div>
            <div class="new-key-corner-br"></div>
            <div class="new-key-scanlines"></div>
            <div class="new-key-beam"></div>
            <div class="new-key-glow-bottom"></div>
            <div class="new-key-content">
              <div class="new-key-mark"><div class="new-key-mark-inner"></div></div>
              <div class="new-key-text">
                <span class="new-key-name">我的超话</span>
                <svg class="new-key-hook" viewBox="0 0 80 14"><path d="M 2 8 C 20 2 50 2 72 8 C 78 11 74 14 70 12"/></svg>
                <span class="new-key-sub">玩家专属应援地 · 打卡</span>
              </div>
              <div class="new-key-arrow"><span>›</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 官方运营组置顶宣传企划卡片 (纯正官方口吻) -->
      <div class="space-y-2 pt-1">
        <div class="flex justify-between items-center px-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OFFICIAL ANNOUNCEMENT · 官方运营中心</span>
          <span class="text-[9px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">置顶公告</span>
        </div>

        <div class="luxe-card p-4 space-y-3.5 bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="relative flex-shrink-0">
                <div class="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-rose-500 flex-shrink-0 shadow-xs">
                  <div class="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-xs font-black">LUMA</div>
                </div>
                <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-slate-950">V</span>
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-xs font-black text-slate-900">LUMA 官方运营组</h4>
                  <span class="text-[8px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded">官方认证</span>
                </div>
                <p class="text-[9px] text-slate-400 mt-0.5">置顶动态 · 官方特邀认证 · 24小时值班</p>
              </div>
            </div>
            <span class="text-[9px] font-bold text-slate-400">#社区公告#</span>
          </div>

          <!-- 官方宣讲正文 -->
          <div class="text-xs text-slate-700 leading-relaxed space-y-2">
            <p class="font-bold text-slate-900">
              ✨ 亲爱的各位 LUMA 用户与创作者们：
            </p>
            <p>
              感谢大家一路以来的陪伴与支持！为了给大家提供更加优质、健康的互动与直播生态，LUMA 官方社区运营组特向大家同步近期平台重点运营动向与社区指引：
            </p>
            <div class="grid grid-cols-2 gap-2 my-2 text-[11px]">
              <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div class="flex items-center gap-1 font-black text-slate-900">
                  <span class="text-rose-500">✦</span> 互动与观播倡议
                </div>
                <p class="text-[10px] text-slate-500 leading-snug">倡导文明交流与理性互动，共同维护友善包容的直播与超话弹幕氛围。</p>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div class="flex items-center gap-1 font-black text-slate-900">
                  <span class="text-purple-500">✦</span> 创作者激励计划
                </div>
                <p class="text-[10px] text-slate-500 leading-snug">全新新星主播扶持与超话阵地已全面上线，期待更多优质主播加入！</p>
              </div>
            </div>
            <p class="text-slate-600 text-[11px]">
              如有任何体验建议或问题，欢迎随时前往【官方论坛】反馈信箱联系我们。愿每一位用户都能在 LUMA 找到属于自己的快乐与陪伴！
            </p>
          </div>

          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
              官方点赞 18.9w+
            </span>
            <span class="text-slate-400">LUMA Official Operations · 官方运营中心</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: 我的个人主页 -->
  `);
})();
