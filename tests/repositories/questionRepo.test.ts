import { describe, it, expect, beforeEach } from 'vitest';
import { getAllQuestions, bulkAddQuestions, getQuestionsByBankId, getQuestionsByIds } from '../../src/repositories/questionRepo';
import { db } from '../../src/db';
import type { Question } from '../../src/types';

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

beforeEach(async () => {
  await db.questions.clear();
});

describe('questionRepo', () => {
  describe('getAllQuestions', () => {
    it('无题目返回空数组', async () => {
      expect(await getAllQuestions()).toEqual([]);
    });

    it('返回全部题目', async () => {
      await bulkAddQuestions([question('q1', 'b1'), question('q2', 'b1'), question('q3', 'b2')]);
      const result = await getAllQuestions();
      expect(result).toHaveLength(3);
    });
  });

  describe('bulkAddQuestions', () => {
    it('批量添加题目', async () => {
      await bulkAddQuestions([question('q1', 'b1'), question('q2', 'b1'), question('q3', 'b2')]);
      expect(await db.questions.count()).toBe(3);
    });

    it('添加的题目可通过 id 查到', async () => {
      await bulkAddQuestions([question('q1', 'b1')]);
      const result = await getQuestionsByIds(['q1']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q1');
    });
  });

  describe('getQuestionsByBankId', () => {
    it('返回指定题库的题目', async () => {
      await bulkAddQuestions([
        question('q1', 'b1'),
        question('q2', 'b1'),
        question('q3', 'b2'),
      ]);
      const result = await getQuestionsByBankId('b1');
      expect(result).toHaveLength(2);
      expect(result.every(r => r.bankId === 'b1')).toBe(true);
    });

    it('不存在的题库返回空数组', async () => {
      expect(await getQuestionsByBankId('nonexistent')).toEqual([]);
    });
  });

  describe('getQuestionsByIds', () => {
    it('按 id 列表获取题目', async () => {
      await bulkAddQuestions([question('q1', 'b1'), question('q2', 'b1'), question('q3', 'b1')]);
      const result = await getQuestionsByIds(['q1', 'q3']);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id).sort()).toEqual(['q1', 'q3']);
    });

    it('id 列表有不存在的 id 不影响结果', async () => {
      await bulkAddQuestions([question('q1', 'b1'), question('q2', 'b1')]);
      const result = await getQuestionsByIds(['q1', 'nonexistent']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q1');
    });

    it('空 id 列表返回空数组', async () => {
      await bulkAddQuestions([question('q1', 'b1')]);
      const result = await getQuestionsByIds([]);
      expect(result).toEqual([]);
    });
  });
});
