import type { PracticeMode } from '../types';

export interface LastPracticeSession {
  bankId: string;
  mode: PracticeMode;
  currentIndex: number;
  questionIds: string[];
  updatedAt: number;
}

const KEY = 'last-practice-session-v1';

export function saveLastPracticeSession(session: LastPracticeSession): void {
  if (session.mode === 'exam') return;
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadLastPracticeSession(): LastPracticeSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastPracticeSession;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export const MODE_LABELS: Record<PracticeMode, string> = {
  sequential: '顺序练习',
  random: '随机练习',
  wrong: '错题本',
  favorite: '收藏题目',
  exam: '模拟考试',
};
