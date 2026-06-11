import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSetting,
  setSetting,
  getSettingRaw,
  getAllSettings,
  getAIConfig,
  saveAIConfig,
  getSettingsForExport,
} from '../../src/repositories/settingsRepo';
import { db } from '../../src/db';

beforeEach(async () => {
  await db.settings.clear();
});

describe('settingsRepo', () => {
  describe('getSetting / setSetting', () => {
    it('get 未设置的 key 返回 undefined', async () => {
      expect(await getSetting('nonexistent')).toBeUndefined();
    });

    it('set 后 get 返回值', async () => {
      await setSetting('theme', 'dark');
      expect(await getSetting('theme')).toBe('dark');
    });

    it('覆盖写入', async () => {
      await setSetting('theme', 'dark');
      await setSetting('theme', 'light');
      expect(await getSetting('theme')).toBe('light');
    });

    it('支持对象值', async () => {
      await setSetting('config', { a: 1, b: [2, 3] });
      expect(await getSetting('config')).toEqual({ a: 1, b: [2, 3] });
    });
  });

  describe('getSettingRaw', () => {
    it('返回完整记录含 updatedAt', async () => {
      await setSetting('theme', 'dark');
      const raw = await getSettingRaw('theme');
      expect(raw).toBeDefined();
      expect(raw!.key).toBe('theme');
      expect(raw!.value).toBe('dark');
      expect(raw!.updatedAt).toBeGreaterThan(0);
    });

    it('不存在的 key 返回 undefined', async () => {
      expect(await getSettingRaw('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllSettings', () => {
    it('无设置返回空数组', async () => {
      expect(await getAllSettings()).toEqual([]);
    });

    it('返回全部设置', async () => {
      await setSetting('a', 1);
      await setSetting('b', 2);
      const result = await getAllSettings();
      expect(result).toHaveLength(2);
    });
  });

  describe('getAIConfig', () => {
    it('三个 AI key 都存在时返回 config 对象', async () => {
      await setSetting('ai_endpoint', 'https://api.example.com');
      await setSetting('ai_apiKey', 'sk-xxx');
      await setSetting('ai_model', 'gpt-4');
      const config = await getAIConfig();
      expect(config).toEqual({
        endpoint: 'https://api.example.com',
        apiKey: 'sk-xxx',
        model: 'gpt-4',
      });
    });

    it('缺少任一 key 返回 null', async () => {
      await setSetting('ai_endpoint', 'https://api.example.com');
      await setSetting('ai_model', 'gpt-4');
      expect(await getAIConfig()).toBeNull();
    });

    it('全部未设置返回 null', async () => {
      expect(await getAIConfig()).toBeNull();
    });
  });

  describe('saveAIConfig', () => {
    it('同时写入三个 AI key', async () => {
      await saveAIConfig('ep', 'key', 'model');
      expect(await getSetting('ai_endpoint')).toBe('ep');
      expect(await getSetting('ai_apiKey')).toBe('key');
      expect(await getSetting('ai_model')).toBe('model');
    });
  });

  describe('getSettingsForExport', () => {
    it('排除 AI 相关 key', async () => {
      await setSetting('theme', 'dark');
      await setSetting('ai_endpoint', 'ep');
      await setSetting('ai_apiKey', 'key');
      await setSetting('ai_model', 'model');
      const result = await getSettingsForExport();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('theme');
      expect(result.every(s => !s.key.startsWith('ai_'))).toBe(true);
    });

    it('无设置返回空数组', async () => {
      expect(await getSettingsForExport()).toEqual([]);
    });
  });
});
