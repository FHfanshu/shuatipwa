# 刷题助手 (shuatipwa)

本地离线刷题 PWA，数据存储在浏览器 IndexedDB，支持离线使用。

## 开发命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 构建（CI 用这个） |
| `npm run lint` | ESLint 检查 |

提交前必须 `npm run build` 通过，CI 会跑 `tsc -b && vite build`。

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- TailwindCSS 4（`@tailwindcss/vite` 插件，不是 PostCSS）
- Dexie 4（IndexedDB ORM）+ dexie-react-hooks
- react-router-dom 7
- vite-plugin-pwa（Workbox service worker）
- fflate（ZIP 压缩）、mammoth（Word）、xlsx（Excel）

## 项目结构

```
src/
  types/index.ts        # 所有类型定义
  db/index.ts           # Dexie 数据库 schema（5 张表）
  utils/                # ai.ts / export.ts / import.ts / helper.ts / textParser.ts
  components/           # QuestionCard / QuestionOverview / BottomNav / Icon
  pages/                # HomePage / PracticePage / ImportPage / SettingsPage / WrongPage
  contexts/ThemeContext.tsx  # 主题 + 配色方案
```

## 数据库 (IndexedDB)

Dexie 数据库名 `ShuaTiDB`，5 张表：
- `banks` — 题库元信息（string id）
- `questions` — 题目（string id，按 bankId 索引）
- `records` — 做题记录（auto-increment id，compound index [bankId+questionId]）
- `favorites` — 收藏（auto-increment id，compound index [bankId+questionId]）
- `aiExplanations` — AI 解析缓存（auto-increment id，questionId 索引）

修改 schema 需要加 `db.version(N)` 迁移，不能直接改现有 version。

## 主题系统

- 6 套配色方案：copper / ocean / forest / lavender / rose / slate
- 明暗模式：`data-theme="light|dark"` 在 `<html>` 上
- 配色：`data-palette="copper"` 等在 `<html>` 上
- 颜色定义在 `src/index.css` 的 CSS 自定义属性中
- `index.html` 有内联脚本在 React 水合前读取 localStorage 设置初始主题

## 部署

双部署目标：
- **Vercel**：`process.env.VERCEL` 存在时 `base: '/'`
- **GitHub Pages**：否则 `base: '/shuatipwa/'`

CI 是 GitHub Actions，push 到 `main` 触发两个 deploy workflow。

## 约束

- 不要使用 `strict: true`，项目用的是 `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch`
- TailwindCSS v4 没有 `tailwind.config.js`，样式用 `@theme` 指令在 `index.css` 中定义
- 图标用 `Icon` 组件（`src/components/Icon.tsx`），传 `name` 和 `size`
- AI 解析走 OpenAI 兼容协议，配置存在 localStorage（`ai_endpoint` / `ai_apiKey` / `ai_model`）
- 做题记录用 `saveRecord` 写入 IndexedDB，`PracticePage` 启动时从 DB 恢复 `results` 和 `questionStates`
- 顺序练习从第一个未答题目开始（基于 IndexedDB 记录），不是从第 1 题
