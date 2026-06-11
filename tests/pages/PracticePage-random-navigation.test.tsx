/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PracticePage from '../../src/pages/PracticePage';
import { db } from '../../src/db';
import type { Question, PracticeRecord } from '../../src/types';

beforeEach(async () => {
  localStorage.clear();
  await db.records.clear();
  await db.questions.clear();
  await db.banks.clear();
  await db.favorites.clear();
  await db.aiExplanations.clear();
});

afterEach(() => {
  cleanup();
});

async function seedBank(id = 'b1', questionCount = 5) {
  await db.banks.add({
    id,
    name: '测试题库',
    createdAt: 1000,
    updatedAt: 1000,
    questionCount,
  });
}

async function seedQuestions(bankId: string, count: number) {
  const qs: Question[] = Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    bankId,
    type: 'single' as const,
    question: `题目 ${i}`,
    options: { A: '选项A', B: '选项B' },
    answer: ['A'],
  }));
  await db.questions.bulkAdd(qs);
  return qs;
}

async function seedRecords(bankId: string, records: Array<{ questionId: string; status: PracticeRecord['status']; timestamp: number }>) {
  await db.records.bulkAdd(records.map(r => ({
    bankId,
    questionId: r.questionId,
    userAnswer: ['A'],
    status: r.status,
    timestamp: r.timestamp,
  })));
}

function renderPracticePage(bankId: string, mode: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params).toString();
  const path = `/practice/${bankId}/${mode}${search ? `?${search}` : ''}`;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/practice/:bankId/:mode" element={<PracticePage />} />
        <Route path="*" element={<div data-testid="fallback" />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Select option A and submit the answer */
async function answerCorrectly() {
  await userEvent.click(await screen.findByText('选项A'));
  await userEvent.click(await screen.findByText('提交答案'));
}

describe('random mode navigation', () => {
  it('prev button goes to previously answered questions', async () => {
    await seedBank('b1', 5);
    await seedQuestions('b1', 5);

    renderPracticePage('b1', 'random', { randomCount: '3' });

    // Should start at a question
    await screen.findByText(/题目/);

    // Answer current question correctly and submit
    await answerCorrectly();

    // Wait for auto-advance to next question
    await waitFor(() => {
      expect(screen.getByText('上一题')).not.toBeDisabled();
    }, { timeout: 2000 });

    // Move to next unanswered question
    await userEvent.click(screen.getByRole('button', { name: /下一题/ }));
    await screen.findByText(/题目/);

    // Now go back — prev button should work (goes to previously answered question)
    const prevBtn = screen.getByRole('button', { name: /上一题/ });
    expect(prevBtn).not.toBeDisabled();
    await userEvent.click(prevBtn);

    // Should be back at a question we already answered
    await screen.findByText(/题目/);
  });

  it('shows empty state when all sampled questions are already answered', async () => {
    await seedBank('b1', 2);
    await seedQuestions('b1', 2);
    // Both already answered
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'correct', timestamp: 2 },
    ]);

    renderPracticePage('b1', 'random', { randomCount: '2' });

    // All sampled questions already answered — should show empty state
    await screen.findByText('没有未做题了');
  });

  it('finish screen appears when all sampled questions are answered in random mode', async () => {
    await seedBank('b1', 2);
    await seedQuestions('b1', 2);
    // No prior records — both are unanswered
    renderPracticePage('b1', 'random', { randomCount: '2' });

    await screen.findByText(/题目/);

    // Answer first question correctly and submit
    await answerCorrectly();

    // Wait for auto-advance to next question
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一题/ })).not.toBeDisabled();
    }, { timeout: 2000 });

    // Click next to go to question 2
    await userEvent.click(screen.getByRole('button', { name: /下一题/ }));
    await screen.findByText(/题目/);

    // Answer second question correctly and submit
    await answerCorrectly();

    // After auto-advance completes, should show finish screen
    await waitFor(() => {
      expect(screen.getByText(/练习完成/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('prev button is enabled when not on first question in random mode', async () => {
    await seedBank('b1', 4);
    await seedQuestions('b1', 4);

    renderPracticePage('b1', 'random', { randomCount: '4' });

    await screen.findByText(/题目/);

    // Answer first question correctly and submit
    await answerCorrectly();

    // Wait for auto-advance
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一题/ })).not.toBeDisabled();
    }, { timeout: 2000 });

    // Move to next question
    await userEvent.click(screen.getByRole('button', { name: /下一题/ }));
    await screen.findByText(/题目/);

    // Prev button should be enabled (we can go back to previously answered question)
    const prevBtn = screen.getByRole('button', { name: /上一题/ });
    expect(prevBtn).not.toBeDisabled();
  });
});
