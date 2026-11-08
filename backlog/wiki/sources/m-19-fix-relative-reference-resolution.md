---
title: m-19 - 修复相对引用解析里程碑
labels: [source, milestone, m-19, markdown]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/milestones/m-19 - fix-relative-reference-resolution.md
---

# m-19 - 修复相对引用解析里程碑

创建于 2026-11-06 15:40，`actual_end` 同日 15:48。里程碑文件本身只有一行描述，实际内容由挂在它下面的任务与验收 fixture 承载。

## 归属任务

- **BACK-835** 统一 Markdown 相对引用解析（渲染期 join + 服务端 try_files，项目根为边界）
- **BACK-836** 把文档页的 `projectPath` 边界转换推广到 decision 页，并抽出共享点击契约
- **BACK-837** 推广到 wiki 页，落地 wikilink 范围 / 编辑器渲染 / 尖括号与全角冒号处理

## 验收资产

`doc-34`（doc 侧）、`decision-2`（decision 侧）、`backlog/wiki/test/back-837 - Link-Check.md` 与 `Another Page.md`（wiki 侧）三向交叉引用。`doc-4` 迁移分类文档也在 BACK-837 提交里被加了一条相对路径链接作为额外的跨集合样本，仅属验收改动，无知识增量。

## 边界

`doc-35` / **BACK-838**（Office 范围）、BACK-839~843（写入风暴、语料摘要与启动缓存）与 m-19 无 milestone 关联，是同期但独立的工作线；把它们归入 m-19 会误读里程碑范围。m-19 的 `actual_end` 早于 BACK-837 的完成时间，也说明里程碑字段只记录骨架创建，不用于推断任务时序。

## Related Concepts

- [[concepts/relative-reference-resolution]] — 里程碑的核心产出

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]]
- [[sources/back-836-decision-relative-reference-resolution]]
- [[sources/back-837-wiki-relative-references-entity-links]]
- [[sources/doc-34-relative-link-check]]
- [[sources/decision-2-relative-link-check]]
