import { db } from '../db';
import type { ExportData } from '../types';
import { zipSync, strToU8 } from 'fflate';

export type ProgressCallback = (step: string, percent: number) => void;

export async function exportAllData(onProgress?: ProgressCallback): Promise<string> {
  onProgress?.('读取题库...', 10);
  const banks = await db.banks.toArray();
  onProgress?.('读取题目...', 30);
  const allQuestions = await db.questions.toArray();
  onProgress?.('读取记录...', 50);
  const records = await db.records.toArray();
  const favorites = await db.favorites.toArray();

  onProgress?.('整理数据...', 70);
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to ensure mobile browsers start the download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportAllAsZip(onProgress?: ProgressCallback): Promise<Blob> {
  onProgress?.('准备数据...', 5);
  const json = await exportAllData(onProgress);
  onProgress?.('压缩中...', 85);
  const compressed = zipSync({
    'backup.json': strToU8(json),
  }, { level: 9 });
  onProgress?.('完成', 100);
  return new Blob([compressed], { type: 'application/zip' });
}

export async function exportBankQuestions(bankId: string): Promise<string> {
  const questions = await db.questions.where('bankId').equals(bankId).toArray();
  return JSON.stringify(questions, null, 2);
}
