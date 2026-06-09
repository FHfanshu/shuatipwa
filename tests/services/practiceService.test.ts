// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadQuestions,
  restoreFromRecords,
  computeStats,
  loadSavedProgress,
  saveProgress,
} from '../../src/services/practiceService';
import { db } from '../../src/db';
import type { Question } from '../../src/types';

// 辅助：往 db 塞题目
async function seedQuestions(bankId: string, count: number): Promise<Question[]> {
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const q: Question = {
      id: `q${i}`,
      bankId,
      type: 'single',
      question: `题目 ${i}`,
      options: { A: '选项A', B: '选项B' },
      answer: ['A'],
    };
    qs.push(q);
  }
  await db.questions.bulkAdd(qs);
  return qs;
}

// 辅助：往 db 塞做题记录
async function seedRecords(bankId: string, records: Array<{ questionId: string; status: 'correct' | 'wrong'; timestamp: number }>) {
  for (const r of records) {
    await db.records.add({
      bankId,
      questionId: r.questionId,
      userAnswer: ['A'],
      status: r.status,
      timestamp: r.timestamp,
    });
  }
}

beforeEach(async () => {
  await db.questions.clear();
  await db.records.clear();
  await db.favorites.clear();
  localStorage.clear();
});

describe('loadQuestions', () => {
  it('sequential 模式返回全部题目', async () => {
    await seedQuestions('b1', 5);
    const qs = await loadQuestions('b1', 'sequential');
    expect(qs).toHaveLength(5);
  });

  it('wrong 模式只返回错题', async () => {
    await seedQuestions('b1', 3);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'wrong', timestamp: 1 },
    ]);
    const qs = await loadQuestions('b1', 'wrong');
    expect(qs).toHaveLength(1);
    expect(qs[0].id).toBe('q1');
  });

  it('favorite 模式只返回收藏题', async () => {
    await seedQuestions('b1', 3);
    await db.favorites.add({ bankId: 'b1', questionId: 'q0', timestamp: 1 });
    const qs = await loadQuestions('b1', 'favorite');
    expect(qs).toHaveLength(1);
    expect(qs[0].id).toBe('q0');
  });

  it('favorite 模式按收藏顺序返回题目', async () => {
    await seedQuestions('b1', 4);
    await db.favorites.bulkAdd([
      { bankId: 'b1', questionId: 'q2', timestamp: 1 },
      { bankId: 'b1', questionId: 'q0', timestamp: 2 },
    ]);
    const qs = await loadQuestions('b1', 'favorite');
    expect(qs.map(q => q.id)).toEqual(['q2', 'q0']);
  });

  it('exam 模式支持 shuffle + 截断', async () => {
    await seedQuestions('b1', 10);
    const qs = await loadQuestions('b1', 'exam', { examCount: 3 });
    expect(qs).toHaveLength(3);
  });
});

describe('restoreFromRecords', () => {
  it('无记录时返回空结果', async () => {
    const qs = await seedQuestions('b1', 3);
    const session = await restoreFromRecords('b1', 'sequential', qs);
    expect(Object.keys(session.results)).toHaveLength(0);
    expect(session.questionStates.size).toBe(0);
    expect(session.startIndex).toBe(0);
  });

  it('恢复做题结果和题目状态', async () => {
    const qs = await seedQuestions('b1', 3);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'wrong', timestamp: 1 },
    ]);
    const session = await restoreFromRecords('b1', 'sequential', qs);
    expect(session.results[0]).toBe('correct');
    expect(session.results[1]).toBe('wrong');
    expect(session.questionStates.size).toBe(2);
  });

  it('sequential 模式跳到第一个未答题', async () => {
    const qs = await seedQuestions('b1', 5);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'correct', timestamp: 1 },
    ]);
    const session = await restoreFromRecords('b1', 'sequential', qs);
    expect(session.startIndex).toBe(2);
  });

  it('sequential 全部答完跳到最后一题', async () => {
    const qs = await seedQuestions('b1', 3);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'correct', timestamp: 1 },
      { questionId: 'q2', status: 'correct', timestamp: 1 },
    ]);
    const session = await restoreFromRecords('b1', 'sequential', qs);
    expect(session.startIndex).toBe(2);
  });

  it('wrong 模式不恢复题目状态（允许重新作答）', async () => {
    const qs = await seedQuestions('b1', 2);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'wrong', timestamp: 1 },
    ]);
    const session = await restoreFromRecords('b1', 'wrong', qs);
    expect(session.questionStates.size).toBe(0); // 不恢复
    expect(session.results[0]).toBe('wrong');    // 但结果保留（用于统计）
  });

  it('只保留每题最新记录', async () => {
    const qs = await seedQuestions('b1', 1);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'wrong', timestamp: 1 },
      { questionId: 'q0', status: 'correct', timestamp: 2 },
    ]);
    const session = await restoreFromRecords('b1', 'sequential', qs);
    expect(session.results[0]).toBe('correct');
  });
});

