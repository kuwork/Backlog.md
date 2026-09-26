---
title: findIdentity rename 回退使用非发布加载
description: BACK-699 选择 load-without-publish 而非 install-corpus
labels: [decision, core, cross-branch]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# findIdentity rename 回退使用非发布加载

## Context

任务文件被重命名或删走且分支侧没有副本时，`ContentStore.findIdentity` 的 rename 回退会加载整个语料只为解析一个身份然后丢弃。问题：这个加载走了发布式 loader，把 `Core.activeBranchFingerprint` 推前了却没有安装任何语料——下一次读因此跳过真正的刷新，向调用者端上移动前的过期分支内容。

## Decision

`ContentStore` 增加 `TaskLoaderOptions = { publish?: boolean }`，一路透传进 `taskLoader`；rename 回退以 `{ publish: false }` 调用——它的加载只为解析一个身份并被丢弃，因此不得推进指纹。安装语料的调用方（`loadCurrentContent`、`refreshTasksFromDisk`）保持 `publishSharedState` 默认 true，publish-on-equal-corpus 行为不变。

## Rejected alternatives

- 让回退真正安装它加载的语料——为一个一次性身份解析付出全语料安装与全量订阅者广播的代价
- 回退后强制下一次读刷新——治标不治本，发布不变式（谁加载谁安装）仍然破洞

## Related Sources

- [[sources/back-699-findidentity-nonpublishing-fallback]] — 本决策的落地与确定性回归测试
- [[sources/back-601-core-browser-publication-ownership]] — 发布所有权规则
- [[sources/back-602-incremental-cross-branch-task-loading]] — 被误用的语料加载路径
