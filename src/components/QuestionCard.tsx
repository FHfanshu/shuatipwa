import { useState, useEffect, useRef } from 'react';
import type { Question, AnswerStatus } from '../types';
import { checkAnswer, getQuestionTypeLabel, getQuestionTypeColor } from '../utils/helper';
import { getAIConfig, streamExplanation } from '../utils/ai';
import { db } from '../db';
import Icon from './Icon';
import ReactMarkdown from 'react-markdown';

interface Props {
  question: Question;
  bankId: string;
  index: number;
  total: number;
  onAnswer?: (status: AnswerStatus) => void;
  onAutoAdvance?: () => void;
  onStateChange?: (state: {
    userAnswer: string[];
    blankInput: string;
    submitted: boolean;
    status: AnswerStatus;
    recordId?: number | null;
  }) => void;
  savedState?: {
    userAnswer: string[];
    blankInput: string;
    submitted: boolean;
    status: AnswerStatus;
    recordId?: number | null;
  };
  showAnswerImmediately?: boolean;
}

export default function QuestionCard({ question, bankId, index, total, onAnswer, onAutoAdvance, onStateChange, savedState, showAnswerImmediately = true }: Props) {
  const [userAnswer, setUserAnswer] = useState<string[]>([]);
  const [blankInput, setBlankInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<AnswerStatus>('unanswered');
  const [isFavorite, setIsFavorite] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [aiCacheId, setAiCacheId] = useState<number | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const recordIdRef = useRef<number | null>(null);
  const submittedAnswerRef = useRef<string[]>([]);

  const isSelfGrade = question.type === 'blank' || question.type === 'short';

  useEffect(() => {
    // Restore saved state if available
    if (savedState) {
      isRestoringRef.current = true;
      setUserAnswer(savedState.userAnswer);
      setBlankInput(savedState.blankInput);
      setSubmitted(savedState.submitted);
      setStatus(savedState.status);
      setRecordId(savedState.recordId ?? null);
      recordIdRef.current = savedState.recordId ?? null;
      submittedAnswerRef.current = savedState.blankInput.trim()
        ? [savedState.blankInput.trim()]
        : savedState.userAnswer;
    } else {
      isRestoringRef.current = false;
      setUserAnswer([]);
      setBlankInput('');
      setSubmitted(false);
      setStatus('unanswered');
      setRecordId(null);
      recordIdRef.current = null;
      submittedAnswerRef.current = [];
    }
    setAiExplanation('');
    setAiLoading(false);
    setAiError('');
    setShowExplanation(false);
    setAiCacheId(null);
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    abortRef.current?.abort();
  }, [question.id]);

  // Auto-advance on correct answer (skip if restoring from saved state)
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (submitted && status === 'correct' && showAnswerImmediately && onAutoAdvance) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        onAutoAdvance();
      }, 450);
      return () => {
        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      };
    }
  }, [submitted, status, showAnswerImmediately, onAutoAdvance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange && (submitted || userAnswer.length > 0 || blankInput)) {
      onStateChange({ userAnswer, blankInput, submitted, status, recordId });
    }
  }, [userAnswer, blankInput, submitted, status, recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    db.favorites.where('[bankId+questionId]').equals([bankId, question.id]).first().then(f => {
      setIsFavorite(!!f);
    });
  }, [bankId, question.id]);

  async function saveRecord(nextStatus: AnswerStatus, answer: string[], timestamp: number) {
    if (recordIdRef.current !== null) {
      await db.records.update(recordIdRef.current, {
        userAnswer: answer,
        status: nextStatus,
        timestamp,
      });
      return;
    }

    const nextRecordId = await db.records.add({
      bankId,
      questionId: question.id,
      userAnswer: answer,
      status: nextStatus,
      timestamp,
    });
    if (typeof nextRecordId === 'number') {
      recordIdRef.current = nextRecordId;
      setRecordId(nextRecordId);
    }
  }

  const toggleOption = (opt: string) => {
    if (submitted) return;

    if (question.type === 'single' || question.type === 'judge') {
      setUserAnswer([opt]);
    } else {
      setUserAnswer(prev =>
        prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
      );
    }
  };

  const handleSubmit = () => {
    if (submitted) return;
    let answer = userAnswer;
    if (question.type === 'blank' || question.type === 'short') {
      answer = blankInput.trim() ? [blankInput.trim()] : [];
    }
    if (answer.length === 0) return;

    const result = checkAnswer(question, answer);
    submittedAnswerRef.current = answer;
    setSubmitted(true);

    if (isSelfGrade && showAnswerImmediately) {
      setStatus('unanswered');
      return;
    }

    setStatus(result);
    void saveRecord(result, answer, new Date().getTime());
    onAnswer?.(result);

  };

  const handleSelfGrade = (nextStatus: AnswerStatus) => {
    if (!submitted) return;
    const answer = submittedAnswerRef.current.length > 0
      ? submittedAnswerRef.current
      : blankInput.trim()
        ? [blankInput.trim()]
        : userAnswer;
    setStatus(nextStatus);
    void saveRecord(nextStatus, answer, new Date().getTime());
    onAnswer?.(nextStatus);

  };

  const toggleFavorite = async () => {
    const existing = await db.favorites.where('[bankId+questionId]').equals([bankId, question.id]).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
      setIsFavorite(false);
    } else {
      await db.favorites.add({ bankId, questionId: question.id, timestamp: Date.now() });
      setIsFavorite(true);
    }
  };

  const handleAIExplanation = async (forceRefresh = false) => {
    // Try loading from cache first
    if (!forceRefresh) {
      const cached = await db.aiExplanations.where('questionId').equals(question.id).first();
      if (cached) {
        setAiExplanation(cached.explanation);
        setAiCacheId(cached.id ?? null);
        setShowExplanation(true);
        return;
      }
    }

    const config = getAIConfig();
    if (!config) {
      setAiError('请先在设置中配置 AI 接口');
      return;
    }
    setShowExplanation(true);
    setAiLoading(true);
    setAiError('');
    setAiExplanation('');
    setAiCacheId(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const typeLabel = { single: '单选', multiple: '多选', judge: '判断', blank: '填空', short: '简答' }[question.type];
      const optionsText = question.options
        ? Object.entries(question.options).map(([k, v]) => `${k}. ${v}`).join('\n')
        : '';
      const correctText = question.options
        ? question.answer.map(a => `${a}. ${question.options![a]}`).join(', ')
        : question.answer.join(', ');
      const userText = userAnswer.length > 0
        ? (question.options ? userAnswer.map(a => `${a}. ${question.options![a]}`).join(', ') : userAnswer.join(', '))
        : '(未作答)';

      let fullText = '';
      for await (const chunk of streamExplanation(typeLabel, question.question, optionsText, correctText, userText, config, controller.signal)) {
        fullText += chunk;
        setAiExplanation(fullText);
      }
      // Cache the result
      if (fullText) {
        // Delete old cache if exists
        if (aiCacheId) await db.aiExplanations.delete(aiCacheId);
        const newId = await db.aiExplanations.add({
          questionId: question.id,
          explanation: fullText,
          createdAt: Date.now(),
        });
        setAiCacheId(newId ?? null);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setAiError(err instanceof Error ? err.message : 'AI 解析生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-2xl border border-border-subtle p-5">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted font-mono">{index + 1}/{total}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getQuestionTypeColor(question.type)}`}>
            {getQuestionTypeLabel(question.type)}
          </span>
          {question.tags?.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
        <button onClick={toggleFavorite} className="active:scale-90 transition-transform text-accent">
          <Icon name={isFavorite ? 'star' : 'star-empty'} size={24} />
        </button>
      </div>

      {/* 题干 */}
      <div className="text-base font-medium text-text-primary mb-4 leading-relaxed whitespace-pre-wrap">
        {question.question}
      </div>

      {/* 选项 */}
      {question.options && (question.type === 'single' || question.type === 'multiple') && (
        <div className="space-y-2 mb-4">
          {Object.entries(question.options).map(([key, value]) => {
            const selected = userAnswer.includes(key);
            const isCorrect = question.answer.includes(key);
            let optionClass = 'border-border-default bg-bg-card hover:border-accent/40';

            if (submitted && showAnswerImmediately) {
              if (isCorrect) {
                optionClass = 'border-emerald-500/70 bg-emerald-500/10 text-text-primary';
              } else if (selected && !isCorrect) {
                optionClass = 'border-red-500/70 bg-red-500/10 text-text-primary';
              } else {
                optionClass = 'border-border-default bg-bg-secondary opacity-60';
              }
            } else if (submitted && !showAnswerImmediately) {
              optionClass = selected ? 'border-accent bg-accent/10 text-accent' : 'border-border-default bg-bg-card opacity-60';
            } else if (selected) {
              optionClass = 'border-accent bg-accent/10 text-accent ring-2 ring-accent/20';
            }

            return (
              <button
                key={key}
                onClick={() => toggleOption(key)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 ${optionClass}`}
              >
                <span className="font-bold text-sm mt-0.5 shrink-0">{key}</span>
                <span className="text-sm leading-relaxed">{value}</span>
                {submitted && showAnswerImmediately && isCorrect && <Icon name="check" size={16} className="ml-auto text-emerald-500" />}
                {submitted && showAnswerImmediately && selected && !isCorrect && <Icon name="x" size={16} className="ml-auto text-red-500" />}
              </button>
            );
          })}
        </div>
      )}

      {/* 判断题选项 */}
      {question.type === 'judge' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{ key: 'true', label: '正确' }, { key: 'false', label: '错误' }].map(({ key, label }) => {
            const selected = userAnswer.includes(key);
            const isCorrect = question.answer.includes(key);
            let cls = 'border-border-default bg-bg-card text-text-primary';
            if (submitted && showAnswerImmediately) {
              if (isCorrect) cls = 'border-emerald-500/70 bg-emerald-500/10 text-text-primary';
              else if (selected) cls = 'border-red-500/70 bg-red-500/10 text-text-primary';
              else cls = 'border-border-default bg-bg-secondary opacity-60';
            } else if (submitted && !showAnswerImmediately) {
              cls = selected ? 'border-accent bg-accent/10 ring-2 ring-accent/20' : 'border-border-default bg-bg-card opacity-60';
            } else if (selected) {
              cls = 'border-accent bg-accent/10 ring-2 ring-accent/20';
            }
            return (
              <button
                key={key}
                onClick={() => toggleOption(key)}
                disabled={submitted}
                className={`py-4 rounded-xl border-2 text-base font-medium transition-all flex items-center justify-center gap-2 ${cls}`}
              >
                <Icon name={key === 'true' ? 'check' : 'x'} size={18} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 填空/简答输入 */}
      {(question.type === 'blank' || question.type === 'short') && (
        <div className="mb-4">
          <textarea
            value={blankInput}
            onChange={e => setBlankInput(e.target.value)}
            disabled={submitted}
            placeholder={question.type === 'blank' ? '请输入答案...' : '请输入你的回答...'}
            className="w-full border border-border-default rounded-xl px-4 py-3 text-sm focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none resize-none disabled:bg-bg-secondary bg-bg-card text-text-primary placeholder:text-text-muted transition-all"
            rows={question.type === 'short' ? 4 : 2}
          />
        </div>
      )}

      {/* 提交按钮 */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={
            (question.type !== 'blank' && question.type !== 'short' && userAnswer.length === 0) ||
            ((question.type === 'blank' || question.type === 'short') && !blankInput.trim())
          }
          className="w-full py-3 bg-accent text-white font-medium rounded-xl active:bg-accent-hover disabled:opacity-40 disabled:active:bg-accent transition-colors"
        >
          提交答案
        </button>
      )}

      {/* 结果 & 解析 */}
      {submitted && showAnswerImmediately && (
        <div className="mt-4 space-y-3">
          {isSelfGrade && (
            <div className="bg-accent/10 border border-accent/25 rounded-xl p-4">
              <div className="text-sm font-medium text-text-primary mb-2">参考答案：</div>
              <div className="text-sm text-text-secondary whitespace-pre-wrap">{question.answer.join(' / ')}</div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleSelfGrade('correct')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-1 ${status === 'correct' ? 'bg-emerald-500 text-white' : 'bg-bg-card border border-emerald-500/35 text-emerald-500'}`}
                >
                  <Icon name="check" size={14} /> 我答对了
                </button>
                <button
                  onClick={() => handleSelfGrade('wrong')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-1 ${status === 'wrong' ? 'bg-red-500 text-white' : 'bg-bg-card border border-red-500/35 text-red-500'}`}
                >
                  <Icon name="x" size={14} /> 我答错了
                </button>
              </div>
            </div>
          )}

          {!isSelfGrade && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${status === 'correct' ? 'bg-emerald-500/15 text-emerald-500 animate-[fadeOut_0.4s_ease-in_0.05s_forwards]' : 'bg-red-500/10 text-red-500'}`}>
              <Icon name={status === 'correct' ? 'check-circle' : 'x-circle'} size={20} />
              <span className="font-medium">{status === 'correct' ? '正确' : '回答错误'}</span>
              {status === 'wrong' && (
                <span className="ml-auto text-sm">正确答案: {question.answer.join(', ')}</span>
              )}
            </div>
          )}

          {submitted && (
            <button
              onClick={() => {
                if (question.explanation) {
                  setShowExplanation(true);
                } else {
                  handleAIExplanation();
                }
              }}
              className="w-full py-3 bg-accent/10 text-accent border border-accent/25 rounded-xl text-sm font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Icon name="lightbulb" size={16} />
              {question.explanation ? '查看解析' : aiExplanation ? '查看 AI 解析' : '生成 AI 解析'}
            </button>
          )}
        </div>
      )}
      {submitted && !showAnswerImmediately && (
        <div className="mt-4 bg-bg-secondary border border-border-subtle rounded-xl p-3 text-center text-sm text-text-secondary">
          答案已提交
        </div>
      )}

      {/* 解析悬浮窗 */}
      {showExplanation && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowExplanation(false)}>
          <div className="absolute inset-0 bg-slate-950/55" />
          <div
            className="relative bg-bg-card rounded-t-2xl w-full max-w-3xl max-h-[70vh] flex flex-col animate-slide-up border-t border-border-subtle"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Icon name="lightbulb" size={18} className="text-accent" />
                解析
              </h3>
              <button onClick={() => setShowExplanation(false)} className="p-1 active:bg-bg-secondary rounded-lg">
                <Icon name="x" size={20} className="text-text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="text-sm text-text-primary leading-relaxed prose prose-sm max-w-none">
                <ReactMarkdown>{question.explanation || ''}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 解析悬浮窗 */}
      {(aiExplanation || aiLoading || aiError) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { setAiExplanation(''); setAiError(''); }}>
          <div className="absolute inset-0 bg-slate-950/55" />
          <div
            className="relative bg-bg-card rounded-t-2xl w-full max-w-3xl max-h-[70vh] flex flex-col animate-slide-up border-t border-border-subtle"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Icon name="lightbulb" size={18} className="text-accent" />
                AI 解析
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => handleAIExplanation(true)} className="p-1.5 active:bg-bg-secondary rounded-lg" title="重新生成">
                  <Icon name="refresh-cw" size={16} className="text-text-muted" />
                </button>
                <button onClick={() => { setAiExplanation(''); setAiError(''); }} className="p-1.5 active:bg-bg-secondary rounded-lg">
                  <Icon name="x" size={20} className="text-text-muted" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {aiLoading && !aiExplanation ? (
                <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
                  <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">正在生成解析...</span>
                </div>
              ) : aiError ? (
                <div className="text-sm text-red-500 py-4 text-center">{aiError}</div>
              ) : (
                <div className="text-sm text-text-primary leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown>{aiExplanation}</ReactMarkdown>
                  {aiLoading && <span className="inline-block w-1.5 h-4 bg-accent/60 ml-0.5 animate-pulse rounded-sm" />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
