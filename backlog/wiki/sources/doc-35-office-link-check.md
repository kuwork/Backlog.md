---
title: doc-35 - Office 页范围与工作表范围验收页
labels: [source, doc, fixture, office, markdown]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/docs/PRDS/OfficeLinkCheck/doc-35 - Office-Link-Check.md
---

# doc-35 - Office 页范围与工作表范围验收页

BACK-838 的 **doc 侧验收 fixture**。四个被测文件放在仓库根 `quickstart/`，范围预览链接统一用站点根 `/quickstart/` 引用，另保留一条相对路径写法作对照。

## 四个真实样本

| 文件 | 规模 |
|---|---|
| `BacklogMD产品说明书.docx` | 约 300 段落、13 张表格，页数由前端排版决定 |
| `BacklogMD对外宣讲.pptx` | 12 张 |
| `BacklogMD快速上手速查手册.pdf` | 3 页 |
| `Strata硬件测试结果集.xlsx` | 4 张中文表：测试结果集 / 官方基准矩阵 / 量化版本规格 / 来源与口径 |

## 验收矩阵

- **docx / pptx / pdf**：整篇不带范围时标题栏**不应出现页码徽标**；`:P2` 单页、`:P1-P2` 范围、`:P12`、`:P2-P5`；PDF `:P9-P12` 越界必须 clamp 到末页且徽标收敛为「第 3 页」，不报错、不留空白画布。
- **xlsx**：`:p1` 序号、`:p1-p4` 序号范围（其余 3 个 tab 仍可点）、`:官方基准矩阵` 中文表名、尖括号写法 `:来源与口径`、不存在的 `:Q1 Sales`（同时覆盖带空格表名的 percent-encode 路径，应停默认表且不报错）。
- **`!` 内联嵌入**：四种格式各一条，应在页内直接渲染，图注带文件名与范围徽标且不与标题重复；内联预览的正文滚动不应带动外层页面滚动。
- **反例**：裸数字 `:3-7` 必须仍按**文本行号**处理（可点、弹窗打开整篇，而不是第 3-7 页），xlsx 的 `:1-2` 当表名处理、找不到就停默认表；普通图片仍走 lightbox；普通 Markdown 链接仍是文本预览；wiki 页面链接照常解析。

这条「裸数字不当页范围」的反例是 `P` 前缀设计存在的全部理由，也是最容易在实现里被 regression 的一条。

## Related Concepts

- [[concepts/file-preview]] — 四个 Office viewer 与范围徽标
- [[concepts/markdown-pipeline]] — 扩展名锚定的范围切分

## Related Sources

- [[sources/back-838-office-page-sheet-ranges]] — 主实现
- [[sources/doc-34-relative-link-check]] — 同批的相对链接验收页
