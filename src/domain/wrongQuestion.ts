import type { PracticeRecord, AnswerStatus } from '../types';

/**
 * 错题本规则：每道题以最新一次有效作答为准。
 * - 最新一次做对 → 不在错题本
 * - 最新一次做错 → 在错题本
 * - 无记录 → 不在错题本
 */
export function getCurrentWrongQuestionIds(records: PracticeRecord[]): string[] {
  const latestStatus = new Map<string, AnswerStatus>();
  const ordered = [...records].sort((a, b) =>
    a.timestamp - b.timestamp || (a.id ?? 0) - (b.id ?? 0)
  );

  for (const record of ordered) {
    if (record.status === 'correct' || record.status === 'wrong') {
      latestStatus.set(record.questionId, record.status);
    }
  }

  return [...latestStatus.entries()]
    .filter(([, status]) => status === 'wrong')
    .map(([questionId]) => questionId);
}
