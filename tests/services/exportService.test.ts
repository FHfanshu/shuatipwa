/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { exportAllData, exportBankQuestions } from '../../src/services/exportService';
import type { ExportDataV2, QuestionBank, Question, PracticeRecord, Favorite, AIExplanation } from '../../src/types';

beforeEach(async () => {
  await db.banks.clear();
  await db.questions.clear();
  await db.records.clear();
  await db.favorites.clear();
  await db.aiExplanations.clear();
  await db.practiceSessions.clear();
  await db.settings.clear();
});

function bank(id: string, name = `Bank ${id}`): QuestionBank {
  return { id, name, createdAt: 1, updatedAt: 1, questionCount: 0 };
}

function question(id: string, bankId: string): Question {
  return {
    id,
    bankId,
    type: 'single',
    question: `Question ${id}`,
    options: { A: 'Alpha', B: 'Beta' },
    answer: ['A'],
    contentHash: `h-${id}`,
    answerHash: `a-${id}`,
  };
}

function record(bankId: string, questionId: string): PracticeRecord {
  return { bankId, questionId, userAnswer: ['A'], status: 'correct', timestamp: 1000 };
}

function favorite(bankId: string, questionId: string): Favorite {
  return { bankId, questionId, timestamp: 1000 };
}

function explanation(bankId: string, questionId: string): AIExplanation {
  return { bankId, questionId, explanation: 'Because A.', createdAt: 1000 };
}

describe('exportAllData', () => {
  it('返回正确结构的 ExportDataV2 JSON', async () => {
    await db.banks.add(bank('b1'));
    await db.questions.bulkAdd([question('q1', 'b1'), question('q2', 'b1')]);
    await db.records.add(record('b1', 'q1'));
    await db.favorites.add(favorite('b1', 'q1'));

    const json = await exportAllData();
    const data: ExportDataV2 = JSON.parse(json);

    expect(data.version).toBe(2);
    expect(data.exportedAt).toBeGreaterThan(0);
    expect(data.banks).toHaveLength(1);
    expect(data.banks[0].id).toBe('b1');
    expect(data.records).toHaveLength(1);
    expect(data.favorites).toHaveLength(1);
  });

  it('题目按 bankId 分组', async () => {
    await db.banks.add(bank('b1'));
    await db.banks.add(bank('b2'));
    await db.questions.bulkAdd([
      question('q1', 'b1'),
      question('q2', 'b1'),
      question('q3', 'b2'),
    ]);

    const data: ExportDataV2 = JSON.parse(await exportAllData());

    expect(data.questions.b1).toHaveLength(2);
    expect(data.questions.b2).toHaveLength(1);
  });

  it('AI 凭据被排除', async () => {
    await db.settings.bulkAdd([
      { key: 'theme', value: 'dark', updatedAt: 1 },
      { key: 'ai_endpoint', value: 'ep', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'secret', updatedAt: 1 },
      { key: 'ai_model', value: 'model', updatedAt: 1 },
    ]);

    const data: ExportDataV2 = JSON.parse(await exportAllData());

    expect(data.settings).toHaveLength(1);
    expect(data.settings![0].key).toBe('theme');
  });

  it('无 AI 解析时不包含 aiExplanations 字段', async () => {
    const data: ExportDataV2 = JSON.parse(await exportAllData());
    expect(data.aiExplanations).toBeUndefined();
  });

  it('有 AI 解析时包含 aiExplanations 字段', async () => {
    await db.aiExplanations.add(explanation('b1', 'q1'));
    const data: ExportDataV2 = JSON.parse(await exportAllData());
    expect(data.aiExplanations).toHaveLength(1);
  });

  it('无设置时不包含 settings 字段', async () => {
    const data: ExportDataV2 = JSON.parse(await exportAllData());
    expect(data.settings).toBeUndefined();
  });

  it('进度回调被调用', async () => {
    const steps: string[] = [];
    await exportAllData((step) => steps.push(step));
    expect(steps).toContain('读取题库...');
    expect(steps).toContain('读取题目...');
    expect(steps).toContain('整理数据...');
  });

  it('空数据库返回空结构', async () => {
    const data: ExportDataV2 = JSON.parse(await exportAllData());
    expect(data.banks).toEqual([]);
    expect(data.questions).toEqual({});
    expect(data.records).toEqual([]);
    expect(data.favorites).toEqual([]);
  });
});

describe('exportBankQuestions', () => {
  it('返回指定题库的题目 JSON', async () => {
    await db.questions.bulkAdd([
      question('q1', 'b1'),
      question('q2', 'b1'),
      question('q3', 'b2'),
    ]);

    const result = JSON.parse(await exportBankQuestions('b1'));
    expect(result).toHaveLength(2);
    expect(result.every((q: Question) => q.bankId === 'b1')).toBe(true);
  });

  it('不存在的题库返回空数组', async () => {
    const result = JSON.parse(await exportBankQuestions('nonexistent'));
    expect(result).toEqual([]);
  });
});
