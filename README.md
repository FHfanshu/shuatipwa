# 刷题助手 - 本地离线刷题 PWA

一个本地优先的离线刷题 Progressive Web App，支持多种题库格式导入、智能练习和进度追踪。数据始终留在你的设备上，保护隐私。

**在线演示**: [点击访问](https://shuatipwa.example.com)

---

## 功能亮点

### 题库管理
- **多格式导入**: JSON / CSV / Excel (.xlsx) / TXT / Markdown
- **批量导入**: 支持一次导入多个题库文件
- **题库命名**: 自定义题库名称，方便管理
- **导出备份**: JSON 格式导出/恢复完整题库和进度

### 智能练习
- **多种模式**: 顺序练习、随机练习、错题重练、收藏练习、模拟考试
- **自动跳转**: 答对后 450ms 自动进入下一题
- **状态保持**: 中途退出后可从断点继续，保留所有进度
- **答题卡导航**: 快速跳转到任意题目
- **收藏系统**: 标记重点题目，随时回顾

### 题型支持
- 单选题 | 多选题 | 判断题 | 填空题 | 简答题
- Markdown 格式题目内容（支持代码块、公式等）

### 进度追踪
- **实时统计**: 正确率、已答题数、错题数
- **错题本**: 自动收集错题，支持错题重练
- **分类筛选**: 按题库、题型、难度筛选题目

### 用户体验
- **移动端优先**: 为手机竖屏优化的触控交互
- **6 色主题**: 精心设计的配色系统，支持深色/浅色模式
- **离线支持**: 添加到主屏幕后完全离线使用
- **流畅动画**: 平滑的页面切换和交互动画

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4 |
| 数据库 | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa |
| 路由 | React Router 7 |
| Excel | xlsx (SheetJS) |
| 文档解析 | mammoth (Word), react-markdown |

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
npm run preview
```

---

## 题库格式

### JSON 格式 (推荐)

```json
{
  "name": "期末复习题库",
  "questions": [
    {
      "type": "single",
      "question": "下列哪项属于操作系统？",
      "options": {
        "A": "MySQL",
        "B": "Windows",
        "C": "HTML",
        "D": "Python"
      },
      "answer": ["B"],
      "explanation": "Windows 是操作系统，而 MySQL 是数据库管理系统。"
    },
    {
      "type": "multiple",
      "question": "以下哪些是编程语言？",
      "options": {
        "A": "Java",
        "B": "Photoshop",
        "C": "Python",
        "D": "Excel"
      },
      "answer": ["A", "C"]
    },
    {
      "type": "judge",
      "question": "HTTP 是无状态协议。",
      "answer": ["true"]
    },
    {
      "type": "fill",
      "question": "TCP/IP 协议的全称是____",
      "answer": ["传输控制协议/互联网协议"]
    }
  ]
}
```

### 支持的字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | ✓ | 题型: `single` `multiple` `judge` `fill` `text` |
| `question` | string | ✓ | 题目内容，支持 Markdown |
| `options` | object | 选择题必填 | 选项 { A: "...", B: "..." } |
| `answer` | string[] | ✓ | 正确答案 |
| `explanation` | string | 可选 | 答案解析 |

---

## 题库转换工具

如果你的题库是 Word/Excel/PDF 格式，可以使用内置的 Python 脚本转换：

### 安装依赖

```bash
pip install python-docx openpyxl pdfplumber
```

### 转换文件

```bash
# 转换 Word 文档
python scripts/convert_to_json.py 题库.docx

# 转换 Excel（自定义题库名称）
python scripts/convert_to_json.py 题库.xlsx --name "期末复习"

# 转换 PDF
python scripts/convert_to_json.py 题库.pdf

# 批量转换多个文件
python scripts/convert_to_json.py *.docx

# 合并多个文件为一个题库
python scripts/convert_to_json.py a.docx b.xlsx --merge
```

---

## 项目结构

```
shuatipwa/
├── src/
│   ├── components/          # UI 组件
│   │   ├── BottomNav.tsx   # 底部导航栏
│   │   ├── QuestionCard.tsx # 答题卡片
│   │   ├── QuestionOverview.tsx # 题目总览
│   │   ├── ThemeToggle.tsx  # 主题切换
│   │   └── Icon.tsx        # 图标组件
│   │
│   ├── pages/               # 页面组件
│   │   ├── HomePage.tsx    # 首页 (题库列表)
│   │   ├── ImportPage.tsx  # 导入页
│   │   ├── PracticePage.tsx # 练习页 (核心)
│   │   ├── WrongPage.tsx   # 错题本
│   │   └── SettingsPage.tsx # 设置页
│   │
│   ├── db/                  # Dexie 数据库配置
│   ├── contexts/           # React Context
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数
│       ├── import.ts      # 题库导入解析
│       ├── helper.ts      # 通用工具
│       └── textParser.ts  # Markdown 解析
│
├── scripts/
│   └── convert_to_json.py # 题库格式转换工具
│
├── public/                  # 静态资源
└── dist/                   # 构建输出
```

---

## 开发

### 代码检查

```bash
npm run lint
```

### 部署

项目构建后生成静态文件，可部署到任何静态托管平台：

- **GitHub Pages**: 使用 GitHub Actions 自动部署
- **Vercel/Netlify**: 直接导入仓库即可
- **Cloudflare Pages**: 支持 PWA 的 Cloudflare Workers

---

## 隐私保护

- 所有数据存储在本地 IndexedDB 中
- 无后端服务器，无数据上传
- 完全离线可用
- 符合隐私优先的设计理念

---

## 许可证

MIT License

---

## 贡献

欢迎提交 Issue 和 Pull Request！

如果你有题库想要转换格式，或者发现了 bug，请在 [GitHub Issues](https://github.com/your-username/shuatipwa/issues) 提出。
