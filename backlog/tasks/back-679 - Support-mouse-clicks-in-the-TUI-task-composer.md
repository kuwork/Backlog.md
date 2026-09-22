---
id: BACK-679
title: Support mouse clicks in the TUI task composer
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-07 20:45'
updated_date: '2026-09-21 06:05'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer-mouse.test.ts
modified_files:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer-mouse.test.ts
priority: low
actual_start: '2026-09-21 05:50'
actual_end: '2026-09-21 06:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TUI composer 的鼠标点击只走了一半：点得到焦点，却从不进入读入态——比完全不支持更糟。

实测（真实 blessed screen 100x30，走真实鼠标派发路径 `program.emit("mouse", …)` + 从 `lpos` 取的真实坐标）：点击 Description 后 `screen.focused` 确实是 description，但 `_reading=undefined`、边框仍是 gray、**Title 仍保持黄色高亮**，随后输入的 "Clicked description" 一个字都没进字段（`getValue()` 仍为 `""`）；键盘导航走后回点 Title 同症状（`_reading=false`，"First" 丢失）。用户看到的就是「上一个控件仍高亮、打字没反应」的假死 composer。

根因两层：① 两个文本字段以 `inputOnFocus: false` 创建、且没有任何 click 处理器，没人把它们接进既有的 `focusField` / `readInput` 路径；② 选择器虽已有 click 处理器，但它既没先走 `focusField`，处理器又返回 undefined → blessed 的祖先链 `element click` autofocus 会对同一个 widget 再 `focus()` 一次，而 `screen.focused` 的 setter 走 `_focus(el, old)` 会**无条件** `old.emit("blur")`，于是该 widget 自己 blur 自己，`readInput` 注册的 blur 处理器立刻把 `_reading` 翻回 false。

fork 没有 Type 选择器（TUI-3 已确认），所以适用面是 Title / Description / Status / Priority 四个字段。期望：点哪个字段哪个字段就独占高亮并进入读入态（文本字段光标可见、可立即输入），点选择器打开既有 picker；键盘导航、动作按钮、持久化与布局行为不变。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 点击任一 composer 文本字段（Title / Description）后它独自高亮并进入读入态：`screen.focused` 为被点字段、`_reading === true`、`getCursor()` 有值，且随后的按键字符落到该字段（实测 100x30：点 Description 后输入 "Clicked description" → `getValue()` 等于该串；修复前为 ""）
- [x] #2 点击后原高亮控件可见地取消高亮：被点文本字段边框为 yellow、另一个文本字段边框回到 gray（实测 Title 边框由 yellow 变 gray）
- [x] #3 键盘导航离开 Title 后回点 Title，与首次点击行为一致：进入读入态、可继续输入（实测输入的 "First" 落在 Title 上）
- [x] #4 重复点击已激活的同一个 Title 不丢读入态：仍 `_reading === true`，后续输入追加在同一值上
- [x] #5 点击 Status / Priority 打开其 picker，条目等于该字段配置的完整选项集（含 Draft / None 等既有构造规则），确认后焦点回到被点的选择器；fork 无 Type 选择器，故 Type 不在适用面内（同 BACK-678 / TUI-3 结论）
- [x] #6 点击处理器 `return false` 掐断冒泡的效果被测试钉住：点击后字段仍处于读入态，不出现「同一 widget 二次 focus → 自 blur → `_reading` 翻 false」；该断言在删掉 `return false` 时必须变红
- [x] #7 任务 Notes 记录真实 screen + 真实鼠标派发路径的实测数值与证据边界，且键盘导航、动作按钮、持久化、布局行为不变（相邻 composer / board 套件保持全绿）
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 用一个循环把 Title / Description / Status / Priority 的 `click` 统一接进既有的 `focusField` 转换：文本字段因此复用 readInput / caret 行为，选择器沿用既有 openPicker；删掉选择器原先那条只开 picker、不经 focusField 的 click 处理器。
2. 处理器 `return false` 掐断冒泡：阻止 blessed 祖先链上的 `element click` 对同一个 widget 二次 focus（经 `_focus(el, old)` 的 `old.emit("blur")` 自 blur），否则 readInput 刚建立的读入态会被立刻取消（实测去掉后 `_reading` 由 true 变 false）。
3. 用真实鼠标派发路径写回归：`program.emit("mouse", { action: "mousedown" | "mouseup", x, y })`，坐标取自渲染后的 `lpos` 中心；覆盖点击进入读入态与光标、独占高亮、打字落地、重复点击同一 Title、以及 Status / Priority 点开 picker 并恢复焦点。
4. 跑聚焦 composer 套件、`bunx tsc --noEmit`、`bun run check .`；做整份与按子句两层回退验证；把实测数值写进任务 Notes。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
用一个循环把 Title / Description / Status / Priority 的 `click` 统一接进既有的 `focusField` 转换，并删掉选择器原先那条只开 picker、不经 focusField 的 click 处理器；处理器 `return false` 掐断冒泡。

