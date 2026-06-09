import { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icon';

interface ModelSelectProps {
  models: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export default function ModelSelect({ models, value, onChange, loading }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 过滤列表
  const filtered = useMemo(() => {
    if (!open) return models;
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(m => m.toLowerCase().includes(q));
  }, [models, query, open]);

  const handleSelect = (model: string) => {
    onChange(model);
    setQuery('');
    setIsTyping(false);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length === 1 && filtered[0] !== value) {
        handleSelect(filtered[0]);
      } else {
        const trimmed = (isTyping ? query : value).trim();
        if (trimmed) {
          onChange(trimmed);
          setQuery('');
          setIsTyping(false);
          setOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setIsTyping(false);
      inputRef.current?.blur();
    }
  };

  const displayValue = isTyping ? query : value;

  return (
    <div ref={ref} className="relative">
      {/* 输入框 */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={e => {
            const next = e.target.value;
            setQuery(next);
            setIsTyping(true);
            onChange(next);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setIsTyping(false);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? '获取模型中...' : '输入或选择模型...'}
          disabled={loading}
          className="w-full border border-border-default rounded-lg px-3 py-2 pr-8 text-sm bg-bg-secondary text-text-primary placeholder:text-text-muted focus:bg-bg-card focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all disabled:opacity-50"
        />
        <Icon
          name="chevron-down"
          size={14}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted transition-transform duration-200 pointer-events-none ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {loading && (
        <p className="text-[11px] text-text-muted mt-1">正在获取模型列表...</p>
      )}

      {/* 下拉面板 */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border-subtle bg-bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-52 overflow-y-auto overscroll-contain p-1">
            {filtered.map(m => (
              <button
                key={m}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(m); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  m === value
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-primary hover:bg-bg-secondary'
                }`}
              >
                <span className="flex-1 truncate">{m}</span>
                {m === value && (
                  <Icon name="check" size={14} className="text-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
