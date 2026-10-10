---
title: BACK-670 - 系统禁用动画时加载指示器保持转动
labels: [source, web-ui, loading, accessibility]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-670 - Keep-the-web-loading-indicators-animating-when-the-OS-disables-animations.md
---

# BACK-670 - 系统禁用动画时加载指示器保持转动

开发主机经 RDP 运行且 Windows 动画关闭（`MinAnimate=0`），Chromium 报告 `prefers-reduced-motion: reduce`，于是每个加载 affordance——逐字继承自上游移植——完全静止。静止的 spinner 与卡死的应用无法区分，因此六个 `motion-reduce:` 抑制被移除，作为刻意的 fork 差异。

- 根因经 CDP 按状态确认：`reducedMotion: true`，圆环计算 `animation-name: none`，260ms 间隔变换矩阵相同——圆环画了但不转
- 抑制代码是上游自己的（`f52b190c6` 与 `v1.52.0` 的 grep 均匹配），移植 BACK-654/BACK-665 时继承：5 × `motion-reduce:animate-none` + 1 × `motion-reduce:hidden`，分布在 `LoadingSpinner`、`BoardLoadingSkeleton`（圆环 + 幽灵脉冲）和 `BranchIndexingIndicator`（圆环 + 扫动条）
- fork 决定：加载进度是必要反馈而非装饰——静止圆环配静止骨架屏在最常禁用动画的主机（RDP、VM、kiosk）上就是一块坏屏；每个移除点带注释记录 WHY，下一个移植者不会条件反射地恢复它
- 作为刻意差异登记在迁移台账（doc-12/doc-13 WEB-14 行）；`motion-reduce` 仍可用于以后新增的真正装饰性动效
- 附带观察：BACK-669 之前的 spinner 一直在转，因为它没有逃逸舱——但作为方块，`rounded-full` 是死工具类；这解释了为什么"换成圆圈后就停了"
- jsdom 契约断言钉死三个组件都不含 `motion-reduce`；5 个回退探针红；reduce 报告主机上的实测 CDP 探针显示圆环 `animation-name: spin`、幽灵 `pulse`、扫动条渲染
- 编号归属说明：本地 BACK-670 与上游 BACK-670（移除 standalone 任务依赖命令，#993）是不同任务共享编号
- 未改的附带发现：`PasteAwareMDEditor.tsx` 仍使用死掉的 `rounded-full`；保持 `/api/status` 会让客户端卡在加载（探针副作用）

## 验收标准

- 三个加载组件不再有任何 `motion-reduce:` 工具类，源码级断言在任何一处回归时失败
- reduce 报告主机上所有圆环计算 `animation-name: spin` 且变换变化；幽灵脉冲；扫动条渲染
- 每组件的类契约在测试中；恢复六个工具类中任何一个断言变红
- 台账记录本地/上游 BACK-670 编号撞车

## Related Concepts
- [[concepts/browser-loading]] — 本任务定义动画契约的加载指示器
- [[concepts/upstream-migration]] — 记录对上游移植代码的刻意差异
- [[concepts/ci-platform-contracts]] — 实测验证的主机环境（RDP/reduced-motion）假设

## Related Sources
- [[sources/back-668-branch-indexing-header-chip]] — 引入本任务移除逃逸的 chip 与扫动条（批次兄弟）
- [[sources/back-669-initial-loading-skeleton]] — 引入本任务修复的骨架屏圆环与幽灵脉冲（批次兄弟）
