import Dexie, { type EntityTable } from 'dexie';
import type { QuestionBank, Question, PracticeRecord, Favorite, AIExplanation, PracticeSessionRecord, AppSetting } from '../types';
import { attachQuestionHashes } from '../domain/questionFingerprint';

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
  // Backfill contentHash/answerHash for existing questions
  const table = tx.table('questions');
  const questions = await table.toArray();
  const missing = questions.filter(q => !q.contentHash);
  if (missing.length === 0) return;
  const withHashes = await attachQuestionHashes(missing);
  await table.bulkPut(withHashes);
});

db.version(4).stores({
  aiExplanations: '++id, bankId, questionId, createdAt, [bankId+questionId]',
  practiceSessions: 'id, bankId, mode, updatedAt',
  settings: 'key, updatedAt',
}).upgrade(async tx => {
  // Backfill bankId for existing aiExplanations from questions table
  const expTable = tx.table('aiExplanations');
  const qTable = tx.table('questions');
  const explanations = await expTable.toArray();
  const missing = explanations.filter(e => !e.bankId);
  if (missing.length === 0) return;
  const questions = await qTable.toArray();
  const qMap = new Map<string, string>(questions.map(q => [q.id, q.bankId]));
  const updated = missing.map(e => ({ ...e, bankId: qMap.get(e.questionId) ?? '' }));
  await expTable.bulkPut(updated);
});

export { db };
