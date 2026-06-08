import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { PracticeMode, QuestionType, AnswerStatus } from '../types';
import type { QuestionState } from '../services/practiceService';
import {
  loadPracticeSession,
  loadQuestions,
  loadSavedProgress,
  saveProgress,
  computeStats,
  restoreFromRecords,
} from '../services/practiceService';
import { saveLastPracticeSession, loadLastPracticeSession } from '../services/practiceSessionStore';
import { getQuestionsByIds } from '../repositories/questionRepo';
import QuestionCard from '../components/QuestionCard';
import QuestionOverview from '../components/QuestionOverview';
import Icon from '../components/Icon';
import type { Question } from '../types';

export default function PracticePage() {
  const { bankId, mode } = useParams<{ bankId: string; mode: PracticeMode }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resume = searchParams.get('resume') === '1';
  const typeFilter = (searchParams.get('type') as QuestionType | null) ?? undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, AnswerStatus>>({});
  const [examCount, setExamCount] = useState(50);
  const [examStarted, setExamStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [restored, setRestored] = useState(false);
  const [questionStates, setQuestionStates] = useState<Map<number, QuestionState>>(new Map());
  const lastSavedRef = useRef<string>('');

  // 加载题目 + 恢复进度
  useEffect(() => {
    if (!bankId || !mode) return;

    const load = async () => {
      setLoading(true);

      if (mode === 'exam' && !examStarted) {
        const qs = await loadQuestions(bankId, mode, { typeFilter });
        setQuestions(qs);
        setLoading(false);
        return;
      }

      // resume=1：恢复上次会话的题目顺序
      if (resume) {
        const last = await loadLastPracticeSession();
        if (last && last.bankId === bankId && last.mode === mode && last.questionIds.length > 0) {
          const qs = await getQuestionsByIds(last.questionIds);
          // getQuestionsByIds 不保证顺序，按保存的 questionIds 重排
          const idToQ = new Map(qs.map(q => [q.id, q]));
          const ordered = last.questionIds.map(id => idToQ.get(id)).filter(Boolean) as Question[];
          if (ordered.length > 0) {
            // 用 ordered 直接恢复记录，确保下标准确映射
            const restored = await restoreFromRecords(bankId, mode, ordered);
            setQuestions(ordered);
            setResults(restored.results);
            setQuestionStates(restored.questionStates);
            setCurrentIndex(Math.min(last.currentIndex, ordered.length - 1));
          } else {
            const session = await loadPracticeSession(bankId, mode, { shuffle: false, typeFilter });
            setQuestions(session.questions);
            setResults(session.results);
            setQuestionStates(session.questionStates);
            setCurrentIndex(session.startIndex);
          }
          setRestored(true);
          setLoading(false);
          lastSavedRef.current = '';
          return;
        }
      }

      const session = await loadPracticeSession(bankId, mode, {
        examCount: mode === 'exam' ? examCount : undefined,
        typeFilter,
      });

      setQuestions(session.questions);
      setResults(session.results);
      setQuestionStates(session.questionStates);
      setCurrentIndex(session.startIndex);
      setRestored(true);
      setLoading(false);
      lastSavedRef.current = '';

      // 顺序模式兜底：尝试从 localStorage 恢复（IndexedDB 优先，但 localStorage 可能更近）
      if (mode === 'sequential' && Object.keys(session.results).length === 0) {
        const saved = loadSavedProgress(bankId, mode);
        if (saved && saved.currentIndex < session.questions.length) {
          setCurrentIndex(saved.currentIndex);
          setResults(saved.results);
        }
      }
    };

    load();
  }, [bankId, mode, examStarted, examCount, resume, typeFilter]);

  // 保存 last practice session（非考试模式）
  useEffect(() => {
    if (!bankId || !mode || mode === 'exam' || questions.length === 0 || !restored) return;
    void saveLastPracticeSession({
      bankId,
      mode,
      currentIndex,
      questionIds: questions.map(q => q.id),
      updatedAt: Date.now(),
    });
  }, [bankId, mode, currentIndex, questions, restored]);

  // 保存进度到 localStorage（顺序模式）
  useEffect(() => {
    if (mode === 'sequential' && questions.length > 0 && bankId && restored) {
      const stateString = JSON.stringify({ currentIndex, results });
      if (stateString !== lastSavedRef.current) {
        saveProgress(bankId, mode, currentIndex, results);
        lastSavedRef.current = stateString;
      }
    }
  }, [currentIndex, results, mode, bankId, questions.length, restored]);

  const handleAnswer = useCallback((index: number, status: AnswerStatus) => {
    setResults(prev => ({ ...prev, [index]: status }));
  }, []);

  const handleSaveQuestionState = useCallback((index: number, state: QuestionState) => {
    setQuestionStates(prev => {
      const next = new Map(prev);
      next.set(index, state);
      return next;
    });
  }, []);

  const handleAutoAdvance = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
  }, [questions.length]);

  const goNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const stats = computeStats(results, questions.length);
  const TYPE_LABELS: Record<string, string> = { single: '单选', multiple: '多选', judge: '判断', blank: '填空', short: '简答' };
  const typeLabel = typeFilter ? TYPE_LABELS[typeFilter] : '';
  const modeLabel = mode === 'exam' ? '考试中' : mode === 'wrong' ? '错题本' : mode === 'favorite' ? '收藏' : '练习';
  const modeIcon = mode === 'exam' ? 'exam' : mode === 'wrong' ? 'x-circle' : mode === 'favorite' ? 'star' : 'book';

  // 考试模式：选择题量
  if (mode === 'exam' && !examStarted) {
    const maxCount = questions.length;
    const examOptions = Array.from(new Set(
      [20, 50, 100].filter(n => n < maxCount).concat(maxCount > 0 ? [maxCount] : [])
    ));
    return (
      <div className="px-4 pt-4 pb-8">
        <button onClick={() => navigate(-1)} className="text-accent text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <h1 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
          <Icon name="exam" size={28} className="text-accent" /> 模拟考试
        </h1>
        <p className="text-sm text-text-secondary mb-6">题库共 {maxCount} 题，选择考试题数</p>

        <div className="space-y-3">
          {examOptions.length === 0 && (
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-sm text-text-secondary">
              题库为空，无法开始考试。
            </div>
          )}
          {examOptions.map(n => (
            <button
              key={n}
              onClick={() => { setExamCount(n); setExamStarted(true); }}
              className="w-full py-4 bg-bg-card border-2 border-border-default rounded-xl text-left px-5 hover:border-accent active:bg-accent/10 transition-colors"
            >
              <div className="font-medium text-text-primary">{n} 题</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {n === maxCount ? '全部题目' : `随机抽取 ${n} 题`}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-accent/10 border border-accent/25 rounded-xl p-4">
          <div className="text-sm text-text-secondary flex items-start gap-2">
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
        <div className="text-text-muted">加载中...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-accent text-sm mb-4 flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Icon
            name={mode === 'wrong' ? 'check-circle' : mode === 'favorite' ? 'star-empty' : 'file-text'}
            size={56}
            className={mode === 'wrong' ? 'text-emerald-500 mb-4' : 'text-text-muted mb-4'}
          />
          <div className="text-lg font-medium text-text-secondary">
            {mode === 'wrong' ? '没有错题，太棒了！' : mode === 'favorite' ? '还没有收藏题目' : '题库为空'}
          </div>
          <p className="text-sm text-text-secondary mt-2">
            {mode === 'wrong' ? '继续保持！' : '先去练习一些题目吧'}
          </p>
        </div>
      </div>
    );
  }

  // 考试结束页
  if (mode === 'exam' && stats.isFinished) {
    return (
      <div className="px-4 pt-4 pb-8">
        <div className="flex flex-col items-center justify-center h-[70vh]">
          <Icon
            name="trophy"
            size={64}
            className={stats.accuracy >= 90 ? 'text-accent mb-4' : stats.accuracy >= 60 ? 'text-accent mb-4' : 'text-text-muted mb-4'}
          />
          <h2 className="text-2xl font-bold text-text-primary mb-2">考试结束！</h2>
          <div className="text-5xl font-bold text-accent my-4">{stats.accuracy}分</div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-xs mt-4">
            <div className="text-center bg-bg-secondary rounded-xl p-3">
              <div className="text-xl font-bold text-text-primary">{questions.length}</div>
              <div className="text-xs text-text-secondary">总题数</div>
            </div>
            <div className="text-center bg-emerald-500/10 rounded-xl p-3">
              <div className="text-xl font-bold text-emerald-500">{stats.correct}</div>
              <div className="text-xs text-emerald-500">正确</div>
            </div>
            <div className="text-center bg-red-500/10 rounded-xl p-3">
              <div className="text-xl font-bold text-red-500">{stats.wrong}</div>
              <div className="text-xs text-red-500">错误</div>
            </div>
          </div>

          <div className="flex gap-3 mt-8 w-full max-w-xs">
            <button
              onClick={() => navigate(`/wrong/${bankId}`)}
              className="flex-1 py-3 bg-accent text-white rounded-xl font-medium active:bg-accent-hover active:scale-[0.98] transition-all"
            >
              查看错题
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 bg-bg-secondary text-text-secondary rounded-xl font-medium active:opacity-80"
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
    <div className="flex flex-col h-dvh bg-bg-primary">
      {/* 顶部栏 */}
      <div className="bg-bg-card border-b border-border-subtle px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => navigate(-1)} className="text-accent text-sm flex items-center gap-1">
          <Icon name="arrow-left" size={16} /> 返回
        </button>
        <div className="text-sm font-medium text-text-secondary flex items-center gap-1">
          <Icon name={modeIcon} size={16} /> {modeLabel}{typeLabel ? ` · ${typeLabel}` : ''}
        </div>
        <div className="text-sm text-text-secondary">
          {stats.answered}/{questions.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1 bg-border-default shrink-0">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* 题目卡片 */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 min-h-0">
        <QuestionCard
          question={currentQuestion}
          bankId={bankId!}
          index={currentIndex}
          total={questions.length}
          onAnswer={status => handleAnswer(currentIndex, status)}
          onAutoAdvance={handleAutoAdvance}
          onStateChange={state => handleSaveQuestionState(currentIndex, state)}
          savedState={questionStates.get(currentIndex)}
          showAnswerImmediately={mode !== 'exam'}
          allowRedo={mode === 'wrong'}
        />
      </div>

      {/* 底部导航 */}
      <div className="bg-bg-card border-t border-border-subtle px-4 pt-3 pb-5 flex items-center gap-3 shrink-0 safe-area-bottom">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2.5 bg-bg-secondary text-text-secondary rounded-xl text-sm font-medium disabled:opacity-30 active:opacity-80 flex items-center gap-1"
        >
          <Icon name="arrow-left" size={14} /> 上一题
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-2">
          <div className="text-sm font-medium text-text-secondary mb-1">
            {currentIndex + 1} / {questions.length}
          </div>
          <div className="w-full h-1 bg-border-default rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex >= questions.length - 1}
          className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-30 active:bg-accent-hover flex items-center gap-1"
        >
          下一题 <Icon name="arrow-right" size={14} />
        </button>
      </div>

      {/* 悬浮总览按钮 */}
      <button
        onClick={() => setShowOverview(true)}
        className="fixed right-4 bottom-24 z-40 w-12 h-12 bg-accent text-white rounded-full shadow-[0_18px_36px_-18px_rgba(31,111,235,0.9)] active:bg-accent-hover flex items-center justify-center transition-transform active:scale-95"
      >
        <Icon name="list" size={22} />
      </button>

      {/* 题目总览面板 */}
      {showOverview && (
        <QuestionOverview
          questions={questions}
          results={results}
          currentIndex={currentIndex}
          onJump={setCurrentIndex}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
}
