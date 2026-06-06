# Agent Guidelines

## 提交流程

1. 改完代码后跑 `npm run build`，必须通过
2. 不要有未使用的 import 或变量（CI 会报错）
3. commit message 用中文，格式：`fix:` / `feat:` / `docs:` + 简短描述
4. push 到 `main` 后等 CI 通过再继续下一步

## 修改数据库 schema

Dexie schema 只能追加，不能修改已有 version：

```ts
// 正确：加新 version
db.version(2).stores({
  newTable: '++id, field1, field2',
});

// 错误：直接改 version(1)
```

恢复备份 (`importFullBackup`) 和清空数据 (`handleClearAll`) 都要同步清理新表。

## 做题流程关键逻辑

- `QuestionCard` 的 `onAutoAdvance` 在答对后 450ms 自动跳下一题
- `isRestoringRef` 阻止回看已答题目时再次触发自动跳转
- `PracticePage` 启动时从 `db.records` 恢复 `results` 和 `questionStates`
- 顺序练习跳到第一个未答题目，不是第 1 题
- `savedState` prop 传入 `QuestionCard` 用于恢复已答题状态

## 样式规范

- 用 TailwindCSS v4 utility class，不要写自定义 CSS（除非在 `index.css` 的 `@theme` 中）
- 颜色用 `bg-bg-primary` / `text-text-primary` / `bg-accent` 等语义化 class
- 圆角统一用 `rounded-xl`（卡片）/ `rounded-2xl`（大卡片）/ `rounded-lg`（按钮/小元素）
- 移动端优先，`max-w-3xl mx-auto` 居中
- 底部导航留 `pb-20` 安全距离

## AI 解析

- 解析结果缓存在 `db.aiExplanations`，按 `questionId` 查找
- 弹窗标题栏有 `refresh-cw` 按钮强制重新生成
- 提示词在 `src/utils/ai.ts` 的 `SYSTEM_PROMPT`

## PWA 注意事项

- `index.html` 的 `<head>` 有内联脚本同步设置 `theme-color` 和 `data-theme`
- `viewport-fit=cover` 需要配合正确的 `theme-color` 避免状态栏色差
- `vite-plugin-pwa` 自动生成 `manifest.json`，配置在 `vite.config.ts`

## 不要做的事

- 不要加测试框架（项目没有测试）
- 不要引入新的状态管理库（用 React useState + Context）
- 不要改 tsconfig 的 strict 设置
- 不要在组件里直接操作 DOM（用 React 状态驱动）
- 不要用 `any` 类型（除非已有代码模式如此）
