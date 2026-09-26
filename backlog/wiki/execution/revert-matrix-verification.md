---
title: 回退矩阵验证法（revert-probe / red-green matrix）
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
labels: [execution, testing]
extracted_from:
  - "[[sources/back-699-findidentity-nonpublishing-fallback]]"
  - "[[sources/back-698-web-in-place-refresh]]"
  - "[[sources/back-696-milestone-popup-live-sync]]"
  - "[[sources/back-691-local-first-lifecycle-vacated-refs]]"
  - "[[sources/back-683-cli-draft-edit]]"
  - "[[sources/back-682-web-positional-batch-drop]]"
  - "[[sources/back-680-batch-status-move]]"
---

# 回退矩阵验证法（revert-probe / red-green matrix）

## 适用场景

653–700 各波次的标准验证法：证明新测试**真的钉住了被测行为**，而非恒绿。任何"加了回归测试"的结论都必须配一条"回退后哪个测试红"的证据。

## 标准步骤

1. 改动落地、测试全绿后，列出改动里可独立回退的**变体**（每个函数分支、每半个行为一个变体）
2. 逐个回退变体（就地改码或 `git stash`），跑目标套件，记录每个变体**恰好**让哪些用例变红
3. 每个新用例至少要被一个变体打红；变体打红了**不相关**的用例说明测试粒度过粗
4. 恢复实现，确认全绿；矩阵脚本留在 `tmp/`（如 `tmp/rollback-682.py`）备查

## 成熟实例的矩阵规模

- BACK-699：5 变体 × 3 套件；变体 D（翻转默认发布行为）回来时全绿，暴露了"安装方仍发布"没有测试钉住——**补了第二个回归用例**。矩阵不只验证测试，也验证覆盖缺口
- BACK-698：6 变体 × 12 用例；BACK-682：8 变体；BACK-696：7 变体 × 8 用例；BACK-683：6 变体 + task-edit 对照组
- BACK-691：4 个定向就地回退，确认恰好判别性用例失败

## 半改动探针

半个改动一个探针能定位因果：BACK-663 只回退门控让新用例红；只回退横幅则精确复现旧症状（空 branch 的 "Read-only" 文案）。一次回退一半，胜过整改动的全绿全红。

## 常见陷阱

- 跳过红阶段直接交付"回归测试"——恒绿测试什么都证明不了
- 首个回归用例通过未修复代码——说明触发条件比假设的窄（BACK-699：store 绑定 watcher 后的一次发布读掩盖了指纹副作用），用 `settleInitialContentReload` 之类确定性同步替代 sleep 后再写触发序列

## Related Concepts

- [[execution/pre-existing-failure-triage]] — 区分"回退打红的新用例"与"pre-existing 失败"
