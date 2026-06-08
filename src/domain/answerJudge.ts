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
  if (!userAnswer || userAnswer.length === 0) return 'unanswered';

  const correct = question.answer.map(a => a.toLowerCase()).sort();
  const user = userAnswer.map(a => a.toLowerCase()).sort();

  if (correct.length !== user.length) return 'wrong';
  for (let i = 0; i < correct.length; i++) {
    if (correct[i] !== user[i]) return 'wrong';
  }
  return 'correct';
}
