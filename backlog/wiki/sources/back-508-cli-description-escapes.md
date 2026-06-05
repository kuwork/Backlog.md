---
title: BACK-508 CLI description 换行符转义修复
labels: [source, bug, cli, ux]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
source_path: backlog/tasks/back-508 - CLI task create does not interpret backslash-n escape sequences in description.md
---

# BACK-508 CLI description 换行符转义修复

修复 CLI 在 Windows 上无法通过 `\n` 在 `--description`/`--desc` 中插入换行的问题，实现跨平台一致的转义行为。

## 问题

- Windows shell 不解释转义序列，用户输入 `\n` 被原样写入任务文件
- bash 双引号字符串会剥离一层反斜杠，同一命令在不同平台产生不同结果
- 跨平台体验不一致

## 解决方案

1. **Windows 上模拟 bash 双引号转义层**：`\\` → `\`
2. **全平台统一 C-style 转义**：`\n` → 换行，`\\` → 字面反斜杠

| 用户输入 | Windows 流程 | bash 流程 | 最终结果 |
|---|---|---|---|
| `\\\\n` (4 个反斜杠) | `\\\\n` → bash 模拟 → `\\n` → C 转义 → `\n` | `\\n` → C 转义 → `\n` | `\n` (字面) |
| `\\n` (2 个反斜杠) | `\\n` → bash 模拟 → `\n` → C 转义 → 换行 | `\n` → C 转义 → 换行 | 换行 |
| `\n` (1 个反斜杠) | `\n` → bash 模拟 → `\n` → C 转义 → 换行 | `\n` → C 转义 → 换行 | 换行 |

## 实现

- `processCliEscapes` 辅助函数加入 `src/cli.ts`
- 应用于五个命令的 `--description`/`--desc`：
  - `task create` / `task edit`
  - `draft create`
  - `milestone create` / `milestone edit`
- `\t`、 `\r` 等其他转义序列原样透传

## 测试

- `src/test/description-newlines.test.ts` 更新为 5 个用例，覆盖跨平台场景

## Related Concepts
- [[concepts/cli-entry]] — CLI 命令体系与交互模式

## Related Sources
- [[sources/back-506-cli-utc-conversion-fix]] — BACK-506 CLI UTC 转换修复
