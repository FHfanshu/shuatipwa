/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

const OVERVIEW_FAB_SIZE = 48;
const OVERVIEW_FAB_MARGIN = 12;

type OverviewFabPosition = { x: number; y: number };

function clampOverviewFabPosition(position: OverviewFabPosition): OverviewFabPosition {
  const maxX = Math.max(OVERVIEW_FAB_MARGIN, window.innerWidth - OVERVIEW_FAB_SIZE - OVERVIEW_FAB_MARGIN);
  const maxY = Math.max(OVERVIEW_FAB_MARGIN, window.innerHeight - OVERVIEW_FAB_SIZE - OVERVIEW_FAB_MARGIN);
  return {
    x: Math.min(Math.max(position.x, OVERVIEW_FAB_MARGIN), maxX),
    y: Math.min(Math.max(position.y, OVERVIEW_FAB_MARGIN), maxY),
  };
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

describe('clampOverviewFabPosition', () => {
  it('位置在范围内时不变', () => {
    const pos = { x: 100, y: 200 };
    const result = clampOverviewFabPosition(pos);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('x 小于 margin 时钳位到 margin', () => {
    const result = clampOverviewFabPosition({ x: -50, y: 200 });
    expect(result.x).toBe(OVERVIEW_FAB_MARGIN);
  });

  it('y 小于 margin 时钳位到 margin', () => {
    const result = clampOverviewFabPosition({ x: 100, y: -10 });
    expect(result.y).toBe(OVERVIEW_FAB_MARGIN);
  });

  it('x 超出右边界时钳位', () => {
    const maxX = window.innerWidth - OVERVIEW_FAB_SIZE - OVERVIEW_FAB_MARGIN;
    const result = clampOverviewFabPosition({ x: window.innerWidth + 100, y: 200 });
    expect(result.x).toBe(maxX);
  });

  it('y 超出下边界时钳位', () => {
    const maxY = window.innerHeight - OVERVIEW_FAB_SIZE - OVERVIEW_FAB_MARGIN;
    const result = clampOverviewFabPosition({ x: 100, y: window.innerHeight + 100 });
    expect(result.y).toBe(maxY);
  });
});

describe('parsePositiveInt', () => {
  it('null → undefined', () => {
    expect(parsePositiveInt(null)).toBeUndefined();
  });

  it('空字符串 → undefined', () => {
    expect(parsePositiveInt('')).toBeUndefined();
  });

  it('正整数 → 返回数值', () => {
    expect(parsePositiveInt('42')).toBe(42);
  });

  it('0 → undefined（非正数）', () => {
    expect(parsePositiveInt('0')).toBeUndefined();
  });

  it('负数 → undefined', () => {
    expect(parsePositiveInt('-5')).toBeUndefined();
  });

  it('小数 → undefined（非整数）', () => {
    expect(parsePositiveInt('3.14')).toBeUndefined();
  });

  it('非数字字符串 → undefined', () => {
    expect(parsePositiveInt('abc')).toBeUndefined();
  });

  it('1 → 1（最小正整数）', () => {
    expect(parsePositiveInt('1')).toBe(1);
  });
});
