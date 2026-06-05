import { read, utils } from 'xlsx';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Question, QuestionBank, QuestionType } from '../types';
import { parseTextToQuestions, inferQuestionType } from './textParser';

// ============ JSON 导入 ============

interface RawQuestion {
  id?: string;
  type?: string;
  question: string;
  options?: Record<string, string> | string[];
  answer: string | string[];
  explanation?: string;
  tags?: string[];
}

function normalizeQuestion(raw: RawQuestion, bankId: string): Question {
  let type: QuestionType = (raw.type as QuestionType) || 'single';

  // 规范化 answer 为数组
  let answer: string[];
  if (Array.isArray(raw.answer)) {
    answer = raw.answer;
  } else {
    answer = [raw.answer];
  }

  // 规范化 options
  let options: Record<string, string> | undefined;
  if (raw.options) {
    if (Array.isArray(raw.options)) {
      // ["A. xxx", "B. yyy"] 或 ["xxx", "yyy"]
      options = {};
      raw.options.forEach((opt, i) => {
        const match = opt.match(/^([A-Za-z])[.、．:：\s]\s*(.*)/);
        if (match) {
          options![match[1].toUpperCase()] = match[2];
        } else {
          options![String.fromCharCode(65 + i)] = opt;
        }
      });
    } else {
      options = raw.options;
    }
  }

  return {
    id: raw.id || uuidv4(),
    bankId,
    type,
    question: raw.question,
    options,
    answer,
    explanation: raw.explanation,
    tags: raw.tags || [],
  };
}

// ============ 文本解析（支持老师发的格式） ============

function parseTextQuestions(text: string): RawQuestion[] {
  const questions: RawQuestion[] = [];

  // 尝试按题号分割: "1." "1、" "1)" "第1题" 等
  const blocks = text.split(/\n\s*(?=\d+[.、．)）]\s)/).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // 提取题干（第一行去掉题号）
    const firstLine = lines[0].replace(/^\d+[.、．)）]\s*/, '');
    const question = firstLine;

    // 提取选项
    const options: Record<string, string> = {};
    const optionLines: string[] = [];
    let answerLine = '';
    let explanationLine = '';
    let otherLines: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const optMatch = line.match(/^([A-Za-z])[.、．:：\s]\s*(.*)/);
      const ansMatch = line.match(/^(答案|正确答案)[：:]\s*(.*)/);
      const expMatch = line.match(/^(解析|解释|分析)[：:]\s*(.*)/);

      if (optMatch) {
        options[optMatch[1].toUpperCase()] = optMatch[2];
        optionLines.push(line);
      } else if (ansMatch) {
        answerLine = ansMatch[2];
      } else if (expMatch) {
        explanationLine = expMatch[2];
      } else {
        otherLines.push(line);
      }
    }

    // 解析答案
    let answer: string[] = [];
    if (answerLine) {
      // "B" "A,C" "AC" "A、C" "对" "错" "正确" "错误"
      const cleaned = answerLine.replace(/[、，\s]/g, '');
      if (/^(对|正确|√|T|true|是)$/i.test(cleaned)) {
        answer = ['true'];
      } else if (/^(错|不正确|错误|×|F|false|否)$/i.test(cleaned)) {
        answer = ['false'];
      } else {
        answer = cleaned.split('').filter(c => /[A-Za-z]/.test(c)).map(c => c.toUpperCase());
      }
    }

    // 判断题型
    let type: QuestionType = 'single';
    if (answer.length === 1 && (answer[0] === 'true' || answer[0] === 'false')) {
      type = 'judge';
    } else if (answer.length > 1) {
      type = 'multiple';
    } else if (Object.keys(options).length === 0) {
      // 没有选项，可能是填空或简答
      type = answer.length > 0 ? 'blank' : 'short';
    }

    if (question) {
      const raw: RawQuestion = {
        question,
        answer: answer.length > 0 ? answer : [''],
        explanation: explanationLine || otherLines.join('\n') || undefined,
        type,
      };
      if (Object.keys(options).length > 0) {
        raw.options = options;
      }
      questions.push(raw);
    }
  }

  return questions;
}

// ============ CSV 导入 ============

