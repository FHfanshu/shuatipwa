import { db } from '../db';
import type { PracticeMode } from '../types';

export type PracticeSessionRecord = {
  id?: string;
  bankId: string;
  mode: PracticeMode;
  currentIndex: number;
  questionIds: string[];
  updatedAt: number;
};

export async function saveLastPracticeSession(session: Omit<PracticeSessionRecord, 'id'>): Promise<void> {
  if (session.mode === 'exam') return;
  await db.practiceSessions.put({ ...session, id: 'last' });
}

export async function loadLastPracticeSession(): Promise<PracticeSessionRecord | null> {
  const record = await db.practiceSessions.get('last');
  return record ?? null;
}

export const MODE_LABELS: Record<PracticeMode, string> = {
  sequential: '顺序练习',
  random: '随机练习',
  wrong: '错题本',
  favorite: '收藏题目',
  exam: '模拟考试',
};
