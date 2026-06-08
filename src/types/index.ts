// ============ 题目类型 ============

export type QuestionType = 'single' | 'multiple' | 'judge' | 'blank' | 'short';

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  question: string;
  options?: Record<string, string>; // { A: "xxx", B: "yyy" }
  answer: string[];                 // ["B"] or ["A","C"] or ["true"] or ["blank1","blank2"]
  explanation?: string;
  tags?: string[];
  contentHash?: string;
  answerHash?: string;
}

// ============ 题库 ============

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  questionCount: number;
}

// ============ 做题记录 ============

export type AnswerStatus = 'correct' | 'wrong' | 'unanswered';

export interface PracticeRecord {
  id?: number;
  bankId: string;
  questionId: string;
  userAnswer: string[];
  status: AnswerStatus;
  timestamp: number;
}

// ============ 收藏 ============

export interface Favorite {
  id?: number;
  bankId: string;
  questionId: string;
  timestamp: number;
}

// ============ 导入导出 ============

export interface ExportData {
  version: 1;
  exportedAt: number;
  banks: QuestionBank[];
  questions: Record<string, Question[]>; // bankId -> questions
  records: PracticeRecord[];
  favorites: Favorite[];
}

export interface AIExplanation {
  id?: number;
  bankId: string;
  questionId: string;
  explanation: string;
  model?: string;
  createdAt: number;
}

export interface PracticeSessionRecord {
  id: string; // 'last' 或 '${bankId}:${mode}'
  bankId: string;
  mode: PracticeMode;
  currentIndex: number;
  questionIds: string[];
  updatedAt: number;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface ExportDataV2 {
  version: 2;
  exportedAt: number;
  banks: QuestionBank[];
  questions: Record<string, Question[]>;
  records: PracticeRecord[];
  favorites: Favorite[];
  aiExplanations?: AIExplanation[];
  settings?: AppSetting[];
}

// ============ 练习模式 ============

export type PracticeMode = 'sequential' | 'random' | 'wrong' | 'favorite' | 'exam';

export interface PracticeConfig {
  bankId: string;
  mode: PracticeMode;
  questionCount?: number; // 考试模式下的题目数量
}
