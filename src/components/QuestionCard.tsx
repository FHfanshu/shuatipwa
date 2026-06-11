import { useState, useEffect, useRef, useMemo } from 'react';
import type { Question, AnswerStatus } from '../types';
import { checkAnswer } from '../utils/helper';
import { loadCachedExplanation, generateExplanation, generateGuidance, type GuidanceChatMessage } from '../services/aiService';
import { upsertRecord } from '../repositories/recordRepo';
import { isFavorited, toggleFavorite as toggleFavoriteRepo } from '../repositories/favoriteRepo';
import Icon from './Icon';
import ReactMarkdown from 'react-markdown';

interface Props {
  question: Question;
  bankId: string;
  index: number;
  total: number;
  counterText?: string;
  onAnswer?: (status: AnswerStatus) => void;
  onAutoAdvance?: () => void;
  onStateChange?: (state: {
    userAnswer: string[];
    blankInput: string;
    submitted: boolean;
    status: AnswerStatus;
    recordId?: number | null;
  }) => void;
  onStateReset?: () => void;
  savedState?: {
    userAnswer: string[];
    blankInput: string;
    submitted: boolean;
    status: AnswerStatus;
    recordId?: number | null;
  };
  showAnswerImmediately?: boolean;
  allowRedo?: boolean;
  onOverlayOpenChange?: (open: boolean) => void;
}

