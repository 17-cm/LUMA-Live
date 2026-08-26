// ==========================================================================
// JS 动态注入测试
// 验证：1.动态注入的DOM能否被找到 2.Tab切换能否工作 3.内联onclick能否工作 4.全屏页能否工作
// ==========================================================================

(function () {
  'use strict';

  // ---------- 1. 动态注入四个 Tab 页面 + 一个全屏页面 ----------
  const pagesRoot = document.getElementById('pages-root');
  pagesRoot.innerHTML = `
    <div id="tab-live" class="tab-page active">
      <h2>🎬 直播广场</h2>
      <p>这个页面的 HTML 是由 JS 动态注入的，不是写在 index.html 里的。</p>
      <button onclick="window.__testInlineOnclick()">测试内联 onclick</button>
      <button class="secondary" onclick="window.__openFullPage()">打开全屏页</button>
      <div id="inline-result"></div>
      <div id="auto-results"></div>
    </div>
    <div id="tab-community" class="tab-page">
      <h2>🔥 社区</h2>
      <p>社区页面内容（动态注入）</p>
      <p>如果你能切换到这里并看到内容，说明 Tab 切换工作正常。</p>
    </div>
    <div id="tab-home" class="tab-page">
      <h2>👤 主页</h2>
      <p>主页内容（动态注入）</p>
    </div>
    <div id="tab-settings" class="tab-page">
      <h2>⚙️ 设定</h2>
      <p>设定页面内容（动态注入）</p>
    </div>
    <div id="fullPageTest" class="full-page">
      <h2>🪟 全屏页面测试</h2>
      <p>这个页面也是 JS 动态注入的。</p>
      <p>如果你能看到这个，说明 PageStack 模式的动态注入也工作了。</p>
      <button onclick="window.__closeFullPage()">关闭全屏页</button>
    </div>
  `;

  // ---------- 2. Tab 切换 ----------
  window.switchTab = function (tabName) {
    document.querySelectorAll('.tab-page').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    var page = document.getElementById('tab-' + tabName);
    if (page) page.classList.add('active');
    if (event && event.target) event.target.classList.add('active');
  };

  // ---------- 3. 内联 onclick 测试 ----------
  window.__testInlineOnclick = function () {
    var el = document.getElementById('inline-result');
    el.innerHTML = '<div class="result pass">✅ 内联 onclick 在动态注入的 HTML 上工作正常！</div>';
  };

  // ---------- 4. 全屏页面（模拟 PageStack） ----------
  window.__openFullPage = function () {
    document.getElementById('fullPageTest').classList.add('open');
  };
  window.__closeFullPage = function () {
    document.getElementById('fullPageTest').classList.remove('open');
  };

  // ---------- 5. 自动检测 ----------
  function runAutoTests() {
    var tests = [
      ['pages-root 容器存在', !!document.getElementById('pages-root')],
      ['tab-live 动态注入成功', !!document.getElementById('tab-live')],
      ['tab-community 动态注入成功', !!document.getElementById('tab-community')],
      ['tab-home 动态注入成功', !!document.getElementById('tab-home')],
      ['tab-settings 动态注入成功', !!document.getElementById('tab-settings')],
      ['fullPageTest 动态注入成功', !!document.getElementById('fullPageTest')],
      ['switchTab 是全局函数', typeof window.switchTab === 'function'],
      ['内联onclick函数已注册', typeof window.__testInlineOnclick === 'function'],
      ['全屏页打开函数已注册', typeof window.__openFullPage === 'function'],
      ['动态注入的元素可见', document.getElementById('tab-live').classList.contains('active')],
    ];

    console.log('=== JS动态注入测试结果 ===');
    var allPass = true;
    tests.forEach(function (t) {
      console.log((t[1] ? '✅' : '❌') + ' ' + t[0]);
      if (!t[1]) allPass = false;
    });
    console.log('总计: ' + tests.filter(function(t){return t[1];}).length + '/' + tests.length + ' 通过');

    var resultsDiv = document.getElementById('auto-results');
    if (resultsDiv) {
      resultsDiv.innerHTML = '<h3>🔍 自动检测结果</h3>' +
        tests.map(function (t) {
          return '<div class="result ' + (t[1] ? 'pass' : 'fail') + '">' +
            (t[1] ? '✅' : '❌') + ' ' + t[0] + '</div>';
        }).join('') +
        '<div class="hint">如果全部通过，说明 JS 动态注入方案可行，可以用来拆分 index.html</div>';
    }
  }

  // 立即执行（DOM 已经解析到 pages-root，script 在其后，同步可用）
  runAutoTests();
})();
