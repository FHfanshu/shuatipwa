import { describe, it, expect } from 'vitest';
import { buildContentKey, buildAnswerKey, attachQuestionHashes } from '../../src/domain/questionFingerprint';
import type { Question } from '../../src/types';

function q(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    bankId: 'b1',
    type: 'single',
    question: '测试题目',
    options: { A: '选项A', B: '选项B' },
    answer: ['A'],
    ...overrides,
  };
}

describe('buildContentKey', () => {
  it('包含题型、题目、选项', () => {
    const key = buildContentKey(q());
    expect(key).toContain('single');
    expect(key).toContain('测试题目');
    expect(key).toContain('A:选项A');
    expect(key).toContain('B:选项B');
  });

  it('空白字符规范化为单空格', () => {
    const key = buildContentKey(q({ question: '测试   题目  内容' }));
    expect(key).toContain('测试 题目 内容');
    expect(key).not.toContain('   ');
  });

  it('中文标点转英文标点', () => {
    const key = buildContentKey(q({ question: '测试，题目。内容；标题：副标题' }));
    expect(key).toContain('测试,题目.内容;标题:副标题');
  });

  it('选项按 key 字母排序', () => {
    const key = buildContentKey(q({ options: { C: '丙', A: '甲', B: '乙' } }));
    const idxA = key.indexOf('A:甲');
    const idxB = key.indexOf('B:乙');
    const idxC = key.indexOf('C:丙');
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });

  it('无选项时选项部分为空字符串', () => {
    const key = buildContentKey(q({ options: undefined }));
    expect(key).not.toContain('A:');
    expect(key).not.toContain('B:');
  });

  it('相同内容产生相同 key', () => {
    const key1 = buildContentKey(q({ id: 'x1' }));
    const key2 = buildContentKey(q({ id: 'x2' }));
    expect(key1).toBe(key2);
  });

  it('不同题目产生不同 key', () => {
    const key1 = buildContentKey(q({ question: '题A' }));
    const key2 = buildContentKey(q({ question: '题B' }));
    expect(key1).not.toBe(key2);
  });
});

describe('buildAnswerKey', () => {
  it('单答案', () => {
    expect(buildAnswerKey(q({ answer: ['A'] }))).toBe('A');
  });

  it('多答案排序', () => {
    expect(buildAnswerKey(q({ answer: ['C', 'A', 'B'] }))).toBe('A,B,C');
  });

  it('相同答案顺序无关', () => {
    expect(buildAnswerKey(q({ answer: ['B', 'A'] }))).toBe(buildAnswerKey(q({ answer: ['A', 'B'] })));
  });

  it('判断题答案', () => {
    expect(buildAnswerKey(q({ answer: ['true'] }))).toBe('true');
  });
});

describe('attachQuestionHashes', () => {
  it('为每个题目附加 contentHash 和 answerHash', async () => {
    const questions = [q(), q({ id: 'q2', question: '另一题' })];
    const result = await attachQuestionHashes(questions);
    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.contentHash).toBeDefined();
      expect(r.answerHash).toBeDefined();
    }
  });

  it('hash 是十六进制字符串，长度 64', async () => {
    const [result] = await attachQuestionHashes([q()]);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.answerHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('相同内容产生相同 hash', async () => {
    const [r1, r2] = await attachQuestionHashes([q(), q({ id: 'q2' })]);
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it('不同答案产生不同 answerHash', async () => {
    const [r1, r2] = await attachQuestionHashes([
      q({ answer: ['A'] }),
      q({ id: 'q2', answer: ['B'] }),
    ]);
    expect(r1.answerHash).not.toBe(r2.answerHash);
  });

  it('空数组返回空数组', async () => {
    expect(await attachQuestionHashes([])).toEqual([]);
  });
});
