/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionCard from '../../src/components/QuestionCard';
import { db } from '../../src/db';
import type { Question } from '../../src/types';

vi.mock('../../src/services/aiService', () => ({
  loadCachedExplanation: vi.fn(),
  generateExplanation: vi.fn(),
  generateGuidance: vi.fn(),
}));

beforeEach(async () => {
  localStorage.clear();
  await db.records.clear();
  await db.favorites.clear();
  await db.aiExplanations.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuestionCard', () => {
  it('saves a choice answer and reports the result after submit', async () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        question={singleQuestion()}
        bankId="b1"
        index={0}
        total={1}
        onAnswer={onAnswer}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'B. Beta' }));
    await userEvent.click(screen.getByRole('button', { name: '提交答案' }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('correct'));
    const records = await db.records.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      bankId: 'b1',
      questionId: 'q1',
      userAnswer: ['B'],
      status: 'correct',
    }));
    expect(screen.getByText('正确')).toBeInTheDocument();
  });

  it('does not save self-graded answers until the user grades them', async () => {
    const onAnswer = vi.fn();
    render(
      <QuestionCard
        question={blankQuestion()}
        bankId="b1"
        index={0}
        total={1}
        onAnswer={onAnswer}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('请输入答案...'), '数据库');
    await userEvent.click(screen.getByRole('button', { name: '提交答案' }));

    expect(await db.records.count()).toBe(0);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByText('参考答案：')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /我答错了/ }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('wrong'));
    const records = await db.records.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      questionId: 'q-blank',
      userAnswer: ['数据库'],
      status: 'wrong',
    }));
  });

  it('updates the existing record when continuing from saved state', async () => {
    const existingId = await db.records.add({
      bankId: 'b1',
      questionId: 'q1',
      userAnswer: ['A'],
      status: 'wrong',
      timestamp: 1,
    });
    const onAnswer = vi.fn();

    render(
      <QuestionCard
        question={singleQuestion()}
        bankId="b1"
        index={0}
        total={1}
        savedState={{
          userAnswer: ['B'],
          blankInput: '',
          submitted: false,
          status: 'unanswered',
          recordId: existingId as number,
        }}
        onAnswer={onAnswer}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '提交答案' }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('correct'));
    const records = await db.records.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      id: existingId,
      userAnswer: ['B'],
      status: 'correct',
    }));
  });
});

function singleQuestion(): Question {
  return {
    id: 'q1',
    bankId: 'b1',
    type: 'single',
    question: 'Pick beta',
    options: { A: 'Alpha', B: 'Beta' },
    answer: ['B'],
  };
}

function blankQuestion(): Question {
  return {
    id: 'q-blank',
    bankId: 'b1',
    type: 'blank',
    question: '数据库英文缩写是什么？',
    answer: ['DB'],
  };
}
