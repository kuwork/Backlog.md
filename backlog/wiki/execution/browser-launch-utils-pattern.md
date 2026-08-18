---
title: 浏览器启动命令统一模式
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [execution, browser, launch]
extracted_from: [BACK-559]
---

# 浏览器启动命令统一模式

## 模式

1. 新建 `src/utils/browser-launch.ts`
2. 提供 `resolveBrowserLaunchCommand(url, env, platform)`：
   - 读取 `env.BROWSER`
   - trim + 去除包裹引号
   - 不 split、不 shell-evaluate
   - 返回 `[executable, url]`
   - 空/缺失时按 `platform` 回退
3. 提供 `launchBrowser(url)` 供 CLI 和 Server 调用
4. 保留调用方的 try/catch 和手动打开指引

## 测试要点

- BROWSER 覆盖、trim、引号剥离、不 split、空值回退、三平台回退

## Related Sources

- [[sources/back-559-browser-launch-honor-browser-env]]
