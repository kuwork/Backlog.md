---
title: Bug 修复 → 预防模式
labels: [pattern, quality, testing]
created_date: 2026-05-27 00:00
updated_date: 2026-05-27 00:00
---

# Bug 修复 → 预防模式

修复单一 bug 后，通过审计、回归测试和状态验证机制，防止同类问题在其他代码路径中复发。

## 适用场景

- 配置项未被尊重（如 `autoCommit`、`checkActiveBranches`）
- 文件系统误匹配（如 `*.md` 把 README.md 当任务解析）
- Web UI 保存后状态丢失或覆盖
- 大小写 / 格式不一致导致的数据匹配失败
- 终端编辑器集成后 TTY 状态异常

## 标准步骤

| 顺序 | 动作 | 目的 |
|---|---|---|
| 1 | **症状修复** | 定位并修复触发 bug 的具体代码路径 |
| 2 | **根因分析** | 区分「表面原因」与「根本原因」（如：表面是 glob 太宽，根本是没有按前缀过滤） |
| 3 | **审计扫荡** | `grep` 全仓库寻找同类模式（如所有硬编码 `true`、所有 `*.md` glob、所有裸字符串 ID 比较） |
| 4 | **统一修复** | 将所有同类实例替换为正确模式（如 `taskIdsEqual()`、前缀过滤函数、配置读取） |
| 5 | **回归测试** | 添加验证「修复类别」的测试，而非只验证「修复点」 |
| 6 | **状态守卫** | 在数据流关键节点添加前置/后置断言或 ref 守卫，防止未来变更破坏不变量 |

## 常见陷阱

| 陷阱 | 示例 | 预防 |
|---|---|---|
| **只修点不修面** | BACK-164 添加 `autoCommit` 后，BACK-166 审计发现仍有命令硬编码提交行为，BACK-187 又发现更多 | 修复后必须执行 `grep -r "git.commit\|git.add" src/` 式审计 |
| **测试只覆盖修复点** | 测试通过但其他 5 个命令仍有相同 bug | 回归测试用参数化测试遍历所有命令变体 |
| **React stale reference 误判** | BACK-357 初版修复会在后台刷新时覆盖用户未保存的编辑 | 引入 `pendingEditingTaskSyncRef`，区分「显式保存」与「被动刷新」两种同步时机 |
| **宽泛 glob 的隐蔽危害** | BACK-185 `*.md` 把 README.md 当任务；BACK-186 导致重复 ID | 所有文件系统遍历必须使用 `task-${prefix}-*.md` 而非 `*.md` |
| **配置默认值与显式传参冲突** | `core.createDocument(doc, true, ...)` 中 `true` 硬编码覆盖了用户配置 | Core 层 API 的布尔参数默认 `undefined`，让 Core 内部读取配置决定 |

## 回归测试模板

```typescript
// 以 autoCommit 为例：参数化测试所有命令
describe.each([
  ['task create', () => cli(['task', 'create', 'Test'])],
  ['task edit', () => cli(['task', 'edit', 'TASK-1', '--title', 'New'])],
  // ... 所有会修改文件的命令
])('%s with autoCommit disabled', (_name, command) => {
  it('should not create git commit', async () => {
    const before = getCommitCount();
    await command();
    expect(getCommitCount()).toBe(before);
  });
});
```

## 参考任务

- [[sources/back-490-overview-command-task]] — BACK-490 附带修复了 `taskIdsEqual()` 大小写比较和 `recentlyUpdated` 回退
- [[sources/due-date-fields-task]] — BACK-401 中的 `renameMilestone → updateMilestone` 重构同时修复了「仅日期变化时短路返回 No changes」的隐藏 bug
