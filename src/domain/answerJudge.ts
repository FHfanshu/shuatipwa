import type { Question, AnswerStatus } from '../types';

/**
 * 判分：比较用户答案和正确答案
 * - 大小写不敏感
 * - 多选顺序无关
 * - 空答案返回 unanswered
 */
export function checkAnswer(
  question: Question,
  userAnswer: string[]
): AnswerStatus {
  const normalizedUserAnswer = normalizeAnswers(userAnswer);
  if (normalizedUserAnswer.length === 0) return 'unanswered';

  const correct = normalizeAnswers(question.answer);
  const user = normalizedUserAnswer;

  if (correct.length !== user.length) return 'wrong';
  for (let i = 0; i < correct.length; i++) {
    if (correct[i] !== user[i]) return 'wrong';
  }
  return 'correct';
}

function normalizeAnswers(answers: unknown): string[] {
  if (!Array.isArray(answers)) return [];
  return answers
    .map(answer => String(answer).trim().toLowerCase())
    .filter(Boolean)
    .sort();
}
