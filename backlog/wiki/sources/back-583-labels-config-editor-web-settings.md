---
title: BACK-583 - Web 设置 labels 配置编辑器
labels: [source, web-ui, cli]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-583 - Add-labels-config-editor-to-web-settings.md
---

# BACK-583 - Web 设置 labels 配置编辑器

Web UI 设置页新增 `labels` 配置键的编辑器（项目推荐标签，用作 Web UI 和 TUI 的自动补全），沿用 defaultAssignee 和 TaskDetailsModal 标签已在用的 ChipInput 模式。

## 实现要点

- `src/web/components/Settings.tsx` 的 Workflow Settings 小节新增 labels ChipInput 编辑器，位于 defaultAssignee 和 defaultEditor 之间。
- 保存时归一化标签：去空白、过滤空值；在 BacklogConfig 中仍是必需的 `string[]`（非 undefined）。
- label/description/placeholder 的 i18n 字符串加入 `src/web/locales/en.ts`、`zh-CN.ts`、`zh-TW.ts`、`ja.ts`。
- `src/test/server-config-endpoint.test.ts` 扩展了 labels 往返和经空列表清除的测试（20 pass / 0 fail）。

## 验收标准

- 设置页显示从 config.labels 填充的 labels 编辑器；经 ChipInput 添加/移除；经 updateConfig 持久化并正确重载。
- 四个语言环境的 i18n 字符串齐全；测试覆盖经 /api/config 的往返。

## Related Concepts

- [[concepts/web-ui-features]] — 设置页配置编辑面
- [[concepts/web-ui-i18n]] — 四语言 i18n 字符串约定（en/zh-CN/zh-TW/ja）
