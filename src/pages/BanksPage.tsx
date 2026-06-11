import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { renameBank, deleteBankCascade } from '../repositories/bankRepo';
import type { QuestionBank, QuestionType, PracticeMode, PracticeRecord } from '../types';
import Icon from '../components/Icon';

const modes: { mode: PracticeMode; icon: string; label: string; desc: string }[] = [
  { mode: 'sequential', icon: 'list', label: '顺序练习', desc: '从上次离开的地方继续' },
  { mode: 'random', icon: 'shuffle', label: '随机练习', desc: '打乱未做题' },
  { mode: 'wrong', icon: 'x-circle', label: '只刷错题', desc: '复习做错的题' },
  { mode: 'favorite', icon: 'star', label: '收藏题目', desc: '只看收藏的题' },
  { mode: 'exam', icon: 'exam', label: '模拟考试', desc: '完成后显示成绩' },
];

type ToastState = { type: 'success' | 'error'; text: string } | null;

export default function BanksPage() {
  const banks = useLiveQuery(() => db.banks.orderBy('updatedAt').reverse().toArray());
  const records = useLiveQuery(() => db.records.toArray());
  const allQuestions = useLiveQuery(() => db.questions.toArray());
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showModeModal, setShowModeModal] = useState<string | null>(null);
  const bankTypeCounts = useMemo(() => {
    if (!allQuestions) return {} as Record<string, Record<string, number>>;
    const map: Record<string, Record<string, number>> = {};
    for (const q of allQuestions) {
      if (!map[q.bankId]) map[q.bankId] = {};
      map[q.bankId][q.type] = (map[q.bankId][q.type] || 0) + 1;
    }
    return map;
  }, [allQuestions]);
  const [renameTarget, setRenameTarget] = useState<QuestionBank | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const filteredBanks = useMemo(() => {
    if (!banks) return [];
    if (!search.trim()) return banks;
    const q = search.trim().toLowerCase();
    return banks.filter(b => b.name.toLowerCase().includes(q));
  }, [banks, search]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!banks) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-40 rounded-xl bg-bg-secondary animate-pulse" />
      </div>
    );
  }

  const startPractice = (bankId: string, mode: PracticeMode, typeFilter?: QuestionType) => {
    setShowModeModal(null);
    const qs = typeFilter ? `?type=${typeFilter}` : '';
    navigate(`/practice/${bankId}/${mode}${qs}`);
  };

  const openRename = (bank: QuestionBank) => {
    setRenameTarget(bank);
    setRenameValue(bank.name);
    setRenameError('');
  };

  const closeRename = () => {
    if (renameSaving) return;
    setRenameTarget(null);
    setRenameValue('');
    setRenameError('');
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameTarget) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      setRenameError('题库名称不能为空');
      return;
    }
    if (nextName === renameTarget.name) {
      closeRename();
      return;
    }

    setRenameSaving(true);
    setRenameError('');
    try {
      await renameBank(renameTarget.id, nextName);
      setToast({ type: 'success', text: '题库已重命名' });
      setRenameTarget(null);
      setRenameValue('');
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : '重命名失败，请重试');
      setToast({ type: 'error', text: '重命名失败' });
    } finally {
      setRenameSaving(false);
    }
  };

  return (
    <div className="px-5 pt-5">
      <Toast toast={toast} />

      {/* Header */}
      <header className="flex items-start justify-between gap-4 animate-reveal-up">
        <div className="min-w-0 pt-1">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-text-primary">
            题库
          </h1>
          <p className="mt-1 text-[13px] text-text-muted tracking-wide">
            {banks.length} 个题库 · 点击开始练习
          </p>
        </div>
        <button
          onClick={() => navigate('/import')}
          className="group shrink-0 flex items-center gap-1.5 rounded-full border border-copper/30 bg-copper-glow px-3.5 py-2 text-xs font-semibold text-copper transition-all hover:bg-copper hover:text-white active:scale-[0.97]"
        >
          <Icon name="import" size={14} className="text-copper group-hover:text-white transition-colors" />
          导入
        </button>
      </header>

      {/* Search */}
      {banks.length > 0 && (
        <div className="mt-5 animate-reveal-up reveal-delay-1">
          <div className="relative">
            <Icon name="list" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索题库..."
              className="w-full pl-10 pr-4 py-2.5 border border-border-default rounded-xl text-sm bg-bg-card text-text-primary placeholder:text-text-muted focus:border-copper focus:ring-4 focus:ring-copper/10 focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bank list or empty state */}
      {banks.length === 0 ? (
        <EmptyState onImport={() => navigate('/import')} />
      ) : filteredBanks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <Icon name="book" size={40} className="text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">没有找到「{search}」相关的题库</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredBanks.map((bank, index) => (
            <div
              key={bank.id}
              className={`animate-reveal-up reveal-delay-${Math.min(index + 2, 10)}`}
            >
              <BankCard
                bank={bank}
                records={records}
                typeCounts={bankTypeCounts[bank.id]}
                onStart={() => setShowModeModal(bank.id)}
                onRename={() => openRename(bank)}
                onDelete={async () => {
                  if (confirm(`确定删除「${bank.name}」？\n此操作不可撤销！`)) {
                    try {
                      await deleteBankCascade(bank.id);
                      setToast({ type: 'success', text: '题库已删除' });
                    } catch (err) {
                      console.error('删除题库失败:', err);
                      setToast({ type: 'error', text: '删除失败，请重试' });
                    }
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}

      {showModeModal && (
        <ModeSheet
          bankId={showModeModal}
          onClose={() => setShowModeModal(null)}
          onSelect={(mode, typeFilter) => startPractice(showModeModal, mode, typeFilter)}
        />
      )}

      {renameTarget && (
        <RenameDialog
          bankName={renameTarget.name}
          value={renameValue}
          error={renameError}
          saving={renameSaving}
          onChange={value => {
            setRenameValue(value);
            if (renameError) setRenameError('');
          }}
          onClose={closeRename}
          onSubmit={submitRename}
        />
      )}
    </div>
  );
}

/* ── Bank Card ── */
function BankCard({
  bank,
  records,
  typeCounts,
  onStart,
  onRename,
  onDelete,
}: {
  bank: QuestionBank;
  records?: PracticeRecord[];
  typeCounts?: Record<string, number>;
  onStart: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const stats = useMemo(() => {
    const bankRecords = records?.filter(record => (
      record.bankId === bank.id &&
      (record.status === 'correct' || record.status === 'wrong')
    )) ?? [];
    const correct = bankRecords.filter(record => record.status === 'correct').length;
    const wrong = bankRecords.filter(record => record.status === 'wrong').length;
    const uniqueAnswered = new Set(bankRecords.map(record => record.questionId)).size;
    const progress = bank.questionCount > 0 ? Math.round((uniqueAnswered / bank.questionCount) * 100) : 0;
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null;

    return { wrong, uniqueAnswered, progress, accuracy };
  }, [bank.id, bank.questionCount, records]);

  const updatedAt = new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(bank.updatedAt);

  return (
    <article
      onClick={onStart}
      className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-5 transition-all duration-300 hover:border-copper/25 hover:shadow-[0_8px_40px_-12px_var(--copper-glow)] active:scale-[0.985]"
    >
      {/* Decorative corner accent */}
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-copper-glow opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        {/* Top row: name + actions */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-text-primary line-clamp-2">
              {bank.name}
            </h3>
            {bank.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-text-muted line-clamp-2">
                {bank.description}
              </p>
            )}
          </div>
          <div
            className="flex shrink-0 gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onRename}
              className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-bg-secondary hover:text-copper active:scale-95"
              aria-label={`重命名 ${bank.name}`}
            >
              <Icon name="pencil" size={15} />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-red-500/10 hover:text-red-500 active:scale-95"
              aria-label={`删除 ${bank.name}`}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
          <span>{updatedAt}</span>
          <span className="text-border-default">·</span>
          <span>{bank.questionCount} 题</span>
          {typeCounts && Object.keys(typeCounts).length > 1 && (
            <>
              <span className="text-border-default">·</span>
              <span>
                {typeCounts.single ? `${typeCounts.single}单选` : ''}
                {typeCounts.multiple ? ` ${typeCounts.multiple}多选` : ''}
                {typeCounts.judge ? ` ${typeCounts.judge}判断` : ''}
                {typeCounts.blank ? ` ${typeCounts.blank}填空` : ''}
                {typeCounts.short ? ` ${typeCounts.short}简答` : ''}
              </span>
            </>
          )}
          {stats.uniqueAnswered > 0 && (
            <>
              <span className="text-border-default">·</span>
              <span>已练 {stats.uniqueAnswered}</span>
            </>
          )}
          {stats.accuracy !== null && (
            <>
              <span className="text-border-default">·</span>
              <span>
                正确率{' '}
                <span className={stats.accuracy >= 80 ? 'text-sage font-medium' : stats.accuracy >= 60 ? 'text-copper font-medium' : 'text-red-500 font-medium'}>
                  {stats.accuracy}%
                </span>
              </span>
            </>
          )}
          {stats.wrong > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/8 px-2 py-0.5 text-[10px] font-medium text-red-500">
              {stats.wrong} 错
            </span>
          )}
        </div>

        {/* Progress bar + action */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-copper to-copper-light transition-all duration-700 ease-out"
              style={{ width: `${Math.max(stats.progress, 2)}%` }}
            />
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              onStart();
            }}
            className="shrink-0 rounded-xl bg-copper px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-accent-hover hover:shadow-md active:scale-[0.97]"
          >
            练习
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Empty State ── */
function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="mt-24 flex flex-col items-center text-center animate-reveal-up reveal-delay-1">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-copper/20 bg-copper-glow text-copper">
          <Icon name="book" size={36} />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-card shadow-sm">
          <Icon name="import" size={14} className="text-copper" />
        </div>
      </div>
      <h2 className="font-display text-2xl font-semibold text-text-primary">还没有题库</h2>
      <p className="mt-2.5 max-w-[20rem] text-sm leading-relaxed text-text-secondary">
        导入题库文件，所有数据仅保存在本地设备
      </p>
      <button
        onClick={onImport}
        className="mt-7 rounded-2xl bg-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-copper/20 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-copper/25 active:scale-[0.97]"
      >
        导入题库
      </button>
    </div>
  );
}

/* ── Mode Sheet ── */
const TYPE_OPTIONS: { type: QuestionType | ''; icon: string; label: string }[] = [
  { type: '', icon: 'list', label: '全部题型' },
  { type: 'single', icon: 'check-circle', label: '单选题' },
  { type: 'multiple', icon: 'check-circle', label: '多选题' },
  { type: 'judge', icon: 'check', label: '判断题' },
  { type: 'blank', icon: 'file-text', label: '填空题' },
  { type: 'short', icon: 'file-text', label: '简答题' },
];

function ModeSheet({ bankId, onClose, onSelect }: {
  bankId: string;
  onClose: () => void;
  onSelect: (mode: PracticeMode, typeFilter?: QuestionType) => void;
}) {
  const [selectedType, setSelectedType] = useState<QuestionType | ''>('');
  const questions = useLiveQuery(() => db.questions.where('bankId').equals(bankId).toArray(), [bankId]);

  const typeCounts = useMemo(() => {
    if (!questions) return {} as Record<QuestionType, number>;
    const counts: Record<string, number> = {};
    for (const q of questions) {
      counts[q.type] = (counts[q.type] || 0) + 1;
    }
    return counts;
  }, [questions]);

  const filteredModes = selectedType
    ? modes.filter(m => {
        // wrong/favorite 模式始终可用（它们先按记录筛选再按 type 过滤）
        if (m.mode === 'wrong' || m.mode === 'favorite') return true;
        // 考试模式也支持
        return true;
      })
    : modes;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-t-3xl border-t border-border-subtle bg-bg-card p-6 pb-8 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border-default" />
        <h3 className="font-display text-xl font-semibold text-text-primary">选择练习</h3>

        {/* 题型选择 */}
        <div className="mt-4">
          <p className="text-xs font-medium text-text-muted mb-2">题型</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(opt => {
              const count = opt.type ? (typeCounts[opt.type] || 0) : (questions?.length ?? 0);
              if (opt.type && count === 0) return null;
              return (
                <button
                  key={opt.type || 'all'}
                  onClick={() => setSelectedType(opt.type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedType === opt.type
                      ? 'bg-accent text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-bg-card'
                  }`}
                >
                  {opt.label}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 模式选择 */}
        <div className="mt-5">
          <p className="text-xs font-medium text-text-muted mb-2">模式</p>
          <div className="space-y-1">
            {filteredModes.map((mode, i) => (
              <button
                key={mode.mode}
                onClick={() => onSelect(mode.mode, selectedType || undefined)}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all hover:bg-copper-glow active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-copper">
                  <Icon name={mode.icon} size={18} />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">{mode.label}</span>
                  <span className="block text-xs text-text-muted">{mode.desc}</span>
                </span>
                <Icon name="chevron-right" size={16} className="text-text-muted" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary"
        >
          取消
        </button>
      </div>
    </div>
  );
}

/* ── Rename Dialog ── */
function RenameDialog({
  bankName,
  value,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  bankName: string;
  value: string;
  error: string;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-5" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-border-subtle bg-bg-card p-6 shadow-[0_24px_70px_-40px_rgba(44,24,16,0.5)] animate-modal-in"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-semibold text-text-primary">重命名题库</h3>
            <p className="mt-1 truncate text-xs text-text-muted">{bankName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-secondary">
            <Icon name="x" size={18} />
          </button>
        </div>

        <label className="mt-5 block text-xs font-medium text-text-secondary" htmlFor="rename-bank-input">
          新名称
        </label>
        <input
          id="rename-bank-input"
          autoFocus
          value={value}
          onChange={event => onChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-copper focus:ring-4 focus:ring-copper/10"
          placeholder="输入题库名称"
          maxLength={80}
        />
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-border-subtle bg-bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition-all active:scale-[0.98] disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-copper px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Toast ── */
function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-slide-in-right ${
        toast.type === 'success' ? 'bg-copper' : 'bg-red-500'
      }`}
    >
      <Icon name={toast.type === 'success' ? 'check' : 'x'} size={14} />
      {toast.text}
    </div>
  );
}
