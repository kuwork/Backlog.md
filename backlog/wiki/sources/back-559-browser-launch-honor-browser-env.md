---
title: BACK-559 - 浏览器启动遵循 BROWSER 环境变量
labels: [source, cli, server, browser]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-559 - Honor-BROWSER-for-devcontainer-browser-launch.md
---

# BACK-559 - 浏览器启动遵循 BROWSER 环境变量

打开 Web UI 时，现在将非空的 `BROWSER` 环境变量作为可执行文件路径遵循，在 devcontainer 场景下非常有用。

## 实现要点

- 新增 `src/utils/browser-launch.ts`，包含 `resolveBrowserLaunchCommand(url, env, platform)` 与 `launchBrowser(url)`。
- `BROWSER` 被视为单个可执行文件路径：去除首尾空白、剥离包裹引号，绝不拆分或进行 shell 求值；URL 作为独立参数传递。
- 当 `BROWSER` 未设置或为空时，使用平台回退：macOS 用 `open`，Windows 用 `cmd /c start`，其他平台用 `xdg-open`。
- 将 `src/cli.ts` 与 `src/server/index.ts` 中两处内联浏览器打开实现替换为 `launchBrowser(url)` 调用，保留 fork 的 try/catch 与手动打开提示。
- 从两个文件中移除不再使用的 `import { $ } from "bun"`。
- `env` 与 `platform` 可注入以便单元测试。测试覆盖 BROWSER 覆盖、空白裁剪、引号剥离、不拆分/shell 求值、空/空白/带引号空的回退，以及全部三个平台回退。

## Related Concepts

- [[concepts/web-server]] — Web Server 与浏览器启动
- [[concepts/cli-entry]] — CLI 命令面

## Related Sources

- [[sources/back-558-browser-server-loopback-only]] — 浏览器服务器回环绑定
