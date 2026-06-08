import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

interface ModelSelectProps {
  models: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export default function ModelSelect({ models, value, onChange, loading }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 如果 value 不在列表里，自动进自定义模式
  useEffect(() => {
    if (models.length > 0 && !models.includes(value) && !customMode) {
      setCustomMode(true);
      setCustomInput(value);
    }
  }, [models, value, customMode]);

  const handleSelect = (model: string) => {
    onChange(model);
    setOpen(false);
    setCustomMode(false);
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setCustomInput(value); }}
        className="w-full flex items-center justify-between border border-border-default rounded-lg px-3 py-2 text-sm bg-bg-secondary text-text-primary focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
      >
        <span className={customMode ? 'text-text-secondary' : ''}>
          {customMode ? value || '自定义模型...' : value}
        </span>
        <Icon name="chevron-down" size={14} className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {loading && (
        <p className="text-[11px] text-text-muted mt-1">正在获取模型列表...</p>
      )}

      {/* 下拉面板 */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border-subtle bg-bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-52 overflow-y-auto overscroll-contain p-1">
            {models.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelect(m)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  m === value && !customMode
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-primary hover:bg-bg-secondary'
                }`}
              >
                <span className="flex-1 truncate">{m}</span>
                {m === value && !customMode && (
                  <Icon name="check" size={14} className="text-accent shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* 分割线 */}
          <div className="h-px bg-border-subtle mx-2" />

          {/* 自定义输入 */}
          <div className="p-2">
            {customMode ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
                  placeholder="输入模型名称..."
                  autoFocus
                  className="flex-1 border border-border-default rounded-lg px-2.5 py-1.5 text-sm bg-bg-secondary text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
                />
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  className="px-2.5 py-1.5 text-xs font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/15 active:scale-[0.97] transition-all"
                >
                  确定
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:bg-bg-secondary transition-colors"
              >
                <Icon name="pencil" size={13} />
                <span>自定义输入</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
