---
title: BACK-800 - 修复编译二进制中 DuckDB 原生绑定打包
labels: [source, bug, build, duckdb, release]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-800 - Fix-DuckDB-native-binding-bundling-in-compiled-executables.md
---

# BACK-800 - 修复编译二进制中 DuckDB 原生绑定打包

`bun run build` 在 Windows 上失败，报 `Could not resolve @duckdb/node-bindings-<platform>`；修掉之后编译出的 exe 启动即崩 `ERR_DLOPEN_FAILED`（LoadLibrary: module not found）。两个缺陷此前都处于潜伏态——DuckDB 从未进过已发布二进制，直到有人本地构建才暴露。

## 问题

1. `@duckdb/node-bindings/duckdb.js` 经运行时平台 switch 选择原生绑定，但打包器静态解析每个分支，而 `bun install`（>=1.2.23 按 os/cpu 过滤 optionalDependencies）只装宿主平台的绑定——其余 7 个平台的包不存在，静态解析失败。
2. oven-sh/bun#44063：`bun compile` 只把 `.node` 解到临时目录，不解它链接的兄弟共享库（duckdb.dll / libduckdb.so / libduckdb.dylib），OS 加载器找不到库。

## 解决方案

- `scripts/build.ts`：从 `BACKLOG_BUILD_TARGET` 解析目标平台/架构（默认宿主），把 7 个非目标 `@duckdb/node-bindings-*` 包标记为 external；目标绑定缺失时提前失败并提示用 `bun install --os/--cpu` 安装。虚拟模块插件（`virtual:duckdb-sibling-lib`）解析到目标绑定的兄弟共享库，借 file loader 把它嵌进 exe。
- `src/duckdb/query.ts`：`@duckdb/node-api` 改动态 import 懒加载；首次加载前把内嵌的兄弟共享库写入 `os.tmpdir()`（尺寸检查防陈旧残留，write-then-rename 容忍并发 exe）；从源码运行时为无操作。
- `.github/workflows/release.yml` 与 `ci.yml`：加 duckOs/duckCpu matrix 字段并给 `bun install` 传 `--os/--cpu`，交叉编译任务得以装到目标平台绑定。

实施前先用最小复现验证了兄弟库解出 workaround，再动仓库。

## 验证

`bun run build` 通过；编译 exe 冒烟测试经 `/api/duckdb/query` 对 CSV 完成端到端 DuckDB 查询；本地交叉编译 `BACKLOG_BUILD_TARGET=bun-linux-arm64` 成功；`bun test src/test/duckdb.test.ts` 38 通过；`bunx tsc --noEmit` 与 biome 干净。implementation-notes 测试的 5s 超时 flake 在干净 main 上同样复现，与本改动无关。

## Related Concepts

- [[concepts/ci-platform-contracts]] — CI/release 构建矩阵与平台契约，本任务扩展其 duckdb 绑定安装维度
- [[concepts/embedded-skills]] — 同为构建期把资源嵌进二进制的机制

## Related Sources

- [[sources/back-796-duckdb-csv-excel-sources]] — DuckDB 查询能力本体（冒烟测试所用的 /api/duckdb/query 路径）
- [[sources/back-797-query-block-pagination]] — 同一 DuckDB 查询线
- [[sources/back-539-linux-runner-win32-arm64-build]] — 交叉编译构建线的既有任务
