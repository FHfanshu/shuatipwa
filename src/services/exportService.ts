import type { ExportDataV2 } from '../types';
import { zipSync, strToU8 } from 'fflate';
import { getAllBanks } from '../repositories/bankRepo';
import { getAllQuestions, getQuestionsByBankId } from '../repositories/questionRepo';
import { getAllRecords } from '../repositories/recordRepo';
import { getAllFavorites } from '../repositories/favoriteRepo';
import { getAllExplanations } from '../repositories/aiExplanationRepo';
import { getAllSettings } from '../repositories/settingsRepo';

export type ProgressCallback = (step: string, percent: number) => void;

export async function exportAllData(onProgress?: ProgressCallback): Promise<string> {
  onProgress?.('读取题库...', 10);
  const banks = await getAllBanks();
  onProgress?.('读取题目...', 30);
  const allQuestions = await getAllQuestions();
  onProgress?.('读取记录...', 50);
  const records = await getAllRecords();
  const favorites = await getAllFavorites();
  onProgress?.('读取 AI 解析...', 60);
  const aiExplanations = await getAllExplanations();
  onProgress?.('读取设置...', 65);
  const settings = await getAllSettings();

  onProgress?.('整理数据...', 70);
  const questionsByBank: Record<string, typeof allQuestions> = {};
  for (const q of allQuestions) {
    if (!questionsByBank[q.bankId]) questionsByBank[q.bankId] = [];
    questionsByBank[q.bankId].push(q);
  }

  const data: ExportDataV2 = {
    version: 2,
    exportedAt: Date.now(),
    banks,
    questions: questionsByBank,
    records,
    favorites,
    aiExplanations: aiExplanations.length > 0 ? aiExplanations : undefined,
    settings: settings.length > 0 ? settings : undefined,
  };

  return JSON.stringify(data);
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
  const questions = await getQuestionsByBankId(bankId);
  return JSON.stringify(questions, null, 2);
}
