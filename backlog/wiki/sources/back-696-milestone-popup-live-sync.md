---
title: BACK-696 - 里程碑弹窗实时同步
labels: [source, tui, milestones, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-696 - Keep-the-milestone-popup-in-sync-with-live-milestone-and-task-state.md
---

# BACK-696 - 里程碑弹窗实时同步

里程碑详情弹窗从按 Enter 时刻的状态一次性渲染，且与任务会话不同，里程碑视图完全不启动监视器——整个视图（弹窗、侧边栏计数、列）是一张静照。本任务为会话新增里程碑文件夹监视器加上既有任务监视器，并让弹窗可原地更新。

## 实现要点

- 新 `src/utils/milestone-watcher.ts`：`watchMilestones` 监视 milestones 与 archive-milestones 文件夹，变更 settled 后发布两份重读列表；故意比任务监视器粗（无逐记录存储可对账），但保留同样的两道防护——仅当文件夹持有与 `m-*.md` 文件同样多的可用里程碑时才算读取成功，与上次发布相同的签名被丢弃
- `milestoneContentSignature` 被导出，使视图与监视器比较同一个"已变"定义，与任务的 `taskContentSignature` 完全同构
- `createMilestonePopup` 除 `close` 外返回 `update` 与 `focus`：弹窗**原地**重渲染头部框与可滚动主体，而非关闭重开——因为宿主 await `closed` 决定是否打开编辑表单，并以 `popupOpen` 门控按键，替换弹窗会 resolve 该 promise 并丢掉门控
- 宿主将打开的弹窗跟踪为状态（`{ key, id, signature, handle }`），在唯一的 `openDetail` finally 路径清除，并由 `syncOpenPopup()` 驱动：离开列表以提示关闭，签名变更重渲染，两种情况下弹窗都收回键盘——否则看板重绘会把焦点交给列列表，弹窗静默地不再响应 Esc/q
- 会话启动两条供给（`watchTasks` 供进度计数，`watchMilestones` 供记录）并随屏幕停止；`archivedMilestones` 变为视图状态，以反映别处执行的归档；弹窗以 edit resolve 时按行键重解析里程碑，使表单打开在当前文件内容上
- 测试：新 `milestone-watcher.test.ts`（5 用例，一个经真实 `fs.watch`），`milestones-tui.test.ts` +4 用例（部件身份证明原地刷新、进度行 0/2 → 1/2、移除带提示关闭、外部创建出现在侧边栏）；7 变体 × 8 用例回滚矩阵；全部邻近套件绿色

## 验收标准

- 进程外里程碑编辑无需用户操作即可刷新打开弹窗的标题、日期、描述与 documentation
- 别处的任务变更移动弹窗的进度计数；里程碑离开列表时以可见提示关闭弹窗
- 里程碑文件夹在整个会话内保持活跃：侧边栏行与作用域列跟随创建与归档
- 刷新走既有通道；未变化的签名为 no-op，使视图自身的写入不闪动

## Related Concepts

- [[concepts/milestones]] — 里程碑视图及其详情弹窗
- [[concepts/cli-tui]] — 监视器供给的会话与弹窗原地更新
- [[concepts/task-lifecycle]] — 任务完成作为弹窗的进度输入

## Related Sources

- [[sources/back-694-board-popup-live-sync]] — 本任务跟随的任务弹窗同步形态（以原地更新替代重开）
- [[sources/back-695-drafts-session-live-sync]] — 给无监视器会话接上供给的同一波工作
- [[sources/back-618-milestone-created-updated-dates]] — 弹窗渲染的里程碑元数据
- [[sources/back-580-milestone-detail-view-edit-modal]] — 里程碑详情/编辑面
