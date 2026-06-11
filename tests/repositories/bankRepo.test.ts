import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { deleteBankCascade, updateBankQuestions } from '../../src/repositories/bankRepo';
import type { AIExplanation, AppSetting, Favorite, PracticeRecord, PracticeSessionRecord, Question, QuestionBank } from '../../src/types';

beforeEach(async () => {
  await db.banks.clear();
  await db.questions.clear();
  await db.records.clear();
  await db.favorites.clear();
  await db.aiExplanations.clear();
  await db.practiceSessions.clear();
  await db.settings.clear();
});

describe('bankRepo', () => {
  it('deleteBankCascade removes only the selected bank data', async () => {
    await db.banks.bulkAdd([bank('b1'), bank('b2')]);
    await db.questions.bulkAdd([question('q1', 'b1'), question('q2', 'b2')]);
    await db.records.bulkAdd([record('b1', 'q1'), record('b2', 'q2')]);
    await db.favorites.bulkAdd([favorite('b1', 'q1'), favorite('b2', 'q2')]);
    await db.aiExplanations.bulkAdd([explanation('b1', 'q1'), explanation('b2', 'q2')]);
    await db.practiceSessions.bulkAdd([session('b1:sequential:all', 'b1'), session('b2:sequential:all', 'b2')]);
    await db.settings.add(setting('theme', 'dark'));

    await deleteBankCascade('b1');

    expect(await db.banks.toArray()).toEqual([expect.objectContaining({ id: 'b2' })]);
    expect(await db.questions.toArray()).toEqual([expect.objectContaining({ id: 'q2', bankId: 'b2' })]);
    expect(await db.records.toArray()).toEqual([expect.objectContaining({ bankId: 'b2', questionId: 'q2' })]);
    expect(await db.favorites.toArray()).toEqual([expect.objectContaining({ bankId: 'b2', questionId: 'q2' })]);
    expect(await db.aiExplanations.toArray()).toEqual([expect.objectContaining({ bankId: 'b2', questionId: 'q2' })]);
    expect(await db.practiceSessions.toArray()).toEqual([expect.objectContaining({ bankId: 'b2' })]);
    expect(await db.settings.get('theme')).toEqual(expect.objectContaining({ value: 'dark' }));
  });

  it('updateBankQuestions reuses hashed questions and purges removed question data', async () => {
    await db.banks.add(bank('b1', 2));
    await db.questions.bulkAdd([
      question('old-keep', 'b1', { contentHash: 'same-content', answerHash: 'old-answer' }),
      question('old-remove', 'b1', { contentHash: 'removed-content', answerHash: 'removed-answer' }),
    ]);
    await db.records.bulkAdd([record('b1', 'old-keep'), record('b1', 'old-remove')]);
    await db.favorites.bulkAdd([favorite('b1', 'old-keep'), favorite('b1', 'old-remove')]);
    await db.aiExplanations.bulkAdd([explanation('b1', 'old-keep'), explanation('b1', 'old-remove')]);
    await db.practiceSessions.add(session('b1:random:all', 'b1'));

    const result = await updateBankQuestions('b1', [
      question('incoming-keep', 'b1', { contentHash: 'same-content', answerHash: 'new-answer', answer: ['B'] }),
      question('incoming-add', 'b1', { contentHash: 'new-content', answerHash: 'new-answer-2' }),
    ]);

    expect(result).toEqual({ added: 1, updated: 1, removed: 1 });
    expect(await db.banks.get('b1')).toEqual(expect.objectContaining({ questionCount: 2 }));

    const questions = await db.questions.where('bankId').equals('b1').toArray();
    expect(questions.map(q => q.id).sort()).toEqual(['incoming-add', 'old-keep']);
    expect(await db.questions.get('old-keep')).toEqual(expect.objectContaining({ answer: ['B'], answerHash: 'new-answer' }));
    expect(await db.questions.get('old-remove')).toBeUndefined();

    expect(await db.records.where('questionId').equals('old-keep').count()).toBe(1);
    expect(await db.records.where('questionId').equals('old-remove').count()).toBe(0);
    expect(await db.favorites.where('questionId').equals('old-remove').count()).toBe(0);
    expect(await db.aiExplanations.where('questionId').equals('old-remove').count()).toBe(0);
    expect(await db.practiceSessions.where('bankId').equals('b1').count()).toBe(0);
  });
});

function bank(id: string, questionCount = 1): QuestionBank {
  return {
    id,
    name: `Bank ${id}`,
    createdAt: 1,
    updatedAt: 1,
    questionCount,
  };
}

function question(id: string, bankId: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    bankId,
    type: 'single',
    question: `Question ${id}`,
    options: { A: 'Alpha', B: 'Beta' },
    answer: ['A'],
    contentHash: `content-${id}`,
    answerHash: `answer-${id}`,
    ...overrides,
  };
}

function record(bankId: string, questionId: string): Omit<PracticeRecord, 'id'> {
  return {
    bankId,
    questionId,
    userAnswer: ['A'],
    status: 'correct',
    timestamp: 1,
  };
}

function favorite(bankId: string, questionId: string): Omit<Favorite, 'id'> {
  return { bankId, questionId, timestamp: 1 };
}

function explanation(bankId: string, questionId: string): Omit<AIExplanation, 'id'> {
  return { bankId, questionId, explanation: 'Explanation', createdAt: 1 };
}

function session(id: string, bankId: string): PracticeSessionRecord {
  return {
    id,
    bankId,
    mode: 'sequential',
    currentIndex: 0,
    questionIds: ['q1'],
    updatedAt: 1,
  };
}

function setting(key: string, value: unknown): AppSetting {
  return { key, value, updatedAt: 1 };
}
