---
title: BACK-723 - Extend Biome coverage to .tsx files
labels:
  - source
  - tooling
  - biome
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:10'
source_path: backlog/tasks/back-723 - Fix-biome.json-to-cover-.tsx-files.md
---

# Extend Biome coverage to .tsx files

`biome.json` 的 includes 只匹配 `src/**/*.ts`，导致 100+ 个 .tsx 文件（web 组件与 web 测试）完全脱离 Biome 的格式化、lint 与 import 整理，问题继承自上游 MrLesk/Backlog.md。

采用彻底修复：`includes` 扩展到 `src/**/*.{ts,tsx}`，先以 `biome check --write` 做机械安全修复（约 96 个文件），再人工清剩余约 400 条诊断（约 104 条 useExhaustiveDependencies、35 条 noNonNullAssertion、29 条 noExplicitAny、23 条 noArrayIndexKey 等）。策略上不留裸规则豁免：noNonNullAssertion 用代码重写修复并对 `src/test/**` 加 override（测试中的惯用法）；50 处 useExhaustiveDependencies 用 biome-ignore 注释压制，且逐条审计——40 条安全、8 条有风险（仅影响 i18n/注释）、2 条是真 bug。

审计中修掉的两个真 bug：`DocumentationDetail.tsx` 的 handleSave 补上 `originalDocTitle` 依赖（改回原名会被静默丢弃）；`TaskDetailsModal.tsx` 的 keydown 监听器改用 latest-ref 模式（此前 Cmd+S 可能保存旧的 milestone/dates）。

合并后的回归修复（视觉检查发现）：`Modal.tsx` 的 document 级 backdrop 监听会让打开弹窗的那次点击冒泡触发立即关闭，改用 overlayRef 只在点击落在遮罩本身时关闭，并补了回归测试；`MilestoneTaskRow` 从 div 改 button 后行宽收缩破坏了里程碑页列对齐，用 `w-full` 修复。教训：语义化标签重构（div->button/fieldset/ul/li）需要视觉验证——测试只抓到 DOM 选择器层面的破坏（TaskColumn 的 12 个测试因 `.space-y-3 > div.relative` 选择器过期而挂，已改为 `li.relative`），抓不到布局回归。

最终 `bun run check .` 0 诊断、tsc 干净、bun test 3119 通过 / 0 失败。

## Related Concepts
- [[concepts/web-ui-features]] — 修复集中在 web 组件层（Modal、MilestoneDetailsModal、TaskColumn 等），语义化标签与布局回归是 web UI 特有的风险面

## Related Sources
- [[sources/back-684-task-detail-popup-backdrop-resize]] — 同属 Modal 弹窗交互修复（backdrop 相关行为）
