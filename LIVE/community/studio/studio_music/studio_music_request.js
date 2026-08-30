// =========================================================================
// 【直播间音乐·请求层】studio_music_request.js
// 职责：宿主 AiPhone.network.fetch 封装 + buildRequest（拼 URL / 参数）
// 依赖：utils.js
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;

  // ---- 网络层（走宿主 AiPhone.network.fetch）---------------------------
  // LUMA-Live 是宿主里的 APP，沙盒 iframe 不能 fetch 外部 API
  // 走宿主 SDK 让宿主服务器代发，target API 无 CORS 也能通
  // 显式传 proxy: true 走宿主 /api/tool-proxy
  function doFetchJson(req) {
    var options = req.options || {};
    var params = {
      url: req.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      proxy: true,
      timeoutMs: options.timeoutMs || 20000
    };
    if (options.body) params.body = options.body;
    var sdk = (window.AiPhone && window.AiPhone.network) ||
              (window.AiPhoneApp && window.AiPhoneApp.network) ||
              (window.api && window.api.network);
    var p;
    if (sdk && typeof sdk.fetch === 'function') {
      p = sdk.fetch(params);
    } else {
      if (window.console && window.console.warn) window.console.warn('[liveMusic] 宿主 network SDK 不可用，无法请求外部 API');
      return Promise.reject(new Error('宿主 network.fetch 不可用'));
    }
    return Promise.resolve(p).then(function (res) {
      if (res && res.ok) {
        if (res.json) return res.json;
        if (res.text) { try { return JSON.parse(res.text); } catch (e) { throw new Error('返回不是合法 JSON'); } }
        throw new Error('空响应');
      }
      throw new Error('HTTP ' + (res && res.status));
    });
  }

  // ================================================================
  // buildRequest - 完整重构版
  // 规则：
  //   1. 默认参数（params）：用户手动填写的固定键值对，原样发送
  //   2. 搜索框参数（searchKey）：用搜索框输入的值补全，独立于默认参数
  //   3. 二级请求参数（detailKey）：用歌曲序号补全，独立于默认参数
  //   三者完全独立，互不依赖，均自动合并到最终 URL
  // ================================================================
  function buildRequest(tool, keyword, extraKv) {
    var url = tool.url || '';
    var method = (tool.method || 'GET').toUpperCase();
    var params = Array.isArray(tool.params) ? tool.params : [];
    var searchKey = (tool.searchKey || '').trim();
    var detailKey = (tool.detailKey || '').trim();

    var parts = [];

    // 1. 默认参数
    params.forEach(function(p) {
      if (p && p.key) {
        parts.push(encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value || ''));
      }
    });

    // 2. 搜索框参数
    if (searchKey && keyword != null && String(keyword).length > 0) {
      var replaced = false;
      for (var i = 0; i < parts.length; i++) {
        var key = parts[i].split('=')[0];
        if (key === encodeURIComponent(searchKey)) {
          parts[i] = encodeURIComponent(searchKey) + '=' + encodeURIComponent(String(keyword));
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        parts.push(encodeURIComponent(searchKey) + '=' + encodeURIComponent(String(keyword)));
      }
    }

    // 3. 二级请求参数
    if (extraKv && typeof extraKv === 'object') {
      Object.keys(extraKv).forEach(function(k) {
        if (k == null) return;
        var v = extraKv[k];
        if (v == null) return;
        var replaced = false;
        for (var i = 0; i < parts.length; i++) {
          var key = parts[i].split('=')[0];
          if (key === encodeURIComponent(k)) {
            parts[i] = encodeURIComponent(k) + '=' + encodeURIComponent(v);
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
      });
    }

    var qs = parts.join('&');
    var fullUrl = url;
    if (qs) fullUrl += (url.indexOf('?') >= 0 ? '&' : '?') + qs;

    var options = { method: method, headers: {} };
    if (method === 'POST') {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = qs;
    }
    return Promise.resolve({ url: fullUrl, options: options });
  }

  L.doFetchJson = doFetchJson;
  L.buildRequest = buildRequest;
})();
