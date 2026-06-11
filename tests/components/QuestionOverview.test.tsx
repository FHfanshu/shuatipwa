import { describe, it, expect } from 'vitest';
import type { QuestionType } from '../../src/types';

// 测试 QuestionOverview 中的 matchFilter 纯函数
// 该函数未导出，复制实现测试

type FilterTab = 'all' | 'choice' | 'judge' | 'other';

function matchFilter(type: QuestionType, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'choice') return type === 'single' || type === 'multiple';
  if (filter === 'judge') return type === 'judge';
  return type === 'blank' || type === 'short';
}

describe('matchFilter', () => {
  describe('all 过滤器', () => {
    it('匹配所有题型', () => {
      const types: QuestionType[] = ['single', 'multiple', 'judge', 'blank', 'short'];
      for (const type of types) {
        expect(matchFilter(type, 'all')).toBe(true);
      }
    });
  });

  describe('choice 过滤器', () => {
    it('匹配 single', () => {
      expect(matchFilter('single', 'choice')).toBe(true);
    });

    it('匹配 multiple', () => {
      expect(matchFilter('multiple', 'choice')).toBe(true);
    });

    it('不匹配 judge', () => {
      expect(matchFilter('judge', 'choice')).toBe(false);
    });

    it('不匹配 blank', () => {
      expect(matchFilter('blank', 'choice')).toBe(false);
    });
  });

  describe('judge 过滤器', () => {
    it('匹配 judge', () => {
      expect(matchFilter('judge', 'judge')).toBe(true);
    });

    it('不匹配 single', () => {
      expect(matchFilter('single', 'judge')).toBe(false);
    });
  });

  describe('other 过滤器', () => {
    it('匹配 blank', () => {
      expect(matchFilter('blank', 'other')).toBe(true);
    });

    it('匹配 short', () => {
      expect(matchFilter('short', 'other')).toBe(true);
    });

    it('不匹配 single', () => {
      expect(matchFilter('single', 'other')).toBe(false);
    });

    it('不匹配 judge', () => {
      expect(matchFilter('judge', 'other')).toBe(false);
    });
  });
});
