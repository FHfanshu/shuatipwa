import { db } from '../db';
import type { QuestionBank } from '../types';

export async function getAllBanks(): Promise<QuestionBank[]> {
  return db.banks.orderBy('updatedAt').reverse().toArray();
}

export async function renameBank(bankId: string, newName: string): Promise<void> {
  await db.banks.update(bankId, { name: newName, updatedAt: Date.now() });
}

export async function deleteBankCascade(bankId: string): Promise<void> {
  await db.questions.where('bankId').equals(bankId).delete();
  await db.records.where('bankId').equals(bankId).delete();
  await db.favorites.where('bankId').equals(bankId).delete();
  await db.banks.delete(bankId);
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites, db.aiExplanations], async () => {
    await db.banks.clear();
    await db.questions.clear();
    await db.records.clear();
    await db.favorites.clear();
    await db.aiExplanations.clear();
  });
}
