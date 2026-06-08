import { db } from '../db';
import type { AIExplanation } from '../types';

export async function getCachedExplanation(questionId: string): Promise<AIExplanation | undefined> {
  return db.aiExplanations.where('questionId').equals(questionId).first();
}

export async function cacheExplanation(
  questionId: string,
  explanation: string,
  existingCacheId?: number | null,
  bankId?: string,
  model?: string,
): Promise<number> {
  if (existingCacheId) {
    await db.aiExplanations.delete(existingCacheId);
  }
  const id = await db.aiExplanations.add({
    questionId,
    bankId: bankId ?? '',
    explanation,
    model,
    createdAt: Date.now(),
  });
  return id as number;
}

export async function getAllExplanations(): Promise<AIExplanation[]> {
  return db.aiExplanations.toArray();
}
