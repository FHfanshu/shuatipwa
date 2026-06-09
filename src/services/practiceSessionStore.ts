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

function scopedSessionId(bankId: string, mode: PracticeMode): string {
  return `${bankId}:${mode}`;
}

export async function saveLastPracticeSession(session: Omit<PracticeSessionRecord, 'id'>): Promise<void> {
  if (session.mode === 'exam') return;
  const scoped = { ...session, id: scopedSessionId(session.bankId, session.mode) };
  await db.transaction('rw', db.practiceSessions, async () => {
    await db.practiceSessions.put(scoped);
    await db.practiceSessions.put({ ...session, id: 'last' });
  });
}

export async function loadLastPracticeSession(
  bankId?: string,
  mode?: PracticeMode
): Promise<PracticeSessionRecord | null> {
  const id = bankId && mode ? scopedSessionId(bankId, mode) : 'last';
  const record = await db.practiceSessions.get(id);
  return record ?? null;
}

export const MODE_LABELS: Record<PracticeMode, string> = {
  sequential: '顺序练习',
  random: '随机练习',
  wrong: '错题本',
  favorite: '收藏题目',
  exam: '模拟考试',
};
