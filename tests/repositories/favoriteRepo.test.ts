import { describe, it, expect, beforeEach } from 'vitest';
import { isFavorited, toggleFavorite } from '../../src/repositories/favoriteRepo';
import { db } from '../../src/db';

beforeEach(async () => {
  await db.favorites.clear();
});

describe('favoriteRepo', () => {
  describe('isFavorited', () => {
    it('returns false when not favorited', async () => {
      expect(await isFavorited('b1', 'q1')).toBe(false);
    });

    it('returns true when favorited', async () => {
      await toggleFavorite('b1', 'q1');
      expect(await isFavorited('b1', 'q1')).toBe(true);
    });
  });

  describe('toggleFavorite', () => {
    it('adds favorite and returns true', async () => {
      const result = await toggleFavorite('b1', 'q1');
      expect(result).toBe(true);
      expect(await isFavorited('b1', 'q1')).toBe(true);
    });

    it('removes favorite and returns false', async () => {
      await toggleFavorite('b1', 'q1');
      const result = await toggleFavorite('b1', 'q1');
      expect(result).toBe(false);
      expect(await isFavorited('b1', 'q1')).toBe(false);
    });

    it('favorites are independent per bank+question', async () => {
      await toggleFavorite('b1', 'q1');
      await toggleFavorite('b2', 'q1');
      expect(await isFavorited('b1', 'q1')).toBe(true);
      expect(await isFavorited('b2', 'q1')).toBe(true);

      await toggleFavorite('b1', 'q1');
      expect(await isFavorited('b1', 'q1')).toBe(false);
      expect(await isFavorited('b2', 'q1')).toBe(true);
    });
  });
});
