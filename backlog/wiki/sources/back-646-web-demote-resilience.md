---
title: BACK-646 - 新增 Web 降级转草稿操作
labels: [source, web-ui, drafts, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-646 - Add-Web-UI-demote-to-draft-action.md
---

# BACK-646 - 新增 Web 降级转草稿操作

Web 任务弹窗的降级转草稿操作是发后即忘：走带重试的拉取路径（降级不是幂等的——每次尝试分配一个新草稿 id），不绑定启动时的任务身份，运行期间也不阻塞其他写入。本任务让该操作端到端韧化。移植上游 BACK-419 的 Web 半边。

- `src/web/lib/api.ts`：`fetchWithRetry` 获得显式重试覆盖与新 `fetchWithoutRetry`（零重试）；`demoteTask` 迁到其上，丢失响应或移动后服务器错误以原始错误上溯，而不是重放失败
- `TaskDetailsModal.tsx`：降级身份（打开状态、任务 id、来源、分支、草稿 vs 任务）加 `activeDemotionRequest` ref 与 `demoting` 状态，绑定每次 await 之后的每个续体——响应落在弹窗已切换任务或关闭之后被丢弃，不再关闭/刷新一个不再归它管的视图
- 降级期间：保存、完成、归档、提升、评论操作、条件/DoD 切换、内联元数据被阻塞；`d`/`c`/`e`/`p` 快捷键提前返回；按钮禁用；Escape/关闭被忽略；拒绝第二次降级；按钮显示 “Demoting…”
- 错误分流：网络错误警告降级可能已成功并刷新视图，用户核实草稿列表后再重试；真实拒绝保留服务器消息；成功则派发 `drafts-updated`、刷新后关闭——移动后的刷新失败改为警告而非静默关闭
- 范围决策：上游的 `demotionState` 与 409 降级冲突分类未移植，因为本 fork 的 `FileSystem.loadTask`/`Core.demoteTask` 形态使两个分支都不可达；Web 侧韧化完整移植
- i18n 键覆盖 en/ja/zh-CN/zh-TW；`Modal.tsx` 页头与操作行现在换行包裹，额外操作在窄宽度不会裁切
- 测试：新 `web-task-details-modal-demote.test.tsx`（5 用例：非重试请求、过期身份、丢响应警告、阻塞状态、刷新并关闭）；55 用例定向 Web 运行全绿。注：测试把 `CustomEvent` 桥接进 jsdom 领域，因为弹窗经裸全局派发 `drafts-updated`

## 验收标准

- 降级永不自动重试；原始服务器错误存活
- 进行中的降级绑定身份；过期续体被丢弃
- 降级期间阻塞所有其他写入、快捷键与关闭
- 丢响应警告“可能已成功”并刷新视图；拒绝保留其消息

## Related Concepts

- [[concepts/task-lifecycle]] — 降级转草稿变更语义
- [[concepts/web-ui-features]] — 任务弹窗操作与键盘快捷键约定
- [[concepts/web-ui-i18n]] — 新字符串遵守的四语标签契约
- [[concepts/upstream-migration]] — 移植上游 BACK-419（提交 5ba37fca1）并有刻意的范围缩减

## Related Sources

- [[sources/demote-to-draft-action]] — 本任务加固的原始 Web 降级操作
- [[sources/back-644-web-draft-editing-fix]] — 草稿列表共享的 `drafts-updated` 刷新事件
- [[sources/back-571-fail-fast-concurrent-task-edits]] — 相关的进行中变更守卫