**为什么 `return false` 是必需的（实测机制，不是照抄上游注释）**：blessed 的 `screen.focused` setter 走 `Screen._focus(el, old)`，会**无条件** `old.emit("blur")`；点击冒泡到祖先链上的 `element click` 后，screen 的 autofocus 处理器对该 widget 再 `focus()` 一次 → 同一个 widget 自己 blur 自己 → `readInput` 注册的 blur 处理器 `_done` 立刻把 `_reading` 置 false 并 `delete this._done`（dist 12823-12832）；而 `__listener` 要到 `nextTick` 才挂上，于是 keypress 监听器留在原处、`_done` 已被删除。实测后果不只是丢读入态：此后再按 Escape 会走到 `_listener` 的 `done(null, null)` 而抛 **TypeError: done is not a function**（dist 12894，实测在测试收尾时炸出来并连带污染后续用例）。

**实测证据**（真实 blessed screen 100x30，走真实鼠标派发路径 `program.emit("mouse", { action: "mousedown" | "mouseup", x, y })`，坐标取自渲染后 `lpos` 的中心）：
- 修复前：点 Description → `screen.focused` 确实变为 description，但 `_reading=undefined`、边框仍 gray、**Title 仍 yellow**（旧高亮不撤），随后输入 "Clicked description" 后 `getValue()` 仍为 `""`；键盘导航走后回点 Title 同症（`_reading=false`，"First" 丢失）。
- 修复后：同两步 → `_reading=true`、`getCursor()` 有值、被点框 yellow 且另一框 gray、输入分别落地为 "Clicked description" / "First"；重复点已激活的 Title 仍 `_reading=true` 且字符追加（"First" → "First again"）；点 Status / Priority 打开 picker，条目分别等于 `["Draft","To Do","In Progress","Done"]` / `["None","High","Medium","Low"]`，确认后焦点回到被点选择器（inverse + bold）。

**适用面裁剪**：fork 无 Type 选择器（同 BACK-678 / TUI-3 结论），上游 AC 的「Status, Type, Priority」在 fork 收敛为 Status / Priority。上游测试用 `widget.emit("click", …)` 直投；fork 改用真实鼠标派发路径（blessed 自己的命中测试、clickable 注册与冒泡链全部参与），并显式断言「picker 打开期间先前聚焦的文本框已让出高亮」——该断言是选择器那一半改动的唯一判别点。

**回退矩阵**（4 变体 × 4 用例逐条单跑）：修复前 HEAD → 4 条全红；只去掉 `return false` → 3 条文本用例红（卡在 `_reading` true vs false）、选择器用例保持绿；只让选择器跳过 `focusField` → 恰好选择器用例红；当前实现 → 4 条全绿。整份回退时选择器用例同样变红（它已依赖 focusField 那条断言）。

**测试助手踩坑**：收尾阶段若让异常穿透，会掩盖真正的断言失败并让后续用例级联报 `Cannot switch a node's screen`（实测护栏缺失态下 Escape 在 blessed 内抛错，屏幕未销毁）→ `withComposer` 的 finally 用 try/catch 包住收尾并保证 `screen.destroy()` 落到 finally。双弹窗收尾顺序：第一次 Escape 关 picker，第二次取消 composer。

**验证**：新增 `src/test/tui-task-composer-mouse.test.ts`（4 用例 / 33 断言）；相邻 12 个套件 88 pass / 0 fail（tui-task-composer 15 / layout 4 / unicode 2 / board-hide-empty-columns 14 / board-render 4 / help-popup 8 / tui-vim-boundary-navigation 5 / tui-emoji-width 4 / tui-acceptance-criteria-progress 18 / generic-list-selection 3 / line-wrapping 7）；`bunx tsc --noEmit` 干净；`bun run check .` 432 文件仅 3 条既有 `assets.ts` warning。

**证据边界**：fork 的 `createScreen` 传 `mouse: process.platform !== "win32"`，本机 win32 上拿不到真机 PTY 鼠标事件（仓库自带的交互 PTY 用例 `tui-ready-filter-pty` 在 win32 恒 skip），故证据为 widget 级的真实派发路径（与上游自称的 deterministic widget evidence 同口径）。

**撞号登记**：本任务分配到 BACK-679，撞上游 BACK-679（= CORE-35「Quote assignee and reporter under every frontmatter key spelling」，分类表里判为 C 类忽略）。fork 保持分配号不改号，台账（doc-12 / doc-13）的登记与提交按用户 2026-09-19 规则先问后做。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
composer 的鼠标激活现在与键盘导航共用同一条 `focusField` / `readInput` 转换：点任一文本字段都会独占高亮并进入读入态（光标可见、字符立即落地），重复点已激活的 Title 仍可继续输入，点 Status / Priority 打开既有 picker 并在确认后把焦点交回被点的选择器。关键细节是点击处理器 `return false` 掐断冒泡——否则 blessed 的祖先链 autofocus 会对同一 widget 二次 focus，经 `screen.focused` setter 的 `old.emit("blur")` 自 blur，刚建立的读入态被立刻取消（实测会让后续 Escape 在 blessed 内抛 TypeError）。新增 `src/test/tui-task-composer-mouse.test.ts`，用真实鼠标派发路径覆盖读入态与光标、独占高亮、打字落地、重复激活与两个选择器的 picker。验证：该文件 4 用例 / 33 断言，相邻 12 个套件 88 pass / 0 fail，`bunx tsc --noEmit` 干净，`bun run check .` 仅 3 条既有 `assets.ts` warning；回退矩阵（整份 / 去护栏 / 选择器不走 focusField）逐条给出一致的红项。
<!-- SECTION:FINAL_SUMMARY:END -->