export default function QuestionCard({ question, bankId, index, total, counterText, onAnswer, onAutoAdvance, onStateChange, onStateReset, savedState, showAnswerImmediately = true, allowRedo, onOverlayOpenChange }: Props) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [aiCacheId, setAiCacheId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [guidanceHint, setGuidanceHint] = useState('');
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceError, setGuidanceError] = useState('');
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const guidanceAbortRef = useRef<AbortController | null>(null);
  const recordIdRef = useRef<number | null>(null);
  const submittedAnswerRef = useRef<string[]>([]);

  const isSelfGrade = question.type === 'blank' || question.type === 'short';

  const init = useMemo(() => {
    if (savedState) {
      return {
        userAnswer: savedState.userAnswer,
        blankInput: savedState.blankInput,
        submitted: savedState.submitted,
        status: savedState.status,
        recordId: savedState.recordId ?? null,
      };
    }
    return { userAnswer: [] as string[], blankInput: '', submitted: false, status: 'unanswered' as const, recordId: null };
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [userAnswer, setUserAnswer] = useState(init.userAnswer);
  const [blankInput, setBlankInput] = useState(init.blankInput);
  const [submitted, setSubmitted] = useState(init.submitted);
  const [status, setStatus] = useState(init.status);
  const [recordId, setRecordId] = useState(init.recordId);
  const explanationOverlayOpen = (showExplanation && Boolean(question.explanation)) || Boolean(aiExplanation || aiLoading || aiError);

  const optionEntries = useMemo(() => (
    question.options ? Object.entries(question.options).filter(([, value]) => String(value).trim()) : []
  ), [question.options]);
  const hasAnswer = question.answer.length > 0;
  const hasValidOptions = question.type !== 'single' && question.type !== 'multiple' ? true : optionEntries.length > 0;
  const isQuestionReady = hasAnswer && hasValidOptions;
  const typeMeta = {
    single: {
      label: '单选题',
      badge: 'border-sky-500/25 bg-sky-500/8 text-sky-500',
      dot: 'bg-sky-500',
    },
    multiple: {
      label: '多选题',
      badge: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
      dot: 'bg-amber-500',
    },
    judge: {
      label: '判断题',
      badge: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-500',
      dot: 'bg-emerald-500',
    },
    blank: {
      label: '填空题',
      badge: 'border-violet-500/25 bg-violet-500/8 text-violet-500',
      dot: 'bg-violet-500',
    },
    short: {
      label: '简答题',
      badge: 'border-rose-500/25 bg-rose-500/8 text-rose-500',
      dot: 'bg-rose-500',
    },
  }[question.type];

  useEffect(() => {
    submittedAnswerRef.current = init.blankInput.trim()
      ? [init.blankInput.trim()]
      : init.userAnswer;
    recordIdRef.current = init.recordId;
  }, [init]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange && (submitted || userAnswer.length > 0 || blankInput)) {
      onStateChange({ userAnswer, blankInput, submitted, status, recordId });
    }
  }, [userAnswer, blankInput, submitted, status, recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let canceled = false;
    isFavorited(bankId, question.id)
      .then(value => {
        if (!canceled) setIsFavorite(value);
      })
      .catch(error => {
        console.error('读取收藏状态失败:', error);
        if (!canceled) setFavoriteError('收藏状态读取失败');
      });
    return () => { canceled = true; };
  }, [bankId, question.id]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      abortRef.current?.abort();
      guidanceAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    onOverlayOpenChange?.(explanationOverlayOpen);
  }, [explanationOverlayOpen, onOverlayOpenChange]);

  useEffect(() => {
    return () => onOverlayOpenChange?.(false);
  }, [onOverlayOpenChange]);

  function scheduleAutoAdvance(nextStatus: AnswerStatus) {
    if (nextStatus !== 'correct' || !showAnswerImmediately || !onAutoAdvance) return;
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      onAutoAdvance();
    }, 650);
  }

  async function saveRecord(nextStatus: AnswerStatus, answer: string[], timestamp: number): Promise<boolean> {
    setSavingRecord(true);
    setSaveError('');
    try {
      const nextId = await upsertRecord(
        { bankId, questionId: question.id, userAnswer: answer, status: nextStatus, timestamp },
        recordIdRef.current
      );
      recordIdRef.current = nextId;
      setRecordId(nextId);
      return true;
    } catch (error) {
      console.error('保存做题记录失败:', error);
      setSaveError('记录保存失败，请检查浏览器存储权限后重试');
      return false;
    } finally {
      setSavingRecord(false);
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
    if (submitted || !isQuestionReady) return;
    let answer = userAnswer;
    if (question.type === 'blank' || question.type === 'short') {
      answer = blankInput.trim() ? [blankInput.trim()] : [];
    }
    if (answer.length === 0) return;

    const result = checkAnswer(question, answer);
    submittedAnswerRef.current = answer;
    closeGuidance();
    setSubmitted(true);

    if (isSelfGrade && showAnswerImmediately) {
      setStatus('unanswered');
      return;
    }

    setStatus(result);
    void saveRecord(result, answer, new Date().getTime()).then(saved => {
      if (!saved) return;
      onAnswer?.(result);
      scheduleAutoAdvance(result);
    });

  };

  const handleSelfGrade = (nextStatus: AnswerStatus) => {
    if (!submitted || savingRecord) return;
    const answer = submittedAnswerRef.current.length > 0
      ? submittedAnswerRef.current
      : blankInput.trim()
        ? [blankInput.trim()]
        : userAnswer;
    setStatus(nextStatus);
    void saveRecord(nextStatus, answer, new Date().getTime()).then(saved => {
      if (!saved) return;
      onAnswer?.(nextStatus);
      scheduleAutoAdvance(nextStatus);
    });

  };

  const handleRedo = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setUserAnswer([]);
    setBlankInput('');
    setSubmitted(false);
    setStatus('unanswered');
    setRecordId(null);
    recordIdRef.current = null;
    submittedAnswerRef.current = [];
    setSaveError('');
    setSavingRecord(false);
    closeGuidance();
    closeExplanation();
    onStateReset?.();
  };

  const toggleFavorite = async () => {
    if (favoriteSaving) return;
    const previous = isFavorite;
    setFavoriteSaving(true);
    setFavoriteError('');
    setIsFavorite(!previous);
    try {
      const nowFav = await toggleFavoriteRepo(bankId, question.id);
      setIsFavorite(nowFav);
    } catch (error) {
      console.error('切换收藏失败:', error);
      setIsFavorite(previous);
      setFavoriteError('收藏失败，请重试');
    } finally {
      setFavoriteSaving(false);
    }
  };

  const closeExplanation = () => {
    setShowExplanation(false);
    setAiExplanation('');
    setAiLoading(false);
    setAiError('');
    abortRef.current?.abort();
  };

  const closeGuidance = () => {
    setGuidanceLoading(false);
    guidanceAbortRef.current?.abort();
  };

  const openGuidance = () => {
    void generateGuidanceHint();
  };

  const generateGuidanceHint = async () => {
    if (guidanceLoading) return;

    setGuidanceError('');
    setGuidanceLoading(true);
    guidanceAbortRef.current?.abort();
    const controller = new AbortController();
    guidanceAbortRef.current = controller;
    const previousHint = guidanceHint.trim();
    const timeoutMessage = 'AI 提示响应超时，请稍后重试';
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45000);

    try {
      const historyForRequest: GuidanceChatMessage[] = previousHint
        ? [
            { role: 'user', content: '给我一个很短的 hint。' },
            { role: 'assistant', content: previousHint },
            { role: 'user', content: '再给我一个很短的新提示，不要重复上一条。' },
          ]
        : [
            { role: 'user', content: '给我一个很短的 hint。' },
          ];
      let nextHint = '';
      const finalText = await generateGuidance(
        question,
        historyForRequest,
        textChunk => {
          nextHint = textChunk.trim();
        },
        controller.signal,
      );
      nextHint = finalText.trim() || nextHint;
      if (!nextHint) {
        throw new Error('AI 没有返回提示内容，请稍后重试');
      }
      setGuidanceHint(nextHint);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!timedOut) return;
      }
      const message = timedOut
        ? timeoutMessage
        : err instanceof Error
          ? err.message
          : 'AI 提示生成失败';
      setGuidanceError(message);
    } finally {
      window.clearTimeout(timeout);
      if (guidanceAbortRef.current === controller) {
        guidanceAbortRef.current = null;
      }
      setGuidanceLoading(false);
    }
  };

  const handleAIExplanation = async (forceRefresh = false) => {
    if (question.explanation && !forceRefresh) {
      setShowExplanation(true);
      return;
    }
    if (!forceRefresh) {
      const cached = await loadCachedExplanation(question.id);
      if (cached) {
        setAiExplanation(cached.explanation);
        setAiCacheId(cached.id ?? null);
        setShowExplanation(true);
        return;
      }
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
      const newId = await generateExplanation(
        question,
        userAnswer,
        (text) => setAiExplanation(text),
        aiCacheId,
        controller.signal,
      );
      if (newId) setAiCacheId(newId);
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
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-bg-secondary px-2.5 py-1.5 font-mono text-sm font-semibold leading-none text-text-secondary">
            {counterText ?? `${index + 1}/${total}`}
          </span>
          <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold leading-none ${typeMeta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${typeMeta.dot}`} />
            <span>{typeMeta.label}</span>
          </div>
          {question.tags?.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={toggleFavorite}
          disabled={favoriteSaving}
          className="active:scale-90 transition-transform text-accent disabled:opacity-50"
          title={isFavorite ? '取消收藏' : '收藏'}
        >
          <Icon name={isFavorite ? 'star' : 'star-empty'} size={24} />
        </button>
      </div>

      {favoriteError && (
        <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {favoriteError}
        </div>
      )}

      {/* 题干 */}
      <div className="text-base font-medium text-text-primary mb-4 leading-relaxed whitespace-pre-wrap">
        {question.question}
      </div>

      {!isQuestionReady && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          这道题的数据不完整，暂时无法作答。请检查题库中的答案或选项配置。
        </div>
      )}

      {/* 选项 */}
      {question.options && (question.type === 'single' || question.type === 'multiple') && (
        <div className="space-y-2 mb-4">
          {optionEntries.map(([key, value]) => {
            const selected = userAnswer.includes(key);
            const isCorrect = question.answer.includes(key);
            let optionClass = 'border-border-default bg-bg-card hover:border-accent/40';

            if (submitted && showAnswerImmediately) {
              if (isCorrect && selected) {
                optionClass = 'border-emerald-500/70 bg-emerald-500/10 text-text-primary';
              } else if (isCorrect && !selected) {
                optionClass = 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400';
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
                disabled={submitted || !isQuestionReady}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 ${optionClass}`}
              >
                <span className="font-bold text-sm mt-0.5 shrink-0">{key}</span>
                <span className="text-sm leading-relaxed">{value}</span>
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
                disabled={submitted || !isQuestionReady}
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
            disabled={submitted || !isQuestionReady}
            placeholder={question.type === 'blank' ? '请输入答案...' : '请输入你的回答...'}
            className="w-full border border-border-default rounded-xl px-4 py-3 text-sm focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none resize-none disabled:bg-bg-secondary bg-bg-card text-text-primary placeholder:text-text-muted transition-all"
            rows={question.type === 'short' ? 4 : 2}
          />
        </div>
      )}

      {/* 提交按钮 */}
      {!submitted && (
        <div className="space-y-2">
          {(guidanceHint || guidanceError) && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
                guidanceError
                  ? 'border-red-500/25 bg-red-500/10 text-red-500'
                  : 'border-accent/20 bg-accent/10 text-text-primary'
              }`}
            >
              <div className="flex items-start gap-2">
                <Icon name={guidanceError ? 'alert-circle' : 'lightbulb'} size={15} className={guidanceError ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-accent'} />
                <span>{guidanceError || guidanceHint}</span>
              </div>
            </div>
          )}
          <button
            onClick={openGuidance}
            disabled={!isQuestionReady || guidanceLoading}
            className="w-full py-3 bg-bg-secondary text-text-secondary border border-border-subtle font-medium rounded-xl active:scale-[0.98] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {guidanceLoading ? (
              <span className="inline-block h-4 w-4 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
            ) : (
              <Icon name="lightbulb" size={16} />
            )}
            {guidanceLoading ? '生成一点提示...' : guidanceHint ? '换个提示' : 'AI 提示'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !isQuestionReady ||
              (question.type !== 'blank' && question.type !== 'short' && userAnswer.length === 0) ||
              ((question.type === 'blank' || question.type === 'short') && !blankInput.trim())
            }
            className="w-full py-3 bg-accent text-white font-medium rounded-xl active:bg-accent-hover disabled:opacity-40 disabled:active:bg-accent transition-colors"
          >
            提交答案
          </button>
        </div>
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
                  disabled={savingRecord}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1 ${status === 'correct' ? 'bg-emerald-500 text-white' : 'bg-bg-card border border-emerald-500/35 text-emerald-500'}`}
                >
                  <Icon name="check" size={14} /> 我答对了
                </button>
                <button
                  onClick={() => handleSelfGrade('wrong')}
                  disabled={savingRecord}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1 ${status === 'wrong' ? 'bg-red-500 text-white' : 'bg-bg-card border border-red-500/35 text-red-500'}`}
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

          {saveError && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-500">
              <div>{saveError}</div>
              <button
                onClick={() => void saveRecord(status, submittedAnswerRef.current, Date.now()).then(saved => {
                  if (!saved) return;
                  onAnswer?.(status);
                  scheduleAutoAdvance(status);
                })}
                disabled={savingRecord || status === 'unanswered'}
                className="mt-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {savingRecord ? '保存中...' : '重新保存'}
              </button>
            </div>
          )}

          {submitted && (
            <button
              onClick={() => {
                handleAIExplanation();
              }}
              className="w-full py-3 bg-accent/10 text-accent border border-accent/25 rounded-xl text-sm font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Icon name="lightbulb" size={16} />
              AI 解析
            </button>
          )}

          {allowRedo && (
            <button
              onClick={handleRedo}
              className="w-full py-3 bg-bg-secondary text-text-secondary border border-border-subtle rounded-xl text-sm font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Icon name="redo" size={16} />
              再做一次
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
      {showExplanation && question.explanation && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={closeExplanation}>
          <div className="absolute inset-0 bg-slate-950/55" />
          <div
            className="relative bg-bg-card rounded-t-2xl w-full max-w-3xl h-[60vh] flex flex-col animate-slide-up border-t border-border-subtle"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Icon name="lightbulb" size={18} className="text-accent" />
                解析
              </h3>
              <button onClick={closeExplanation} className="p-1 active:bg-bg-secondary rounded-lg">
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={closeExplanation}>
          <div className="absolute inset-0 bg-slate-950/55" />
          <div
            className="relative bg-bg-card rounded-t-2xl w-full max-w-3xl h-[60vh] flex flex-col animate-slide-up border-t border-border-subtle"
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
                <button onClick={closeExplanation} className="p-1.5 active:bg-bg-secondary rounded-lg">
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
