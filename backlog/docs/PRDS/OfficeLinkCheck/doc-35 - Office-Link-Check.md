---
id: doc-35
title: Office Link Check
type: other
created_date: '2026-11-07 06:16'
---

> 本文件是「Office 文件页面与工作表范围」功能（BACK-838）的 **doc 侧验收 fixture**。四个被测文件都放在仓库根目录的 `quickstart/`，范围预览链接统一使用站点根路径 `/quickstart/` 引用。
> 验证点：docx / pptx / pdf 的 `:P起-止` 页范围、xlsx 的 `:p序号` 与 `:表名`、`!` 前缀的内联嵌入，以及不带 `P` 的裸数字必须仍按「文本行号」处理。
> 判定标准：普通链接打开弹窗预览，`!` 链接在页内直接渲染；参数写错时不报错，退化为打开整篇或停在默认工作表。

## 测试文件

| 文件 | 类型 | 规模 |
| --- | --- | --- |
| `quickstart/BacklogMD产品说明书.docx` | Word | 约 300 段落、13 张表格，页数由前端排版决定 |
| `quickstart/BacklogMD对外宣讲.pptx` | PowerPoint | 12 张 |
| `quickstart/BacklogMD快速上手速查手册.pdf` | PDF | 3 页 |
| `quickstart/Strata硬件测试结果集.xlsx` | Excel | **4 张表**：测试结果集、官方基准矩阵、量化版本规格、来源与口径 |

## Word 页范围

整篇不带范围，弹窗标题栏不应出现页码徽标：

[产品说明书](/quickstart/BacklogMD产品说明书.docx)

单页 `:P2`，应滚到第 2 页：

[产品说明书 第 2 页](/quickstart/BacklogMD产品说明书.docx:P2)

范围 `:P1-P2`，应滚到第 1 页并显示「第 1–2 页」：

[产品说明书 第 1-2 页](/quickstart/BacklogMD产品说明书.docx:P1-P2)

内联嵌入，应在页内渲染并带文件名与范围徽标（徽标不与标题重复）：

![产品说明书](/quickstart/BacklogMD产品说明书.docx:P1-P2)

## PowerPoint 页范围

整篇 12 张：

[演示文稿](/quickstart/BacklogMD对外宣讲.pptx)

范围 `:P2-P5`，应只剩第 2-5 张，缩略图栏与播放计数都是 1 / 4：

[演示文稿 第 2-5 张](/quickstart/BacklogMD对外宣讲.pptx:P2-P5)

单张 `:P12`，应只剩第 12 张：

[演示文稿 第 12 张](/quickstart/BacklogMD对外宣讲.pptx:P12)

内联嵌入：

![演示文稿](/quickstart/BacklogMD对外宣讲.pptx:P3-P5)

## PDF 页范围

整篇 3 页：

[速查手册](/quickstart/BacklogMD快速上手速查手册.pdf)

单页 `:P2`：

[速查手册 第 2 页](/quickstart/BacklogMD快速上手速查手册.pdf:P2)

范围 `:P2-P3`，应只渲染 2 页并显示「第 2–3 页」：

[速查手册 第 2-3 页](/quickstart/BacklogMD快速上手速查手册.pdf:P2-P3)

越界 `:P9-P12`，应只渲染末页（第 3 页），徽标也收敛成「第 3 页」，不报错、不出现空白画布：

[速查手册 第 9-12 页](/quickstart/BacklogMD快速上手速查手册.pdf:P9-P12)

内联嵌入：

![速查手册](/quickstart/BacklogMD快速上手速查手册.pdf:P2-P3)

## Excel 工作表

整篇，停在第一张表「测试结果集」：

[Strata 硬件测试结果集](/quickstart/Strata硬件测试结果集.xlsx)

序号 `:p1`，应激活「测试结果集」并显示「工作表 1」：

[工作簿 第 1 张表](/quickstart/Strata硬件测试结果集.xlsx:p1)

序号范围 `:p1-p4`，应激活第一张表、徽标显示「工作表 1–4」，其余 3 张 tab 仍可点：

[工作簿 第 1-4 张表](/quickstart/Strata硬件测试结果集.xlsx:p1-p4)

中文表名 `:官方基准矩阵`，应激活第 2 张表：

[工作簿 官方基准矩阵](/quickstart/Strata硬件测试结果集.xlsx:官方基准矩阵)

中文表名用尖括号写法，应激活第 4 张表：

[工作簿 来源与口径 尖括号](</quickstart/Strata硬件测试结果集.xlsx:来源与口径>)

不存在的工作表 `:Q1 Sales`（同时覆盖带空格表名的 percent-encode 路径），应停在默认表且不报错：

[工作簿 不存在的表名](</quickstart/Strata硬件测试结果集.xlsx:Q1 Sales>)

内联嵌入，应直接在页内渲染「量化版本规格」：

![工作簿](/quickstart/Strata硬件测试结果集.xlsx:量化版本规格)

## 反例

裸数字必须按文本行号处理，不能当页范围：链接可点，弹窗打开整篇，而不是第 3-7 页。

[产品说明书 裸数字](/quickstart/BacklogMD产品说明书.docx:3-7)

裸数字在 Excel 里当表名处理：找不到名为 `1-2` 的表，停留在默认表，且不应报错。

[工作簿 裸数字](/quickstart/Strata硬件测试结果集.xlsx:1-2)

相对路径仍然可用（上面的范围预览统一用根路径，这里保留一条相对写法作对照）：

[速查手册 相对路径](<../../../../quickstart/BacklogMD快速上手速查手册.pdf:P1>)

## 对照

普通图片仍走 lightbox，不受本功能影响：

![示例图片](../../../assets/images/web.jpeg)

普通 Markdown 文件链接仍是文本预览：

[doc-34 验收页](<../RelativeLink/doc-34 - Relative-Link-Check.md:3-8>)

wiki 页面链接：

[wiki 验收页](<../../../wiki/test/back-837 - Link-Check.md>)

## 检查清单

- [ ] 四类文件点击后都弹窗，标题是干净文件名、页码徽标只有一枚
- [ ] docx 带范围定位到起始页
- [ ] pptx 带范围只剩窗口内的幻灯片，缩略图与计数同步
- [ ] pdf 带范围只渲染窗口内的页，越界不报错且徽标收敛
- [ ] xlsx 按序号、按中文表名都能切到目标表，多表范围保留其余 tab
- [ ] `!` 链接渲染成内联预览，图注不与徽标重复
- [ ] 裸数字不触发页范围，链接仍然可点
- [ ] 内联预览的正文滚动不影响外层页面滚动
