---
id: BACK-621
title: >-
  Fix launcher resolving unprefixed platform package names (regression from
  BACK-550)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 21:46'
updated_date: '2026-09-07 22:28'
labels: []
dependencies: []
modified_files:
  - scripts/resolveBinary.cjs
  - scripts/cli.cjs
  - scripts/postuninstall.cjs
  - src/test/resolveBinary.test.ts
  - src/test/cli-launcher.test.ts
ordinal: 224400
actual_start: '2026-09-07 21:46'
actual_end: '2026-09-07 22:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mac arm64 users installing @kuwork/backlog.md@1.49.3-CN get 'Binary package not installed for darwin-arm64' even though the platform package is installed. Root cause: BACK-550 changed scripts/resolveBinary.cjs to build unprefixed platform package names (backlog.md-darwin-arm64) based on the false claim that scoped platform packages are never published; in fact the fork publishes and installs @kuwork/backlog.md-<platform>-<arch> (see package.json optionalDependencies and release.yml). require.resolve with an unscoped specifier never looks inside the @kuwork scope, so resolution fails before spawn. Local builds work because bun run cli runs src/cli.ts directly, bypassing the launcher. Do NOT hardcode the @kuwork prefix back: derive the scope from the main package's own name so the launcher adapts to scoped or unscoped publishing without fork-specific strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/resolveBinary.cjs derives the platform package name prefix from the main package.json name (scope if present, empty otherwise); no @kuwork literal in source
- [x] #2 scripts/postuninstall.cjs reuses the same derivation instead of duplicating package name logic
- [x] #3 Tests cover scoped and unscoped name derivation and the darwin fallback matrix still passes
- [x] #4 bunx tsc --noEmit, bun run check ., and bun test all pass
- [x] #5 发布脚本 scripts/publish-npm.cmd（release 分支，实际 npm 发布流程）发布的 scoped 平台包名与解析器推导结果一致，无需改动；release.yml 为上游 Actions 流程，fork 不使用，保持原样
- [x] #6 启动器在 spawn 前恢复二进制执行位（chmod 0o755），覆盖 publish-npm.cmd 在 Windows 上打包导致 tarball 内二进制为 0644 的 EACCES 风险
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/resolveBinary.cjs: read own package.json name, derive scope prefix (name starting with @ -> scope + '/', else ''), build platform package names with it; keep darwin fallback matrix and injectable resolver for tests
2. scripts/postuninstall.cjs: reuse the derivation helper from resolveBinary.cjs instead of hardcoded unprefixed names
3. .github/workflows/release.yml: derive expected package name and platform package name from main package.json name (node one-liner), and chmod +x the binary before packing
4. Update src/test/resolveBinary.test.ts for scoped/unscoped derivation; keep cli-launcher.test.ts aligned
5. Validate: bunx tsc --noEmit, bun run check ., bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
实际发布流程核实：fork 不走 .github/workflows/release.yml（上游 Actions，platform 包名为 unprefixed，fork 也无上游包发布权限），而是在 release 分支用 scripts/build-release.cmd 构建 GitHub Release 二进制 + scripts/publish-npm.cmd 手动发布 npm。publish-npm.cmd 中平台包名和 optionalDependencies 均硬编码为 @kuwork scoped 名，与主包名一致——因此解析器从主包自身 package.json 的 name 推导 scope 即可对齐，无需在源码中出现 @kuwork 字面量，publish-npm.cmd 无需改动。EACCES 债的根因：publish-npm.cmd 在 Windows 上用 copy 打包非 Windows 二进制，tarball 内 mode 为 0644；已在 cli.cjs spawn 前加 chmodSync 0o755 兜底，比改发布脚本更简单且覆盖所有包管理器安装路径。release.yml 的改动已回退，保持与上游一致减少合并冲突。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
修复 BACK-550 引入的回归：launcher 用 unprefixed 包名 require.resolve 平台包，而 fork 实际发布的是 scoped 包（@kuwork/backlog.md-<platform>-<arch>），导致 darwin-arm64 等用户安装后报 Binary package not installed。未硬编码 @kuwork：scripts/resolveBinary.cjs 改为从主包自身 package.json 的 name 推导 scope 前缀（发布布局 ./package.json、仓库布局 ../package.json 均兼容），unscoped 发布自动回到上游行为。变更：
- scripts/resolveBinary.cjs：新增 getOwnPackageName/scopePrefixOf/PLATFORM_ARCHES，getPackageName 使用推导前缀
- scripts/cli.cjs：spawn 前 chmodSync 0o755 恢复执行位（publish-npm.cmd 在 Windows 打包导致 tarball 内二进制 0644）；安装帮助文本使用动态主包名；arg 清理正则泛化为任意 scope
- scripts/postuninstall.cjs：复用 PLATFORM_ARCHES + getPackageName，删除硬编码包名列表
- 测试：resolveBinary.test.ts 期望改为从 repo package.json 动态推导（无 @kuwork 字面量），新增 scopePrefixOf 单测；cli-launcher.test.ts fixture 写入真实包名并新增执行位恢复用例
核实发布流程：fork 实际用 release 分支 scripts/build-release.cmd + publish-npm.cmd 手动发布（release.yml 为上游 Actions，未使用，已保持原样回退）；publish-npm.cmd 的 scoped 包名与推导结果一致，无需改动。
验证：bun test resolveBinary/cli-launcher 27 用例（22 pass / 5 POSIX skip on win32）；bunx tsc --noEmit 通过；bun run check . 通过（仅 3 个既有警告）；模拟已发布布局（主包 + scoped 平台包 + 真实 exe）端到端运行 cli.js --version 成功输出 1.49.3-CN，postuninstall 派生名单正确。源码与测试中均无 @kuwork 字面量。
<!-- SECTION:FINAL_SUMMARY:END -->
