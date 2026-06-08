import type { Question, QuestionType, PracticeMode, AnswerStatus, PracticeRecord } from '../types';
import { getCurrentWrongQuestionIds } from '../domain/wrongQuestion';
import { shuffleArray } from '../utils/helper';
import { getRecordsByBankId } from '../repositories/recordRepo';
import { getQuestionsByBankId, getQuestionsByIds } from '../repositories/questionRepo';
import { getFavoriteQuestionIds } from '../repositories/favoriteRepo';

export interface QuestionState {
  userAnswer: string[];
  blankInput: string;
  submitted: boolean;
  status: AnswerStatus;
  recordId?: number | null;
}

export interface PracticeSession {
  questions: Question[];
  results: Record<number, AnswerStatus>;
  questionStates: Map<number, QuestionState>;
  startIndex: number;
}

export interface PracticeStats {
  answered: number;
  correct: number;
  wrong: number;
  accuracy: number;
  isFinished: boolean;
}

interface SavedProgress {
  currentIndex: number;
  results: Record<number, AnswerStatus>;
}

/**
 * 加载练习会话：按模式查题 → 恢复 IndexedDB 记录 → 确定起始位置
 */
export async function loadPracticeSession(
  bankId: string,
  mode: PracticeMode,
  options?: { examCount?: number; shuffle?: boolean; typeFilter?: QuestionType }
): Promise<PracticeSession> {
  const questions = await loadQuestions(bankId, mode, options);

  // 考试模式不恢复历史记录
  if (mode === 'exam') {
    return { questions, results: {}, questionStates: new Map(), startIndex: 0 };
  }

  return restoreFromRecords(bankId, mode, questions);
}

/**
 * 按模式加载题目
 */
export async function loadQuestions(
  bankId: string,
  mode: PracticeMode,
  options?: { examCount?: number; shuffle?: boolean; typeFilter?: QuestionType }
): Promise<Question[]> {
  let qs: Question[];

  if (mode === 'wrong') {
    const records = await getRecordsByBankId(bankId);
    const wrongIds = getCurrentWrongQuestionIds(records);
    qs = wrongIds.length > 0 ? await getQuestionsByIds(wrongIds) : [];
  } else if (mode === 'favorite') {
    const favIds = await getFavoriteQuestionIds(bankId);
    qs = favIds.length > 0 ? await getQuestionsByIds(favIds) : [];
  } else {
    qs = await getQuestionsByBankId(bankId);
  }

  // 题型过滤
  if (options?.typeFilter) {
    qs = qs.filter(q => q.type === options.typeFilter);
  }

  if (options?.shuffle ?? (mode === 'random' || mode === 'exam')) {
    qs = shuffleArray(qs);
  }

  if (mode === 'exam' && options?.examCount) {
    qs = qs.slice(0, options.examCount);
  }

  return qs;
}

/**
 * 从 IndexedDB 做题记录恢复进度
 */
export async function restoreFromRecords(
  bankId: string,
  mode: PracticeMode,
  questions: Question[]
): Promise<PracticeSession> {
  const allRecords = await getRecordsByBankId(bankId);

  if (allRecords.length === 0) {
    return { questions, results: {}, questionStates: new Map(), startIndex: 0 };
  }

  const questionIdToIndex = new Map<string, number>();
  questions.forEach((q, i) => questionIdToIndex.set(q.id, i));

  // 每题只保留最新记录
  const latestRecords = getLatestRecords(allRecords);

  const results: Record<number, AnswerStatus> = {};
  const questionStates = new Map<number, QuestionState>();

  for (const [questionId, record] of latestRecords) {
    const idx = questionIdToIndex.get(questionId);
    if (idx === undefined) continue;
    results[idx] = record.status;

    // 错题模式不恢复题目状态，让用户重新作答
    if (mode !== 'wrong') {
      questionStates.set(idx, {
        userAnswer: record.userAnswer || [],
        blankInput: '',
        submitted: true,
        status: record.status,
        recordId: record.id,
      });
    }
  }

  const startIndex = determineStartIndex(mode, questions.length, results);

  // 顺序模式：清除 localStorage 残留（以 IndexedDB 为准）
  if (mode === 'sequential') {
    localStorage.removeItem(`practice-progress-${bankId}-${mode}`);
  }

  return { questions, results, questionStates, startIndex };
}

/**
 * 从 localStorage 恢复保存的进度（兜底）
 */
export function loadSavedProgress(bankId: string, mode: PracticeMode): SavedProgress | null {
  if (mode !== 'sequential') return null;
  const saved = localStorage.getItem(`practice-progress-${bankId}-${mode}`);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as SavedProgress;
  } catch {
    localStorage.removeItem(`practice-progress-${bankId}-${mode}`);
    return null;
  }
}

/**
 * 保存当前进度到 localStorage
 */
export function saveProgress(
  bankId: string,
  mode: PracticeMode,
  currentIndex: number,
  results: Record<number, AnswerStatus>
): void {
  if (mode !== 'sequential') return;
  const progress: SavedProgress = { currentIndex, results };
  localStorage.setItem(`practice-progress-${bankId}-${mode}`, JSON.stringify(progress));
}

/**
 * 计算做题统计
 */
export function computeStats(
  results: Record<number, AnswerStatus>,
  totalQuestions: number
): PracticeStats {
  const entries = Object.values(results);
  const answered = entries.length;
  const correct = entries.filter(r => r === 'correct').length;
  const wrong = entries.filter(r => r === 'wrong').length;
  const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  return { answered, correct, wrong, accuracy, isFinished: answered >= totalQuestions };
}

// ── 内部工具函数 ──

function getLatestRecords(records: PracticeRecord[]): Map<string, PracticeRecord> {
  const latest = new Map<string, PracticeRecord>();
  for (const r of records) {
    const existing = latest.get(r.questionId);
    if (!existing || r.timestamp > existing.timestamp) {
      latest.set(r.questionId, r);
    }
  }
  return latest;
}

function determineStartIndex(
  mode: PracticeMode,
  total: number,
  results: Record<number, AnswerStatus>
): number {
  if (mode === 'sequential') {
    const firstUnanswered = Object.keys(Array.from({ length: total }))
      .map(Number)
      .find(i => !results[i]);
    return firstUnanswered ?? total - 1;
  }
  return 0;
}
