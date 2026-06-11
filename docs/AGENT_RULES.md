# Agent 修改约束

## 必读文件

修改前必须阅读：

- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/TESTING.md
- docs/REGRESSION.md

## 最高优先级规则

1. 不允许直接修改 IndexedDB 旧 version schema。
2. 修改 `src/db/index.ts` 必须说明是否需要 migration。
3. 页面组件不得直接操作 Dexie table。
4. 复杂业务逻辑不得继续塞进 `pages/` 或 `components/`。
5. 修改导入解析必须增加 fixture 测试。
6. 修改答案判断必须增加 `answerJudge` 测试。
7. 修改做题状态恢复必须增加 `practiceService` 测试。
8. 修改 PWA 更新策略必须手动验证刷新、离线、GitHub Pages base。
9. 不允许用 `any` 掩盖类型错误。
10. 不允许为了修一个 bug 大面积重写无关模块。
11. 单个受维护文本文件不得超过 1000 行；接近限制时先拆分模块、组件或测试 fixture。
12. `src/` 和 `tests/` 内相对引用关系必须保持 DAG，不允许循环引用。

## 修改流程

每次修 bug 必须按顺序：

1. 定位 bug 类型：
   - import parsing
   - answer judging
   - practice session
   - IndexedDB persistence
   - PWA/cache
   - AI explanation
   - UI display

2. 先写失败测试或最小 fixture。
3. 再修实现。
4. 运行：

```bash
npm run check
```

## CI 与并发协作

- 本地 CI 必须在稳定工作区运行；如果另一个智能体或用户正在改代码，先用 `git status --short` 确认没有混入无关改动。
- 一个智能体跑 CI、另一个智能体同时改代码时，结果只能说明“命令启动时的工作区快照”，不能代表后续改动。
- 需要验证自己的改动但工作区已有他人未提交改动时，优先创建临时 clean worktree 验证目标提交，或先沟通暂停修改。
- 不要把他人并发产生的文件一起 stage/commit；每次提交前必须检查 `git diff --cached --name-only`。

## 禁止行为

* 禁止静默清空用户 IndexedDB。
* 禁止在 migration 中假设旧数据完整。
* 禁止让 `QuestionCard` 直接写 records/favorites/aiExplanations。
* 禁止让 `PracticePage` 直接实现恢复进度规则。
* 禁止改坏 Vercel `/` 和 GitHub Pages `/shuatipwa/` 双 base 逻辑。
* 禁止用 `any` 掩盖类型错误。
* 禁止静默吞掉导入错误。
* 禁止为了绕过 1000 行限制把无关代码塞进例外文件、生成文件或 lockfile。
* 禁止引入 `A -> B -> A` 或更长链路的循环引用；共享逻辑应上提到更低层模块。

## Git 提交规范

- 原子化提交：一个 commit 只做一件事。
- 如果不能做到严格原子化，按类别分 commit，不要混在一起。
- 分类示例：
  - `chore: 安装 vitest + fake-indexeddb` — 依赖和配置变更
  - `refactor: 抽取 domain/answerJudge.ts` — 纯重构，不改行为
  - `feat: 新增 recordRepo / favoriteRepo` — 新增 repo 层
  - `refactor: QuestionCard 改用 repo 调用` — 组件迁移到 repo
  - `test: 新增 answerJudge / wrongQuestion 单元测试` — 纯测试
  - `fix: 修复 xxx` — bug 修复
- 不要把依赖安装、代码重构、测试编写混进同一个 commit。
- commit message 用中文或英文均可，但同一个项目内保持一致。