function parseCSV(text: string): RawQuestion[] {
  // 简单 CSV: question, A, B, C, D, answer, explanation
  const lines = text.trim().split('\n');
  const questions: RawQuestion[] = [];

  // 检查是否有表头
  const firstLine = lines[0].toLowerCase();
  const startIndex = (firstLine.includes('question') || firstLine.includes('题目') || firstLine.includes('题干')) ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const question = cols[0];
    const options: Record<string, string> = {};
    let answerIdx = cols.length - 2;
    let explanationIdx = cols.length - 1;

    // 检测选项列
    for (let j = 1; j < cols.length; j++) {
      if (cols[j] && j < answerIdx) {
        options[String.fromCharCode(64 + j)] = cols[j];
      }
    }

    const answerStr = cols[answerIdx] || '';
    const explanation = cols[explanationIdx] || '';

    let answer: string[];
    const cleaned = answerStr.replace(/[、，\s]/g, '');
    if (/^(对|正确|√|T|true)$/i.test(cleaned)) {
      answer = ['true'];
    } else if (/^(错|错误|×|F|false)$/i.test(cleaned)) {
      answer = ['false'];
    } else {
      answer = cleaned.split('').filter(c => /[A-Za-z]/.test(c)).map(c => c.toUpperCase());
    }

    questions.push({
      question,
      options: Object.keys(options).length > 0 ? options : undefined,
      answer: answer.length > 0 ? answer : [''],
      explanation: explanation || undefined,
    });
  }

  return questions;
}

// ============ Excel 导入 ============

function parseExcel(buffer: ArrayBuffer): RawQuestion[] {
  const workbook = read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (data.length < 2) return [];

  // 将表格转为 CSV 格式再解析
  const csvLines = data.map(row => row.map(cell => `"${String(cell || '')}"`).join(','));
  return parseCSV(csvLines.join('\n'));
}

// ============ 主导入函数 ============

export async function importFromFile(
  file: File,
  bankName?: string
): Promise<{ bank: QuestionBank; count: number }> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase();

  let rawQuestions: RawQuestion[] = [];

  if (ext === 'json') {
    const text = await file.text();
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
      rawQuestions = data;
    } else if (data.questions && Array.isArray(data.questions)) {
      // { name: "...", questions: [...] }
      rawQuestions = data.questions;
      if (!bankName && data.name) bankName = data.name;
    } else {
      throw new Error('JSON 格式不正确，需要是数组或包含 questions 字段的对象');
    }

    if (!bankName) bankName = fileName.replace(/\.json$/i, '');
  } else if (ext === 'csv') {
    const text = await file.text();
    rawQuestions = parseCSV(text);
    if (!bankName) bankName = fileName.replace(/\.csv$/i, '');
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    rawQuestions = parseExcel(buffer);
    if (!bankName) bankName = fileName.replace(/\.xlsx?$/i, '');
  } else if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const parsed = parseTextToQuestions(result.value);
    rawQuestions = parsed.map(q => ({
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      type: q.type || inferQuestionType(q),
    }));
    if (!bankName) bankName = fileName.replace(/\.docx$/i, '');
  } else if (ext === 'txt' || ext === 'md') {
    const text = await file.text();
    rawQuestions = parseTextQuestions(text);
    if (!bankName) bankName = fileName.replace(/\.(txt|md)$/i, '');
  } else {
    throw new Error(`不支持的文件格式: ${ext}。请使用 JSON、CSV、Excel、Word 或文本文件。`);
  }

  if (rawQuestions.length === 0) {
    throw new Error('未能从文件中解析出任何题目');
  }

  // 创建题库
  const bankId = uuidv4();
  const now = Date.now();
  const bank: QuestionBank = {
    id: bankId,
    name: bankName || '导入题库',
    createdAt: now,
    updatedAt: now,
    questionCount: rawQuestions.length,
  };

  // 标准化题目
  const questions = rawQuestions.map(raw => normalizeQuestion(raw, bankId));

  // 写入数据库
  await db.transaction('rw', [db.banks, db.questions], async () => {
    await db.banks.add(bank);
    await db.questions.bulkAdd(questions);
  });

  return { bank, count: questions.length };
}

// ============ 从 JSON 恢复全部数据 ============

export async function importFullBackup(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (data.version !== 1) {
    throw new Error('备份版本不支持');
  }

  await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites], async () => {
    await db.banks.clear();
    await db.questions.clear();
    await db.records.clear();
    await db.favorites.clear();

    if (data.banks) await db.banks.bulkAdd(data.banks);
    for (const [_bankId, questions] of Object.entries(data.questions || {})) {
      await db.questions.bulkAdd(questions as Question[]);
    }
    if (data.records) await db.records.bulkAdd(data.records);
    if (data.favorites) await db.favorites.bulkAdd(data.favorites);
  });
}