describe('computeStats', () => {
  it('空结果', () => {
    const stats = computeStats({}, 10);
    expect(stats.answered).toBe(0);
    expect(stats.correct).toBe(0);
    expect(stats.wrong).toBe(0);
    expect(stats.isFinished).toBe(false);
  });

  it('部分完成', () => {
    const stats = computeStats({ 0: 'correct', 1: 'wrong' }, 10);
    expect(stats.answered).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.wrong).toBe(1);
    expect(stats.isFinished).toBe(false);
    expect(stats.accuracy).toBe(50);
  });

  it('忽略 unanswered 和越界结果', () => {
    const stats = computeStats({ 0: 'correct', 1: 'unanswered', 5: 'wrong' }, 2);
    expect(stats.answered).toBe(1);
    expect(stats.correct).toBe(1);
    expect(stats.wrong).toBe(0);
    expect(stats.accuracy).toBe(100);
    expect(stats.isFinished).toBe(false);
  });

  it('全部完成', () => {
    const stats = computeStats({ 0: 'correct', 1: 'correct' }, 2);
    expect(stats.isFinished).toBe(true);
    expect(stats.accuracy).toBe(100);
  });

  it('正确率计算', () => {
    const stats = computeStats({ 0: 'correct', 1: 'wrong', 2: 'wrong', 3: 'wrong' }, 4);
    expect(stats.accuracy).toBe(25);
  });
});

describe('localStorage 进度', () => {
  it('保存和读取进度', () => {
    saveProgress('b1', 'sequential', 5, { 0: 'correct' });
    const saved = loadSavedProgress('b1', 'sequential');
    expect(saved).toEqual({ currentIndex: 5, results: { 0: 'correct' } });
  });

  it('非 sequential 模式不保存', () => {
    saveProgress('b1', 'random', 5, { 0: 'correct' });
    const saved = loadSavedProgress('b1', 'random');
    expect(saved).toBeNull();
  });

  it('损坏的 JSON 自动清理', () => {
    localStorage.setItem('practice-progress-b1-sequential', 'invalid{json');
    const saved = loadSavedProgress('b1', 'sequential');
    expect(saved).toBeNull();
    expect(localStorage.getItem('practice-progress-b1-sequential')).toBeNull();
  });

  it('损坏的结构自动清理', () => {
    localStorage.setItem('practice-progress-b1-sequential', JSON.stringify({ currentIndex: '2', results: null }));
    const saved = loadSavedProgress('b1', 'sequential');
    expect(saved).toBeNull();
    expect(localStorage.getItem('practice-progress-b1-sequential')).toBeNull();
  });

  it('读取时清理无效结果状态', () => {
    localStorage.setItem('practice-progress-b1-sequential', JSON.stringify({
      currentIndex: 2.8,
      results: { 0: 'correct', 1: 'unanswered', '-1': 'wrong', bad: 'correct' },
    }));
    const saved = loadSavedProgress('b1', 'sequential');
    expect(saved).toEqual({ currentIndex: 2, results: { 0: 'correct' } });
  });
});
