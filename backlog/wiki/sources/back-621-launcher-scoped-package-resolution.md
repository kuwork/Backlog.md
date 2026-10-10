---
title: BACK-621 - 修复启动器解析无前缀平台包名回归
labels: [source, cli, bug, release]
created_date: 2026-09-07 22:28
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-621 - Fix-launcher-resolving-unprefixed-platform-package-names-regression-from-BACK-550.md
---

# BACK-621 - 修复启动器解析无前缀平台包名回归

在 Mac arm64 上安装 `@kuwork/backlog.md@1.49.3-CN` 的用户收到“Binary package not installed for darwin-arm64”，尽管平台包已安装。BACK-550 曾把 `scripts/resolveBinary.cjs` 改为基于一个错误说法（称带 scope 的平台包从不发布）构造无前缀平台包名；用无 scope 的说明符做 `require.resolve` 永远不会去 `@kuwork` scope 里找，于是解析在 spawn 之前就失败了。修复方案从主包自己的 `package.json` 名称推导 scope——源码和测试中不再出现任何 `@kuwork` 字面量。

- `scripts/resolveBinary.cjs`：新增 `getOwnPackageName`/`scopePrefixOf`/`PLATFORM_ARCHES` 辅助函数；`getPackageName` 构造 `@<scope>/backlog.md-<platform>-<arch>`，无前缀场景则构造无前缀名——兼容发布布局（`./package.json`）与仓库布局（`../package.json`）；darwin 回退矩阵与可注入的 resolver 保留
- `scripts/postuninstall.cjs`：复用 `PLATFORM_ARCHES` + `getPackageName`，删除其硬编码的包名列表
- `scripts/cli.cjs`：在 spawn 前对二进制执行 `chmodSync 0o755`——覆盖 `publish-npm.cmd` 在 Windows 上打包非 Windows 二进制带来的 EACCES 风险（tarball 模式 0644）；安装帮助文本使用动态主包名；参数清理正则泛化到任意 scope
- 发布现状核对：本 fork 不使用上游 `.github/workflows/release.yml`，而是从发布分支通过 `scripts/build-release.cmd` + `scripts/publish-npm.cmd` 手动发布，后者硬编码的 `@kuwork` 带 scope 名称与推导结果本就一致——release.yml 的改动已回退以保持与上游可合并
- 测试：`resolveBinary.test.ts` 从仓库 package.json 动态推导期望（无 scope 字面量）+ `scopePrefixOf` 单元测试；`cli-launcher.test.ts` 夹具写入真实包名 + 执行位恢复用例；22 通过 / 5 个 POSIX 用例在 win32 上跳过；端到端模拟已发布布局运行 `cli.js --version` → 1.49.3-CN

## 验收标准

- resolveBinary.cjs 从主 package.json 名称推导前缀；源码中无 @kuwork 字面量
- postuninstall.cjs 复用同一推导
- 测试覆盖带 scope/无前缀推导；darwin 回退矩阵通过
- tsc、biome、bun test 通过
- publish-npm.cmd 的已发布名称与推导一致、保持原样；release.yml 保持上游原样
- 启动器在 spawn 前恢复执行位（chmod 0o755）

## Related Concepts

- [[concepts/cli-entry]] — 从全局安装到二进制 spawn 的启动器/resolveBinary 解析链

## Related Sources

- [[sources/back-550-apple-silicon-binary-resolution]] — 引入本次回归的 BACK-550 改动
