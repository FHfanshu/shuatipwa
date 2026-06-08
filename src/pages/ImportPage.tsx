import { useState, useRef, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { importFromFile } from '../services/importService';
import { AI_PROMPT } from '../utils/aiPrompt';
import Icon from '../components/Icon';

interface ImportError {
  message: string;
  reason?: string;
  suggestions?: string[];
  showAiPrompt?: boolean;
}

function classifyError(msg: string): ImportError {
  if (msg.includes('未能从文件中解析出任何题目')) {
    return {
      message: msg,
      reason: '未能解析出任何题目',
      suggestions: [
        '检查是否包含「答案：A」格式的答案行',
        '检查选项是否为 A. / B. / C. / D. 格式',
        '如果格式较乱，试试用 AI 转换成标准 JSON',
      ],
      showAiPrompt: true,
    };
  }
  if (msg.includes('JSON 格式不正确')) {
    return {
      message: msg,
      reason: 'JSON 格式不正确',
      suggestions: [
        'JSON 需要是数组 [{...}] 或包含 questions 数组的对象',
        '用 JSON 校验工具检查语法是否正确',
      ],
    };
  }
  if (msg.includes('不支持的文件格式')) {
    return {
      message: msg,
      reason: '文件格式不支持',
      suggestions: ['请使用 JSON、CSV、Excel、Word 或文本文件'],
    };
  }
  return { message: msg };
}

export default function ImportPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; count: number } | null>(null);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [bankName, setBankName] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = AI_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    setResult(null);
    setLoading(true);
    try {
      const { bank, count } = await importFromFile(file, bankName || undefined);
      setResult({ name: bank.name, count });
      setBankName('');
    } catch (e: any) {
      setImportError(classifyError(e.message || '导入失败'));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display text-[2rem] font-semibold tracking-tight text-text-primary mb-2">导入题库</h1>
      <p className="text-sm text-text-secondary mb-6">支持 JSON、CSV、Excel、Word、TXT / Markdown</p>

      {/* 自定义名称 */}
      <div className="mb-4">
        <label className="text-sm text-text-secondary mb-1 block">题库名称（可选，留空则用文件名）</label>
        <input
          type="text"
          value={bankName}
          onChange={e => setBankName(e.target.value)}
          placeholder="例如：操作系统期末复习"
          className="w-full px-4 py-3 border border-border-default rounded-xl text-sm focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none bg-bg-card text-text-primary placeholder:text-text-muted transition-all"
        />
      </div>

      {/* 拖拽区域 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragging ? 'border-accent bg-accent/10 shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-border-default bg-bg-card hover:border-accent/50 hover:bg-bg-secondary'
        }`}
      >
        {loading ? (
          <div>
            <Icon name="refresh" size={40} className="text-accent mb-3 animate-spin" />
            <div className="text-text-secondary">正在导入...</div>
          </div>
        ) : (
          <div>
            <Icon name="folder" size={48} className="text-text-muted mb-3" />
            <div className="font-medium text-text-secondary mb-1">点击或拖拽文件到这里</div>
            <div className="text-xs text-text-muted">JSON / CSV / Excel / Word / TXT / Markdown</div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,.xlsx,.xls,.docx,.txt,.md"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* 结果 */}
      {result && (
        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Icon name="check-circle" size={22} className="text-emerald-500" />
            <div>
              <div className="font-medium text-text-primary">导入成功</div>
              <div className="text-sm text-text-secondary">「{result.name}」共 {result.count} 题</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigate('/banks')}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium active:bg-accent-hover active:scale-[0.98] transition-all"
            >
              查看题库
            </button>
            <button
              onClick={() => { setResult(null); }}
              className="flex-1 py-2 bg-bg-card border border-border-default text-text-secondary rounded-lg text-sm font-medium active:scale-[0.98] transition-all"
            >
              继续导入
            </button>
          </div>
        </div>
      )}

      {/* 错误 */}
      {importError && (
        <div className="mt-4 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Icon name="x-circle" size={22} className="text-red-500 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">导入失败</div>
              {importError.reason && (
                <div className="text-sm text-text-secondary mt-1">原因：{importError.reason}</div>
              )}
              {importError.suggestions && importError.suggestions.length > 0 && (
                <div className="mt-2 text-sm text-text-secondary">
                  <div className="font-medium mb-1">建议：</div>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {importError.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {importError.showAiPrompt && (
                <button
                  onClick={handleCopyPrompt}
                  className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium active:scale-[0.98] transition-all ${
                    copied ? 'bg-emerald-500 text-white' : 'bg-accent text-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Icon name={copied ? 'check' : 'copy'} size={14} />
                    {copied ? '已复制到剪贴板' : '复制 AI 转换提示词'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 格式说明 */}
      <div className="mt-6 bg-bg-secondary rounded-xl p-4">
        <h3 className="font-medium text-text-secondary mb-3 flex items-center gap-1">
          <Icon name="file-text" size={16} /> JSON 格式示例
        </h3>
        <pre className="text-xs bg-bg-card text-text-secondary border border-border-subtle p-3 rounded-lg overflow-x-auto">{`[
  {
    "type": "single",
    "question": "下列哪项属于操作系统？",
    "options": {"A":"MySQL","B":"Windows","C":"HTML","D":"Python"},
    "answer": ["B"],
    "explanation": "Windows 是操作系统。"
  },
  {
    "type": "judge",
    "question": "CPU 是核心部件。",
    "answer": ["true"]
  }
]`}</pre>
      </div>
    </div>
  );
}
