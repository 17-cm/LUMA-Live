// =========================================================================
// 【礼物系统重构模块】LIVE/设定/gift_system.js
// 功能：统一管理礼物数据、送礼流程、连击系统、礼物横幅、全屏特效
// 设计原则：简洁、可靠、每一步都有 try-catch，不会因为小错误中断整个流程
// =========================================================================
(function initGiftSystem() {
  'use strict';

  // =========================================================================
  // 1. 礼物数据配置（价格越来越贵）
  // =========================================================================
  const GIFT_LIST = [
    // 普通礼物（9个）
    { id: 'heart', name: '小心心', price: 1, icon: '❤️', luxury: false, color: 'bg-rose-500/15' },
    { id: 'glow', name: '荧光棒', price: 5, icon: '✨', luxury: false, color: 'bg-cyan-500/15' },
    { id: 'donut', name: '甜甜圈', price: 10, icon: '🍩', luxury: false, color: 'bg-amber-500/15' },
    { id: 'balloon', name: '告白气球', price: 52, icon: '🎈', luxury: false, color: 'bg-pink-500/15' },
    { id: 'bouquet', name: '告白花束', price: 99, icon: '💐', luxury: false, color: 'bg-rose-500/15' },
    { id: 'firework', name: '璀璨花火', price: 188, icon: '🎆', luxury: false, color: 'bg-yellow-500/15' },
    { id: 'crown', name: '绚丽皇冠', price: 520, icon: '👑', luxury: false, color: 'bg-amber-500/15' },
    { id: 'guardwing', name: '守护之翼', price: 999, icon: '🪽', luxury: false, color: 'bg-purple-500/15' },
    { id: 'sportcar', name: '极速超跑', price: 1314, icon: '🏎️', luxury: false, color: 'bg-rose-600/20' },
    // 豪华礼物（6个，价格越来越贵，触发全屏特效）
    { id: 'angelwing', name: '天使之翼', price: 2888, icon: '👼', luxury: true, fxType: 'wings', color: 'bg-gradient-to-tr from-amber-300 to-yellow-400' },
    { id: 'deepsea', name: '深海星辰', price: 5200, icon: '🐋', luxury: true, fxType: 'whale', color: 'bg-gradient-to-tr from-sky-400 to-blue-600' },
    { id: 'castle', name: '水晶城堡', price: 9999, icon: '🏰', luxury: true, fxType: 'castle', color: 'bg-gradient-to-tr from-purple-500 to-pink-500' },
    { id: 'carnival', name: '梦幻嘉年华', price: 18888, icon: '🎡', luxury: true, fxType: 'carnival', color: 'bg-gradient-to-tr from-amber-400 to-rose-500' },
    { id: 'starship', name: '星际飞船', price: 33440, icon: '🚀', luxury: true, fxType: 'starship', color: 'bg-gradient-to-tr from-cyan-400 to-indigo-500' },
    { id: 'cosmicheart', name: '宇宙之心', price: 99999, icon: '💖', luxury: true, fxType: 'cosmic', color: 'bg-gradient-to-tr from-rose-500 via-purple-600 to-amber-400' },
  ];

  // 豪华礼物特效映射
  const LUXURY_FX_MAP = {
    wings: { title: '🪽 天使之翼·圣洁守护', duration: 3900 },
    whale: { title: '🌊 深海星辰·巨鲸巡游', duration: 3900 },
    castle: { title: '🏰 梦幻水晶城堡 降临', duration: 3900 },
    carnival: { title: '✨ 梦幻嘉年华 盛大开幕 ✨', duration: 3900 },
    starship: { title: '🚀 星际跃迁·巡航启航', duration: 3900 },
    cosmic: { title: '🌌 宇宙之心·星芒闪耀', duration: 3900 },
  };

  // =========================================================================
  // 2. 连击状态
  // =========================================================================
  let comboState = {
    active: false,
    giftId: '',
    giftName: '',
    unitPrice: 0,
    unitQty: 1,
    totalCount: 0,
    comboCount: 0,
    timer: null,
    bannerEl: null,
  };

  let selectedQty = 1;

  // =========================================================================
  // 3. 工具函数
  // =========================================================================
  function formatPrice(price) {
    if (price >= 10000) {
      return (price / 10000).toFixed(1) + 'w';
    }
    return price.toLocaleString();
  }

  // =========================================================================
  // 4. 渲染礼物列表
  // =========================================================================
  function renderGiftList() {
    const grid = document.getElementById('giftScrollGrid');
    if (!grid) return;

    grid.innerHTML = GIFT_LIST.map(gift => `
      <div onclick="window.GiftSystem.sendGiftById('${gift.id}')" class="gift-card-item ${gift.luxury ? 'gift-card-luxury' : ''}">
        <div class="gift-icon-wrap ${gift.color} ${gift.id === 'cosmicheart' ? 'animate-pulse' : ''}">${gift.icon}</div>
        <span class="text-[10px] font-bold ${gift.luxury ? 'text-amber-300 font-black' : 'text-white/95'}">${gift.name}</span>
        <span class="text-[9px] ${gift.luxury ? 'text-amber-200 font-black' : 'text-amber-300 font-black'}">${formatPrice(gift.price)} 币</span>
      </div>
    `).join('');
  }

  // =========================================================================
  // 5. 数量选择
  // =========================================================================
  function selectQty(qty) {
    selectedQty = Number(qty) || 1;
    document.querySelectorAll('.gift-qty-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`gift-qty-${qty}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // =========================================================================
  // 6. 核心送礼流程
  // =========================================================================
  async function sendGiftById(giftId) {
    const gift = GIFT_LIST.find(g => g.id === giftId);
    if (!gift) {
      console.warn('[GiftSystem] 礼物不存在:', giftId);
      return;
    }
    await doSendGift(gift, selectedQty);
  }

  async function doSendGift(gift, qty) {
    const api = window.api;
    const totalCost = gift.price * qty;
    const curBal = window.currentWalletBalance || 0;

    // 1. 检查余额
    if (curBal < totalCost) {
      if (api && api.ui && api.ui.toast) {
        api.ui.toast(`💎 余额不足（当前 ${curBal} 币，需 ${totalCost} 币）`);
      }
      if (typeof window.openRechargeModal === 'function') {
        window.openRechargeModal();
      }
      return;
    }

    // 2. 钱包扣款（try-catch，失败也继续）
    try {
      if (api && api.wallet && api.wallet.pay) {
        await api.wallet.pay({ amount: totalCost, title: 'LUMA 直播打赏', detail: `${gift.name} x${qty}` });
      }
    } catch (e) {
      console.warn('[GiftSystem] 钱包扣款跳过:', e.message);
    }

    // 3. 更新余额到数据库（try-catch）
    try {
      window.currentWalletBalance = Math.max(0, curBal - totalCost);
      if (api && api.db) {
        await dbUpsert("app_wallet", "vault_data", { balance: window.currentWalletBalance });
      }
      if (typeof window.syncWalletDisplays === 'function') {
        window.syncWalletDisplays();
      }
    } catch (e) {
      console.warn('[GiftSystem] 更新余额失败:', e.message);
    }

    // 4. 关闭礼物抽屉（送完礼物后自动收起弹窗）
    try {
      const modal = document.getElementById('giftTrayModal');
      if (modal) modal.classList.remove('open');
    } catch (e) {}

    // 5. 记录交易（try-catch，失败不影响后续）
    try {
      if (typeof window.recordTransaction === 'function' && window.currentRoom) {
        const streamerAvatar = window.currentRoom.avatar || window.currentRoom.cover || '';
        const streamerTag = (typeof window.getCanonicalSubCategory === 'function')
          ? window.getCanonicalSubCategory(window.currentRoom)
          : (window.currentRoom.subTag || '签约主播');
        await window.recordTransaction(`送出 ${gift.name} x${qty}`, "gift", totalCost, window.currentRoom.name, streamerAvatar, streamerTag);
      }
    } catch (e) {
      console.warn('[GiftSystem] 记录交易失败:', e.message);
    }

    // 6. 获取用户信息
    let uInfo = { name: '玩家', avatar: '', tag: '观众', vip: 'Lv.1', type: 'user' };
    try {
      if (typeof window.getCurrentUserLiveInfo === 'function') {
        uInfo = window.getCurrentUserLiveInfo();
      }
    } catch (e) {}

    const streamerName = window.currentRoom ? window.currentRoom.name : '主播';

    // 7. 显示礼物横幅（try-catch）
    try {
      showGiftBanner(uInfo, gift, qty);
    } catch (e) {
      console.warn('[GiftSystem] 显示横幅失败:', e.message);
    }

    // 8. 发送礼物弹幕（try-catch）
    try {
      if (typeof window.pushDanmakuToScreen === 'function') {
        window.pushDanmakuToScreen(uInfo, `送了 ${qty} 个【${gift.name}】给【${streamerName}】✨`, 'gift');
      }
    } catch (e) {
      console.warn('[GiftSystem] 发送弹幕失败:', e.message);
    }

    // 9. 启动/更新连击（try-catch）
    try {
      updateCombo(gift, qty);
    } catch (e) {
      console.warn('[GiftSystem] 连击失败:', e.message);
    }

    // 10. 豪华礼物触发全屏特效（try-catch）
    try {
      if (gift.luxury && gift.fxType) {
        triggerLuxuryFx(gift);
      }
    } catch (e) {
      console.warn('[GiftSystem] 全屏特效失败:', e.message);
    }

    // 11. 送礼记录只存在当前直播间内存变量里（不写全局记忆，避免串台）
    // 下次打包弹幕时，从这里检索送礼记录，让 AI 在台词里自然感谢
    try {
      if (window.currentRoom) {
        if (!window.currentRoom.giftHistory) {
          window.currentRoom.giftHistory = [];
        }
        window.currentRoom.giftHistory.push({
          giftName: gift.name,
          count: qty,
          totalCost: totalCost,
          userName: uInfo.name,
          time: Date.now()
        });
        // 只保留最近 20 条
        if (window.currentRoom.giftHistory.length > 20) {
          window.currentRoom.giftHistory = window.currentRoom.giftHistory.slice(-20);
        }
      }
    } catch (e) {
      console.warn('[GiftSystem] 保存送礼记录失败:', e.message);
    }

  }

  // =========================================================================
  // 7. 礼物横幅
  // =========================================================================
  function showGiftBanner(senderInfo, gift, count) {
    const track = document.getElementById('giftBannerTrack');
    if (!track) return;

    // 如果是连击更新，直接更新现有横幅
    if (comboState.active && comboState.bannerEl && comboState.bannerEl.parentNode && comboState.giftId === gift.id) {
      const banner = comboState.bannerEl;
      const textDesc = banner.querySelector('.gift-banner-desc');
      const countEl = banner.querySelector('.gift-banner-count');
      if (textDesc) {
        textDesc.innerHTML = `<span class="text-amber-300 font-black">【${senderInfo.name}】</span> 送了 <span class="text-rose-300 font-black">${comboState.totalCount}</span> 个 <span class="text-amber-300 font-black">【${gift.name}】</span> 给 <span class="text-amber-200 font-bold">${window.currentRoom ? window.currentRoom.name : '主播'}</span>`;
      }
      if (countEl) {
        countEl.textContent = `x${comboState.totalCount}`;
      }
      banner.classList.remove('combo-bounce-active');
      void banner.offsetWidth;
      banner.classList.add('combo-bounce-active');
      return;
    }

    // 创建新横幅
    const banner = document.createElement('div');
    banner.className = 'live-grand-gift-banner';
    banner.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 flex-shrink-0 shadow">
          <img src="${senderInfo.avatar || getAvatar((senderInfo && senderInfo.name) || null, 'first')}" class="w-full h-full rounded-full object-cover border border-white/80" onerror="this.src=getAvatar(null,'emoji')">
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 leading-none">
            ${senderInfo.tag ? `<span class="text-[7.5px] bg-rose-500/30 text-rose-200 border border-rose-400/40 px-1 py-[0.5px] rounded font-black truncate max-w-[60px] leading-none">${senderInfo.tag}</span>` : ''}
            <span class="text-xs font-black text-white truncate max-w-[85px]">${senderInfo.name}</span>
            <span class="text-[7.5px] ${senderInfo.idColor || 'bg-slate-900 text-amber-300 border-amber-400/50'} font-black px-1 py-[0.5px] rounded-full leading-none"></span>
          </div>
          <p class="gift-banner-desc text-[9px] text-white/90 font-medium mt-1 leading-tight truncate">
            送了 <span class="text-rose-300 font-bold">${count}</span> 个 <span class="text-amber-300 font-bold">【${gift.name}】</span> 给 <span class="text-amber-200 font-bold">${window.currentRoom ? window.currentRoom.name : '主播'}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0 pl-2">
        <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-base shadow">
          ${gift.icon}
        </div>
        <span class="gift-banner-count text-sm font-black text-amber-300 italic drop-shadow">x${count}</span>
      </div>
    `;

    track.appendChild(banner);
    comboState.bannerEl = banner;

    // 3.8 秒后如果没有连击活动，移除横幅
    setTimeout(() => {
      if (banner && banner.parentNode && !comboState.active) {
        banner.remove();
      }
    }, 3800);
  }

  // =========================================================================
  // 8. 连击系统
  // =========================================================================
  function updateCombo(gift, qty) {
    const circleBtn = document.getElementById('liveComboCircleBtn');
    const progressCircle = document.getElementById('comboProgressCircle');
    const counterNum = document.getElementById('comboCounterNumber');

    // 如果是新的连击或不同礼物，重置
    if (!comboState.active || comboState.giftId !== gift.id) {
      comboState.active = true;
      comboState.giftId = gift.id;
      comboState.giftName = gift.name;
      comboState.unitPrice = gift.price;
      comboState.unitQty = qty;
      comboState.totalCount = qty;
      comboState.comboCount = 1;
    } else {
      // 累加连击
      comboState.comboCount++;
      comboState.totalCount += qty;
    }

    // 显示连击按钮
    if (circleBtn) {
      circleBtn.classList.add('active');
      circleBtn.classList.add('bounce');
      setTimeout(() => circleBtn.classList.remove('bounce'), 200);
    }
    if (counterNum) {
      counterNum.textContent = `x${comboState.comboCount}`;
    }

    // 进度条动画（2.8 秒）
    if (progressCircle) {
      progressCircle.style.transition = 'none';
      progressCircle.style.strokeDashoffset = '0';
      void progressCircle.offsetWidth;
      progressCircle.style.transition = 'stroke-dashoffset 2.8s linear';
      progressCircle.style.strokeDashoffset = '175.9';
    }

    // 清除旧定时器，设置新的
    if (comboState.timer) clearTimeout(comboState.timer);
    comboState.timer = setTimeout(() => {
      endCombo();
    }, 2800);
  }

  function endCombo() {
    comboState.active = false;
    const circleBtn = document.getElementById('liveComboCircleBtn');
    if (circleBtn) circleBtn.classList.remove('active');

    // 1.2 秒后移除横幅
    if (comboState.bannerEl && comboState.bannerEl.parentNode) {
      setTimeout(() => {
        if (comboState.bannerEl && comboState.bannerEl.parentNode) {
          comboState.bannerEl.remove();
        }
        comboState.bannerEl = null;
      }, 1200);
    }
  }

  // 连击按钮点击（继续送同一个礼物）
  async function onComboClick() {
    if (!comboState.active || !window.currentRoom) return;
    const gift = GIFT_LIST.find(g => g.id === comboState.giftId);
    if (!gift) return;
    await doSendGift(gift, comboState.unitQty);
  }

  // =========================================================================
  // 9. 豪华礼物全屏特效
  // =========================================================================
  function triggerLuxuryFx(gift) {
    const layer = document.getElementById('liveFullscreenFxLayer');
    if (!layer) return;

    const fxCfg = LUXURY_FX_MAP[gift.fxType];
    if (!fxCfg) return;

    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="fx-stage fx-${gift.fxType}">
        <div class="fx-icon">${gift.icon}</div>
        <div class="fx-title">${fxCfg.title}</div>
        <div class="fx-sender">${window.currentRoom ? window.currentRoom.name : '主播'} 收到了 ${gift.name}</div>
      </div>
    `;

    setTimeout(() => {
      layer.classList.add('hidden');
      layer.innerHTML = '';
    }, fxCfg.duration);
  }

  // =========================================================================
  // 10. 初始化
  // =========================================================================
  function init() {
    renderGiftList();
  }

  // 暴露到全局
  window.GiftSystem = {
    GIFT_LIST,
    sendGiftById,
    selectQty,
    onComboClick,
    renderGiftList,
    init,
  };

  // 兼容旧接口
  window.sendGift = function(name, price) {
    const gift = GIFT_LIST.find(g => g.name === name);
    if (gift) {
      window.GiftSystem.sendGiftById(gift.id);
    }
  };
  window.selectGiftQuantity = selectQty;
  window.handleComboCircleClick = onComboClick;

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
