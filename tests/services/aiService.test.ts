import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { buildGuidanceMessages, fetchModels, generateGuidance } from '../../src/services/aiService';
import type { Question } from '../../src/types';
import { db } from '../../src/db';

function question(overrides?: Partial<Question>): Question {
  return {
    id: 'q1',
    bankId: 'b1',
    type: 'single',
    question: '下列哪项属于操作系统？',
    options: {
      A: 'MySQL',
      B: 'Windows',
      C: 'HTML',
      D: 'Python',
    },
    answer: ['B'],
    explanation: 'Windows 是操作系统。',
    ...overrides,
  };
}

describe('buildGuidanceMessages', () => {
  it('does not include answer, explanation, or option contents in pre-answer guidance context', () => {
    const messages = buildGuidanceMessages(question(), [
      { role: 'user', content: '我没思路' },
    ]);
    const payload = JSON.stringify(messages);

    expect(payload).toContain('下列哪项属于操作系统？');
    expect(payload).toContain('选项：共 4 项');
    expect(payload).not.toContain('MySQL');
    expect(payload).not.toContain('Windows');
    expect(payload).not.toContain('正确答案：');
    expect(payload).not.toContain('answer');
    expect(payload).not.toContain('Windows 是操作系统。');
  });

  it('instructs the model not to reveal final answers', () => {
    const messages = buildGuidanceMessages(question(), []);
    expect(messages[0].content).toContain('不给最终结果');
    expect(messages[0].content).toContain('选项字母/序号');
    expect(messages[0].content).toContain('不复述或改写选项文本');
  });

  it('preserves prior assistant hints so refresh requests can avoid repetition', () => {
    const messages = buildGuidanceMessages(question(), [
      { role: 'user', content: '给我一个很短的 hint。' },
      { role: 'assistant', content: '先区分系统软件和应用软件。' },
      { role: 'user', content: '再给我一个很短的新提示，不要重复上一条。' },
    ]);

    expect(messages.at(-2)).toEqual({
      role: 'assistant',
      content: '先区分系统软件和应用软件。',
    });
    expect(messages.at(-1)?.content).toContain('不要重复上一条');
  });

  it('can build a safe retry prompt without sending the original question text', () => {
    const messages = buildGuidanceMessages(question(), [], 'safe-retry');
    const payload = JSON.stringify(messages);

    expect(payload).toContain('题目：内容暂不发送');
    expect(payload).toContain('通用审题方向');
    expect(payload).not.toContain('下列哪项属于操作系统？');
    expect(payload).not.toContain('Windows');
  });
});

describe('fetchModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts endpoints that already include /v1', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'mimo-v2.5-pro' }] }),
    } as Response);

    const models = await fetchModels('https://api.xiaomimimo.com/v1', 'key');

    expect(models).toEqual(['mimo-v2.5-pro']);
    expect(fetchMock).toHaveBeenCalledWith('https://api.xiaomimimo.com/v1/models', {
      headers: { Authorization: 'Bearer key' },
    });
  });

  it('accepts endpoints without /v1', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await fetchModels('https://api.xiaomimimo.com', 'key');

    expect(fetchMock).toHaveBeenCalledWith('https://api.xiaomimimo.com/v1/models', {
      headers: { Authorization: 'Bearer key' },
    });
  });

  it('surfaces API error details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: { message: 'Invalid API Key' } }),
    } as Response);

    await expect(fetchModels('https://api.xiaomimimo.com/v1', 'bad-key'))
      .rejects.toThrow('Invalid API Key');
  });
});

describe('generateGuidance', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses MiMo-compatible streaming body and still reads JSON content when returned', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.xiaomimimo.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'key', updatedAt: 1 },
      { key: 'ai_model', value: 'mimo-v2.5-pro', updatedAt: 1 },
    ]);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ choices: [{ message: { content: '先判断题目考察的核心概念。' } }] }),
    } as Response);
    const chunks: string[] = [];

    const result = await generateGuidance(question(), [{ role: 'user', content: '没思路' }], text => chunks.push(text));

    expect(result).toBe('先判断题目考察的核心概念。');
    expect(chunks).toEqual(['先判断题目考察的核心概念。']);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.stream).toBe(true);
    expect(body.max_completion_tokens).toBe(160);
    expect(body.max_tokens).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('replaces guidance that leaks an option with a safe fallback before emitting it', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.example.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'key', updatedAt: 1 },
      { key: 'ai_model', value: 'example-chat', updatedAt: 1 },
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ choices: [{ message: { content: 'Windows 是系统软件，直接选它。' } }] }),
    } as Response);
    const chunks: string[] = [];

    const result = await generateGuidance(question(), [], text => chunks.push(text));

    expect(result).toBe('先抓题干关键词，再按概念类别逐项判断。');
    expect(chunks).toEqual(['先抓题干关键词，再按概念类别逐项判断。']);
  });

  it('retries with a safer prompt when the provider rejects the original question', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.example.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'key', updatedAt: 1 },
      { key: 'ai_model', value: 'example-chat', updatedAt: 1 },
    ]);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'content filtered' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ choices: [{ message: { content: '先判断题干考察的是概念、人物还是事件。' } }] }),
      } as Response);

    const result = await generateGuidance(question(), [], () => {});

    expect(result).toBe('先判断题干考察的是概念、人物还是事件。');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(JSON.stringify(firstBody.messages)).toContain('下列哪项属于操作系统？');
    expect(JSON.stringify(secondBody.messages)).toContain('题目：内容暂不发送');
    expect(JSON.stringify(secondBody.messages)).not.toContain('下列哪项属于操作系统？');
  });

  it('does not retry authorization failures', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.example.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'bad-key', updatedAt: 1 },
      { key: 'ai_model', value: 'example-chat', updatedAt: 1 },
    ]);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid API Key' } }),
    } as Response);

    await expect(generateGuidance(question(), [], () => {}))
      .rejects.toThrow('Invalid API Key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads OpenAI-style SSE chunks for other providers', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.example.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'key', updatedAt: 1 },
      { key: 'ai_model', value: 'example-chat', updatedAt: 1 },
    ]);
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"先看"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"关键词"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    } as Response);

    const result = await generateGuidance(question(), [{ role: 'user', content: '没思路' }], () => {});

    expect(result).toBe('先看关键词');
  });

  it('throws when the model returns no visible content', async () => {
    await db.settings.bulkPut([
      { key: 'ai_endpoint', value: 'https://api.xiaomimimo.com/v1', updatedAt: 1 },
      { key: 'ai_apiKey', value: 'key', updatedAt: 1 },
      { key: 'ai_model', value: 'mimo-v2.5-pro', updatedAt: 1 },
    ]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ choices: [{ message: { reasoning_content: '思考过程' } }] }),
    } as Response);

    await expect(generateGuidance(question(), [{ role: 'user', content: '没思路' }], () => {}))
      .rejects.toThrow('AI 没有返回提示内容');
  });
});
