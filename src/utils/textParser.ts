/**
 * 纯文本题库解析器
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

interface ParsedQuestion {
  question: string;
  options?: Record<string, string>;
  answer: string[];
  explanation?: string;
  type?: QuestionType;
}

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
    const isNewQuestion = /^(?:第\s*)?\d+[.、．\)）]/.test(line);

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
  const questionText = questionPart.replace(/^(?:第\s*)?\d+[.、．\)）]\s*/, '').trim();
  if (!questionText) return null;

  const options: Record<string, string> = {};
  let answerLine = '';
  let explanationLine = '';

  // 从 tab 后面提取答案
  if (answerPart) {
    const ansMatch = answerPart.match(/(?:\(?正确\)?答案|答案|answer|答)\s*[：:]\s*(.+)/i);
    if (ansMatch) answerLine = ansMatch[1].trim();
  }

  // 解析后续行
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

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

  const cleaned = raw.trim();

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
  // 去掉末尾空括号
  text = text.replace(/[（(]\s*[）)]\s*[。.]?\s*$/, '');
  // 去掉中间空括号
  text = text.replace(/[（(]\s*[）)]/, '');
  // 去掉末尾残留半括号
  text = text.replace(/[（(]\s*$/, '');
  // 去掉末尾标点
  text = text.replace(/[。.，,]+$/, '');
  // HTML 实体
  text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text.trim();
}

// ============ 推断题型 ============

export function inferQuestionType(q: ParsedQuestion): QuestionType {
  if (q.answer.length === 1 && (q.answer[0] === 'true' || q.answer[0] === 'false')) {
    return 'judge';
  }
  if (q.options) {
    return q.answer.length > 1 ? 'multiple' : 'single';
  }
  if (q.question.includes('____') || q.question.includes('（  ）') || q.question.includes('（）')) {
    return 'blank';
  }
  return 'short';
}
