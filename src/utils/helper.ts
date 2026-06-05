import type { Question, QuestionType, AnswerStatus } from '../types';

/**
 * 判分：比较用户答案和正确答案
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

/**
 * 根据题型返回选项标签
 */
export function getQuestionTypeLabel(type: QuestionType): string {
  const labels: Record<QuestionType, string> = {
    single: '单选',
    multiple: '多选',
    judge: '判断',
    blank: '填空',
    short: '简答',
  };
  return labels[type];
}

/**
 * 根据题型返回选项标签颜色
 */
export function getQuestionTypeColor(type: QuestionType): string {
  const colors: Record<QuestionType, string> = {
    single: 'bg-blue-100 text-blue-700',
    multiple: 'bg-purple-100 text-purple-700',
    judge: 'bg-orange-100 text-orange-700',
    blank: 'bg-green-100 text-green-700',
    short: 'bg-gray-100 text-gray-700',
  };
  return colors[type];
}

/**
 * shuffle 数组（Fisher-Yates）
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
