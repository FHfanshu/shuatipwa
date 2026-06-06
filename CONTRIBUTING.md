# 贡献指南

## 开发环境

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，支持热更新。

## 命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run preview` | 预览生产构建 |

## 提交规范

提交信息用中文，格式：

```
<type>: <简短描述>

fix: 修复 xxx 的问题
feat: 新增 xxx 功能
docs: 更新文档
refactor: 重构 xxx
```

## 提交前检查

1. `npm run build` 必须通过（CI 会跑 `tsc -b && vite build`）
2. `npm run lint` 无报错
3. 不要有未使用的 import 或变量

## 项目结构

```
src/
  types/          # TypeScript 类型定义
  db/             # IndexedDB (Dexie) 数据库
  utils/          # 工具函数（AI、导入导出、解析）
  components/     # 可复用组件
  pages/          # 页面组件
  contexts/       # React Context
```

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- TailwindCSS 4（`@tailwindcss/vite`，不是 PostCSS）
- Dexie 4（IndexedDB）
- react-router-dom 7

## 数据库修改

修改 IndexedDB schema 时，只能追加新 version，不能修改已有 version：

```ts
db.version(2).stores({
  newTable: '++id, fieldName',
});
```

记得同步更新 `importFullBackup`（恢复备份）和 `handleClearAll`（清空数据）中的表清理逻辑。

## 部署

Push 到 `main` 自动部署到 Vercel 和 GitHub Pages，无需手动操作。
