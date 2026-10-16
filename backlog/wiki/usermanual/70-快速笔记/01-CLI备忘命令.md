---
title: CLI 备忘命令
labels: [usermanual]
created_date: 2026-10-03 01:14
updated_date: 2026-10-10 23:27
---


# CLI 备忘命令

`backlog memo` 子命令组提供终端里的快速捕获与浏览能力，与 HTTP API、MCP 工具共享同一存储模块（`src/core/memos.ts`），保证一套 ID 方案、一种文件格式。

## 创建备忘

```bash
# 内联创建（memo create 不接受位置参数，正文必须走 --content）
backlog memo create --content "周会结论：v2 发布推迟一周" --tags meeting

# 多行内容从 stdin 读取（省略 --content 时）
cat debug.log | backlog memo create --tags debug

# 手动输入多行：直接在终端敲正文，EOF 结束
backlog memo create --tags debug
# Type the memo, then end with Ctrl+D (Ctrl+Z on the classic Windows console). Ctrl+C aborts.
# 第一行
# 第二行
```

> 交互终端下省略 `--content` 会进入键盘捕获：提示语输出到 stderr（不会混进正文），多行原样落盘；`Ctrl+C` 中断，不建文件（退出码 130）；直接结束输入（空正文）报 `Memo content is empty.`，不建文件。
>
> **结束键**：优先用 `Ctrl+D`——VS Code 集成终端、Git Bash、Windows Terminal 都会把这个按键原样交给程序，Unix/macOS/WSL 上它还产生真正的 EOF。经典 Windows 控制台（cmd/PowerShell）不投递任何 EOF，此时改用 `Ctrl+Z`；注意 `Ctrl+Z` 在 VS Code 里被拦截、在 mintty(Git Bash) 里是挂起信号，所以这两个环境统一用 `Ctrl+D`。
>
> 实现要点：TTY 上命令会切到 raw mode 才能识别这些按键，因此回显由 CLI 自己做（逐字符回显、`Enter` 换行、`Backspace` 擦除当前行）；管道/重定向时仍是原本的「直接读 stdin、不回显」。

- `--content <text>`：内联正文，省略时从 stdin 读取——管道/重定向时直接读，TTY 时改为键盘捕获
- `--tags <tags>`：逗号分隔的标签列表，两种输入方式下都生效
- 创建成功后 CLI 输出新 memo 的 ID（如 `20261003-1`）

## 列出备忘

```bash
backlog memo list

# 只看某一天的备忘
backlog memo list --date 2026-10-01

# 按标签过滤（逗号分隔或可重复，大小写不敏感，任一匹配）
backlog memo list --tags meeting,debug
```

列表按最新在前逐行输出「ID + 一行预览」（正文前 20 个字符、去换行、截断加省略号），全文请用 `memo view` 查看。

### 列表分页

`memo list` 与其他列表命令一样支持统一的分页窗口选项：

| 选项 | 说明 | 示例 |
|------|------|------|
| `--max-count <n>` | 最多输出 n 条 | `--max-count 20` |
| `--skip <n>` | 跳过前 n 条（取下一页） | `--skip 20` |
| `--count` | 只输出匹配总数（一个数字） | `--count` |

被截断的文本输出以 `Showing <first>-<last> of <total> items. Next: backlog memo list --skip <n>` 结尾，照抄即可翻页；`--count` 只输出数字且不能与 `--json` 组合。各列表命令分页语义的集中说明见 [搜索与序列](../../10-任务管理/04-搜索与序列.md) 的「列表分页」一节。

### 纯文本输出

```bash
backlog memo list --plain
```

`--plain` 输出纯文本列表，适合 AI 代理与脚本解析。注意：CLI 的文本搜索输出（`backlog search`）**不包含** memo 结果——memo 被视为 Web-only 类型（与 Wiki 结果一致），JSON 输出中会携带 memo 摘要。

## 查看备忘

```bash
# TTY 环境：打开可滚动查看器（PageUp / PageDown 翻页）
backlog memo view 20261003-1

# 非 TTY 或 --plain：直接打印全文与 frontmatter
backlog memo view 20261003-1 --plain
```

## 更新备忘

```bash
# 替换正文
backlog memo update 20261003-1 --content "修正后的结论"

# 追加一行（保留原有内容）
backlog memo update 20261003-1 --append "补充：性能回归已定位到缓存层"

# 只改标签（保留正文不动）
backlog memo update 20261003-1 --tags meeting,important

# 正文与标签一起改
backlog memo update 20261003-1 --append "补充一句" --tags meeting,important

# 清空标签
backlog memo update 20261003-1 --tags ""
```

`--content` 与 `--append` 二选一；`--tags` 可与它们任意组合，也可单独使用（只改标签是合法更新）。三者都不给则报错 `No update options provided.` 并退出。省略 `--tags` 表示不动原标签，传空值 `--tags ""` 表示清空标签。更新会刷新 `updated_date`。

标签解析与 REST `PATCH /api/memos/:id` 一致：trim、丢弃空项、去重，支持逗号分隔或重复传入（`--tags a --tags b`）。注意 memo 没有标题，修改正文的第一个非空行即改变了列表中显示的卡片标题。

## 删除备忘

```bash
backlog memo delete 20261003-1
```

删除成功输出确认信息；ID 不存在时明确报告未找到。

## 查看使用指南

CLI 内置了 memos 使用指南，可随时查阅：

```bash
backlog instructions memos
```

该指南覆盖全部子命令的参数、过滤与分页语义、未找到错误处理等细节，AI 代理首轮加载配置时会一并读取。
