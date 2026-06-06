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

const QUESTION_TYPES: QuestionType[] = ['single', 'multiple', 'judge', 'blank', 'short'];

function isQuestionType(type: string | undefined): type is QuestionType {
  return QUESTION_TYPES.includes(type as QuestionType);
}

function normalizeAnswerText(raw: string): string {
  return raw.trim().replace(/^(答案|正确答案|answer|答)\s*[：:]\s*/i, '').replace(/[。.;；]+$/g, '').trim();
}

function parseAnswerText(raw: string, hasOptions: boolean): string[] {
  const cleaned = normalizeAnswerText(raw);
  if (!cleaned) return [];

  if (/^(对|正确|√|T|true|是)$/i.test(cleaned)) return ['true'];
  if (/^(错|不正确|错误|×|F|false|否)$/i.test(cleaned)) return ['false'];

  if (!hasOptions) return [cleaned];

  const compact = cleaned.replace(/[、，,\s]/g, '');
  return compact.split('').filter(c => /[A-Za-z]/.test(c)).map(c => c.toUpperCase());
}

function inferRawQuestionType(answer: string[], options?: Record<string, string>, question = ''): QuestionType {
  if (answer.length === 1 && (answer[0] === 'true' || answer[0] === 'false')) return 'judge';
  if (options && Object.keys(options).length > 0) return answer.length > 1 ? 'multiple' : 'single';
  if (question.includes('____') || question.includes('（  ）') || question.includes('（）')) return 'blank';
  return 'short';
}

function normalizeQuestion(raw: RawQuestion, bankId: string): Question {
  // 规范化 answer 为数组
  let answer: string[];
  if (Array.isArray(raw.answer)) {
    answer = raw.answer.map(a => String(a).trim()).filter(Boolean);
  } else {
    answer = [String(raw.answer).trim()].filter(Boolean);
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
      options = Object.fromEntries(
        Object.entries(raw.options).map(([key, value]) => [key.toUpperCase(), value])
      );
    }
  }

  const type = isQuestionType(raw.type) ? raw.type : inferRawQuestionType(answer, options, raw.question);
  if (type === 'single' || type === 'multiple') {
    answer = answer.map(a => a.toUpperCase());
  } else if (type === 'judge') {
    answer = parseAnswerText(answer[0] || '', false);
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
    const otherLines: string[] = [];

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
      answer = parseAnswerText(answerLine, Object.keys(options).length > 0);
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

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

function parseRows(data: unknown[][]): RawQuestion[] {
  const questions: RawQuestion[] = [];
  const rows = data
    .map(row => row.map(cell => String(cell ?? '').trim()))
    .filter(row => row.some(cell => cell));

  if (rows.length === 0) return [];

  // 检查是否有表头
  const header = rows[0].map(cell => cell.toLowerCase());
  const hasHeader = header.some(cell =>
    cell.includes('question') || cell.includes('题目') || cell.includes('题干') ||
    cell.includes('answer') || cell.includes('答案')
  );
  const startIndex = hasHeader ? 1 : 0;

  const findHeaderIndex = (patterns: RegExp[]) =>
    hasHeader ? header.findIndex(cell => patterns.some(pattern => pattern.test(cell))) : -1;

  const questionIdx = Math.max(0, findHeaderIndex([/question/, /题目/, /题干/]));
  const answerHeaderIdx = findHeaderIndex([/answer/, /答案/]);
  const explanationHeaderIdx = findHeaderIndex([/explanation/, /解析/, /解释/, /分析/]);
  const typeHeaderIdx = findHeaderIndex([/^type$/, /题型/]);

  const optionHeaderMap = new Map<number, string>();
  if (hasHeader) {
    rows[0].forEach((cell, index) => {
      const normalized = cell.trim();
      const match = normalized.match(/^(?:选项)?([A-Za-z])$/);
      if (match) optionHeaderMap.set(index, match[1].toUpperCase());
    });
  }

  for (let i = startIndex; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length < 2) continue;

    const answerIdx = answerHeaderIdx >= 0 ? answerHeaderIdx : cols.length - 2;
    const explanationIdx = explanationHeaderIdx >= 0 ? explanationHeaderIdx : cols.length - 1;
    const question = cols[questionIdx] || '';
    if (!question) continue;

    const options: Record<string, string> = {};

    if (optionHeaderMap.size > 0) {
      for (const [index, key] of optionHeaderMap) {
        if (cols[index]) options[key] = cols[index];
      }
    } else {
      for (let j = 1; j < answerIdx; j++) {
        if (cols[j]) options[String.fromCharCode(64 + j)] = cols[j];
      }
    }

    const answerStr = cols[answerIdx] || '';
    const explanation = cols[explanationIdx] || '';
    const answer = parseAnswerText(answerStr, Object.keys(options).length > 0);
    const typeFromHeader = typeHeaderIdx >= 0 ? cols[typeHeaderIdx] : undefined;
    const type = isQuestionType(typeFromHeader)
      ? typeFromHeader
      : inferRawQuestionType(answer, Object.keys(options).length > 0 ? options : undefined, question);

    questions.push({
      question,
      options: Object.keys(options).length > 0 ? options : undefined,
      answer: answer.length > 0 ? answer : [''],
      explanation: explanation || undefined,
      type,
    });
  }

  return questions;
}

function parseCSV(text: string): RawQuestion[] {
  return parseRows(parseCSVRows(text));
}

// ============ Excel 导入 ============

function parseExcel(buffer: ArrayBuffer): RawQuestion[] {
  const workbook = read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  return parseRows(data);
}

// ============ 主导入函数 ============

export async function importFromFile(
  file: File,
  bankName?: string
): Promise<{ bank: QuestionBank; count: number }> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase();

  let rawQuestions: RawQuestion[];

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
    const parsed = parseTextToQuestions(text);
    rawQuestions = parsed.length > 0
      ? parsed.map(q => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        type: q.type || inferQuestionType(q),
      }))
      : parseTextQuestions(text);
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

// ============ 从 ZIP/JSON 恢复全部数据 ============

export async function importFullBackup(file: File): Promise<void> {
  let jsonText: string;

  if (file.name.endsWith('.zip')) {
    const { unzipSync, strFromU8 } = await import('fflate');
    const buf = await file.arrayBuffer();
    const files = unzipSync(new Uint8Array(buf));
    const backup = files['backup.json'];
    if (!backup) throw new Error('ZIP 中未找到 backup.json');
    jsonText = strFromU8(backup);
  } else {
    jsonText = await file.text();
  }

  const data = JSON.parse(jsonText);

  if (data.version !== 1) {
    throw new Error('备份版本不支持');
  }

  await db.transaction('rw', [db.banks, db.questions, db.records, db.favorites, db.aiExplanations], async () => {
    await db.banks.clear();
    await db.questions.clear();
    await db.records.clear();
    await db.favorites.clear();
    await db.aiExplanations.clear();

    if (data.banks) await db.banks.bulkAdd(data.banks);
    for (const questions of Object.values(data.questions || {})) {
      await db.questions.bulkAdd(questions as Question[]);
    }
    if (data.records) await db.records.bulkAdd(data.records);
    if (data.favorites) await db.favorites.bulkAdd(data.favorites);
  });
}
