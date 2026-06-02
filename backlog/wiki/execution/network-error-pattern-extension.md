---
title: 扩展 Git 网络错误识别模式
labels: [execution]
created_date: 2026-05-25 00:45
updated_date: 2026-05-25 00:45
---

# 扩展 Git 网络错误识别模式

## 场景

`GitOperations.fetch()` 使用 `containsNetworkErrorPattern()` 识别网络错误并优雅降级（返回本地数据而非崩溃）。当新的网络错误类型出现时，需要将其加入识别模式列表。

## 标准步骤

1. **定位错误检测函数**
   - 文件：`src/git/operations.ts`
   - 函数：`containsNetworkErrorPattern()`

2. **追加新模式**
   - 将新错误关键词小写后追加到 `networkErrorPatterns` 数组
   - 保持与现有模式一致的粒度（足够宽泛以覆盖变体，足够精确以避免误报）

3. **添加测试**
   - 文件：`src/test/git.test.ts`
   - 覆盖：新错误模式、经典错误（回归）、非网络错误（确保无假阳性）

4. **运行完整测试套件**
   - `bun test` 确认无回归

## BACK-487 示例

追加的 SSL 相关模式：
```typescript
"ssl_error_syscall",
"ssl_connect",
"ssl handshake failed",
"tls handshake timeout",
```

## 设计原则

- **纯增量变更**：只扩展识别范围，不改变非网络错误的抛出行为
- **环境意识**：SSL 错误常因 `Bun.spawn` 继承的环境与交互式 shell 不同（缺失代理变量）

## 提取来源
- [[sources/ssl-network-error-fix]]
