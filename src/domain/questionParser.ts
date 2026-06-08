/**
 * 纯文本题库解析器（Domain 层 — 纯函数，无副作用）
 * 支持从 docx/txt/md 提取的纯文本中解析题目
 *
 * 支持格式:
 * 1、题目内容（ ）。正确答案：A
 * A、 选项A
 * B、 选项B
 * ...
 *
 * 1、题目内容。答案：B A、选项A B、选项B ...
 */

import type { QuestionType } from '../types';

export interface ParsedQuestion {
  question: string;
  options?: Record<string, string>;
  answer: string[];
  explanation?: string;
  type?: QuestionType;
}

const questionNumberPattern = /^(?:第\s*)?\d+\s*(?:[.、．)）]|题)\s*/;
const answerPattern = /(?:\(?正确\)?答案|答案|answer|答)\s*[：:]\s*(.*?)(?=\s+[A-Za-z][.、．:：]\s|\s*(?:解析|解释|说明|分析)\s*[：:]|$)/i;
const explanationPattern = /(?:解析|解释|说明|分析)\s*[：:]\s*(.*)$/i;

// ============ 主入口 ============

export function parseTextToQuestions(text: string): ParsedQuestion[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 按题号分组
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    // 跳过章节标题（如 "一、 单项选择题"）
    if (/^[一二三四五六七八九十]+[、.．]\s*$/.test(line)) continue;

    // 检测新题号
    const isNewQuestion = questionNumberPattern.test(line);

    if (isNewQuestion && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [line];
    } else if (isNewQuestion) {
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  // 解析每个 block
  const questions: ParsedQuestion[] = [];
  for (const block of blocks) {
    const q = parseBlock(block);
    if (q && q.question.length >= 4 && q.answer.length > 0 && q.answer[0] !== '') {
      questions.push(q);
    }
  }

  return questions;
}

// ============ 解析单个题目块 ============

function parseBlock(lines: string[]): ParsedQuestion | null {
  if (!lines.length) return null;

  const firstLine = lines[0];

  // 拆分 tab（题干和答案可能在同一行，tab 分隔）
  const parts = firstLine.split('\t');
  const questionPart = parts[0].trim();
  const answerPart = parts.length > 1 ? parts[1].trim() : '';

  // 去掉题号
  let questionText = questionPart.replace(questionNumberPattern, '').trim();

  const options: Record<string, string> = {};
  let answerLine = '';
  let explanationLine = '';

  // 从 tab 后面提取答案
  if (answerPart) {
    const ansMatch = answerPart.match(/(?:\(?正确\)?答案|答案|answer|答)\s*[：:]\s*(.+)/i);
    if (ansMatch) answerLine = ansMatch[1].trim();
  }

  const inlineAnswer = extractAnswer(questionText);
  if (!answerLine && inlineAnswer.answer) answerLine = inlineAnswer.answer;
  questionText = inlineAnswer.text;

  const inlineExplanation = extractExplanation(questionText);
  if (inlineExplanation.explanation) explanationLine = inlineExplanation.explanation;
  questionText = inlineExplanation.text;

  const inlineOptions = extractInlineOptions(questionText);
  Object.assign(options, inlineOptions.options);
  questionText = inlineOptions.text;

  if (!questionText) return null;

  // 解析后续行
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];

    const lineAnswer = extractAnswer(line);
    if (!answerLine && lineAnswer.answer) answerLine = lineAnswer.answer;
    line = lineAnswer.text;

    const lineExplanation = extractExplanation(line);
    if (lineExplanation.explanation) explanationLine = lineExplanation.explanation;
    line = lineExplanation.text;

    const lineOptions = extractInlineOptions(line);
    if (Object.keys(lineOptions.options).length > 0) {
      Object.assign(options, lineOptions.options);
      continue;
    }

    // 选项行
    const optMatch = line.match(/^([A-Za-z])[.、．:：]\s*(.*)/);
    if (optMatch) {
      options[optMatch[1].toUpperCase()] = optMatch[2].trim();
      continue;
    }

    // 答案行（独立行）
    if (!answerLine) {
      const ansMatch = line.match(/(?:\(?正确\)?答案|答案|answer|答)\s*[：:]\s*(.+)/i);
      if (ansMatch) {
        answerLine = ansMatch[1].trim();
        continue;
      }
    }

    // 解析行
    const expMatch = line.match(/^(解析|解释|说明|分析)\s*[：:]\s*(.*)/);
    if (expMatch) {
      explanationLine = expMatch[2].trim();
      continue;
    }
  }

  const answer = parseAnswer(answerLine);
  const cleaned = cleanQuestion(questionText);

  const result: ParsedQuestion = {
    question: cleaned,
    answer: answer.length > 0 ? answer : [''],
  };
  if (Object.keys(options).length > 0) result.options = options;
  if (explanationLine) result.explanation = explanationLine;

  return result;
}

