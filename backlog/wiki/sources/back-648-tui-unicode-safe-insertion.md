---
title: BACK-648 - TUI 文本插入 Unicode 安全化
labels: [source, tui]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-648 - Make-TUI-text-field-insertion-Unicode-safe.md
---

# BACK-648 - TUI 文本插入 Unicode 安全化

TUI 任务撰写器把可打印字符的插入委托给 vendored 的 neo-neo-bblessed 控件——这些控件按终端显示单元计算光标，却按 UTF-16 索引切分字符串——在星平面字符（表情、CJK 扩展、旗帜）旁边输入会拆裂其代理对，把替换字符持久化进任务文件。现在插入由撰写器自己接管，走删除已在使用的同一条按码点安全的路径。移植自上游 BACK-592。

- `src/ui/components/task-composer.ts` 中的 `caretIndexFromCursor`/`cursorFromCaretIndex` 调和了两种单位：`CaretLines` 新增可选的 `displayWidth` 钩子，由控件自身的 `strWidth` 喂入（回退为每码点一个单元），计数前先剥掉控件内部的 `\x03` 宽字符占位符，`indexAtDisplayColumn` 把显示列映射到码点起始，`safeCodePointBoundary` 把任何落在低位代理上的索引吸附回边界
- 删除变更被提取为共享的 `setTextAtCaret`（暂存光标、设置值、重读换行后的行、恢复光标、恢复滚动行），`insertText` 构建于其上——恢复滚动行是真正的行为修复：没有它，插入后视口会停在最后一行换行行上
- `ownInputKeys` 通过 `isTextInsertion` 谓词认领可打印输入并路由到 `insertText`；Tab/Backspace/Delete 拦截仍优先检查，因此其他按键保持原有路径
- 控件能力在运行时探测而非臆断：`strWidth`/`setScroll` 是打包的 index.d.ts 未为 textbox 声明的原型方法，经由现有内部类型 `ComposerInput` 读取（已确认 `strWidth("𠮷") === 2`）
- 本 fork 完全没有撰写器交互覆盖（BACK-563 测试拆分只带过来了模型用例）；新的 `src/test/tui-task-composer-unicode.test.ts` 在无头 100x30 屏幕上真实驱动 `openTaskComposer`，在两个字段中部的星平面字符旁输入，并断言持久化后的文件字节（`AX𠮷B`、`left Y𠮷 right`、无 U+FFFD）与重载
- 门禁：tsc 干净，biome 0 错误，9 个文件的 TUI 定向集 48 通过 / 4 跳过（既有的 PTY 跳过）

## 验收标准

- 光标换算把显示单元光标解析为完整的码点边界并忽略控件占位符；在星平面字符附近精确互逆
- 在 Title 或 Description 的星平面字符旁输入绝不拆裂代理对；持久化文件保留原字符
- 光标落在目标位置；编辑长描述靠前的换行行时视口保持跟随
- Tab/Backspace/Delete/Ctrl+W 及所有控制键行为与之前完全一致

## Related Concepts

- [[concepts/cli-tui]] — 通过 `ownInputKeys` 实现的撰写器输入归属
- [[concepts/upstream-migration]] — 移植自上游 BACK-592（commit bc96f2310，PR #907）

## Related Sources

- [[sources/back-563-tui-intent-first-composer]] — 其测试拆分丢掉了本次重建的交互覆盖
- [[sources/back-587-repair-tui-task-composer-ux]] — 相邻的撰写器 UX 修复
