import type { QuestionType } from '../types';
import { checkAnswer as _checkAnswer } from '../domain/answerJudge';
import { getCurrentWrongQuestionIds as _getCurrentWrongQuestionIds } from '../domain/wrongQuestion';

/**
 * 判分：比较用户答案和正确答案
 * @deprecated 从 domain/answerJudge 导入
 */
export const checkAnswer = _checkAnswer;

/**
 * 错题本以每道题最新一次有效作答为准。
 * @deprecated 从 domain/wrongQuestion 导入
 */
export const getCurrentWrongQuestionIds = _getCurrentWrongQuestionIds;

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
