---
title: BACK-722 - 修复既存与随机测试失败
labels: [source, tests, tooling]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-722 - Fix-pre-existing-and-flaky-test-failures-across-the-suite.md
---

# BACK-722 - 修复既存与随机测试失败

BACK-721 验证期间通过 stash 基线确认了一批在干净代码树上就存在的失败，目标是让 `bun test` 全绿并消除对负载敏感的随机超时。

## 问题

确定性失败有两类真实问题：`getSearchResultMeta` 的实现新增了 `completed` 字段（用于已完成语料的角标）而测试断言未同步；TUI 任务编辑器的三个极端尺寸布局测试失败——根因是 BACK-689 给编辑器加了计划/实际/截止日期字段后，BACK-678 写的几何断言（如 Create 按钮位置）过期，修复方式是按当前编辑器重新推导几何并复核原不变量。

负载敏感的超时（vacated-task-references、cli-board-integration、AcceptanceCriteriaManager、ContentStore、queryTasks、server-search-endpoint 等，失败集合每次运行漂移）单跑均通过、全量并行时超默认 5 秒；过程中还探明 Bun 1.3.14 会静默忽略 bunfig 中 `[test]` 的 timeout 配置（bunfig 已改为数字格式但无效，只能靠第三参）。

## 解决方案

给 7 个文件中的 23 个重测试显式 20 秒预算、编译 exe 的测试 120 秒。顺手做的加固：清理误入 tmp/ 的测试产物；`ViewSwitcher.startLoading` 不再泄漏未处理的 background rejection；graph service 的 `reconcile()` 在扫描与读取窗口之间文件被删除（server 测试的临时目录清理）时会以未处理错误崩掉同步，现在读文件遇 ENOENT 跳过该文件，graph 套件 66/66 通过。cli-board-integration 改用 `statusNames()` 以兼容对象形态的状态机配置（BACK-721 引入）。

## 验证

连续两次全量运行 0 失败（3098 与 3119 通过）。

## Related Concepts

- [[concepts/kuzu-graph]] — graph reconcile 的 ENOENT 容错加固属于 Kuzu 任务图同步链路的稳定性修复

## Related Sources

- [[sources/back-612-content-store-test-stabilization]] — 同为测试稳定性任务，处理 ContentStore 相关测试的随机失败
- [[sources/back-609-mcp-stdio-test-timeout]] — 同为给敏感测试显式放大超时的先例
- [[sources/back-610-cli-priority-filtering-test-timeouts]] — 同为测试超时治理任务
