# 架构说明

## 分层

项目分为五层：

1. **UI 层** — `pages/` 和 `components/`
2. **Service 层** — 业务流程编排
3. **Repository 层** — IndexedDB 读写
4. **Domain 层** — 纯业务规则（无副作用）
5. **Infrastructure 层** — PWA、AI API、文件解析、版本检测

## 目录结构

```
src/
  domain/              # 纯业务模型和规则
    answerJudge.ts     # 答案判断（checkAnswer）
    wrongQuestion.ts   # 错题本规则（getCurrentWrongQuestionIds）
    questionParser.ts  # 文本解析（纯函数，从 textParser.ts 迁入）
    questionType.ts    # 题型推断和标签映射
  services/            # 业务服务层，给 UI 调用
    practiceService.ts # 做题流程：加载、恢复、提交、统计
    importService.ts   # 题库导入 + 全量备份恢复
    exportService.ts   # 题库导出 + 全量备份导出
    aiService.ts       # AI 解析：缓存查询、配置读取、流式调用、缓存写入
    versionService.ts  # 版本检测（待迁入）
  repositories/        # 只负责 DB 读写
    bankRepo.ts
    questionRepo.ts
    recordRepo.ts
    favoriteRepo.ts
    aiExplanationRepo.ts
  db/
    index.ts           # Dexie schema 定义
  types/
    index.ts           # 所有类型定义
  utils/               # 最小化：helper.ts + downloadBlob + aiPrompt + version
  pages/
  components/
  contexts/
```

## UI 层规则

- 页面只负责展示、路由、轻量交互状态。
- 组件不得直接访问 Dexie。
- 组件不得直接实现业务规则。
- 复杂流程必须放入 service。
- `PracticePage` 目标：150 行以内，只调用 `practiceService` 渲染。
- `QuestionCard` 不得直接操作 `db.records`、`db.favorites`、`db.aiExplanations`。

## Service 层规则

- `practiceService`：加载练习、提交答案、恢复进度、计算统计。
- `favoriteService`：收藏状态和切换收藏。
- `aiService`：AI 解析缓存、请求、刷新。
- `importService`：题库导入（文件读取 + 解析 + 写入 DB）。
- `exportService`：题库导出。
- `backupService`：全量备份导入导出。
- service 可以调用 repository，不直接调用 Dexie。

## Repository 层规则

- 只负责数据库读写，不含业务逻辑。
- 对旧数据字段缺失做兼容。
- 不包含 UI 逻辑。
- 不包含答案判断逻辑。
- 所有返回值处理旧数据缺字段的情况。

## Domain 层规则

- 纯函数，无浏览器 API，无 Dexie，无 localStorage。
- 必须容易单测。
- 答案判断、错题规则、文本解析、题型推断都属于这里。

## 当前已知的违反架构点（待逐步修复）

- ~~`QuestionCard.tsx` 直接调用 `db.records`、`db.favorites`、`db.aiExplanations`（9 处）~~ ✅ 已迁到 repo
- ~~`SettingsPage.tsx` 直接调用 `db.transaction` 清空数据~~ ✅ 已迁到 bankRepo
- ~~`WrongPage.tsx` 直接调用 `db.records`、`db.questions`~~ ✅ 已迁到 repo
- ~~`helper.ts` 混合了 domain 逻辑（checkAnswer）和 UI 映射（getQuestionTypeColor）~~ ✅ checkAnswer/getCurrentWrongQuestionIds 已迁到 domain
- ~~`PracticePage.tsx` 直接调用 `db.records`、`db.questions`、`db.favorites`（6 处）~~ ✅ 已迁到 practiceService
- ~~`textParser.ts` 和 `import.ts` 中 `inferQuestionType` / `inferRawQuestionType` 逻辑重复~~ ✅ 已统一到 domain/questionParser.ts
- ~~`utils/export.ts` 和 `utils/import.ts` 仍直接调用 db~~ ✅ 已迁到 importService/exportService，DB 操作通过 repo
- ~~`utils/ai.ts` 仍为 Infrastructure 层，待迁到 services/aiService~~ ✅ 已迁到 aiService，QuestionCard 不再直接调用 repo/ai
- `HomePage.tsx` 的 `useLiveQuery` 仍用原始 db 调用（需要保留以支持响应式更新）

