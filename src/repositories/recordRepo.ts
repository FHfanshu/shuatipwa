import { db } from '../db';
import type { PracticeRecord } from '../types';

export async function upsertRecord(
  record: Omit<PracticeRecord, 'id'>,
  existingId?: number | null
): Promise<number> {
  if (existingId != null) {
    await db.records.update(existingId, {
      userAnswer: record.userAnswer,
      status: record.status,
      timestamp: record.timestamp,
    });
    return existingId;
  }
  const id = await db.records.add(record);
  return id as number;
}

export async function getRecordsByBankId(bankId: string): Promise<PracticeRecord[]> {
  return db.records.where('bankId').equals(bankId).toArray();
}
