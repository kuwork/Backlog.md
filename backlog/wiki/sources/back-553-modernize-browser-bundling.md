---
title: BACK-553 用 Bun 与 Tailwind 现代化浏览器 UI 打包
labels: [source, build, web-ui]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-553 - Modernize-browser-UI-bundling-with-Bun-and-Tailwind.md
---

# BACK-553 用 Bun 与 Tailwind 现代化浏览器 UI 打包

将浏览器 UI 构建流程迁移到 Bun 原生全栈构建（`Bun.build` + `bun-plugin-tailwind`），替代旧的两步 build:css + compile 流程。

## 问题

浏览器 UI 构建流程是 `build:css`（`@tailwindcss/cli` 预生成 `src/web/styles/style.css`）再 `bun build --compile`，依赖提交进仓库的生成产物 style.css，并残留过时的 favicon 回退逻辑。

## 解决方案

- **新增 `scripts/build.ts`**：使用 `Bun.build` + `bun-plugin-tailwind`，使编译出的二进制直接从源码嵌入 React 应用、Tailwind CSS、JS 与静态资源；支持 `BACKLOG_BUILD_OUTFILE`/`BACKLOG_BUILD_VERSION`/`BACKLOG_BUILD_TARGET` 环境变量与编译输出文件（含 `executablePath`，对应 `--compile-executable-path`）
- `src/web/index.html` 的样式表链接从 `./styles/style.css` 指向源码入口 `./styles/source.css`，删除提交的生成文件 style.css
- 移除 `src/server/index.ts` 中的 favicon import 与 `/favicon` 回退分支，改由 Bun 从 HTML bundle 提供 hashed favicon 资产
- `package.json` 的 build/cli 脚本改调 scripts/build.ts；`bunfig.toml` 开发模式加 `[serve.static] plugins = [bun-plugin-tailwind]`；ci.yml/release.yml/flake.nix 构建步骤与 DEVELOPMENT.md 同步到共享构建脚本
- `scripts/build-release.cmd` 修复为调用 `bun scripts/build.ts` + 4 个环境变量（`BACKLOG_BUILD_VERSION/TARGET/OUTFILE/EXECUTABLE_PATH`），保留 `:ensure_runtime` 缓存跨编译 workaround

## 实现位置

- `scripts/build.ts`（新增）、`scripts/build-release.cmd`
- `src/web/index.html`、`src/web/styles/source.css`
- `src/server/index.ts`
- `package.json`、`bunfig.toml`、`.github/workflows/ci.yml`、`release.yml`、`flake.nix`、`DEVELOPMENT.md`
- `src/test/build.test.ts`

## 测试

`src/test/build.test.ts` 扩展——spawn 编译后二进制、启动浏览器、断言 no-store HTML 头与 hashed CSS/JS/favicon 资产服务及编译后二进制行为（1 pass、16 断言）。验证：`bunx tsc --noEmit`、biome check 通过，`bun scripts/build.ts` 成功构建 105MB 编译二进制。

## Related Concepts
- [[concepts/embedded-skills]] — 构建时嵌入
- [[concepts/web-server]] — 静态资产服务
- [[concepts/web-ui-features]] — Tailwind 渲染

## Related Sources
- [[sources/back-539-linux-runner-win32-arm64-build]] — 发布构建
- [[sources/back-550-apple-silicon-binary-resolution]] — 二进制解析
- [[sources/doc-4-upstream-migration-classification]] — B10 迁移分析