// ============ 解析答案 ============

function parseAnswer(raw: string): string[] {
  if (!raw) return [];

  const cleaned = raw.trim().replace(/[。.;；]+$/g, '').trim();

  // 判断题
  if (/^(对|正确|√|T|true|是)$/i.test(cleaned)) return ['true'];
  if (/^(错|不正确|错误|×|F|false|否)$/i.test(cleaned)) return ['false'];

  // 连续字母（如 "ABCD"）
  if (/^[A-Z]{2,}$/.test(cleaned)) {
    return cleaned.split('').sort();
  }

  // 分隔符分隔
  const parts = cleaned.split(/[、，,\s]+/);
  const letters = parts
    .map(p => p.trim().toUpperCase())
    .filter(p => /^[A-Z]$/.test(p));

  if (letters.length > 0) {
    return [...new Set(letters)].sort();
  }

  return [cleaned];
}

// ============ 清理题干 ============

function cleanQuestion(text: string): string {
  // 空括号规范化为填空占位 ____，而非删除
  text = text.replace(/[（(]\s*[）)]/g, '____');
  // 连续下划线规范化
  text = text.replace(/_{3,}/g, '____');
  // 去掉末尾残留半括号
  text = text.replace(/[（(]\s*$/, '');
  // 去掉末尾标点
  text = text.replace(/[。.，,]+$/, '');
  // HTML 实体
  text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text.trim();
}

function extractAnswer(text: string): { text: string; answer: string } {
  const match = text.match(answerPattern);
  if (!match) return { text, answer: '' };
  return {
    text: text.replace(answerPattern, '').trim(),
    answer: match[1].replace(/[。.;；]+$/g, '').trim(),
  };
}

function extractExplanation(text: string): { text: string; explanation: string } {
  const match = text.match(explanationPattern);
  if (!match) return { text, explanation: '' };
  return {
    text: text.replace(explanationPattern, '').trim(),
    explanation: match[1].trim(),
  };
}

function extractInlineOptions(text: string): { text: string; options: Record<string, string> } {
  const options: Record<string, string> = {};
  const optionPattern = /(^|\s)([A-Za-z])[.、．:：]\s*(.*?)(?=\s+[A-Za-z][.、．:：]\s|\s*(?:\(?正确\)?答案|答案|answer|答|解析|解释|说明|分析)\s*[：:]|$)/g;
  const cleaned = text.replace(optionPattern, (match, leading: string, key: string, value: string) => {
    const optionText = value.trim();
    if (!optionText) return match;
    options[key.toUpperCase()] = optionText;
    return leading ? ' ' : '';
  });

  return {
    text: cleaned.trim(),
    options,
  };
}

// ============ 推断题型 ============

export function inferQuestionType(q: ParsedQuestion): QuestionType;
export function inferQuestionType(answer: string[], options?: Record<string, string>, question?: string): QuestionType;
export function inferQuestionType(
  qOrAnswer: ParsedQuestion | string[],
  options?: Record<string, string>,
  question = ''
): QuestionType {
  // 重载 1：ParsedQuestion
  if (!Array.isArray(qOrAnswer)) {
    const q = qOrAnswer;
    if (q.answer.length === 1 && (q.answer[0] === 'true' || q.answer[0] === 'false')) return 'judge';
    if (q.options) return q.answer.length > 1 ? 'multiple' : 'single';
    if (q.question.includes('____') || q.question.includes('（  ）') || q.question.includes('（）')) return 'blank';
    return 'short';
  }

  // 重载 2：(answer[], options?, question?)
  const answer = qOrAnswer;
  if (answer.length === 1 && (answer[0] === 'true' || answer[0] === 'false')) return 'judge';
  if (options && Object.keys(options).length > 0) return answer.length > 1 ? 'multiple' : 'single';
  if (question.includes('____') || question.includes('（  ）') || question.includes('（）')) return 'blank';
  return 'short';
}
