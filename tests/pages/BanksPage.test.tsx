/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BanksPage from '../../src/pages/BanksPage';
import { db } from '../../src/db';
import type { PracticeRecord, Question, QuestionBank, QuestionType } from '../../src/types';

beforeEach(async () => {
  localStorage.clear();
  await db.records.clear();
  await db.questions.clear();
  await db.banks.clear();
});

afterEach(() => {
  cleanup();
});

describe('BanksPage practice mode sheet', () => {
  it('starts a limited random practice from unanswered questions', async () => {
    await seedBank({ id: 'b1', questionCount: 6 });
    await seedQuestions('b1', 6);
    await seedRecords('b1', [
      { questionId: 'q1', status: 'correct', timestamp: 1 },
      { questionId: 'q3', status: 'wrong', timestamp: 2 },
    ]);

    renderBanksPage();

    await userEvent.click(await screen.findByText('测试题库'));
    await userEvent.click(screen.getByRole('button', { name: /随机练习/ }));

    expect(await screen.findByText('全部题型 · 共 6 题，已练 2 题，未做 4 题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /完整随机练习/ })).toBeEnabled();

    const countInput = screen.getByLabelText('自定义随机题数');
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '2');
    await userEvent.click(screen.getByRole('button', { name: '开始' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/practice/b1/random?randomCount=2');
  });

  it('keeps the selected type filter when starting an exam count', async () => {
    await seedBank({ id: 'b1', questionCount: 25 });
    await seedQuestions('b1', 22, 'single');
    await seedQuestions('b1', 3, 'judge', 22);

    renderBanksPage();

    await userEvent.click(await screen.findByText('测试题库'));
    await userEvent.click(await screen.findByRole('button', { name: /单选题\s*22/ }));
    await userEvent.click(screen.getByRole('button', { name: /模拟考试/ }));

    expect(await screen.findByText('单选题 · 共 22 题，答完后显示成绩')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /20 题/ }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/practice/b1/exam?type=single&count=20');
  });

  it('blocks limited random starts when all questions are already answered', async () => {
    await seedBank({ id: 'b1', questionCount: 2 });
    await seedQuestions('b1', 2);
    await seedRecords('b1', [
      { questionId: 'q0', status: 'correct', timestamp: 1 },
      { questionId: 'q1', status: 'wrong', timestamp: 2 },
    ]);

    renderBanksPage();

    await userEvent.click(await screen.findByText('测试题库'));
    await userEvent.click(screen.getByRole('button', { name: /随机练习/ }));

    expect(await screen.findByText('全部题型 · 共 2 题，已练 2 题，未做 0 题')).toBeInTheDocument();
    expect(screen.getByText('这个范围内的题目都已经做过了，可以进入完整随机练习查看记录或从总览回顾。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /完整随机练习/ })).toBeEnabled();
    expect(screen.queryByLabelText('自定义随机题数')).not.toBeInTheDocument();
  });
});

function renderBanksPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BanksPage />} />
        <Route path="/practice/:bankId/:mode" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

async function seedBank(overrides: Partial<QuestionBank> = {}) {
  await db.banks.add({
    id: 'b1',
    name: '测试题库',
    createdAt: 1000,
    updatedAt: 1000,
    questionCount: 0,
    ...overrides,
  });
}

async function seedQuestions(bankId: string, count: number, type: QuestionType = 'single', offset = 0) {
  const questions: Question[] = Array.from({ length: count }, (_, index) => {
    const idNumber = index + offset;
    return {
      id: `q${idNumber}`,
      bankId,
      type,
      question: `Question ${idNumber}`,
      options: type === 'single' ? { A: 'A', B: 'B' } : undefined,
      answer: type === 'judge' ? ['true'] : ['A'],
    };
  });
  await db.questions.bulkAdd(questions);
}

async function seedRecords(
  bankId: string,
  records: Array<Pick<PracticeRecord, 'questionId' | 'status' | 'timestamp'>>
) {
  await db.records.bulkAdd(records.map(record => ({
    bankId,
    questionId: record.questionId,
    userAnswer: ['A'],
    status: record.status,
    timestamp: record.timestamp,
  })));
  await waitFor(async () => {
    await expect(db.records.where('bankId').equals(bankId).count()).resolves.toBe(records.length);
  });
}
