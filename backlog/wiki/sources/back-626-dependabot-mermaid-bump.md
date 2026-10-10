---
title: BACK-626 - 解决 Dependabot 告警（mermaid 升级）
labels: [source, security, dependencies, build]
created_date: 2026-09-13 01:12
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-626 - Resolve-open-Dependabot-alerts.md
---

# BACK-626 - 解决 Dependabot 告警（mermaid 升级）

五份已发布 advisory 影响钉死的 mermaid `11.15.0`——radar 图 DoS、配置原型链污染、可达兄弟元素的 CSS 注入、架构图原型链污染、XY 图死循环 DoS。Mermaid 在发布产物中并非仅开发期使用：`src/web/utils/mermaid.ts` 导入预构建浏览器 bundle，该 bundle 被嵌入编译后的 CLI 二进制，并在回环 Web UI 中渲染任务/文档 markdown。`securityLevel strict` 能挡住脚本注入，但挡不住 CSS 与原型链污染问题。

- 直接依赖 `mermaid` 从 `11.15.0` 升到精确 `11.16.1`——修复全部五个 GHSA 的版本（`GHSA-rhh3-jpg6-66xh`、`GHSA-c4c3-pg64-4m4v`、`GHSA-6x64-9x62-f2gx`、`GHSA-3rrr-jr9j-h3q3`、`GHSA-2v8p-3f2j-5mp7`）；advisory 数据库扫描显示 `11.16.1` 无未决 advisory
- 版本选择：`11.17.2` 是最新的干净 11.x，但 `11.16.1` 已有公开的深度供应链验证与五周的公开暴露期
- `bun.lock` 重新生成：可归因于本次升级的差值是 7 行新增、只覆盖 mermaid 子树（mermaid、`@braintree/sanitize-url`、`@mermaid-js/parser`、`cytoscape`、`dayjs`、`katex`、根 spec）；删除的 150 行是孤儿条目清理，在未修改的树上跑一次普通 `bun i` 也会复现
- `bun.nix`：mermaid 子树的六个条目因生成器需要 Docker 或 Nix（本机不可用）而手工更新；每个哈希逐字节匹配 lockfile 的 sha512 完整性，块结构保持生成器产物样式
- 验证：类型检查、Biome、`src/test/mermaid.test.ts`（3 通过）、完整 `bun run build`（二进制已刷新，报告 `1.50.1-CN`，含 11.16.1 标记）；全量套件剩余失败在未改动的依赖、低内存条件下可复现
- 记下 fork 缺口：`bun.nix` 在本 fork 无 CI 校验（无 nix 任务、无 bun2nix 守卫），逐字节 lock 完整性交叉核对是唯一的本地保证

## 验收标准

- mermaid 在 `package.json` 与 `bun.lock` 中解析到 >= 11.16.1 且无已知未决 advisory
- 可归因于升级的 lockfile 差值只触及 mermaid 子树
- Mermaid 渲染仍正常，`src/test/mermaid.test.ts` 通过
- 升级后编译二进制可构建，`bun.nix` 仅为 mermaid 子树重新生成

## Related Concepts

- [[concepts/web-ui-features]] — 本次升级保护的已列出 Web UI 技术特性 mermaid 渲染
- [[concepts/ci-platform-contracts]] — 本 fork 缺失的 Nix 校验任务所属位置
- [[concepts/core-architecture]] — 把 mermaid bundle 带进 CLI 二进制的构建/嵌入路径

## Related Sources

- [[sources/back-553-modernize-browser-bundling]] — 把 mermaid 带进二进制的 BACK-553 Bun.build 流水线
