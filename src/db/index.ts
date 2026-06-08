import Dexie, { type EntityTable } from 'dexie';
import type { QuestionBank, Question, PracticeRecord, Favorite, AIExplanation, PracticeSessionRecord, AppSetting } from '../types';

const db = new Dexie('ShuaTiDB') as Dexie & {
  banks: EntityTable<QuestionBank, 'id'>;
  questions: EntityTable<Question, 'id'>;
  records: EntityTable<PracticeRecord, 'id'>;
  favorites: EntityTable<Favorite, 'id'>;
  aiExplanations: EntityTable<AIExplanation, 'id'>;
  practiceSessions: EntityTable<PracticeSessionRecord, 'id'>;
  settings: EntityTable<AppSetting, 'key'>;
};

db.version(1).stores({
  banks: 'id, name, createdAt, updatedAt',
  questions: 'id, bankId, type',
  records: '++id, bankId, questionId, status, timestamp, [bankId+questionId]',
  favorites: '++id, bankId, questionId, timestamp, [bankId+questionId]',
});

db.version(2).stores({
  aiExplanations: '++id, questionId, createdAt',
}).upgrade(async tx => {
  void tx;
});

db.version(3).stores({
  questions: 'id, bankId, type, contentHash, [bankId+contentHash]',
}).upgrade(async tx => {
  void tx;
});

db.version(4).stores({
  aiExplanations: '++id, bankId, questionId, createdAt, [bankId+questionId]',
  practiceSessions: 'id, bankId, mode, updatedAt',
  settings: 'key, updatedAt',
}).upgrade(async tx => {
  // Migrate existing aiExplanations: backfill bankId from questions
  void tx;
});

export { db };
