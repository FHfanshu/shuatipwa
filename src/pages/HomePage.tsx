import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { QuestionBank, PracticeRecord } from '../types';
import Icon from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';
import { loadLastPracticeSession, MODE_LABELS } from '../services/practiceSessionStore';

/* ── helpers ── */
function dayKey(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function computeDailyAccuracy(records: PracticeRecord[]): { label: string; value: number }[] {
  const now = Date.now();
  const days: { label: string; correct: number; wrong: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ label, correct: 0, wrong: 0 });
  }

  const labelMap = new Map(days.map(d => [d.label, d]));
  for (const r of records) {
    const key = dayKey(r.timestamp);
    const bucket = labelMap.get(key);
    if (!bucket) continue;
    if (r.status === 'correct') bucket.correct++;
    else if (r.status === 'wrong') bucket.wrong++;
  }

  return days.map(d => ({
    label: d.label,
    value: d.correct + d.wrong > 0 ? Math.round((d.correct / (d.correct + d.wrong)) * 100) : 0,
  }));
}

/* ═══════════════════════════════════════════ */
export default function HomePage() {
  const banks = useLiveQuery(() => db.banks.orderBy('updatedAt').reverse().toArray());
  const records = useLiveQuery(() => db.records.toArray());
  const navigate = useNavigate();

  const homeStats = useMemo(() => {
    const totalQuestions = banks?.reduce((sum, bank) => sum + bank.questionCount, 0) ?? 0;
    const correct = records?.filter(r => r.status === 'correct').length ?? 0;
    const wrong = records?.filter(r => r.status === 'wrong').length ?? 0;
    const answered = new Set(records?.map(r => `${r.bankId}:${r.questionId}`) ?? []).size;
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null;

    const timestamps = records?.map(r => r.timestamp).filter(Boolean) as number[] | undefined;
    const daysSinceStart = timestamps && timestamps.length > 0
      ? Math.max(1, Math.ceil((Date.now() - Math.min(...timestamps)) / 86400000))
      : 0;

    const dailyAccuracy = records ? computeDailyAccuracy(records) : [];

    return {
      totalQuestions,
      answered,
      accuracy,
      daysSinceStart,
      bankCount: banks?.length ?? 0,
      completionPct: totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0,
      dailyAccuracy,
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
    <div className="px-5 pt-5 pb-6">
      <HomeHeader />

      {banks.length === 0 ? (
        <EmptyState onBanks={() => navigate('/banks')} />
      ) : (
        <>
          {/* ── Hero ── */}
          <div className="mt-7 animate-reveal-up reveal-delay-1">
            <HeroSection stats={homeStats} />
          </div>

          {/* ── Continue CTA ── */}
          <ContinueCard banks={banks} navigate={navigate} />

          {/* ── Divider ── */}
          <div className="my-6 h-px bg-border-subtle" />

          {/* ── Recent banks ── */}
          <div className="animate-reveal-up reveal-delay-4">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary">题库</h2>
              <button
                onClick={() => navigate('/banks')}
                className="text-xs font-medium text-copper transition-colors hover:text-accent-hover"
              >
                查看全部
              </button>
            </div>
            <div className="space-y-2.5">
              {banks.slice(0, 4).map((bank, i) => (
                <BankRow key={bank.id} bank={bank} records={records} delay={i} onClick={() => navigate(`/practice/${bank.id}/sequential`)} />
              ))}
            </div>
          </div>

          {/* ── Motivation ── */}
          <p className="mt-10 text-center text-[11px] tracking-widest text-text-muted/60 animate-reveal-up reveal-delay-6">
            每日坚持，知识日积月累
          </p>
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
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-text-primary">刷题助手</h1>
        <p className="mt-1 text-[13px] text-text-muted tracking-wide">本地离线 · 题库管理与练习</p>
      </div>
      <ThemeToggle className="shrink-0 border border-border-subtle bg-surface-glass backdrop-blur-md rounded-xl" />
    </header>
  );
}

/* ── Hero Section ── */
function HeroSection({
  stats,
}: {
  stats: {
    totalQuestions: number;
    answered: number;
    accuracy: number | null;
    completionPct: number;
    dailyAccuracy: { label: string; value: number }[];
  };
}) {
  const hasData = stats.accuracy !== null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-card px-5 py-6">
      {/* Top: two big numbers */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-text-muted">总体进度</p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-[42px] font-bold leading-none text-text-primary tabular-nums">{stats.completionPct}</span>
            <span className="text-base font-medium text-text-muted">%</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {stats.answered}/{stats.totalQuestions} 题
          </p>
        </div>
        {hasData && (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-widest text-text-muted">正确率</p>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-[42px] font-bold leading-none text-copper tabular-nums">{stats.accuracy}</span>
              <span className="text-base font-medium text-copper/60">%</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {stats.answered > 0 ? `${stats.answered} 题已答` : '暂无数据'}
            </p>
          </div>
        )}
      </div>

      {/* Line chart */}
      {stats.dailyAccuracy.some(d => d.value > 0) && (
        <div className="mt-6">
          <p className="mb-3 text-[10px] font-medium tracking-wide text-text-muted">近 7 天正确率</p>
          <LineChart data={stats.dailyAccuracy} />
        </div>
      )}
    </section>
  );
}

/* ── Line Chart (SVG) ── */
function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const padL = 28;
  const padR = 8;
  const padT = 4;
  const padB = 22;
  const w = 300;
  const h = 100;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    y: padT + (1 - d.value / 100) * innerH,
    value: d.value,
    label: d.label,
  }));

  // Smooth path via cubic bezier
  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
    linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Gradient fill path
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`;

  const gridLines = [0, 50, 100];
  const gradId = 'lg-grad';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--copper)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--copper)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {gridLines.map(v => {
        const y = padT + (1 - v / 100) * innerH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="var(--border-default)" strokeWidth="0.5" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8">
              {v}
            </text>
          </g>
        );
      })}

      {/* Gradient fill under line */}
      <path d={fillPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path d={linePath} fill="none" stroke="var(--copper)" strokeWidth="2" strokeLinecap="round" />

      {/* Dots */}
      {pts.map((p, i) => {
        const isToday = i === pts.length - 1;
        return (
          <g key={i}>
            {isToday && (
              <circle cx={p.x} cy={p.y} r="6" fill="var(--copper)" opacity="0.15" />
            )}
            <circle
              cx={p.x} cy={p.y}
              r={isToday ? 4 : 2.5}
              fill={isToday ? 'var(--copper)' : 'var(--bg-card)'}
              stroke="var(--copper)"
              strokeWidth={isToday ? 2 : 1.5}
            />
            {/* Day label */}
            <text x={p.x} y={h - 4} textAnchor="middle" fill={isToday ? 'var(--copper)' : 'var(--text-muted)'} fontSize="8" fontWeight={isToday ? '600' : '400'}>
              {p.label.split('/')[1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Continue Card ── */
function ContinueCard({
  banks,
  navigate,
}: {
  banks: QuestionBank[];
  navigate: (path: string) => void;
}) {
  const info = useMemo(() => {
    const last = loadLastPracticeSession();
    if (!last) return null;
    const bank = banks.find(b => b.id === last.bankId);
    if (!bank) return null;
    return {
      bankName: bank.name,
      bankId: last.bankId,
      mode: last.mode,
      currentIndex: last.currentIndex,
      modeLabel: MODE_LABELS[last.mode],
    };
  }, [banks]);

  if (!info) return null;

  return (
    <div className="mt-3 animate-reveal-up reveal-delay-2">
      <button
        onClick={() => navigate(`/practice/${info.bankId}/${info.mode}?resume=1`)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-border-subtle bg-bg-card px-5 py-4 text-left transition-all duration-300 hover:border-border-default hover:shadow-[0_8px_32px_-12px_var(--copper-glow)] active:scale-[0.985]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-copper/20 bg-copper/10 text-copper transition-transform duration-300 group-hover:scale-105">
          <Icon name="play" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-copper tracking-wide">继续上次</p>
          <p className="mt-0.5 text-[15px] font-semibold text-text-primary leading-snug">
            {info.bankName} · {info.modeLabel} · 第 {info.currentIndex + 1} 题
          </p>
        </div>
        <Icon name="chevron-right" size={20} className="shrink-0 text-copper/60 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-copper" />
      </button>
    </div>
  );
}

/* ── Bank Row (compact) ── */
function BankRow({
  bank,
  records,
  delay,
  onClick,
}: {
  bank: QuestionBank;
  records?: PracticeRecord[];
  delay: number;
  onClick: () => void;
}) {
  const stats = useMemo(() => {
    const bankRecords = records?.filter(r => r.bankId === bank.id) ?? [];
    const uniqueAnswered = new Set(bankRecords.map(r => r.questionId)).size;
    const progress = bank.questionCount > 0 ? Math.round((uniqueAnswered / bank.questionCount) * 100) : 0;
    return { uniqueAnswered, progress };
  }, [bank.id, bank.questionCount, records]);

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3.5 rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-left transition-all duration-300 hover:border-border-default active:scale-[0.985] animate-reveal-up reveal-delay-${Math.min(delay + 5, 10)}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text-primary truncate">{bank.name}</p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          {stats.uniqueAnswered}/{bank.questionCount} 题
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary">
          <div
            className="h-full rounded-full bg-copper transition-all duration-700 ease-out"
            style={{ width: `${Math.max(stats.progress, 3)}%` }}
          />
        </div>
        <span className="w-9 text-right text-[11px] font-semibold text-text-muted">{stats.progress}%</span>
      </div>
    </button>
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
