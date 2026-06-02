---
title: Web UI 国际化（i18n）
labels: [concept]
created_date: 2026-05-17 02:20
updated_date: 2026-05-31 01:11
---

# Web UI 国际化（i18n）

Backlog.md Web UI 的零依赖轻量级国际化方案，基于自定义 React Context 与 TypeScript 类型安全翻译字典。

## 核心设计

**拒绝重型库**：不引入 i18next 或 react-intl，以保持 `bun build --compile` 生成的单文件二进制体积最小。所有翻译字典在编译时作为 ES 模块内联，无运行时文件读取。

## 类型系统

### DeepString 泛型

`src/web/locales/types.ts` 中的 `DeepString<T>` 将任意嵌套对象/函数结构递归映射为 `string` 返回类型：

```ts
type DeepString<T> = T extends (...args: infer P) => infer R
  ? (...args: P) => DeepString<R>
  : T extends object
    ? { [K in keyof T]: DeepString<T[K]> }
    : string;
```

`TranslationDict = DeepString<typeof en>` 确保：
- 所有语言文件必须与英语字典的键结构完全一致
- 函数签名（参数个数与类型）必须一致
- 访问不存在的键产生编译错误

### 字典结构

以 `en.ts` 为 source of truth，按功能域分组：

| 命名空间 | 用途 |
|---|---|
| `common` | 通用操作词（保存、取消、删除、加载中…） |
| `nav` | 侧边栏导航、搜索、文件树操作 |
| `board` | 看板标题、筛选器、泳道 |
| `taskList` | 任务列表列头、空状态、分页提示 |
| `taskDetails` | 任务编辑/创建表单、确认弹窗 |
| `taskCard` / `taskColumn` | 卡片与列的操作提示 |
| `milestones` | 里程碑管理、拖放提示 |
| `drafts` | 草稿列表与操作 |
| `documents` / `decisions` | 文档与决策编辑器 |
| `settings` | 设置页面全部标签与验证消息 |
| `cleanup` | 清理已完成任务向导 |
| `statistics` | 统计图表与指标名称、热力图标签、贡献标题 pluralization |
| `init` | 初始化向导全部步骤 |
| `filePreview` | 文件预览模态框 |
| `pasteAwareMDEditor` | 粘贴编辑器提示 |
| `wiki` | Wiki 页面编辑器 |

## 运行时架构

### I18nContext

- 维护 `locale` 状态（`"en" | "ja" | "zh-CN" | "zh-TW"`）
- 挂载时通过 `apiClient.fetchConfig()` 读取后端保存的语言偏好
- 提供 `setLocale` 与 `t`（当前语言字典）给子树

### useI18n Hook

组件消费的标准入口：

```ts
const { t } = useI18n();
```

### App.tsx 集成

`loadAllData()` 在**首次加载**时调用 `setLocale(configData.locale)`，确保页面加载时立即应用已保存的语言设置。后续后台数据刷新（WebSocket 事件触发的 `loadAllData()`）不再覆盖用户手动切换的语言，防止 locale 回退 bug（BACK-503）。

## 编译时嵌入

翻译文件以常规 `import { en } from "./en"` 方式导入，`bun build --compile` 会将所有字典静态内联到最终二进制中。无需在运行时读取 `locales/` 目录，也无需配置 bundler 的 asset loader。

## 持久化

`locale` 字段存储于 `backlog.config.yml`（或项目根配置），通过现有的 `/api/config` API 读写。切换语言后 Settings 页面调用 `apiClient.updateConfig({ ...config, locale })`，后端序列化到 YAML，随后 WebSocket 广播 `config-updated` 事件，但语言切换在前端即时生效，无需等待广播。

## 与现有功能的关系

- **粘贴为 Markdown**：编辑器提示词（"Upload Word document"）已纳入 `pasteAwareMDEditor` 命名空间
- **Wiki 编辑**：Wiki 页面保存成功提示、占位文本已纳入 `wiki` 命名空间
- **文件预览**：加载提示与行范围文案已纳入 `filePreview` 命名空间
- **初始化向导**：全部步骤文本（~100+ 键）独立在 `init` 命名空间中

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 页面、视图与技术特性总览
- [[concepts/web-server]] — Web Server API，包含 `/api/config` 语言配置透传
- [[concepts/paste-as-markdown]] — 编辑器中的国际化提示

## Related Sources
- [[sources/web-ui-i18n-task]] — BACK-478 原始任务与实现笔记
- [[sources/task-completion-heatmap-task]] — BACK-503 热力图 i18n 与 locale 切换修复
