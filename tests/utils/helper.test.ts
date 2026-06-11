import { describe, it, expect } from 'vitest';
import { getQuestionTypeColor, shuffleArray } from '../../src/utils/helper';

describe('getQuestionTypeColor', () => {
  it('单选题返回 accent 色', () => {
    expect(getQuestionTypeColor('single')).toContain('accent');
  });

  it('多选题返回 accent 色', () => {
    expect(getQuestionTypeColor('multiple')).toContain('accent');
  });

  it('判断题返回 secondary 色', () => {
    expect(getQuestionTypeColor('judge')).toContain('secondary');
  });

  it('填空题返回 secondary 色', () => {
    expect(getQuestionTypeColor('blank')).toContain('secondary');
  });

  it('简答题返回 secondary 色', () => {
    expect(getQuestionTypeColor('short')).toContain('secondary');
  });
});

describe('shuffleArray', () => {
  it('返回新数组（不修改原数组）', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    const result = shuffleArray(original);
    expect(result).not.toBe(original);
    expect(original).toEqual(copy);
  });

  it('包含相同的元素', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffleArray(arr);
    expect(result.sort((a, b) => a - b)).toEqual(arr);
  });

  it('长度不变', () => {
    const arr = [1, 2, 3];
    expect(shuffleArray(arr)).toHaveLength(3);
  });

  it('空数组返回空数组', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('单元素数组返回相同元素', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });

  it('多次打乱后元素仍然完整', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    for (let run = 0; run < 10; run++) {
      const result = shuffleArray(arr);
      expect(result.sort((a, b) => a - b)).toEqual(arr);
    }
  });
});
