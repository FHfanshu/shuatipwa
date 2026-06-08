/**
 * AI 解析服务（Service 层）
 * 职责：缓存查询、配置读取、流式调用、缓存写入
 */

import type { Question } from '../types';
import { getQuestionTypeLabel } from '../domain/questionType';
import { getCachedExplanation, cacheExplanation } from '../repositories/aiExplanationRepo';
import { getAIConfig as getAIConfigFromDB } from '../repositories/settingsRepo';

const SYSTEM_PROMPT = `你是刷题 App 的题目解析助手，称呼用户为"同学"。请用简洁中文解释，重点帮助快速理解。

输出要求：
- 先给结论：正确答案是什么。
- 再解释关键原因，避免长篇背景。
- 选择题：只分析关键选项；如果选项较多，每项一句话以内。
- 判断题：说明判断依据。
- 填空/简答：给出答案要点和常见扣分点。
- 如果同学答错，指出最可能混淆点。
- 控制在 120 到 250 字，必要时用 Markdown 加粗重点。`;

export interface AIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

/**
 * 从 /v1/models 拉取可用模型列表
 */
export async function fetchModels(endpoint: string, apiKey: string): Promise<string[]> {
  try {
    const base = endpoint.replace(/\/$/, '');
    const url = `${base}/v1/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.map((m: { id: string }) => m.id).filter(Boolean) ?? [];
  } catch {
    return [];
  }
}

/**
 * 从 IndexedDB 读取 AI 配置；若 IndexedDB 无数据则 fallback 读 localStorage（兼容旧版）
 */
export async function getAIConfig(): Promise<AIConfig | null> {
  let config = await getAIConfigFromDB();
  if (!config) {
    // 兼容旧版 localStorage
    const endpoint = localStorage.getItem('ai_endpoint');
    const apiKey = localStorage.getItem('ai_apiKey');
    const model = localStorage.getItem('ai_model');
    if (endpoint && apiKey && model) {
      config = { endpoint, apiKey, model };
    }
  }
  return config;
}

/**
 * 查询缓存的 AI 解析
 */
export async function loadCachedExplanation(
  questionId: string
): Promise<{ id?: number; explanation: string } | undefined> {
  return getCachedExplanation(questionId);
}

/**
 * 生成 AI 解析（流式）并自动缓存
 *
 * @returns 解析完成后返回缓存 id；如果被 abort 则返回 null
 */
export async function generateExplanation(
  question: Question,
  userAnswer: string[],
  onChunk: (text: string) => void,
  existingCacheId?: number | null,
  signal?: AbortSignal,
): Promise<number | null> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const typeLabel = getQuestionTypeLabel(question.type);
  const optionsText = question.options
    ? Object.entries(question.options).map(([k, v]) => `${k}. ${v}`).join('\n')
    : '';
  const correctText = question.options
    ? question.answer.map(a => `${a}. ${question.options![a]}`).join(', ')
    : question.answer.join(', ');
  const userText = userAnswer.length > 0
    ? (question.options ? userAnswer.map(a => `${a}. ${question.options![a]}`).join(', ') : userAnswer.join(', '))
    : '(未作答)';

  let fullText = '';
  const url = `${config.endpoint.replace(/\/$/, '')}/v1/chat/completions`;

  const body = {
    model: config.model,
    stream: true,
    temperature: 0.3,
    max_tokens: 600,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `题型：${typeLabel}\n` +
          `题目：${question.question}\n` +
          (optionsText ? `选项：\n${optionsText}\n` : '') +
          `正确答案：${correctText}\n` +
          `我的答案：${userText}`,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(fullText);
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  }

  // 缓存结果
  if (fullText) {
    return cacheExplanation(question.id, fullText, existingCacheId, question.bankId, config.model);
  }
  return null;
}
