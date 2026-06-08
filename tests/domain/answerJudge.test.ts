import { describe, it, expect } from 'vitest';
import { checkAnswer } from '../../src/domain/answerJudge';
import type { Question } from '../../src/types';

function q(answer: string[], overrides?: Partial<Question>): Question {
  return {
    id: 'q1',
    bankId: 'b1',
    type: answer.length > 1 ? 'multiple' : 'single',
    question: 'test',
    answer,
    ...overrides,
  };
}

describe('checkAnswer', () => {
  describe('单选题', () => {
    it('正确答案 → correct', () => {
      expect(checkAnswer(q(['A']), ['A'])).toBe('correct');
    });

    it('错误答案 → wrong', () => {
      expect(checkAnswer(q(['A']), ['B'])).toBe('wrong');
    });

    it('大小写不敏感', () => {
      expect(checkAnswer(q(['A']), ['a'])).toBe('correct');
      expect(checkAnswer(q(['a']), ['A'])).toBe('correct');
    });

    it('多选题顺序无关', () => {
      expect(checkAnswer(q(['A', 'C']), ['C', 'A'])).toBe('correct');
      expect(checkAnswer(q(['C', 'A']), ['A', 'C'])).toBe('correct');
    });
  });

  describe('多选题', () => {
    it('完全匹配 → correct', () => {
      expect(checkAnswer(q(['A', 'B', 'C']), ['A', 'B', 'C'])).toBe('correct');
    });

    it('遗漏选项 → wrong', () => {
      expect(checkAnswer(q(['A', 'C']), ['A'])).toBe('wrong');
    });

    it('多选选项 → wrong', () => {
      expect(checkAnswer(q(['A']), ['A', 'B'])).toBe('wrong');
    });

    it('大小写混合', () => {
      expect(checkAnswer(q(['A', 'C']), ['c', 'a'])).toBe('correct');
    });
  });

  describe('判断题', () => {
    it('true 正确', () => {
      expect(checkAnswer(q(['true'], { type: 'judge' }), ['true'])).toBe('correct');
    });

    it('false 正确', () => {
      expect(checkAnswer(q(['false'], { type: 'judge' }), ['false'])).toBe('correct');
    });

    it('true vs false → wrong', () => {
      expect(checkAnswer(q(['true'], { type: 'judge' }), ['false'])).toBe('wrong');
    });
  });

  describe('边界情况', () => {
    it('空答案 → unanswered', () => {
      expect(checkAnswer(q(['A']), [])).toBe('unanswered');
    });

    it('null/undefined 答案 → unanswered', () => {
      expect(checkAnswer(q(['A']), null as unknown as string[])).toBe('unanswered');
      expect(checkAnswer(q(['A']), undefined as unknown as string[])).toBe('unanswered');
    });

    it('填空题正确', () => {
      expect(checkAnswer(q(['hello'], { type: 'blank' }), ['hello'])).toBe('correct');
    });

    it('填空题大小写不敏感', () => {
      expect(checkAnswer(q(['Hello'], { type: 'blank' }), ['hello'])).toBe('correct');
    });
  });
});
