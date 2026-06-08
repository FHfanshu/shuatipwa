import { db } from '../db';
import type { AppSetting } from '../types';

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const record = await db.settings.get(key);
  return record?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

export async function getSettingRaw(key: string): Promise<AppSetting | undefined> {
  return db.settings.get(key);
}

export async function getAllSettings(): Promise<AppSetting[]> {
  return db.settings.toArray();
}

const AI_KEYS = ['ai_endpoint', 'ai_apiKey', 'ai_model'] as const;

export async function getAIConfig(): Promise<{ endpoint: string; apiKey: string; model: string } | null> {
  const endpoint = await getSetting<string>('ai_endpoint');
  const apiKey = await getSetting<string>('ai_apiKey');
  const model = await getSetting<string>('ai_model');
  if (!endpoint || !apiKey || !model) return null;
  return { endpoint, apiKey, model };
}

export async function saveAIConfig(endpoint: string, apiKey: string, model: string): Promise<void> {
  await Promise.all([
    setSetting('ai_endpoint', endpoint),
    setSetting('ai_apiKey', apiKey),
    setSetting('ai_model', model),
  ]);
}

export async function getSettingsForExport(): Promise<AppSetting[]> {
  const all = await db.settings.toArray();
  return all.filter(s => !AI_KEYS.includes(s.key as typeof AI_KEYS[number]));
}
