/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { importFullBackup } from '../../src/services/importService';
import type { ExportDataV2 } from '../../src/types';

beforeEach(async () => {
  await db.banks.clear();
  await db.questions.clear();
  await db.records.clear();
  await db.favorites.clear();
  await db.aiExplanations.clear();
  await db.practiceSessions.clear();
  await db.settings.clear();
});

describe('importFullBackup', () => {
  it('restores backup data, backfills question hashes, and drops AI credentials', async () => {
    const backup: ExportDataV2 = {
      version: 2,
      exportedAt: 1,
      banks: [{
        id: 'b1',
        name: 'Backup Bank',
        createdAt: 1,
        updatedAt: 1,
        questionCount: 1,
      }],
      questions: {
        b1: [{
          id: 'q1',
          bankId: 'b1',
          type: 'single',
          question: 'Which letter?',
          options: { A: 'A', B: 'B' },
          answer: ['A'],
        }],
      },
      records: [{ bankId: 'b1', questionId: 'q1', userAnswer: ['A'], status: 'correct', timestamp: 1 }],
      favorites: [{ bankId: 'b1', questionId: 'q1', timestamp: 1 }],
      aiExplanations: [{ bankId: 'b1', questionId: 'q1', explanation: 'Because A.', createdAt: 1 }],
      settings: [
        { key: 'theme', value: 'dark', updatedAt: 1 },
        { key: 'ai_apiKey', value: 'secret', updatedAt: 1 },
        { key: 'ai_endpoint', value: 'https://example.com/v1', updatedAt: 1 },
        { key: 'ai_model', value: 'model', updatedAt: 1 },
      ],
    };

    await importFullBackup(jsonFile('backup.json', backup));

    expect(await db.banks.get('b1')).toEqual(expect.objectContaining({ name: 'Backup Bank' }));
    expect(await db.records.count()).toBe(1);
    expect(await db.favorites.count()).toBe(1);
    expect(await db.aiExplanations.count()).toBe(1);

    const question = await db.questions.get('q1');
    expect(question?.contentHash).toBeTruthy();
    expect(question?.answerHash).toBeTruthy();
    expect(await db.settings.get('theme')).toEqual(expect.objectContaining({ value: 'dark' }));
    expect(await db.settings.get('ai_apiKey')).toBeUndefined();
    expect(await db.settings.get('ai_endpoint')).toBeUndefined();
    expect(await db.settings.get('ai_model')).toBeUndefined();
  });

  it('rejects unsupported backup versions before replacing local data', async () => {
    await db.banks.add({
      id: 'existing',
      name: 'Existing',
      createdAt: 1,
      updatedAt: 1,
      questionCount: 0,
    });

    await expect(importFullBackup(jsonFile('backup.json', { version: 999 }))).rejects.toThrow('备份版本不支持');

    expect(await db.banks.get('existing')).toEqual(expect.objectContaining({ name: 'Existing' }));
  });
});

function jsonFile(name: string, data: unknown): File {
  return new File([JSON.stringify(data)], name, { type: 'application/json' });
}
