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
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">导入题库</h1>
      <p className="text-sm text-gray-500 mb-6">支持 JSON、CSV、Excel、Word、TXT / Markdown</p>

      {/* 自定义名称 */}
      <div className="mb-4">
        <label className="text-sm text-gray-600 mb-1 block">题库名称（可选，留空则用文件名）</label>
        <input
          type="text"
          value={bankName}
          onChange={e => setBankName(e.target.value)}
          placeholder="例如：操作系统期末复习"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* 拖拽区域 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400'
        }`}
      >
        {loading ? (
          <div>
            <Icon name="refresh" size={40} className="text-blue-500 mb-3 animate-spin" />
            <div className="text-gray-600">正在导入...</div>
          </div>
        ) : (
          <div>
            <Icon name="folder" size={48} className="text-gray-400 mb-3" />
            <div className="font-medium text-gray-700 mb-1">点击或拖拽文件到这里</div>
            <div className="text-xs text-gray-400">JSON / CSV / Excel / Word / TXT / Markdown</div>
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
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Icon name="check-circle" size={22} className="text-green-600" />
            <div>
              <div className="font-medium text-green-800">导入成功！</div>
              <div className="text-sm text-green-600">「{result.name}」共 {result.count} 题</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium active:bg-green-700"
            >
              去刷题
            </button>
            <button
              onClick={() => { setResult(null); }}
              className="flex-1 py-2 bg-white border border-green-300 text-green-700 rounded-lg text-sm font-medium"
            >
              继续导入
            </button>
          </div>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Icon name="x-circle" size={22} className="text-red-600" />
            <div>
              <div className="font-medium text-red-800">导入失败</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* 格式说明 */}
      <div className="mt-6 bg-gray-50 rounded-xl p-4">
        <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-1">
          <Icon name="file-text" size={16} /> JSON 格式示例
        </h3>
        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-x-auto">{`[
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
