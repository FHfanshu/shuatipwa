import { db } from '../db';
import type { QuestionBank, Question, PracticeRecord, Favorite, AIExplanation, AppSetting } from '../types';

export async function getAllBanks(): Promise<QuestionBank[]> {
  return db.banks.orderBy('updatedAt').reverse().toArray();
}

export async function renameBank(bankId: string, newName: string): Promise<void> {
  await db.banks.update(bankId, { name: newName, updatedAt: Date.now() });
}

export async function deleteBankCascade(bankId: string): Promise<void> {
  const questionIds = await db.questions.where('bankId').equals(bankId).primaryKeys();
  if (questionIds.length > 0) {
    await db.aiExplanations.where('questionId').anyOf(questionIds as string[]).delete();
  }
  await db.questions.where('bankId').equals(bankId).delete();
  await db.records.where('bankId').equals(bankId).delete();
  await db.favorites.where('bankId').equals(bankId).delete();
  await db.practiceSessions.where('bankId').equals(bankId).delete();
  await db.banks.delete(bankId);
}

export async function createBank(bank: QuestionBank): Promise<void> {
  await db.banks.add(bank);
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites, db.aiExplanations, db.practiceSessions, db.settings], async () => {
    await db.banks.clear();
    await db.questions.clear();
    await db.records.clear();
    await db.favorites.clear();
    await db.aiExplanations.clear();
    await db.practiceSessions.clear();
    await db.settings.clear();
  });
}

/**
 * 创建题库 + 写入题目（单事务，importService 用）
 */
export async function createBankWithQuestions(bank: QuestionBank, questions: Question[]): Promise<void> {
  await db.transaction('rw', [db.banks, db.questions], async () => {
    await db.banks.add(bank);
    await db.questions.bulkAdd(questions);
  });
}

/**
 * 清空全部数据并写入备份数据（单事务，importService 用）
 */
export async function replaceAllData(
  banks: QuestionBank[],
  questions: Question[],
  records: PracticeRecord[],
  favorites: Favorite[],
  aiExplanations: AIExplanation[] = [],
  settings: AppSetting[] = [],
): Promise<void> {
  await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites, db.aiExplanations, db.practiceSessions, db.settings], async () => {
    await db.banks.clear();
    await db.questions.clear();
    await db.records.clear();
    await db.favorites.clear();
    await db.aiExplanations.clear();
    await db.practiceSessions.clear();
    await db.settings.clear();

    if (banks.length) await db.banks.bulkAdd(banks);
    if (questions.length) await db.questions.bulkAdd(questions);
    if (records.length) await db.records.bulkAdd(records);
    if (favorites.length) await db.favorites.bulkAdd(favorites);
    if (aiExplanations.length) await db.aiExplanations.bulkAdd(aiExplanations);
    if (settings.length) await db.settings.bulkAdd(settings);
  });
}
