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
- Context: LUMA-Live 项目的本质与宿主/APP 关系；如何正确使用宿主 SDK
- Instructions:
  - 架构：小手机宿主 = `xiaolongbao0709/ai-virtual-phone`（netlify 部署），LUMA-Live = 小手机里装的**一个 APP**（沙盒 iframe 跑在宿主里）
  - LUMA-Live **就是沙盒 APP**，所有持久化必须用宿主 SDK，**不要用 localStorage**（退出 APP 数据就丢）
  - 私有数据库：`AiPhone.db.create / list / get / update / delete`（无 upsert，整个 JSON 塞单条 record）
  - 外部 API：`AiPhone.network.fetch({ url, method, body, proxy: true, timeoutMs })`——沙盒 iframe 不能用浏览器原生 fetch，**必须**显式传 `proxy: true` 走宿主 /api/tool-proxy
  - manifest 必须声明 `network.allowedDomains`，否则宿主代理拒绝转发
  - manifest 已有权限 `"network.fetch"`，无需再加
  - 媒体：`AiPhone.media.put / get / delete`，不要用 dataURL 塞 db
  - 弹提示：`AiPhone.ui.toast`
  - 角色/AI/语音/定位/钱包/工具/世界书/记忆 等所有能力都有对应 SDK，**全部走 SDK**，不要用浏览器原生 API
  - `window.AiPhone` / `window.AiPhoneApp` / `window.api` 三种别名都可能，按顺序探测
  - 读 `app制造指南.js` 是任何新增能力开发的第一步
