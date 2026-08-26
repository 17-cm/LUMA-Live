// =========================================================================
// 【统一页面栈管理器】
// 功能：管理所有全屏页面的跳转、返回、动画、状态保留
// 原理：像一摞牌，打开新页面压入栈顶，返回弹出栈顶，下面的页面状态保留
// =========================================================================
(function () {
  'use strict';
  const ANIMATION_TYPES = {
    'slide-right': { baseClass: 'page-stack-slide-right', openClass: 'page-stack-open' },
    'slide-bottom': { baseClass: 'page-stack-slide-bottom', openClass: 'page-stack-open' },
    'fade': { baseClass: 'page-stack-fade', openClass: 'page-stack-open' },
  };
  const PageStack = {
    stack: ['home'],
    isAnimating: false,
    pages: {},
    animationDuration: 300,
    register(pageId, config = {}) {
      const element = config.element || document.getElementById(pageId);
      if (!element) { console.warn('[PageStack] 页面元素未找到:', pageId); return; }
      const animationType = config.animationType || 'slide-right';
      const animConfig = ANIMATION_TYPES[animationType] || ANIMATION_TYPES['slide-right'];
      element.classList.add('page-stack-page', animConfig.baseClass);
      this.pages[pageId] = {
        id: pageId, element: element, animationType: animationType,
        openClass: config.openClass || animConfig.openClass,
        hiddenClass: config.hiddenClass !== undefined ? config.hiddenClass : 'hidden',
        onOpen: config.onOpen || null, onClose: config.onClose || null,
        baseZIndex: config.zIndex || 100,
      };
      if (!this.stack.includes(pageId) && this.pages[pageId].hiddenClass) {
        element.classList.add(this.pages[pageId].hiddenClass);
      }
    },
    open(pageId, options = {}) {
      if (this.isAnimating) return;
      const currentPageId = this.current();
      if (currentPageId === pageId) return;
      const page = this.pages[pageId];
      if (!page) { console.warn('[PageStack] 页面未注册:', pageId); return; }
      this.isAnimating = true;
      this.stack.push(pageId);
      this._updateZIndexes();
      const el = page.element;
      if (page.hiddenClass) el.classList.remove(page.hiddenClass);
      void el.offsetWidth;
      el.classList.add(page.openClass);
      if (page.onOpen) { try { page.onOpen(options); } catch (e) { console.error('[PageStack] onOpen 错误:', e); } }
      setTimeout(() => { this.isAnimating = false; }, this.animationDuration);
    },
    back() {
      if (this.isAnimating) return false;
      if (this.stack.length <= 1) return false;
      const currentPageId = this.stack.pop();
      const currentPage = this.pages[currentPageId];
      this.isAnimating = true;
      if (currentPage) {
        const el = currentPage.element;
        el.classList.remove(currentPage.openClass);
        setTimeout(() => { if (currentPage.hiddenClass) el.classList.add(currentPage.hiddenClass); }, this.animationDuration);
        if (currentPage.onClose) { try { currentPage.onClose(); } catch (e) { console.error('[PageStack] onClose 错误:', e); } }
      }
      this._updateZIndexes();
      setTimeout(() => { this.isAnimating = false; }, this.animationDuration);
      return true;
    },
    backTo(pageId) {
      if (!this.stack.includes(pageId)) { console.warn('[PageStack] 页面不在栈中:', pageId); return; }
      while (this.current() !== pageId) { if (!this.back()) break; }
    },
    reset() {
      while (this.stack.length > 1) {
        const pageId = this.stack.pop();
        const page = this.pages[pageId];
        if (page) {
          page.element.classList.remove(page.openClass);
          if (page.hiddenClass) page.element.classList.add(page.hiddenClass);
          if (page.onClose) { try { page.onClose(); } catch (e) {} }
        }
      }
      this.isAnimating = false;
    },
    current() { return this.stack[this.stack.length - 1]; },
    previous() { return this.stack.length > 1 ? this.stack[this.stack.length - 2] : null; },
    isInStack(pageId) { return this.stack.includes(pageId); },
    _updateZIndexes() {
      this.stack.forEach((pageId, index) => {
        const page = this.pages[pageId];
        if (page && page.element && pageId !== 'home') {
          page.element.style.zIndex = page.baseZIndex + index;
        }
      });
    },
  };
  window.PageStack = PageStack;
})();
