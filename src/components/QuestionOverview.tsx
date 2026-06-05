import { useState } from 'react';
import type { Question, AnswerStatus, QuestionType } from '../types';
import Icon from './Icon';

interface Props {
  questions: Question[];
  results: Record<number, AnswerStatus>;
  currentIndex: number;
  onJump: (index: number) => void;
  onClose: () => void;
}

type FilterTab = 'all' | 'choice' | 'judge' | 'other';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'choice', label: '选择题' },
  { key: 'judge', label: '判断题' },
  { key: 'other', label: '填空/简答' },
];

function matchFilter(type: QuestionType, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'choice') return type === 'single' || type === 'multiple';
  if (filter === 'judge') return type === 'judge';
  return type === 'blank' || type === 'short';
}

export default function QuestionOverview({ questions, results, currentIndex, onJump, onClose }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => matchFilter(q.type, filter));

  const correctCount = filtered.filter(({ i }) => results[i] === 'correct').length;
  const wrongCount = filtered.filter(({ i }) => results[i] === 'wrong').length;
  const totalFiltered = filtered.length;
  const progressPct = totalFiltered > 0 ? Math.round(((correctCount + wrongCount) / totalFiltered) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={onClose}>
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-slate-950/40" />

      {/* 浮动面板 */}
      <div
        className="relative w-[82%] max-w-md h-[85vh] my-auto mr-2 bg-bg-card rounded-2xl shadow-[0_28px_80px_-32px_rgba(2,8,23,0.65)] border border-border-subtle flex flex-col overflow-hidden animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="px-4 pt-3 pb-2 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-text-primary text-base">题目总览</div>
            <button onClick={onClose} className="p-1.5 text-text-muted active:bg-bg-secondary rounded-lg">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="text-xs text-text-secondary">
            {totalFiltered} 题 · 正确 {correctCount} · 错误 {wrongCount} · 完成 {progressPct}%
          </div>

          {/* 进度条 */}
          <div className="h-1.5 bg-bg-secondary rounded-full mt-2 overflow-hidden">
            <div className="flex h-full">
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${totalFiltered > 0 ? (correctCount / totalFiltered) * 100 : 0}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${totalFiltered > 0 ? (wrongCount / totalFiltered) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="px-3 py-2 flex gap-1.5 shrink-0 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary active:opacity-80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 题号网格 */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          <div className="grid grid-cols-7 gap-1.5">
            {filtered.map(({ i }) => {
              const result = results[i];
              const isCurrent = i === currentIndex;

              let bg = 'bg-bg-secondary text-text-secondary';
              if (isCurrent) bg = 'bg-accent text-white ring-2 ring-accent/30';
              else if (result === 'correct') bg = 'bg-emerald-500 text-white';
              else if (result === 'wrong') bg = 'bg-red-500 text-white';

              return (
                <button
                  key={i}
                  onClick={() => { onJump(i); onClose(); }}
                  className={`aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition-all active:scale-95 ${bg}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Icon name="file-text" size={32} className="mb-2" />
              <div className="text-sm">该类型暂无题目</div>
            </div>
          )}
        </div>

        {/* 图例 */}
        <div className="px-3 py-2 border-t border-border-subtle flex items-center justify-center gap-4 text-xs text-text-secondary shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-accent inline-block" /> 当前
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> 正确
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" /> 错误
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-bg-secondary border border-border-default inline-block" /> 未答
          </span>
        </div>
      </div>
    </div>
  );
}
