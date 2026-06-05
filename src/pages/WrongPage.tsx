import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import Icon from '../components/Icon';

export default function WrongPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();

  const wrongQuestions = useLiveQuery(async () => {
    if (!bankId) return [];
    const records = await db.records.where('bankId').equals(bankId).reverse().sortBy('timestamp');
    const wrongIds = new Set<string>();
    const answeredCorrectly = new Set<string>();
    for (const r of records) {
      if (r.status === 'wrong' && !answeredCorrectly.has(r.questionId)) {
        wrongIds.add(r.questionId);
      }
      if (r.status === 'correct') {
        answeredCorrectly.add(r.questionId);
        wrongIds.delete(r.questionId);
      }
    }
    return db.questions.where('id').anyOf([...wrongIds]).toArray();
  }, [bankId]);

  const [currentIndex, setCurrentIndex] = useState(0);

  if (!wrongQuestions) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>;
  }

  if (wrongQuestions.length === 0) {
    return (
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Icon name="check-circle" size={56} className="text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">没有错题</h2>
          <p className="text-gray-500 text-sm mt-2">继续保持！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <Icon name="x-circle" size={16} className="text-red-500" /> 错题本
        </div>
        <div className="text-sm text-gray-500">{wrongQuestions.length} 题</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {wrongQuestions.length > 0 && (
          <QuestionCard
            question={wrongQuestions[currentIndex]}
            bankId={bankId!}
            index={currentIndex}
            total={wrongQuestions.length}
          />
        )}
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 safe-area-bottom">
        <button
          onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-30 flex items-center gap-1"
        >
          <Icon name="arrow-left" size={14} /> 上一题
        </button>
        <div className="flex-1 text-center text-sm text-gray-500">
          {currentIndex + 1} / {wrongQuestions.length}
        </div>
        <button
          onClick={() => setCurrentIndex(p => Math.min(wrongQuestions.length - 1, p + 1))}
          disabled={currentIndex >= wrongQuestions.length - 1}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-30 flex items-center gap-1"
        >
          下一题 <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
