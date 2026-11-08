---
title: Office 页范围强制 P 前缀并让 capture 拦截器走共享解析器
labels: [decision, markdown, office, web-ui]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# Office 页范围强制 P 前缀并让 capture 拦截器走共享解析器

## 背景

BACK-838 要让 Office 链接能指向 `report.docx` 的第 1-4 页、pptx 的第 2-5 张、xlsx 的某张表。但 `:1-4` 在 Markdown 里**已经**表示纯文本文件的第 1-4 行，渲染期 join 也会把 `report.docx:P1-P4` 当成不透明 URI scheme 塌成死 `#` 锚点。

## 决定

| 文件 | 合法 token | 语义 |
|---|---|---|
| docx / pptx / pdf | `:P1`、`:P1-P4` | 页窗口，**`P` 强制** |
| xlsx / xlsm | `:p1`、`:p1-p4`、`:表名` | 1-based 工作表序号或名字 |
| 其它文本 | `:3-7` | 仍是文本行范围 |

`P` 不是装饰：去掉它就等于让文档夺走 `:1-4` 已有的文本行含义。`splitTarget` 按扩展名决定 token 是否合法，工作簿接受任意 token、分页格式只接受 `P...`、其它扩展名保留行范围；范围 token 在 join 时被剥离并回挂，绝不进文件路径或字节 URL。

第二项决定同等重要：`Layout.tsx` 的 document 级 **capture-phase** 拦截器先于所有 Markdown handler 运行并 `stopPropagation`，因此它才是「最后一公里」。它必须走 `parseOfficeLink` + `binaryOfficeFileProps`，把范围放进独立 state、标题用干净文件名；不能把原始 href 直接拼进 `/api/raw-file?path=`。

## 被否方案与代价

- **裸数字按页解释**：会破坏既有文本行范围链接，且无法向后兼容；doc-35 专门留了两条反例守住这条。
- **扩展名无关的通用 range 语法**：`.md:10-20` 与 `.docx:10-20` 含义冲突，解析层无法在不看扩展名的情况下判定。
- **只在 `useMarkdownLinkPreview` 里解析范围**：capture-phase 拦截器绕过了整个 Markdown 点击契约，只改契约层无效 —— 用户测试报的「所有范围预览 404 + 徽标与标题重复」正是这个漏网路径，两个问题同根。
- **把范围留在标题里**：`report.docx:P1-P4` 当标题会与 `officeRangeLabel` 生成的徽标重复，且暴露实现细节。

## 验证证据

`doc-35` 用四个真实 `quickstart/` 文件覆盖整篇 / 单页 / 范围 / 越界 clamp / 序号 / 中文表名 / 尖括号表名 / 不存在表名 / `!` 内联嵌入 / 裸数字反例 / 相对路径对照。122 个作用域测试 + headless Chrome 确认无 4xx、徽标单一、docx `:P2` 定位第 2 页、pptx `:P2-P5` 计数 1/4、pdf `:P9-P12` clamp 到第 3 页、xlsx 各 token 激活正确工作表。

## Related Concepts

- [[concepts/file-preview]] — 四个 viewer 与范围徽标
- [[concepts/markdown-pipeline]] — 扩展名锚定的范围切分
- [[concepts/relative-reference-resolution]] — 共享点击契约

## Related Sources

- [[sources/back-838-office-page-sheet-ranges]] — 裁决与用户测试反馈
- [[sources/doc-35-office-link-check]] — 反例与验收矩阵
