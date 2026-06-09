import { db } from '../db';
import type { PracticeMode, QuestionType } from '../types';

export type PracticeSessionRecord = {
  id?: string;
  bankId: string;
  mode: PracticeMode;
  typeFilter?: QuestionType | null;
  currentIndex: number;
  questionIds: string[];
  updatedAt: number;
};

function normalizeTypeFilter(typeFilter?: QuestionType | null): QuestionType | null {
  return typeFilter ?? null;
}

function scopedSessionId(bankId: string, mode: PracticeMode, typeFilter?: QuestionType | null): string {
  return `${bankId}:${mode}:${normalizeTypeFilter(typeFilter) ?? 'all'}`;
}

function legacyScopedSessionId(bankId: string, mode: PracticeMode): string {
  return `${bankId}:${mode}`;
}

export async function saveLastPracticeSession(session: Omit<PracticeSessionRecord, 'id'>): Promise<void> {
  if (session.mode === 'exam') return;
  const normalizedSession = {
    ...session,
    typeFilter: normalizeTypeFilter(session.typeFilter),
  };
  const scoped = {
    ...normalizedSession,
    id: scopedSessionId(normalizedSession.bankId, normalizedSession.mode, normalizedSession.typeFilter),
  };
  await db.transaction('rw', db.practiceSessions, async () => {
    await db.practiceSessions.put(scoped);
    await db.practiceSessions.put({ ...normalizedSession, id: 'last' });
  });
}

export async function loadLastPracticeSession(
  bankId?: string,
  mode?: PracticeMode,
  typeFilter?: QuestionType | null
): Promise<PracticeSessionRecord | null> {
  if (!bankId || !mode) {
    const record = await db.practiceSessions.get('last');
    return record ?? null;
  }

  const normalizedTypeFilter = normalizeTypeFilter(typeFilter);
  const record = await db.practiceSessions.get(scopedSessionId(bankId, mode, normalizedTypeFilter));
  if (record) return record;

  if (normalizedTypeFilter === null) {
    const legacy = await db.practiceSessions.get(legacyScopedSessionId(bankId, mode));
    return legacy ? { ...legacy, typeFilter: legacy.typeFilter ?? null } : null;
  }

  return null;
}

export const MODE_LABELS: Record<PracticeMode, string> = {
  sequential: '顺序练习',
  random: '随机练习',
  wrong: '错题本',
  favorite: '收藏题目',
  exam: '模拟考试',
};
