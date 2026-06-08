import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedExplanation, cacheExplanation } from '../../src/repositories/aiExplanationRepo';
import { db } from '../../src/db';

beforeEach(async () => {
  await db.aiExplanations.clear();
});

describe('aiExplanationRepo', () => {
  describe('getCachedExplanation', () => {
    it('returns undefined when no cache exists', async () => {
      const result = await getCachedExplanation('q1');
      expect(result).toBeUndefined();
    });

    it('returns cached explanation', async () => {
      await cacheExplanation('q1', 'This is the explanation');
      const result = await getCachedExplanation('q1');
      expect(result).toBeDefined();
      expect(result!.explanation).toBe('This is the explanation');
    });
  });

  describe('cacheExplanation', () => {
    it('stores and returns id', async () => {
      const id = await cacheExplanation('q1', 'Explanation text');
      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);
    });

    it('replaces old cache when existingCacheId is provided', async () => {
      const id1 = await cacheExplanation('q1', 'Old explanation');
      const id2 = await cacheExplanation('q1', 'New explanation', id1);
      expect(id2).not.toBe(id1);

      const cached = await getCachedExplanation('q1');
      expect(cached!.explanation).toBe('New explanation');
      expect(cached!.id).toBe(id2);
    });
  });
});
