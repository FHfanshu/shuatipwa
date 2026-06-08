import { describe, it, expect } from 'vitest';
import { getCurrentWrongQuestionIds } from '../../src/domain/wrongQuestion';
import type { PracticeRecord } from '../../src/types';

function record(
  questionId: string,
  status: 'correct' | 'wrong' | 'unanswered',
  timestamp: number,
  id?: number
): PracticeRecord {
  return { id, bankId: 'b1', questionId, userAnswer: ['A'], status, timestamp };
}

describe('getCurrentWrongQuestionIds', () => {
  it('无记录 → 空数组', () => {
    expect(getCurrentWrongQuestionIds([])).toEqual([]);
  });

  it('最新一次做对 → 不在错题本', () => {
    const records = [
      record('q1', 'wrong', 1),
      record('q1', 'correct', 2),
    ];
    expect(getCurrentWrongQuestionIds(records)).toEqual([]);
  });

  it('最新一次做错 → 在错题本', () => {
    const records = [
      record('q1', 'correct', 1),
      record('q1', 'wrong', 2),
    ];
    expect(getCurrentWrongQuestionIds(records)).toEqual(['q1']);
  });

  it('只做错一次 → 在错题本', () => {
    const records = [record('q1', 'wrong', 1)];
    expect(getCurrentWrongQuestionIds(records)).toEqual(['q1']);
  });

  it('只做对一次 → 不在错题本', () => {
    const records = [record('q1', 'correct', 1)];
    expect(getCurrentWrongQuestionIds(records)).toEqual([]);
  });

  it('多题混合', () => {
    const records = [
      record('q1', 'wrong', 1),
      record('q1', 'correct', 2),
      record('q2', 'correct', 1),
      record('q2', 'wrong', 2),
      record('q3', 'wrong', 1),
    ];
    const result = getCurrentWrongQuestionIds(records);
    expect(result).toContain('q2');
    expect(result).toContain('q3');
    expect(result).not.toContain('q1');
  });

  it('unanswered 记录不影响结果', () => {
    const records = [
      record('q1', 'correct', 1),
      record('q1', 'unanswered', 2),
    ];
    // unanswered 不覆盖之前的 correct
    expect(getCurrentWrongQuestionIds(records)).toEqual([]);
  });

  it('按 timestamp 排序，相同 timestamp 按 id 排序', () => {
    const records = [
      record('q1', 'correct', 100, 2),
      record('q1', 'wrong', 100, 1),
    ];
    // id=1 先，id=2 后，所以最终状态是 correct
    expect(getCurrentWrongQuestionIds(records)).toEqual([]);
  });

  it('大量记录性能', () => {
    const records: PracticeRecord[] = [];
    for (let i = 0; i < 1000; i++) {
      records.push(record(`q${i}`, i % 2 === 0 ? 'correct' : 'wrong', i));
    }
    const result = getCurrentWrongQuestionIds(records);
    expect(result.length).toBe(500);
  });
});
