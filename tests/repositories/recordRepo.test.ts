import { describe, it, expect, beforeEach } from 'vitest';
import { upsertRecord, getRecordsByBankId } from '../../src/repositories/recordRepo';
import { db } from '../../src/db';

beforeEach(async () => {
  await db.records.clear();
});

describe('recordRepo', () => {
  describe('upsertRecord', () => {
    it('inserts a new record and returns id', async () => {
      const id = await upsertRecord({
        bankId: 'b1',
        questionId: 'q1',
        userAnswer: ['A'],
        status: 'correct',
        timestamp: 1000,
      });
      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);
    });

    it('updates existing record when existingId is provided', async () => {
      const id = await upsertRecord({
        bankId: 'b1',
        questionId: 'q1',
        userAnswer: ['A'],
        status: 'correct',
        timestamp: 1000,
      });

      const sameId = await upsertRecord(
        {
          bankId: 'b1',
          questionId: 'q1',
          userAnswer: ['B'],
          status: 'wrong',
          timestamp: 2000,
        },
        id
      );

      expect(sameId).toBe(id);
      const records = await getRecordsByBankId('b1');
      expect(records).toHaveLength(1);
      expect(records[0].userAnswer).toEqual(['B']);
      expect(records[0].status).toBe('wrong');
    });
  });

  describe('getRecordsByBankId', () => {
    it('returns records for the given bank', async () => {
      await upsertRecord({ bankId: 'b1', questionId: 'q1', userAnswer: ['A'], status: 'correct', timestamp: 1000 });
      await upsertRecord({ bankId: 'b1', questionId: 'q2', userAnswer: ['B'], status: 'wrong', timestamp: 2000 });
      await upsertRecord({ bankId: 'b2', questionId: 'q3', userAnswer: ['C'], status: 'correct', timestamp: 3000 });

      const records = await getRecordsByBankId('b1');
      expect(records).toHaveLength(2);
      expect(records.every(r => r.bankId === 'b1')).toBe(true);
    });

    it('returns empty array for non-existent bank', async () => {
      const records = await getRecordsByBankId('nonexistent');
      expect(records).toEqual([]);
    });
  });
});
