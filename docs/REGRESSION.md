# 回归测试规则

## 原则

每次修复真实 bug，必须：
1. 保存触发 bug 的输入为 fixture。
2. 写一个失败测试复现 bug。
3. 修实现让测试通过。
4. 测试名描述 bug 行为，不是修复方式。

## Fixture 目录

```
tests/fixtures/
  import/            # 各种格式的导入文件
  regression/        # 真实 bug 触发数据
```

## 命名规范

导入 fixture：
```
tests/fixtures/import/
  simple-single-choice.txt
  multi-choice.txt
  judge-questions.txt
  malformed-missing-answer.txt
  inline-options.txt
  tab-separated.txt
  real-sample-001.txt
```

回归 fixture：
```
tests/fixtures/regression/
  20260608-inline-answer-parsed-wrong.txt
  20260610-duplicate-answer-key.txt
```

## 必测场景

### 文本解析（textParser）

| 场景 | 要测什么 |
|------|---------|
| 标准格式 | `1、题目。答案：A` + 选项在下一行 |
| 行内格式 | 题目、答案、选项在同一行 |
| Tab 分隔 | 题目和答案用 Tab 分隔 |
| 行内选项 | `A.选项A B.选项B` 在同一行 |
| 解析提取 | `解析：xxx` 或 `解析：xxx` 在答案后 |
| 判断题 | 对/错/正确/错误/True/False/√/× |
| 多选题 | AC / A,C / A C / A、C |
| 答案格式 | `答案：A` / `正确答案 A` / `answer: A` |
| 章节标题 | `一、单项选择题` 应跳过 |
| 空题库 | 空字符串返回空数组 |

### 答案判断（answerJudge）

| 场景 | 要测什么 |
|------|---------|
| 单选正确 | `['A']` vs `['A']` → correct |
| 单选错误 | `['A']` vs `['B']` → wrong |
| 大小写 | `['a']` vs `['A']` → correct |
| 多选顺序无关 | `['A','C']` vs `['C','A']` → correct |
| 多选遗漏 | `['A','C']` vs `['A']` → wrong |
| 判断正确 | `['true']` vs `['true']` → correct |
| 判断错误 | `['true']` vs `['false']` → wrong |
| 空答案 | `[]` → unanswered |

### 错题本（wrongQuestion）

| 场景 | 要测什么 |
|------|---------|
| 最新一次做对 | 不再算错题 |
| 最新一次做错 | 进入错题本 |
| 无记录 | 不在错题本 |
| 同题多次 | 只看最新一次 |

### 导入（importService）

| 场景 | 要测什么 |
|------|---------|
| 选项缺失 | 是否给 warning |
| 答案格式不同 | A / 答案：A / 正确答案 A 是否兼容 |
| 多选题 | AC / A,C / A C 是否统一 |
| 判断题 | 对/错/正确/错误/True/False |
| 重复题目 | 是否去重或提示 |
| 空题库 | 是否拒绝导入 |
| Excel 空行 | 是否跳过 |
