---
title: BACK-624 全局搜索对话框设计与分解推理
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels: [reasoning, web-ui, search]
---

# BACK-624 全局搜索对话框设计与分解推理

## 原始需求（PRD）

为一个 macOS Spotlight 风格的居中全局搜索对话框提供 PRD：绑定浏览器路由、支持前进后退、无右侧预览面板、单列高密度分组列表、列表滚动位置记忆、键盘优先。PRD 在若干处与 fork 架构冲突，执行时需要主动适配。

## 问题分解

1. **路由壳**：新页面 vs 模态路由？→ 模态路由（PRD 明确"无独立页面，底层页面保持挂载 + 滚动锁"）
2. **历史语义**：PRD 要求 `pushState` / `replaceState` / `popstate` 三件套
3. **数据来源**：是否需要新 API？
4. **结果渲染**：分组 + 高亮 + 虚拟滚动
5. **键盘与焦点**：快捷键、焦点陷阱、选中态
6. **滚动记忆**：什么作为"位置"的持久化表示
7. **视口**：窄屏如何不破坏上述机制

## 备选方案对比

| 议题 | 方案 A | 方案 B | 选择与理由 |
|---|---|---|---|
| 历史语义 | 直接调用 `window.history.pushState/replaceState` 并监听 `popstate` | 复用 React Router（`navigate` push/replace、`navigate(-1)`、`location.state`） | **B**。代码库中不存在裸 history API 调用，Router 已接管 popstate；等价语义且与既有 modal 路由一致 |
| 滚动记忆 | 持久化 `scrollTop` 像素 | 持久化 `visibleStartIndex`（首个可见行索引） | **B**。定高行下索引对数据量增长更稳定，越界可确定性回退 |
| 虚拟列表 | 引入第三方虚拟化库 | 手写定高窗口化 | **B**。无新依赖符合 fork 体积约束；行高恒定使实现面极小 |
| 任务结果跳转 | `/?highlight=id`（既有高亮路由） | 直接 `/task/:id/:slug` | **B**。前者会经 BoardPage 再 push，导致后退落到 `/`，破坏"后退重开对话框" |
| 关闭后回到背景 | 对任务与文档/决策/wiki 统一挂 `backgroundLocation` | 仅对模态目标（任务）挂 `backgroundLocation`，其余走整页 push | **B**。文档/决策/wiki 不是模态路由，挂背景会导致 URL 变化但不渲染 |
| 遮罩视觉 | PRD 的毛玻璃/backdrop blur | 与任务模态框一致的 `bg-black/40 dark:bg-black/60` 无模糊 | **B**（用户决定，覆盖 PRD） |

## 任务拆分（原计划 10 步 → 实际执行）

计划中的 10 步（路由壳 → 快捷键改线 → SearchDialog → type tabs + i18n → 结果查询防抖 → 虚拟列表 → 键盘导航 → 滚动记忆 → 竞态防护 → 验证）基本按序落地，但第 8 步"滚动记忆"与第 3/6 步耦合最紧：只有行高恒定 + `visibleStartIndex` 才能让"返回时还原位置"在窄屏/桌面两种行高下都成立，因此实际实现把行高常量提升为视口模式常量。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 防抖响应乱序覆盖新结果 | 序列计数器守卫，只接受最新请求的响应 |
| 输入受 URL replace 影响导致光标跳动 | 输入框维护本地 draft 同步更新，URL replace 防抖 300ms，打开结果前 flush |
| 空态窗口高度塌陷 | 结果首屏加载期间用同尺寸不可见占位符撑高 |
| 每次打开任务模态框都多出一条 `/search` 历史 | `handleCloseModal` 在存在 `backgroundLocation` 时改为 pop |
| 窄屏行高变化破坏还原 | 行高随视口模式取常量，两种模式各自保持恒定 |

## 结果

八轮用户反馈迭代后收敛：对话框、虚拟列表、分组折叠、ID 高亮、共享徽章配色、窄屏两行布局、光标稳定。唯一明确遗留是 `zh-TW` 全量文案审计。

## Related Concepts

- [[concepts/spotlight-search]] — 最终落地的概念模型
- [[concepts/web-ui-features]] — 所属功能域

## Related Sources

- [[sources/back-624-global-search-dialog]] — 任务来源与最终实现
- [[sources/back-627-back-arrow-history-fix]] — 历史栈不变式的后续修复
