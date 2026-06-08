import { db } from '../db';
import type { Question } from '../types';

export async function getQuestionsByBankId(bankId: string): Promise<Question[]> {
  return db.questions.where('bankId').equals(bankId).toArray();
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  return db.questions.where('id').anyOf(ids).toArray();
}
