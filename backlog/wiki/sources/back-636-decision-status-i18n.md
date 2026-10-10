---
title: BACK-636 - 本地化决策状态标签
labels: [source, web-ui, decisions, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-636 - Localize-decision-status-labels-in-the-Web-UI.md
---

# BACK-636 - 本地化决策状态标签

BACK-635 使决策状态可编辑，但徽标与下拉在组件里渲染原始的英文值并首字母大写。本任务在四种语言中本地化标签，并把状态小丸重样式化为任务状态徽标的处理方式——旧小丸只用亮色黄色类、无暗色变体。

- 四个语言文件都新增覆盖 proposed、accepted、rejected、deprecated 与 superseded 的 `statusLabels` 映射；deprecated 虽有标签，尽管它不是编辑器选项——因为它有文档且可能存在于已存数据中
- `DecisionDetail.tsx` 用一个查找辅助函数渲染预览徽标与编辑态下拉选项，自由文本状态回退到之前的首字母大写原始行为；选项值保持原始状态字符串，翻译界面永不改写已存数据
- 重样式（并入 BACK-637 的范围）：本地 `getStatusColor` 辅助函数（bg-yellow-50/text-yellow-700，无暗色变体）被 `DECISION_STATUS_STYLES` 取代，镜像 `utils/task-badge-colors` 的任务状态色板，带 `dark:bg-<hue>-900/50` 成对与中性的回退样式
- 每个已知状态带自己的前导图标（clock、check circle、x circle、slashed circle、swap arrows；info circle 回退），颜色从不是唯一信号；编辑态控件变成前面带同图标的纯 select
- 在 zh-CN 语言的真实浏览器中验证：选项值保持原始而标签本地化，保存存下 `status: accepted`，非规范的 `triage` 状态在两处都回退为 “Triage”；暗色小丸计算为 muted green-900/50 配 green-200 文本（已审阅截图）
- 没有测试导入语言模块，四语覆盖依赖浏览器实测而非新测试

## 验收标准

- 徽标与下拉在全部四种语言中显示五个已知状态的本地化标签；选项值保持原始值
- 非规范的已存状态在两处都渲染为首字母大写的原始值
- 小丸使用无边框任务状态小丸处理，主题感知色对 + 按状态图标；移除过时的 `getStatusColor`

## Related Concepts

- [[concepts/web-ui-i18n]] — 语言文件标签约定与原始值保留
- [[concepts/i18n-string-fragmentation]] — 标签住在组件里而非语言文件时的相关风险

## Related Sources

- [[sources/back-635-decision-status-editing]] — 引入本任务所本地化的可编辑状态
- [[sources/back-517-i18n-fragmentation-fix]] — 组件内嵌界面字符串的早期清理
- [[sources/back-624-global-search-dialog]] — 重样式来源的 `task-badge-colors.ts` 色板
