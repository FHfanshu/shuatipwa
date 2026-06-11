# 测试规则

## 测试基础设施

- **Vitest** — 纯函数单测和集成测试
- **fake-indexeddb** — IndexedDB 集成测试
- **@testing-library/react** — 组件 smoke 测试
- **jsdom** — DOM 环境模拟

## 测试目录结构

```
tests/
  domain/              # 纯函数单测
    answerJudge.test.ts
    wrongQuestion.test.ts
    textParser.test.ts
    questionFingerprint.test.ts
  repositories/        # IndexedDB 集成测试（用 fake-indexeddb）
    recordRepo.test.ts
    favoriteRepo.test.ts
    aiExplanationRepo.test.ts
    bankRepo.test.ts
    questionRepo.test.ts
    settingsRepo.test.ts
  services/            # 业务流程测试
    practiceService.test.ts
    importService.test.ts
    exportService.test.ts
    practiceSessionStore.test.ts
    aiService.test.ts
  components/          # 组件 smoke 测试
    QuestionCard.test.tsx
    ModelSelect.test.tsx
    QuestionOverview.test.tsx
  contexts/            # Context 测试
    ThemeContext.test.tsx
  pages/               # 页面测试
    BanksPage.test.tsx
    PracticePage.test.ts
    HomePage.test.ts
    ImportPage.test.ts
  utils/               # 工具函数测试
    helper.test.ts
  fixtures/
    import/            # 导入格式 fixture
    regression/        # 真实 bug 回归样例
```

## 测试优先级

**第一优先级（必须先做）：**
- answerJudge — 答案判断纯函数
- wrongQuestion — 错题本规则
- textParser — 文本解析
- importService — 题库导入
- practiceService — 做题状态恢复

**第二优先级：**
- repositories（fake-indexeddb）
- backup import/export
- aiExplanation cache

**第三优先级：**
- React component smoke tests
- PWA manual verification

## 修改对应测试

| 修改内容 | 必须增加或更新 |
|---|---|
| 答案判断 | `tests/domain/answerJudge.test.ts` |
| 错题本规则 | `tests/domain/wrongQuestion.test.ts` |
| 文本解析 | fixture + `tests/domain/textParser.test.ts` |
| 内容去重 hash | `tests/domain/questionFingerprint.test.ts` |
| Excel/CSV/JSON 导入 | `tests/services/importService.test.ts` |
| 数据导出 | `tests/services/exportService.test.ts` |
| 做题恢复 | `tests/services/practiceService.test.ts` |
| IndexedDB schema | migration/repository test |
| 题目 CRUD | `tests/repositories/questionRepo.test.ts` |
| 应用设置 | `tests/repositories/settingsRepo.test.ts` |
| AI 解析缓存 | `tests/repositories/aiExplanationRepo.test.ts` |
| PWA 更新 | 手动验证记录 |

## 回归样例规则

真实 bug 修复后，必须把触发 bug 的输入保存为 fixture。

文件名格式：
```
tests/fixtures/regression/YYYYMMDD-short-name.txt
```

测试名必须说明 bug 行为：
```ts
it('keeps inline options when answer appears on same line', () => {})
```

## 本地检查

普通修改：
```bash
npm run check
```

发布前：
```bash
npm run check
npm run build
```
