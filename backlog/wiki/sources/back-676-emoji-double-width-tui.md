---
title: BACK-676 - TUI 中 emoji 按双宽计
labels: [source, tui, dependencies, unicode]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-676 - Count-emoji-as-double-width-in-the-TUI.md
---

# BACK-676 - TUI 中 emoji 按双宽计

TUI 经 `neo-neo-bblessed` 渲染，其宽度表把 emoji 计为一格，而终端画成两格——行里每个 emoji 都花一格的漂移，看板边框错位，重渲染残留陈旧单元格。修复是把依赖升到 1.0.10，外加钉住宽度行为的回归测试。

- 修复属于依赖而非 `src/ui`：宽度表从 Unicode 16 Emoji_Presentation 属性生成，同时喂给 `charWidth` 与分类宽单元的布局 regex——树内手维护表会漂移；项目不带本地补丁，因此升版本就是全部修复
- `neo-neo-bblessed` 在三处记录点都钉到 1.0.10：`package.json`、`bun.lock`（工作区依赖列表加带发布 sha512 的解析条目）、生成的 `bun.nix`（version key、tarball URL、hash）；lockfile 完整性字符串经本地哈希 tarball 验证，不是照抄信任
- 新 `src/test/tui-emoji-width.test.ts` 钉住四个面：默认 emoji 表现的码点测 2 格；VS16 序列测 2，包括冗余 VS16 情形（`✅️` 不能变 3）；文本表现/ASCII/CJK 宽度不变；布局 regex 把 emoji 与 CJK 标宽、拒绝 ASCII
- 修正后的表无需改 `src/ui` 就到达两个面：`formatTaskListItem` 构建行字符串，部件做全部换行、截断与宽单元分类——测试外没有源文件实现宽字符数学
- 区分能力已证明：同一测试在仓库外临时项目里对 1.0.9 跑失败 3/4（emoji 情形测 1 格，regex 返回 null），宽度不变式通过——否则测试什么都没钉住，升版本未验证
- `bun install --frozen-lockfile` 解析到 1.0.10 证明三个文件一致；六个引入渲染库的现有套件保持绿（32 通过）

## 验收标准

- `neo-neo-bblessed` 解析到 1.0.10，manifest、lockfile 与 Nix 表达式在一个事实源上一致
- emoji 默认表现码点与 VS16 序列测 2 格；冗余 VS16 仍为 2
- 文本表现、ASCII 与 CJK 宽度不变；布局 regex 把 emoji/CJK 分类为宽、ASCII 不宽
- 回归测试覆盖全部四个面；不保留本地补丁目录或树内宽度表

## Related Concepts
- [[concepts/cli-tui]] — blessed/neo-neo-bblessed 渲染栈与单元格宽度模型
- [[concepts/ci-platform-contracts]] — lockfile/manifest/Nix 一致作为可复现性契约
- [[concepts/upstream-migration]] — 对照 fork 验证的上游 BACK-646 移植

## Related Sources
- [[sources/back-675-tui-ac-bar-ascii]] — 字形可移植性的同级 TUI 渲染修复（批次兄弟）
- [[sources/back-539-linux-runner-win32-arm64-build]] — 早期依赖/平台钉版工作
