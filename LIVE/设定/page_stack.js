// =========================================================================
// 【统一页面栈管理器】LIVE/设定/page_stack.js
// 功能：管理所有全屏页面的跳转、返回、动画、状态保留
// 原理：像一摞牌，打开新页面压入栈顶，返回弹出栈顶，下面的页面状态保留
// 支持动画：slide-right（右侧滑入）、slide-bottom（底部滑入）、fade（淡入淡出）
// =========================================================================
(function () {
  'use strict';

  const ANIMATION_TYPES = {
    'slide-right': {
      baseClass: 'page-stack-slide-right',
      openClass: 'page-stack-open',
    },
    'slide-bottom': {
      baseClass: 'page-stack-slide-bottom',
      openClass: 'page-stack-open',
    },
    'fade': {
      baseClass: 'page-stack-fade',
      openClass: 'page-stack-open',
    },
  };

  const PageStack = {
    // 页面栈，初始只有首页（home 是虚拟的，代表主界面 Tab）
    stack: ['home'],
    // 是否正在动画中，防止快速点击
    isAnimating: false,
    // 已注册的页面配置
    pages: {},
    // 动画时长（毫秒），和 CSS transition 保持一致
    animationDuration: 300,

    /**
     * 注册一个页面
     * @param {string} pageId - 页面唯一标识
     * @param {object} config - 页面配置
     *   - element: DOM 元素（默认按 pageId 找）
     *   - animationType: 动画类型 'slide-right' | 'slide-bottom' | 'fade'（默认 'slide-right'）
     *   - openClass: 打开时添加的类名（默认根据 animationType 自动设置）
     *   - hiddenClass: 隐藏时的类名（默认 'hidden'）
     *   - onOpen: 打开时的回调函数
     *   - onClose: 关闭时的回调函数
     *   - zIndex: 页面层级（默认自动按栈深度计算）
     */
    register(pageId, config = {}) {
      const element = config.element || document.getElementById(pageId);
      if (!element) {
        console.warn('[PageStack] 页面元素未找到:', pageId);
        return;
      }

      // 确定动画类型
      const animationType = config.animationType || 'slide-right';
      const animConfig = ANIMATION_TYPES[animationType] || ANIMATION_TYPES['slide-right'];

      // 给元素添加基础动画类
      element.classList.add('page-stack-page', animConfig.baseClass);

      this.pages[pageId] = {
        id: pageId,
        element: element,
        animationType: animationType,
        openClass: config.openClass || animConfig.openClass,
        hiddenClass: config.hiddenClass !== undefined ? config.hiddenClass : 'hidden',
        onOpen: config.onOpen || null,
        onClose: config.onClose || null,
        baseZIndex: config.zIndex || 100,
      };

      // 初始状态：确保页面是隐藏的（除非在栈里）
      if (!this.stack.includes(pageId) && this.pages[pageId].hiddenClass) {
        element.classList.add(this.pages[pageId].hiddenClass);
      }

      console.log('[PageStack] 页面已注册:', pageId, '动画:', animationType);
    },

    /**
     * 打开新页面（压入栈顶）
     * @param {string} pageId - 要打开的页面 ID
     * @param {object} options - 传递给页面的参数
     */
    open(pageId, options = {}) {
      // 防快速点击
      if (this.isAnimating) {
        console.log('[PageStack] 动画中，忽略点击');
        return;
      }

      // 已经在当前页面，不重复打开
      const currentPageId = this.current();
      if (currentPageId === pageId) {
        console.log('[PageStack] 已经在当前页面:', pageId);
        return;
      }

      const page = this.pages[pageId];
      if (!page) {
        console.warn('[PageStack] 页面未注册:', pageId);
        return;
      }

      console.log('[PageStack] 打开页面:', pageId, '动画:', page.animationType, '当前栈:', [...this.stack]);

      this.isAnimating = true;

      // 压入栈
      this.stack.push(pageId);

      // 更新所有页面的 z-index（栈顶的页面层级最高）
      this._updateZIndexes();

      // 显示新页面
      const el = page.element;
      if (page.hiddenClass) el.classList.remove(page.hiddenClass);

      // 触发重排，确保动画生效
      void el.offsetWidth;

      // 添加打开类（触发动画）
      el.classList.add(page.openClass);

      // 执行 onOpen 回调
      if (page.onOpen) {
        try {
          page.onOpen(options);
        } catch (e) {
          console.error('[PageStack] onOpen 回调错误:', e);
        }
      }

      // 动画结束后解锁
      setTimeout(() => {
        this.isAnimating = false;
        console.log('[PageStack] 页面打开完成:', pageId);
      }, this.animationDuration);
    },

    /**
     * 返回上一页（弹出栈顶）
     * @returns {boolean} 是否成功返回
     */
    back() {
      // 防快速点击
      if (this.isAnimating) {
        console.log('[PageStack] 动画中，忽略返回');
        return false;
      }

      // 已经在首页了，不能再返回
      if (this.stack.length <= 1) {
        console.log('[PageStack] 已经在首页，不能返回');
        return false;
      }

      const currentPageId = this.stack.pop();
      const currentPage = this.pages[currentPageId];
      const prevPageId = this.current();

      console.log('[PageStack] 返回上一页:', currentPageId, '->', prevPageId, '当前栈:', [...this.stack]);

      this.isAnimating = true;

      // 关闭当前页面
      if (currentPage) {
        const el = currentPage.element;
        // 移除打开类（触发滑出/淡出动画）
        el.classList.remove(currentPage.openClass);

        // 动画结束后隐藏
        setTimeout(() => {
          if (currentPage.hiddenClass) el.classList.add(currentPage.hiddenClass);
        }, this.animationDuration);

        // 执行 onClose 回调
        if (currentPage.onClose) {
          try {
            currentPage.onClose();
          } catch (e) {
            console.error('[PageStack] onClose 回调错误:', e);
          }
        }
      }

      // 更新 z-index
      this._updateZIndexes();

      // 动画结束后解锁
      setTimeout(() => {
        this.isAnimating = false;
        console.log('[PageStack] 返回完成');
      }, this.animationDuration);

      return true;
    },

    /**
     * 返回到指定页面（弹出到该页面为止）
     * @param {string} pageId - 目标页面 ID
     */
    backTo(pageId) {
      if (!this.stack.includes(pageId)) {
        console.warn('[PageStack] 页面不在栈中:', pageId);
        return;
      }

      // 不断返回，直到目标页面成为栈顶
      while (this.current() !== pageId) {
        if (!this.back()) break;
      }
    },

    /**
     * 重置页面栈（回到首页，关闭所有页面）
     */
    reset() {
      console.log('[PageStack] 重置页面栈');

      // 关闭所有页面（除了首页）
      while (this.stack.length > 1) {
        const pageId = this.stack.pop();
        const page = this.pages[pageId];
        if (page) {
          page.element.classList.remove(page.openClass);
          if (page.hiddenClass) page.element.classList.add(page.hiddenClass);
          if (page.onClose) {
            try {
              page.onClose();
            } catch (e) {}
          }
        }
      }

      this.isAnimating = false;
    },

    /**
     * 获取当前页面 ID
     */
    current() {
      return this.stack[this.stack.length - 1];
    },

    /**
     * 获取上一个页面 ID
     */
    previous() {
      return this.stack.length > 1 ? this.stack[this.stack.length - 2] : null;
    },

    /**
     * 判断页面是否在栈中
     */
    isInStack(pageId) {
      return this.stack.includes(pageId);
    },

    /**
     * 更新所有页面的 z-index（栈顶的页面层级最高）
     */
    _updateZIndexes() {
      this.stack.forEach((pageId, index) => {
        const page = this.pages[pageId];
        if (page && page.element) {
          // 首页不设置 z-index（它是主界面）
          if (pageId !== 'home') {
            page.element.style.zIndex = page.baseZIndex + index;
          }
        }
      });
    },
  };

  // 暴露到全局
  window.PageStack = PageStack;

  console.log('[PageStack] 页面栈管理器已加载');
})();
