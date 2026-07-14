---
title: CLI 跨平台转义一致性模式
labels: [execution, cli, cross-platform]
created_date: '2026-06-05 15:19'
updated_date: '2026-07-14 07:14'
---

# CLI 跨平台转义一致性模式

当 CLI 参数需要在 Windows 与 Unix shell 之间保持一致行为时，可采用「模拟层 + 统一处理」的两层架构。

## 场景

- Windows shell（cmd/PowerShell）不解释 `"` 内的转义序列
- bash 双引号会剥离一层反斜杠
- 同一命令 `backlog task add "Title" --desc "Line1\nLine2"` 在两个平台产生不同文件

## 模式步骤

1. **平台检测**：`process.platform === "win32"`
2. **模拟层（仅 Windows）**：将 bash 双引号行为应用到输入字符串
   - `\\` → `\`
   - `\` → `\`（不变）
3. **统一处理层（全平台）**：应用目标转义规则
   - `\n` → 换行
   - `\\` → 字面反斜杠
4. **透传原则**：未定义的转义序列（如 `\t`）原样保留，不报错

## 应用实例

- BACK-508 将 `processCliEscapes` 应用于 `task create/edit`、`draft create`、`milestone create/edit` 的 `--description`/`--desc`
- BACK-527 扩展应用到 `task create/edit` 的 `--plan`、`--notes`、`--final-summary`，保持与 description 一致的跨平台多行输入体验

## 相关来源
- [[sources/back-508-cli-description-escapes]]
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]]
