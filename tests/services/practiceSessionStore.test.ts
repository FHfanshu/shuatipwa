// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db';
import { loadLastPracticeSession, saveLastPracticeSession } from '../../src/services/practiceSessionStore';

beforeEach(async () => {
  await db.practiceSessions.clear();
});

describe('practiceSessionStore', () => {
  it('saves a global last session and a scoped session', async () => {
    await saveLastPracticeSession({
      bankId: 'b1',
      mode: 'sequential',
      currentIndex: 3,
      questionIds: ['q1', 'q2'],
      updatedAt: 1000,
    });

    const global = await loadLastPracticeSession();
    const scoped = await loadLastPracticeSession('b1', 'sequential');

    expect(global?.id).toBe('last');
    expect(global?.currentIndex).toBe(3);
    expect(scoped?.id).toBe('b1:sequential');
    expect(scoped?.questionIds).toEqual(['q1', 'q2']);
  });

  it('keeps sessions isolated by bank and mode', async () => {
    await saveLastPracticeSession({
      bankId: 'b1',
      mode: 'sequential',
      currentIndex: 1,
      questionIds: ['q1'],
      updatedAt: 1000,
    });
    await saveLastPracticeSession({
      bankId: 'b2',
      mode: 'random',
      currentIndex: 4,
      questionIds: ['q5'],
      updatedAt: 2000,
    });

    expect((await loadLastPracticeSession('b1', 'sequential'))?.currentIndex).toBe(1);
    expect((await loadLastPracticeSession('b2', 'random'))?.currentIndex).toBe(4);
    expect((await loadLastPracticeSession())?.bankId).toBe('b2');
  });

  it('does not save exam sessions', async () => {
    await saveLastPracticeSession({
      bankId: 'b1',
      mode: 'exam',
      currentIndex: 1,
      questionIds: ['q1'],
      updatedAt: 1000,
    });

    expect(await loadLastPracticeSession()).toBeNull();
  });
});
