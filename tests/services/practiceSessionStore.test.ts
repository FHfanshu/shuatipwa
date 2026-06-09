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
    expect(global?.typeFilter).toBeNull();
    expect(scoped?.id).toBe('b1:sequential:all');
    expect(scoped?.typeFilter).toBeNull();
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

  it('keeps type-filtered sessions isolated from unfiltered sessions', async () => {
    await saveLastPracticeSession({
      bankId: 'b1',
      mode: 'sequential',
      typeFilter: 'single',
      currentIndex: 2,
      questionIds: ['single-1'],
      updatedAt: 1000,
    });
    await saveLastPracticeSession({
      bankId: 'b1',
      mode: 'sequential',
      typeFilter: null,
      currentIndex: 5,
      questionIds: ['all-1'],
      updatedAt: 2000,
    });

    const single = await loadLastPracticeSession('b1', 'sequential', 'single');
    const unfiltered = await loadLastPracticeSession('b1', 'sequential', null);
    const multiple = await loadLastPracticeSession('b1', 'sequential', 'multiple');

    expect(single?.id).toBe('b1:sequential:single');
    expect(single?.currentIndex).toBe(2);
    expect(single?.questionIds).toEqual(['single-1']);
    expect(unfiltered?.id).toBe('b1:sequential:all');
    expect(unfiltered?.currentIndex).toBe(5);
    expect(unfiltered?.questionIds).toEqual(['all-1']);
    expect(multiple).toBeNull();
  });

  it('falls back to legacy scoped sessions only for unfiltered practice', async () => {
    await db.practiceSessions.put({
      id: 'b1:random',
      bankId: 'b1',
      mode: 'random',
      currentIndex: 1,
      questionIds: ['q1'],
      updatedAt: 1000,
    });

    expect((await loadLastPracticeSession('b1', 'random'))?.id).toBe('b1:random');
    expect(await loadLastPracticeSession('b1', 'random', 'single')).toBeNull();
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
