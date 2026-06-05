import { useState } from 'react';
import { db } from '../db';
import { exportAllData, downloadJSON } from '../utils/export';
import { importFullBackup } from '../utils/import';
import Icon from '../components/Icon';

const AI_PROMPT = `请将以下题目内容转换为 JSON 格式，严格遵循以下结构：

{
  "name": "题库名称",
  "questions": [
    {
      "type": "single",
      "question": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer": ["B"],
      "explanation": "解析（如有）"
    }
  ]
}

规则：
1. type 取值：single（单选）/ multiple（多选）/ judge（判断）/ blank（填空）/ short（简答）
2. 单选题 answer 为一个字母的数组，如 ["B"]
3. 多选题 answer 为多个字母的数组，如 ["A", "C"]
4. 判断题没有 options，answer 为 ["true"] 或 ["false"]
5. 填空题没有 options，answer 为答案文本数组
6. 简答题没有 options，answer 为参考答案数组
7. options 的 key 必须是大写字母 A/B/C/D/E...
8. 保持原题内容不变，不要修改题意
9. 只输出 JSON，不要其他内容

以下是题目内容：
`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-blue-600 text-white active:bg-blue-700'
      }`}
    >
      <Icon name={copied ? 'check' : 'file-text'} size={16} />
      {copied ? '已复制到剪贴板' : '复制提示词'}
    </button>
  );
}

export default function SettingsPage() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const date = new Date().toISOString().slice(0, 10);
      downloadJSON(json, `刷题宝备份_${date}.json`);
      setMessage({ type: 'success', text: '备份已下载！' });
    } catch (e: any) {
      setMessage({ type: 'error', text: '导出失败: ' + e.message });
    }
  };

  const handleRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm('恢复备份将覆盖当前所有数据，确定继续？')) return;
      try {
        await importFullBackup(file);
        setMessage({ type: 'success', text: '数据恢复成功！' });
      } catch (err: any) {
        setMessage({ type: 'error', text: '恢复失败: ' + err.message });
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirm('确定清空所有数据？\n此操作不可撤销！')) return;
    if (!confirm('再次确认：删除所有题库、做题记录和收藏？')) return;
    try {
      await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites], async () => {
        await db.banks.clear();
        await db.questions.clear();
        await db.records.clear();
        await db.favorites.clear();
      });
      setMessage({ type: 'success', text: '所有数据已清空' });
    } catch (e: any) {
      setMessage({ type: 'error', text: '清空失败: ' + e.message });
    }
  };

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">设置</h1>

      {message && (
        <div className={`mb-4 p-4 rounded-xl flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <span className="flex items-center gap-2">
            <Icon name={message.type === 'success' ? 'check-circle' : 'x-circle'} size={18} />
            {message.text}
          </span>
          <button onClick={() => setMessage(null)} className="text-sm opacity-60">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* 数据管理 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">数据管理</h2>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-4 px-4 py-4 border-b border-gray-50 active:bg-gray-50"
          >
            <Icon name="upload" size={22} className="text-blue-500" />
            <div className="text-left flex-1">
              <div className="font-medium text-gray-900">导出备份</div>
              <div className="text-xs text-gray-500">下载全部数据为 JSON 文件</div>
            </div>
            <Icon name="chevron-right" size={18} className="text-gray-300" />
          </button>

          <button
            onClick={handleRestore}
            className="w-full flex items-center gap-4 px-4 py-4 border-b border-gray-50 active:bg-gray-50"
          >
            <Icon name="download" size={22} className="text-green-500" />
            <div className="text-left flex-1">
              <div className="font-medium text-gray-900">恢复备份</div>
              <div className="text-xs text-gray-500">从 JSON 文件恢复数据</div>
            </div>
            <Icon name="chevron-right" size={18} className="text-gray-300" />
          </button>

          <button
            onClick={handleClearAll}
            className="w-full flex items-center gap-4 px-4 py-4 active:bg-gray-50"
          >
            <Icon name="trash" size={22} className="text-red-500" />
            <div className="text-left flex-1">
              <div className="font-medium text-red-600">清空所有数据</div>
              <div className="text-xs text-gray-500">删除所有题库和记录</div>
            </div>
            <Icon name="chevron-right" size={18} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">关于</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-center">
            <Icon name="book" size={40} className="text-blue-500 mb-2" />
            <div className="font-bold text-gray-900">刷题宝</div>
            <div className="text-xs text-gray-500 mt-1">v1.0.0</div>
            <div className="text-xs text-gray-400 mt-3 leading-relaxed">
              本地离线刷题 PWA<br />
              数据存储在你的设备上，不会上传到任何服务器<br />
              支持 JSON / CSV / Excel / 文本导入
            </div>
          </div>
        </div>
      </div>

      {/* 使用提示 */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">使用提示</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-3">
          <p className="flex items-start gap-2">
            <Icon name="smartphone" size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>添加到主屏幕后可像 App 一样使用，支持离线访问。</span>
          </p>
          <p className="flex items-start gap-2">
            <Icon name="refresh" size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>建议定期导出备份，防止数据丢失。</span>
          </p>
        </div>
      </div>

      {/* AI 转换提示词 */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">AI 转换提示词</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-600 mb-3">
            老师发的 Word / PDF 题库，把内容粘贴给 ChatGPT 或 Claude，配合以下提示词即可一键转为可导入的 JSON 格式。
          </p>
          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{AI_PROMPT}</pre>
          </div>
          <CopyButton text={AI_PROMPT} />
        </div>
      </div>
    </div>
  );
}
