import { db } from '../db';

export async function isFavorited(bankId: string, questionId: string): Promise<boolean> {
  const existing = await db.favorites.where('[bankId+questionId]').equals([bankId, questionId]).first();
  return !!existing;
}

export async function getFavoriteQuestionIds(bankId: string): Promise<string[]> {
  const favs = await db.favorites.where('bankId').equals(bankId).toArray();
  return favs.map(f => f.questionId);
}

export async function toggleFavorite(bankId: string, questionId: string): Promise<boolean> {
  const existing = await db.favorites.where('[bankId+questionId]').equals([bankId, questionId]).first();
  if (existing) {
    await db.favorites.delete(existing.id!);
    return false;
  }
  await db.favorites.add({ bankId, questionId, timestamp: Date.now() });
  return true;
}
