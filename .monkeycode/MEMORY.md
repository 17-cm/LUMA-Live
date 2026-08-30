# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: YYYY-MM-DD
- Context: Mentioned scenario or time
- Instructions:
  - Content of user teaching or instruction, described line by line

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-08-30
- Context: User repeatedly reminded that the LUMA-Live project runs as a sandboxed APP inside the "小手机" (small phone) host, not as a standalone web app.
- Instructions:
  - 沙盒 iframe 环境里 localStorage、fetch、new Audio()、navigator.geolocation、MediaRecorder 这些浏览器原生 API 都不可靠（关掉 APP 数据就丢 / 跨域被拦 / 沙盒里调用会失败）
  - 一切能力必须走宿主注入的 SDK：`window.AiPhone`（也兼容 `window.AiPhoneApp` / `window.api`）
  - 私有数据库用 `AiPhone.db.create/list/get/update/delete`（无 upsert），不要用 localStorage
  - 外部 API 用 `AiPhone.network.fetch({ url, method, body, proxy: true, timeoutMs })`，target API 没 CORS 时必须传 `proxy: true` 走宿主 /api/tool-proxy；manifest 必须声明 `network.allowedDomains`
  - 媒体用 `AiPhone.media.put/get/delete`，不要用 dataURL 塞 db
  - 弹提示用 `AiPhone.ui.toast`，不要用 alert
  - 角色/AI/语音/定位/钱包/工具等所有能力都有对应 SDK，参见 app制造指南.js 能力表
  - 浏览器原生 API 只在宿主 SDK 不可用时作兜底（开发调试场景）
  - 读 app制造指南.js 是任何新增能力开发的第一步，不要凭直觉猜用浏览器原生 API
