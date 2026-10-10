---
title: BACK-586 - 允许清空 defaultEditor
labels: [source, cli]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-586 - Allow-clearing-defaultEditor.md
---

# BACK-586 - 允许清空 defaultEditor

此前没有受支持的方式清除已配置的 defaultEditor：`config set defaultEditor ""` 被可执行文件校验拒绝，`init --default-editor ""` 被真值回退静默丢弃。两条路径现在都把显式空值视为"无编辑器"——这很重要，因为发布的默认 `code --wait` 会挂起无人值守的 agent 进程。

## 实现要点

- `config set defaultEditor ""`：值为空时跳过 `isEditorAvailable` 可执行检查；配置序列化器本就在 falsy 时省略 `default_editor`，从 config.yml 清除该键（`src/file-system/operations.ts`）。
- `init --default-editor ""`：isNonInteractive 防护从真值判断改为 `options.defaultEditor !== undefined`，回退链在 `src/cli.ts` 中从 `||` 改为 `??`，显式空标志不再落到 existingConfig/EDITOR/VISUAL；`src/core/init.ts` 中既有的空值清除逻辑（`hasDefaultEditorOverride` + delete）删除该键。
- 非空值仍校验，可执行文件缺失时拒绝。
- 测试：`src/test/config-commands.test.ts` 新增 3 个用例（19 pass），外加两条清除路径的脚本化复现。

## 验收标准

- config set defaultEditor "" 清除该键；init --default-editor "" 清除先前配置的编辑器；非空值仍校验；测试覆盖两条清除路径。

## Related Concepts

- [[concepts/cli-entry]] — config 命令与 init 标志处理
