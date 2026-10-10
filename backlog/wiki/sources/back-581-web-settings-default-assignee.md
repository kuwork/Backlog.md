---
title: BACK-581 - Web 设置编辑 defaultAssignee
labels: [source, web-ui, config]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-581 - Add-defaultAssignee-editing-to-web-settings.md
---

# BACK-581 - Web 设置编辑 defaultAssignee

在 Web UI 设置页（Workflow Settings 小节，与 defaultStatus/defaultEditor 并列）新增 `defaultAssignee` 编辑入口。用户可查看、添加、移除和重排默认负责人；保存走既有 `updateConfig` API，语义与 CLI 一致（空列表清除默认值，列表在创建时替换默认值）。依赖 BACK-579——它将 `defaultAssignee` 变为经 core/config 接通的字符串列表。

## 实现要点

- `src/web/components/Settings.tsx`：Workflow Settings 小节新增列表编辑器，数据来自 `fetchConfig`；保存时空列表归一化为 `undefined` 以删除该键（匹配 CLI 清除语义）。
- 使用 TaskDetailsModal 负责人已在用的共享 `ChipInput` 组件（打磨项合并自 BACK-582）；中文标签从 `经办人`/`經辦人` 更名为 `负责人`/`負責人` 以保持一致。
- label/description/placeholder 的 i18n 字符串加入 `src/web/locales/en.ts`、`zh-CN.ts`、`zh-TW.ts`、`ja.ts`。
- `src/test/server-config-endpoint.test.ts` 覆盖 `defaultAssignee` 经 PUT `/api/config` 的往返与清除语义。
- 验证：`bunx tsc --noEmit` 和 `bun run check .` 通过（仅既有 `src/core/assets.ts` 警告）；目标测试通过。

## 验收标准

- 设置页显示从 fetchConfig 填充的 defaultAssignee 控件；用户可添加、移除和重排负责人。
- 保存经 updateConfig 持久化为 YAML 列表；空列表清除默认值，与 CLI 语义一致；测试覆盖往返。

## Related Concepts

- [[concepts/web-ui-features]] — 设置页配置编辑模式
- [[concepts/web-ui-i18n]] — 四语言标签更新

## Related Sources

- [[sources/back-579-default-assignee]] — 本 UI 所编辑的 core/config 实现（同批次）
- [[sources/back-533-config-block-yaml-lists]] — 配置 YAML 列表序列化语义
