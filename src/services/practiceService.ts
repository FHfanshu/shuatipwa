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

const PROGRESS_PREFIX = 'practice-progress';

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
  let requestedIds: string[] | null = null;

  if (mode === 'wrong') {
    const records = await getRecordsByBankId(bankId);
    const wrongIds = getCurrentWrongQuestionIds(records);
    requestedIds = wrongIds;
    qs = wrongIds.length > 0 ? await getQuestionsByIds(wrongIds) : [];
  } else if (mode === 'favorite') {
    const favIds = await getFavoriteQuestionIds(bankId);
    requestedIds = favIds;
    qs = favIds.length > 0 ? await getQuestionsByIds(favIds) : [];
  } else {
    qs = await getQuestionsByBankId(bankId);
  }

  // 题型过滤
  if (options?.typeFilter) {
    qs = qs.filter(q => q.type === options.typeFilter);
  }

  if (mode === 'wrong' || mode === 'favorite') {
    const questionOrder = new Map((requestedIds ?? []).map((id, index) => [id, index]));
    qs = qs.filter(q => q.bankId === bankId).sort((a, b) => {
      const aIndex = questionOrder.get(a.id) ?? 0;
      const bIndex = questionOrder.get(b.id) ?? 0;
      return aIndex - bIndex;
    });
  }

  if ((options?.shuffle ?? (mode === 'random' || mode === 'exam')) && qs.length > 1) {
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

    if (mode === 'wrong') continue;

    questionStates.set(idx, {
      userAnswer: record.userAnswer || [],
      blankInput: '',
      submitted: true,
      status: record.status,
      recordId: record.id,
    });
  }

  const startIndex = determineStartIndex(mode, questions.length, results);

  // 顺序模式：清除 localStorage 残留（以 IndexedDB 为准）
  if (mode === 'sequential') {
    removeSavedProgress(bankId, mode);
  }

  return { questions, results, questionStates, startIndex };
}

/**
 * 从 localStorage 恢复保存的进度（兜底）
 */
export function loadSavedProgress(bankId: string, mode: PracticeMode): SavedProgress | null {
  if (mode !== 'sequential') return null;
  const key = progressStorageKey(bankId, mode);
  const saved = safeGetLocalStorage(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<SavedProgress>;
    if (!parsed || typeof parsed.currentIndex !== 'number' || !parsed.results || typeof parsed.results !== 'object') {
      safeRemoveLocalStorage(key);
      return null;
    }
    return {
      currentIndex: Math.max(0, Math.floor(parsed.currentIndex)),
      results: normalizeSavedResults(parsed.results),
    };
  } catch {
    safeRemoveLocalStorage(key);
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
  const progress: SavedProgress = {
    currentIndex: Math.max(0, Math.floor(currentIndex)),
    results: normalizeSavedResults(results),
  };
  safeSetLocalStorage(progressStorageKey(bankId, mode), JSON.stringify(progress));
}

/**
 * 计算做题统计
 */
export function computeStats(
  results: Record<number, AnswerStatus>,
  totalQuestions: number
): PracticeStats {
  const entries = Object.entries(results)
    .map(([key, status]) => ({ index: Number(key), status }))
    .filter(({ index, status }) => (
      Number.isInteger(index) &&
      index >= 0 &&
      index < totalQuestions &&
      (status === 'correct' || status === 'wrong')
    ))
    .map(({ status }) => status);
  const answered = entries.length;
  const correct = entries.filter(r => r === 'correct').length;
  const wrong = entries.filter(r => r === 'wrong').length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  return { answered, correct, wrong, accuracy, isFinished: answered >= totalQuestions };
}

// ── 内部工具函数 ──

function getLatestRecords(records: PracticeRecord[]): Map<string, PracticeRecord> {
  const latest = new Map<string, PracticeRecord>();
  for (const r of records) {
    const existing = latest.get(r.questionId);
    if (
      !existing ||
      r.timestamp > existing.timestamp ||
      (r.timestamp === existing.timestamp && (r.id ?? 0) > (existing.id ?? 0))
    ) {
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
  if (mode === 'sequential' || mode === 'random') {
    const firstUnanswered = Object.keys(Array.from({ length: total }))
      .map(Number)
      .find(i => !results[i]);
    return firstUnanswered ?? total - 1;
  }
  return 0;
}

function progressStorageKey(bankId: string, mode: PracticeMode): string {
  return `${PROGRESS_PREFIX}-${bankId}-${mode}`;
}

function removeSavedProgress(bankId: string, mode: PracticeMode): void {
  safeRemoveLocalStorage(progressStorageKey(bankId, mode));
}

function normalizeSavedResults(results: Record<number, AnswerStatus> | Record<string, unknown>): Record<number, AnswerStatus> {
  const normalized: Record<number, AnswerStatus> = {};
  for (const [key, value] of Object.entries(results)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    if (value === 'correct' || value === 'wrong') {
      normalized[index] = value;
    }
  }
  return normalized;
}

function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Progress is best-effort; IndexedDB records remain the source of truth.
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable localStorage.
  }
}
