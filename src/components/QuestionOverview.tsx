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

  // 构建带原始索引的过滤列表
  const filtered = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => matchFilter(q.type, filter));

  const correctCount = filtered.filter(({ i }) => results[i] === 'correct').length;
  const wrongCount = filtered.filter(({ i }) => results[i] === 'wrong').length;
  const totalFiltered = filtered.length;
  const progressPct = totalFiltered > 0 ? Math.round(((correctCount + wrongCount) / totalFiltered) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      {/* 顶栏 */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div>
          <div className="font-bold text-gray-900">题目总览</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {totalFiltered} 题 · 正确 {correctCount} · 错误 {wrongCount} · 完成 {progressPct}%
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-500 active:bg-gray-100 rounded-lg">
          <Icon name="x" size={22} />
        </button>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 bg-gray-100 shrink-0">
        <div className="flex h-full">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${totalFiltered > 0 ? (correctCount / totalFiltered) * 100 : 0}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${totalFiltered > 0 ? (wrongCount / totalFiltered) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 筛选标签 */}
      <div className="px-4 py-2 flex gap-2 shrink-0 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 题号网格 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        <div className="grid grid-cols-8 gap-2">
          {filtered.map(({ q, i }) => {
            const result = results[i];
            const isCurrent = i === currentIndex;

            let bg = 'bg-gray-100 text-gray-600';
            if (isCurrent) bg = 'bg-blue-600 text-white ring-2 ring-blue-300';
            else if (result === 'correct') bg = 'bg-green-500 text-white';
            else if (result === 'wrong') bg = 'bg-red-500 text-white';

            return (
              <button
                key={i}
                onClick={() => { onJump(i); onClose(); }}
                className={`aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-all active:scale-95 ${bg}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Icon name="file-text" size={40} className="mb-3" />
            <div>该类型暂无题目</div>
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-center gap-5 text-xs text-gray-500 shrink-0 safe-area-bottom">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> 当前
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" /> 正确
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" /> 错误
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> 未答
        </span>
      </div>
    </div>
  );
}
