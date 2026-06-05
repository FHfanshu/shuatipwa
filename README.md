# 刷题宝 - 本地离线刷题 PWA

本地离线刷题应用，数据不离开你的设备。支持导入多种格式题库，手机浏览器打开即可使用。

## 功能

- 导入题库：JSON / CSV / Excel / TXT / Markdown
- 练习模式：顺序、随机、错题、收藏、模拟考试
- 题型支持：单选、多选、判断、填空、简答
- 进度追踪：正确率、已完成题数、错题统计
- 数据备份：导出 / 恢复 JSON 备份
- PWA 离线：添加到主屏幕后可离线使用

## 技术栈

- Vite + React 18 + TypeScript
- Tailwind CSS v4（移动端优先 UI）
- Dexie.js（IndexedDB 封装）
- vite-plugin-pwa（PWA 支持）
- xlsx（Excel 解析）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`

## 题库转换

老师发的 Word / Excel / PDF 题库可以用内置脚本转换：

```bash
# 转换 Word 文档
python scripts/convert_to_json.py 题库.docx

# 转换 Excel
python scripts/convert_to_json.py 题库.xlsx --name "期末复习"

# 转换 PDF
python scripts/convert_to_json.py 题库.pdf

# 批量转换
python scripts/convert_to_json.py *.docx

# 合并多个文件
python scripts/convert_to_json.py a.docx b.docx --merge
```

Python 依赖：`pip install python-docx openpyxl pdfplumber`

## JSON 格式

```json
{
  "name": "题库名称",
  "questions": [
    {
      "type": "single",
      "question": "下列哪项属于操作系统？",
      "options": {"A": "MySQL", "B": "Windows", "C": "HTML", "D": "Python"},
      "answer": ["B"],
      "explanation": "Windows 是操作系统。"
    }
  ]
}
```

## 项目结构

```
src/
  types/          TypeScript 类型定义
  db/             Dexie 数据库
  utils/          导入、导出、判分工具
  components/     答题卡片、底部导航、图标
  pages/          首页、导入、刷题、错题本、设置
scripts/
  convert_to_json.py   题库文件转换脚本
```

## License

MIT
