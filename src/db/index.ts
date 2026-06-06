import Dexie, { type EntityTable } from 'dexie';
import type { QuestionBank, Question, PracticeRecord, Favorite } from '../types';

const db = new Dexie('ShuaTiDB') as Dexie & {
  banks: EntityTable<QuestionBank, 'id'>;
  questions: EntityTable<Question, 'id'>;
  records: EntityTable<PracticeRecord, 'id'>;
  favorites: EntityTable<Favorite, 'id'>;
  aiExplanations: EntityTable<{ id?: number; questionId: string; explanation: string; createdAt: number }, 'id'>;
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
  // No data migration needed for new table
  void tx;
});

export { db };
