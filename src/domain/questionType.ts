import type { QuestionType } from '../types';

/**
 * 根据题型返回中文标签
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
