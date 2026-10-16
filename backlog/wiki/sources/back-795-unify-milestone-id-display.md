---
title: BACK-795 - 统一里程碑 ID 大写 M-N 显示
labels: [source, web-ui, tui, cli, milestones]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-795 - Unify-milestone-ID-display-uppercase-M-N-style-across-Web-UI-TUI-and-CLI-plain-output.md
---

# BACK-795 - 统一里程碑 ID 大写 M-N 显示

里程碑 ID 在各端要么不显示代号、要么小写（m-9），与任务 ID 的大写渲染（TASK-9）不一致。本任务新增共享显示助手 `formatMilestoneId` 并铺到 Web、TUI、CLI plain 三端；纯显示层改动，存储与别名解析不变。

## 目标

- Web 里程碑列表与详情标题显示大写代号（M-9 — Title，em dash 对齐任务详情模态框）；标签回退到裸 id 时代号只显示一次。
- TUI 里程碑行与详情弹窗头部用 M-N - Title 风格（连字符，对齐任务行）。
- `milestone list --plain` 小节标题渲染为 `## M-N - Title (n tasks)`。
- `formatMilestoneId` 有单测，受影响的 web/TUI/CLI 测试同步更新。

## 实现要点

- `formatMilestoneId` 落在 `src/core/milestones.ts`（经 `src/web/utils/milestones.ts` 再导出）：大小写不敏感匹配 `m-<digits>`，前缀大写、去零填充，非 id 引用原样透传。
- 应用点：`src/web/components/MilestonesPage.tsx`（桶标题、移除/重分配下拉选项）、`src/web/components/MilestoneDetailsModal.tsx`（模态框标题、重分配选项）、`src/ui/milestones.ts`（`formatRowLabel` 侧边栏行、详情弹窗头部、移除提示）、`src/board.ts`（`generateMilestoneGroupedBoard` 小节标题）。标签等于裸 id（实体未加载）时只显示代号。

## 验证

`src/web/utils/milestones.test.ts` 新增 `formatMilestoneId` 用例；更新 `board.test.ts`、`milestones-tui.test.ts`、`web-milestone-live-add.test.tsx`、`cli-milestone-management.test.ts`。`bunx tsc --noEmit`、biome check 及受影响测试文件通过；milestones-tui 有 4 个弹窗计时用例在本机基线上同样 flaky，与本改动无关。

## Related Concepts

- [[concepts/milestones]] — 里程碑管理，本任务统一其三端 ID 显示风格

## Related Sources

- [[sources/back-688-milestones-plain-grouped-output]] — milestones plain 分组输出，本任务改其小节标题格式
- [[sources/back-792-milestone-live-add-title-fix]] — 裸 id 回退标签的代码路径（`getMilestoneLabel`）来源
- [[sources/back-761-terminal-card-actual-end]] — 同期里程碑显示打磨线
