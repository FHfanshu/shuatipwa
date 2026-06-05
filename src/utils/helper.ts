import type { Question, QuestionType, AnswerStatus, PracticeRecord } from '../types';

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
    single: 'bg-accent/10 text-accent',
    multiple: 'bg-accent/10 text-accent',
    judge: 'bg-bg-secondary text-text-secondary',
    blank: 'bg-bg-secondary text-text-secondary',
    short: 'bg-bg-secondary text-text-secondary',
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

/**
 * 错题本以每道题最新一次有效作答为准。
 */
export function getCurrentWrongQuestionIds(records: PracticeRecord[]): string[] {
  const latestStatus = new Map<string, AnswerStatus>();
  const ordered = [...records].sort((a, b) =>
    a.timestamp - b.timestamp || (a.id ?? 0) - (b.id ?? 0)
  );

  for (const record of ordered) {
    if (record.status === 'correct' || record.status === 'wrong') {
      latestStatus.set(record.questionId, record.status);
    }
  }

  return [...latestStatus.entries()]
    .filter(([, status]) => status === 'wrong')
    .map(([questionId]) => questionId);
}
