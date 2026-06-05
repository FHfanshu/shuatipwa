import Dexie, { type EntityTable } from 'dexie';
import type { QuestionBank, Question, PracticeRecord, Favorite } from '../types';

const db = new Dexie('ShuaTiDB') as Dexie & {
  banks: EntityTable<QuestionBank, 'id'>;
  questions: EntityTable<Question, 'id'>;
  records: EntityTable<PracticeRecord, 'id'>;
  favorites: EntityTable<Favorite, 'id'>;
};

db.version(1).stores({
  banks: 'id, name, createdAt, updatedAt',
  questions: 'id, bankId, type',
  records: '++id, bankId, questionId, status, timestamp, [bankId+questionId]',
  favorites: '++id, bankId, questionId, timestamp, [bankId+questionId]',
});

export { db };
