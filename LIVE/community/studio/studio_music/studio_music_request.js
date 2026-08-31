// =========================================================================
// 【直播间音乐·请求层】studio_music_request.js
// 职责：浏览器原生 fetch（直连）+ buildRequest（拼 URL / 参数）
// 依赖：utils.js
// =========================================================================
(function () {
  'use strict';

  var L = window.LM;

  // ---- 网络层：浏览器原生 fetch（直连，不走宿主代理）---------------
  // 不走宿主 AiPhone.network.fetch — 浏览器直接请求目标 URL
  // 受浏览器 CORS 限制：目标 API 必须返回 Access-Control-Allow-Origin
  function doFetchJson(req) {
    var options = req.options || {};
    var fetchOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    if (options.body) fetchOptions.body = options.body;
    return fetch(req.url, fetchOptions).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // ---- 文本 fetch（歌词链接、纯文本返回） -------------------------------
  function doFetchText(url, options) {
    var fetchOptions = {
      method: (options && options.method) || 'GET',
      headers: (options && options.headers) || {}
    };
    return fetch(url, fetchOptions).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  // ---- 音频链接 → dataUrl（宿主代播需要可播的 dataUrl / media-store）-----
  // 播放必须走宿主 voice.play，需要先把远程音频 fetch 成 dataUrl。
  // 若目标音频未开放 CORS 会失败，此时交给调用方兜底提示。
  function fetchAudioDataUrl(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error('读取音频失败')); };
        reader.readAsDataURL(blob);
      });
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

    // 4. 自定义请求头（每行 "Name: value"，空白行忽略）
    if (tool.headers && typeof tool.headers === 'string') {
      tool.headers.split(/\r?\n/).forEach(function(line) {
        var idx = line.indexOf(':');
        if (idx < 0) return;
        var name = line.slice(0, idx).trim();
        var value = line.slice(idx + 1).trim();
        if (name) options.headers[name] = value;
      });
    }

    return Promise.resolve({ url: fullUrl, options: options });
  }

  L.doFetchJson = doFetchJson;
  L.doFetchText = doFetchText;
  L.fetchAudioDataUrl = fetchAudioDataUrl;
  L.buildRequest = buildRequest;
})();
