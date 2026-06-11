import { describe, it, expect } from 'vitest';
import type { PracticeRecord } from '../../src/types';

// 测试 HomePage 中的 computeDailyAccuracy 纯函数
// 由于该函数未导出，这里复制其实现进行测试以保证逻辑正确
function dayKey(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function computeDailyAccuracy(records: PracticeRecord[]): { label: string; value: number }[] {
  const now = Date.now();
  const days: { label: string; correct: number; wrong: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ label, correct: 0, wrong: 0 });
  }

  const labelMap = new Map(days.map(d => [d.label, d]));
  for (const r of records) {
    const key = dayKey(r.timestamp);
    const bucket = labelMap.get(key);
    if (!bucket) continue;
    if (r.status === 'correct') bucket.correct++;
    else if (r.status === 'wrong') bucket.wrong++;
  }

  return days.map(d => ({
    label: d.label,
    value: d.correct + d.wrong > 0 ? Math.round((d.correct / (d.correct + d.wrong)) * 100) : 0,
  }));
}

function record(status: 'correct' | 'wrong', daysAgo: number): PracticeRecord {
  return {
    bankId: 'b1',
    questionId: 'q1',
    userAnswer: ['A'],
    status,
    timestamp: Date.now() - daysAgo * 86400000,
  };
}

describe('computeDailyAccuracy', () => {
  it('空记录返回 7 天全 0', () => {
    const result = computeDailyAccuracy([]);
    expect(result).toHaveLength(7);
    expect(result.every(d => d.value === 0)).toBe(true);
  });

  it('今天的记录正确反映在当天', () => {
    const result = computeDailyAccuracy([
      record('correct', 0),
      record('correct', 0),
      record('wrong', 0),
    ]);
    const today = result[result.length - 1];
    expect(today.value).toBe(Math.round((2 / 3) * 100));
  });

  it('7 天前的记录被计入', () => {
    const result = computeDailyAccuracy([record('correct', 6)]);
    const first = result[0];
    expect(first.value).toBe(100);
  });

  it('超过 7 天的记录被忽略', () => {
    const result = computeDailyAccuracy([record('correct', 8)]);
    expect(result.every(d => d.value === 0)).toBe(true);
  });

  it('只看 correct 和 wrong，unanswered 不影响', () => {
    const result = computeDailyAccuracy([
      { bankId: 'b1', questionId: 'q1', userAnswer: [], status: 'unanswered' as unknown as 'correct', timestamp: Date.now() },
    ]);
    expect(result[result.length - 1].value).toBe(0);
  });

  it('每天独立计算正确率', () => {
    const result = computeDailyAccuracy([
      record('correct', 0),
      record('wrong', 1),
    ]);
    const today = result[result.length - 1];
    const yesterday = result[result.length - 2];
    expect(today.value).toBe(100);
    expect(yesterday.value).toBe(0);
  });

  it('返回值格式包含 label 和 value', () => {
    const result = computeDailyAccuracy([]);
    for (const d of result) {
      expect(d).toHaveProperty('label');
      expect(d).toHaveProperty('value');
      expect(typeof d.label).toBe('string');
      expect(typeof d.value).toBe('number');
    }
  });
});
