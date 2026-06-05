import { useState, useRef, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { importFromFile } from '../utils/import';
import Icon from '../components/Icon';

export default function ImportPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; count: number } | null>(null);
  const [error, setError] = useState('');
  const [bankName, setBankName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { bank, count } = await importFromFile(file, bankName || undefined);
      setResult({ name: bank.name, count });
      setBankName('');
    } catch (e: any) {
      setError(e.message || '导入失败');
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
              onClick={() => navigate('/')}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium active:bg-accent-hover active:scale-[0.98] transition-all"
            >
              去刷题
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
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Icon name="x-circle" size={22} className="text-red-500" />
            <div>
              <div className="font-medium text-text-primary">导入失败</div>
              <div className="text-sm text-red-500 mt-1">{error}</div>
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
