import { db } from '../db';

export async function getCachedExplanation(questionId: string): Promise<{ id?: number; explanation: string } | undefined> {
  return db.aiExplanations.where('questionId').equals(questionId).first();
}

export async function cacheExplanation(questionId: string, explanation: string, existingCacheId?: number | null): Promise<number> {
  if (existingCacheId) {
    await db.aiExplanations.delete(existingCacheId);
  }
  const id = await db.aiExplanations.add({
    questionId,
    explanation,
    createdAt: Date.now(),
  });
  return id as number;
}
