---
name: convert-quiz
description: 将 Word/Excel/CSV/PDF/TXT 题库文件转换为刷题宝 JSON 格式
user_invocable: true
---

# 题库文件转换

将老师发的题库文件（Word / Excel / CSV / PDF / 纯文本）一键转换为刷题宝 PWA 可导入的 JSON 格式。

## 使用方式

用户提供文件路径后，执行以下步骤：

### 1. 确认文件存在

检查用户提供的文件路径是否有效，支持格式：`.docx` / `.xlsx` / `.xls` / `.csv` / `.txt` / `.md` / `.pdf`

### 2. 运行转换脚本

```bash
cd F:/Coding/vibecoding/shuatipwa
python scripts/convert_to_json.py "<文件路径>" [--name "题库名称"] [--output "输出路径.json"]
```

参数说明：
- `--name` / `-n`：指定题库名称（默认使用文件名）
- `--output` / `-o`：指定输出路径（默认：原文件名_converted.json）
- 支持批量：传入多个文件路径
- `--merge` / `-m`：合并多个文件为一个题库

### 3. 验证输出

转换完成后，用 Python 验证 JSON 质量：

```python
import json
with open('output.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f"题库: {data['name']}")
print(f"总题数: {len(data['questions'])}")
# 检查题型分布
types = {}
for q in data['questions']:
    t = q.get('type', 'unknown')
    types[t] = types.get(t, 0) + 1
print(f"题型: {types}")
# 抽查前 3 题
for q in data['questions'][:3]:
    print(f"  [{q['type']}] {q['question'][:50]}... -> {q['answer']}")
```

### 4. 报告结果

向用户展示：
- 转换出的题目总数
- 题型分布（单选/多选/判断/填空/简答）
- 输出文件路径
- 提示用户可以将 JSON 文件拖入刷题宝 App 的导入页面

## 支持的输入格式

| 格式 | 说明 | 依赖 |
|------|------|------|
| `.docx` | Word 文档 | `python-docx` |
| `.xlsx` / `.xls` | Excel 表格 | `openpyxl` |
| `.csv` | CSV 文本 | 内置 csv 模块 |
| `.txt` / `.md` | 纯文本 / Markdown | 无 |
| `.pdf` | PDF 文档 | `pdfplumber` |

如果缺少依赖，提示用户安装：
```bash
pip install python-docx openpyxl pdfplumber
```

## 常见题库格式

脚本会自动识别以下格式：

**格式 1 — 题号 + 选项 + 答案在同一段落/行：**
```
1、下列哪项正确？A、选项A B、选项B C、选项C D、选项D 答案：B
```

**格式 2 — 题号行 + 选项分行（Word 常见）：**
```
1、下列哪项正确？（ ）。	正确答案：B
A、 选项A
B、 选项B
C、 选项C
D、 选项D
```

**格式 3 — Excel 表格（列标题为 题目/A/B/C/D/答案）：**
| 题目 | A | B | C | D | 答案 |
|------|---|---|---|---|------|

**格式 4 — 判断题：**
```
1、CPU是核心部件。答案：对
```

## 输出格式

```json
{
  "name": "题库名称",
  "questions": [
    {
      "type": "single",
      "question": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer": ["B"],
      "explanation": "解析"
    }
  ]
}
```

## 注意事项

- PDF 文件依赖 `pdfplumber`，如果 PDF 是扫描件（图片），需要先 OCR
- Word 中的表格内容也会被提取
- 如果转换结果不理想，可以先用 AI（ChatGPT/Claude）将题库转成标准格式再导入
- 脚本位于 `F:/Coding/vibecoding/shuatipwa/scripts/convert_to_json.py`
