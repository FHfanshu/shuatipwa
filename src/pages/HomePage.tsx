import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { QuestionBank, PracticeRecord } from '../types';
import Icon from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';

export default function HomePage() {
  const banks = useLiveQuery(() => db.banks.orderBy('updatedAt').reverse().toArray());
  const records = useLiveQuery(() => db.records.toArray());
  const navigate = useNavigate();

  const homeStats = useMemo(() => {
    const totalQuestions = banks?.reduce((sum, bank) => sum + bank.questionCount, 0) ?? 0;
    const correct = records?.filter(record => record.status === 'correct').length ?? 0;
    const wrong = records?.filter(record => record.status === 'wrong').length ?? 0;
    const answered = new Set(records?.map(record => record.questionId) ?? []).size;
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null;

    const timestamps = records?.map(r => r.timestamp).filter(Boolean) as number[] | undefined;
    const daysSinceStart = timestamps && timestamps.length > 0
      ? Math.max(1, Math.ceil((Date.now() - Math.min(...timestamps)) / 86400000))
      : 0;

    return {
      totalQuestions,
      answered,
      accuracy,
      daysSinceStart,
      bankCount: banks?.length ?? 0,
      completionPct: totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0,
    };
  }, [banks, records]);

  if (!banks) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-40 rounded-xl bg-bg-secondary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-5">
      <HomeHeader />

      {banks.length === 0 ? (
        <EmptyState onBanks={() => navigate('/banks')} />
      ) : (
        <>
          {/* Hero progress ring */}
          <div className="animate-reveal-up reveal-delay-1">
            <ProgressHero stats={homeStats} />
          </div>

          {/* Continue last session */}
          <ContinueCard banks={banks} records={records} navigate={navigate} />

          {/* Quick stat pills */}
          <div className="mt-5 flex gap-2.5 animate-reveal-up reveal-delay-2">
            <StatPill icon="database" label="题库" value={homeStats.bankCount} />
            <StatPill icon="file-text" label="题目" value={homeStats.totalQuestions} />
            <StatPill
              icon="check-circle"
              label="正确率"
              value={homeStats.accuracy === null ? '--' : `${homeStats.accuracy}%`}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Header ── */
function HomeHeader() {
  return (
    <header className="flex items-start justify-between gap-4 animate-reveal-up">
      <div className="min-w-0 pt-1">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-text-primary">
          刷题助手
        </h1>
        <p className="mt-1 text-[13px] text-text-muted tracking-wide">
          本地离线 · 题库管理与练习
        </p>
      </div>
      <ThemeToggle className="shrink-0 border border-border-subtle bg-surface-glass backdrop-blur-md rounded-xl" />
    </header>
  );
}

/* ── Progress Hero Ring ── */
function ProgressHero({
  stats,
}: {
  stats: { totalQuestions: number; answered: number; accuracy: number | null; completionPct: number; daysSinceStart: number };
}) {
  const radius = 54;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (stats.completionPct / 100) * circumference;

  return (
    <section className="mt-7 flex items-center gap-7">
      {/* Ring */}
      <div className="relative shrink-0" style={{ width: 136, height: 136 }}>
        {/* Glow */}
        <div
          className="ring-glow absolute inset-2 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--copper-glow) 0%, transparent 70%)' }}
        />
        <svg width={136} height={136} viewBox="0 0 136 136">
          {/* Track */}
          <circle
            cx={68}
            cy={68}
            r={radius}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth={stroke}
          />
          {/* Fill */}
          <circle
            cx={68}
            cy={68}
            r={radius}
            fill="none"
            stroke="var(--copper)"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="progress-ring-circle"
            style={{
              strokeDasharray: circumference,
              '--ring-circumference': circumference,
              '--ring-offset': offset,
            } as React.CSSProperties}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="relative">
            <span className="text-3xl font-semibold text-text-primary">{stats.completionPct}</span>
            <span className="absolute text-[10px] font-medium text-text-muted" style={{ right: -11, bottom: '25%' }}>%</span>
          </span>
        </div>
      </div>

      {/* Summary text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-text-secondary">
          {stats.totalQuestions === 0
            ? '导入题库后即可开始练习'
            : stats.completionPct === 0
              ? `共 ${stats.totalQuestions} 题等待练习`
              : stats.completionPct < 100
                ? `已完成 ${stats.answered} / ${stats.totalQuestions} 题，继续加油！`
                : '所有题目已完成，太厉害了！'}
        </p>
        {stats.accuracy !== null && stats.daysSinceStart > 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sage" />
            <span className="text-xs text-text-muted">
              最近 {stats.daysSinceStart} 天正确率 <span className="font-semibold text-copper">{stats.accuracy}%</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Stat Pill ── */
function StatPill({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-border-subtle bg-bg-card px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-copper-glow text-copper">
        <Icon name={icon} size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-none text-text-primary">{value}</div>
        <div className="mt-0.5 text-[11px] text-text-muted">{label}</div>
      </div>
    </div>
  );
}

/* ── Continue Card ── */
function ContinueCard({
  banks,
  records,
  navigate,
}: {
  banks: QuestionBank[];
  records?: PracticeRecord[];
  navigate: (path: string) => void;
}) {
  const info = useMemo(() => {
    if (!records || records.length === 0) return null;

    // 找最近一次做题记录
    const latest = records.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    const bank = banks.find(b => b.id === latest.bankId);
    if (!bank) return null;

    // 尝试从 localStorage 恢复进度（顺序模式）
    let questionIndex: number | null = null;
    try {
      const saved = localStorage.getItem(`practice-progress-${bank.id}-sequential`);
      if (saved) {
        const parsed = JSON.parse(saved) as { currentIndex: number };
        if (typeof parsed.currentIndex === 'number') {
          questionIndex = parsed.currentIndex;
        }
      }
    } catch { /* ignore */ }

    // 如果没有 localStorage 记录，根据 records 推算顺序模式的起始位置
    if (questionIndex === null) {
      const bankRecords = records.filter(r => r.bankId === bank.id);
      const answeredIds = new Set(bankRecords.map(r => r.questionId));
      // 顺序模式起始题号 = 已答数量（0-based）
      questionIndex = Math.min(answeredIds.size, bank.questionCount - 1);
    }

    return {
      bankName: bank.name,
      bankId: bank.id,
      questionIndex,
      questionCount: bank.questionCount,
    };
  }, [banks, records]);

  if (!info) return null;

  return (
    <div className="mt-5 animate-reveal-up reveal-delay-1">
      <button
        onClick={() => navigate(`/practice/${info.bankId}/sequential`)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-border-subtle bg-bg-card px-5 py-4 text-left transition-all duration-300 hover:border-border-default hover:shadow-[0_8px_32px_-12px_var(--copper-glow)] active:scale-[0.985]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-copper/20 bg-copper/10 text-copper transition-transform duration-300 group-hover:scale-105">
          <Icon name="play" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-copper tracking-wide">继续上次</p>
          <p className="mt-0.5 text-[15px] font-semibold text-text-primary leading-snug">
            {info.bankName} · 第 {info.questionIndex + 1} 题
          </p>
        </div>
        <Icon name="chevron-right" size={20} className="shrink-0 text-copper/60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-copper" />
      </button>
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ onBanks }: { onBanks: () => void }) {
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
      <h2 className="font-display text-2xl font-semibold text-text-primary">开始刷题之旅</h2>
      <p className="mt-2.5 max-w-[20rem] text-sm leading-relaxed text-text-secondary">
        导入题库文件，所有数据仅保存在本地设备，无需联网即可使用
      </p>
      <button
        onClick={onBanks}
        className="mt-7 rounded-2xl bg-copper px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-copper/20 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-copper/25 active:scale-[0.97]"
      >
        去导入题库
      </button>
    </div>
  );
}
