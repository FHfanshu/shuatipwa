import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PracticeStats } from '../services/practiceService';

import Icon from './Icon';

interface CompletionScreenProps {
  mode: 'exam' | 'random';
  stats: PracticeStats;
  questionsLength: number;
  bankId: string;
}

function getAccuracyMessage(accuracy: number): string {
  if (accuracy === 100) return '完美通关';
  if (accuracy >= 90) return '非常出色';
  if (accuracy >= 70) return '表现不错';
  if (accuracy >= 50) return '继续加油';
  return '还需努力';
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 90) return 'text-emerald-500';
  if (accuracy >= 70) return 'text-accent';
  if (accuracy >= 50) return 'text-amber-500';
  return 'text-red-400';
}

const RING_RADIUS = 68;
const RING_STROKE = 4;
const RING_VIEWBOX = 160;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function CompletionScreen({ mode, stats, questionsLength, bankId }: CompletionScreenProps) {
  const navigate = useNavigate();
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setAnimatedPercent(stats.accuracy);
    });
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [stats.accuracy]);

  const dashOffset = RING_CIRCUMFERENCE - (animatedPercent / 100) * RING_CIRCUMFERENCE;
  const isExam = mode === 'exam';

  return (
    <div className="flex flex-col h-dvh bg-bg-primary overflow-hidden animate-[slide-in-right_0.35s_var(--ease-out-expo)]">
      {/* 顶部栏 */}
      <div className="bg-bg-card border-b border-border-subtle px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate(-1)} className="text-accent text-sm flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="text-sm font-medium text-text-secondary">
          {isExam ? '考试结果' : '练习结果'}
        </div>
        <div className="w-16" />
      </div>

      {/* 内容 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* 环形正确率 */}
        <div
          className="relative w-44 h-44 mb-8 rounded-full"
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'scale(1)' : 'scale(0.85)',
            transition: 'all 0.6s var(--ease-out-expo)',
          }}
        >
          <svg
            className="w-full h-full -rotate-90"
            viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
          >
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--border-default)"
              strokeWidth={RING_STROKE}
              opacity={0.5}
            />
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-[1400ms] ease-[var(--ease-out-expo)]"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end">
              <span className="text-[42px] font-bold tracking-tighter text-text-primary font-sans leading-none">
                {animatedPercent}
              </span>
              <span className="text-sm font-medium text-text-muted mb-1.5 ml-1">%</span>
            </div>
          </div>
        </div>

        {/* 评语 */}
        <p
          className={`text-xl font-semibold ${getAccuracyColor(stats.accuracy)}`}
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.5s var(--ease-out-expo) 0.15s',
          }}
        >
          {getAccuracyMessage(stats.accuracy)}
        </p>

        {/* 三项数据 — 带分隔线 */}
        <div
          className="flex items-center gap-0 mt-10 w-full max-w-[280px]"
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(14px)',
            transition: 'all 0.5s var(--ease-out-expo) 0.3s',
          }}
        >
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold font-sans text-text-primary leading-none">
              {questionsLength}
            </div>
            <div className="text-[11px] text-text-muted mt-1.5 tracking-wide">总题</div>
          </div>
          <div className="w-px h-10 bg-border-default" />
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold font-sans text-emerald-500 leading-none">
              {stats.correct}
            </div>
            <div className="text-[11px] text-text-muted mt-1.5 tracking-wide">正确</div>
          </div>
          <div className="w-px h-10 bg-border-default" />
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold font-sans text-red-400 leading-none">
              {stats.wrong}
            </div>
            <div className="text-[11px] text-text-muted mt-1.5 tracking-wide">错误</div>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="px-6 pb-8 pt-4 flex flex-col gap-3 shrink-0">
        {isExam ? (
          <>
            <button
              onClick={() => navigate(`/wrong/${bankId}`)}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-medium text-sm active:bg-accent-hover active:scale-[0.98] transition-all"
            >
              查看错题
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 bg-bg-secondary text-text-secondary rounded-xl font-medium text-sm active:opacity-80 transition-opacity"
            >
              返回首页
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-medium text-sm active:bg-accent-hover active:scale-[0.98] transition-all"
            >
              继续练习
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 bg-bg-secondary text-text-secondary rounded-xl font-medium text-sm active:opacity-80 transition-opacity"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </div>
  );
}
