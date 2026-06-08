import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import QuestionCard from '../components/QuestionCard';
import Icon from '../components/Icon';
import { getCurrentWrongQuestionIds } from '../domain/wrongQuestion';
import { getRecordsByBankId } from '../repositories/recordRepo';
import { getQuestionsByIds } from '../repositories/questionRepo';

export default function WrongPage() {
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();

  const wrongQuestions = useLiveQuery(async () => {
    if (!bankId) return [];
    const records = await getRecordsByBankId(bankId);
    const wrongIds = getCurrentWrongQuestionIds(records);
    return wrongIds.length > 0 ? getQuestionsByIds(wrongIds) : [];
  }, [bankId]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Adjust index when wrongQuestions list shrinks (e.g. after answering correctly)
  useEffect(() => {
    if (wrongQuestions && wrongQuestions.length > 0) {
      setCurrentIndex(prev => Math.min(prev, wrongQuestions.length - 1));
    }
  }, [wrongQuestions?.length]);

  if (!wrongQuestions) {
    return <div className="flex items-center justify-center h-64 text-text-muted">加载中...</div>;
  }

  if (wrongQuestions.length === 0) {
    return (
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-accent text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Icon name="check-circle" size={56} className="text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">没有错题</h2>
          <p className="text-text-secondary text-sm mt-2">继续保持！</p>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, wrongQuestions.length - 1);
  const currentQuestion = wrongQuestions[safeIndex];

  if (!currentQuestion) {
    return <div className="flex items-center justify-center h-64 text-text-muted">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-dvh bg-bg-primary">
      <div className="bg-bg-card border-b border-border-subtle px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate(-1)} className="text-accent text-sm flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="text-sm font-medium text-text-secondary flex items-center gap-1">
          <Icon name="x-circle" size={16} className="text-red-500" /> 错题本
        </div>
        <div className="text-sm text-text-secondary">{wrongQuestions.length} 题</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {wrongQuestions.length > 0 && (
          <QuestionCard
            question={currentQuestion}
            bankId={bankId!}
            index={safeIndex}
            total={wrongQuestions.length}
            allowRedo
          />
        )}
      </div>

      <div className="bg-bg-card border-t border-border-subtle px-4 py-3 flex items-center gap-3 shrink-0 safe-area-bottom">
        <button
          onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
          disabled={safeIndex === 0}
          className="px-4 py-2.5 bg-bg-secondary text-text-secondary rounded-xl text-sm font-medium disabled:opacity-30 flex items-center gap-1"
        >
          <Icon name="arrow-left" size={14} /> 上一题
        </button>
        <div className="flex-1 text-center text-sm text-text-secondary">
          {safeIndex + 1} / {wrongQuestions.length}
        </div>
        <button
          onClick={() => setCurrentIndex(Math.min(wrongQuestions.length - 1, safeIndex + 1))}
          disabled={safeIndex >= wrongQuestions.length - 1}
          className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-30 flex items-center gap-1"
        >
          下一题 <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
