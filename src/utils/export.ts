import { db } from '../db';
import type { ExportData } from '../types';
import { zipSync, strToU8 } from 'fflate';

export async function exportAllData(): Promise<string> {
  const banks = await db.banks.toArray();
  const allQuestions = await db.questions.toArray();
  const records = await db.records.toArray();
  const favorites = await db.favorites.toArray();

  // 按 bankId 分组题目
  const questionsByBank: Record<string, typeof allQuestions> = {};
  for (const q of allQuestions) {
    if (!questionsByBank[q.bankId]) questionsByBank[q.bankId] = [];
    questionsByBank[q.bankId].push(q);
  }

  const data: ExportData = {
    version: 1,
    exportedAt: Date.now(),
    banks,
    questions: questionsByBank,
    records,
    favorites,
  };

  return JSON.stringify(data);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAllAsZip(): Promise<Blob> {
  const json = await exportAllData();
  const compressed = zipSync({
    'backup.json': strToU8(json),
  }, { level: 9 });
  return new Blob([compressed], { type: 'application/zip' });
}

export async function exportBankQuestions(bankId: string): Promise<string> {
  const questions = await db.questions.where('bankId').equals(bankId).toArray();
  return JSON.stringify(questions, null, 2);
}
