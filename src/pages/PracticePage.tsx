import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { Question, PracticeMode, AnswerStatus } from '../types';
import { shuffleArray } from '../utils/helper';
import QuestionCard from '../components/QuestionCard';
import Icon from '../components/Icon';

export default function PracticePage() {
  const { bankId, mode } = useParams<{ bankId: string; mode: PracticeMode }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, AnswerStatus>>({});
  const [examCount, setExamCount] = useState(50);
  const [examStarted, setExamStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bankId || !mode) return;

    const loadQuestions = async () => {
      setLoading(true);
      let qs: Question[] = [];

      if (mode === 'wrong') {
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
        qs = await db.questions.where('id').anyOf([...wrongIds]).toArray();
      } else if (mode === 'favorite') {
        const favs = await db.favorites.where('bankId').equals(bankId).toArray();
        const favIds = favs.map(f => f.questionId);
        qs = await db.questions.where('id').anyOf(favIds).toArray();
      } else {
        qs = await db.questions.where('bankId').equals(bankId).toArray();
      }

      if (mode === 'random' || mode === 'exam') {
        qs = shuffleArray(qs);
      }

      if (mode === 'exam' && !examStarted) {
        setQuestions(qs);
        setLoading(false);
        return;
      }

      if (mode === 'exam') {
        qs = qs.slice(0, examCount);
      }

      setQuestions(qs);
      setLoading(false);
      setCurrentIndex(0);
      setResults({});
    };

    loadQuestions();
  }, [bankId, mode, examStarted, examCount]);

  const handleAnswer = useCallback((index: number, status: AnswerStatus) => {
    setResults(prev => ({ ...prev, [index]: status }));
  }, []);

  const goNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(r => r === 'correct').length;
  const wrong = Object.values(results).filter(r => r === 'wrong').length;

  const modeLabel = mode === 'exam' ? '考试中' : mode === 'wrong' ? '错题本' : mode === 'favorite' ? '收藏' : '练习';
  const modeIcon = mode === 'exam' ? 'exam' : mode === 'wrong' ? 'x-circle' : mode === 'favorite' ? 'star' : 'book';

  // 考试模式选择题量
  if (mode === 'exam' && !examStarted) {
    const maxCount = questions.length;
    return (
      <div className="px-4 pt-4 pb-8">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Icon name="exam" size={28} className="text-blue-600" /> 模拟考试
        </h1>
        <p className="text-sm text-gray-500 mb-6">题库共 {maxCount} 题，选择考试题数</p>

        <div className="space-y-3">
          {[20, 50, 100].filter(n => n <= maxCount).concat(maxCount <= 100 ? [] : [maxCount]).map(n => (
            <button
              key={n}
              onClick={() => { setExamCount(n); setExamStarted(true); }}
              className="w-full py-4 bg-white border-2 border-gray-200 rounded-xl text-left px-5 hover:border-blue-400 active:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-900">{n} 题</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {n === maxCount ? '全部题目' : `随机抽取 ${n} 题`}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-sm text-orange-800 flex items-start gap-2">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <span>考试模式下，答完所有题后才会显示成绩。答错的题会自动加入错题本。</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Icon
            name={mode === 'wrong' ? 'check-circle' : mode === 'favorite' ? 'star-empty' : 'file-text'}
            size={56}
            className={mode === 'wrong' ? 'text-green-500 mb-4' : 'text-gray-400 mb-4'}
          />
          <div className="text-lg font-medium text-gray-700">
            {mode === 'wrong' ? '没有错题，太棒了！' : mode === 'favorite' ? '还没有收藏题目' : '题库为空'}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {mode === 'wrong' ? '继续保持！' : '先去练习一些题目吧'}
          </p>
        </div>
      </div>
    );
  }

  // 考试结束页
  const isExamFinished = mode === 'exam' && answered >= questions.length;
  if (isExamFinished) {
    const accuracy = Math.round((correct / questions.length) * 100);
    return (
      <div className="px-4 pt-4 pb-8">
        <div className="flex flex-col items-center justify-center h-[70vh]">
          <Icon
            name="trophy"
            size={64}
            className={accuracy >= 90 ? 'text-yellow-500 mb-4' : accuracy >= 60 ? 'text-blue-500 mb-4' : 'text-gray-400 mb-4'}
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">考试结束！</h2>
          <div className="text-5xl font-bold text-blue-600 my-4">{accuracy}分</div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-xs mt-4">
            <div className="text-center bg-gray-50 rounded-xl p-3">
              <div className="text-xl font-bold text-gray-800">{questions.length}</div>
              <div className="text-xs text-gray-500">总题数</div>
            </div>
            <div className="text-center bg-green-50 rounded-xl p-3">
              <div className="text-xl font-bold text-green-600">{correct}</div>
              <div className="text-xs text-green-500">正确</div>
            </div>
            <div className="text-center bg-red-50 rounded-xl p-3">
              <div className="text-xl font-bold text-red-600">{wrong}</div>
              <div className="text-xs text-red-500">错误</div>
            </div>
          </div>

          <div className="flex gap-3 mt-8 w-full max-w-xs">
            <button
              onClick={() => navigate(`/wrong/${bankId}`)}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium active:bg-orange-600"
            >
              查看错题
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium active:bg-gray-200"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <Icon name={modeIcon} size={16} /> {modeLabel}
        </div>
        <div className="text-sm text-gray-500">
          {answered}/{questions.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* 题目卡片 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <QuestionCard
          question={currentQuestion}
          bankId={bankId!}
          index={currentIndex}
          total={questions.length}
          onAnswer={status => handleAnswer(currentIndex, status)}
          showAnswerImmediately={mode !== 'exam'}
        />
      </div>

      {/* 底部导航 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 sticky bottom-0">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-30 active:bg-gray-200 flex items-center gap-1"
        >
          <Icon name="arrow-left" size={14} /> 上一题
        </button>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1 overflow-x-auto px-2 py-1">
            {questions.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((_, i) => {
              const idx = Math.max(0, currentIndex - 3) + i;
              const isCurrent = idx === currentIndex;
              const result = results[idx];
              let bg = 'bg-gray-200 text-gray-600';
              if (isCurrent) bg = 'bg-blue-600 text-white';
              else if (result === 'correct') bg = 'bg-green-500 text-white';
              else if (result === 'wrong') bg = 'bg-red-500 text-white';

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center ${bg}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex >= questions.length - 1}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-30 active:bg-blue-700 flex items-center gap-1"
        >
          下一题 <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}
