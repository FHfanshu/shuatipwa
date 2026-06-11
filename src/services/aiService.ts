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

const GUIDANCE_SYSTEM_PROMPT = `你是刷题 App 的答前学习教练，称呼用户为"同学"。学生还没有提交答案，你的目标是帮 TA 想起来、学会推理，而不是替 TA 作答。

必须遵守：
- 这是一条"答前提示"，不是解析；宁可抽象一点，也不能让学生直接定位答案。
- 绝对不要直接给最终答案、正确选项字母/序号、判断题正误结论、填空题或简答题可直接抄写的完整答案。
- 禁止复述、引用或改写任何选项文本、答案关键词、专有名词、人名、年份、数值、公式结果。
- 不要给答案的首字、字数、谐音、近义词、英文缩写或其它可反推答案的线索。
- 选择题：不要逐项排除，不要描述"哪一项具有/不具有某特征"；只提示判别标准或题干关键词。
- 判断题：不要用肯定或否定方式评价题干；只提示应核对的概念边界。
- 填空/简答：只提示作答角度或知识范围，不给可填入的词句。
- 如果学生追问最终答案，要礼貌拒绝，并改给下一步提示。
- 只输出一条 15 到 45 字中文 hint，不寒暄、不编号、不使用 Markdown。`;

const GUIDANCE_FALLBACK_BY_TYPE: Record<Question['type'], string> = {
  single: '先抓题干关键词，再按概念类别逐项判断。',
  multiple: '先列出题干要求，再核对每项是否都满足。',
  judge: '先找绝对化表述，再回忆概念边界。',
  blank: '先看空格前后语境，定位考察的知识点。',
  short: '先列关键词，再按定义、条件、结果组织回答。',
};

export interface AIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface GuidanceChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  temperature: number;
  maxTokens: number;
  preferStream: boolean;
}

function getOpenAICompatBaseUrl(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}

function getOpenAICompatUrl(endpoint: string, path: string): string {
  return `${getOpenAICompatBaseUrl(endpoint)}/v1/${path.replace(/^\/+/, '')}`;
}

function isMiMoEndpoint(endpoint: string): boolean {
  try {
    return new URL(getOpenAICompatBaseUrl(endpoint)).hostname.toLowerCase().includes('xiaomimimo.com');
  } catch {
    return endpoint.toLowerCase().includes('xiaomimimo.com');
  }
}

function isMiMoConfig(config: AIConfig): boolean {
  return isMiMoEndpoint(config.endpoint) || config.model.toLowerCase().startsWith('mimo-');
}

function getAuthHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

function buildCompletionBody(
  config: AIConfig,
  messages: ChatMessage[],
  { temperature, maxTokens, preferStream }: CompletionOptions,
) {
  const mimo = isMiMoConfig(config);
  return {
    model: config.model,
    stream: preferStream,
    temperature,
    ...(mimo
      ? { max_completion_tokens: maxTokens, thinking: { type: 'disabled' } }
      : { max_tokens: maxTokens }),
    messages,
  };
}

function normalizeContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(part => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object') {
      const record = part as Record<string, unknown>;
      if (typeof record.text === 'string') return record.text;
      if (typeof record.content === 'string') return record.content;
    }
    return '';
  }).join('');
}

function extractCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  if (firstChoice && typeof firstChoice === 'object') {
    const choice = firstChoice as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;
    const delta = choice.delta as Record<string, unknown> | undefined;
    return normalizeContent(message?.content)
      || normalizeContent(delta?.content)
      || normalizeContent(choice.text);
  }
  return normalizeContent(data.output_text);
}

function compactForLeakCheck(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s"'`“”‘’.,，。;；:：!?！？()[\]{}【】<>《》、/\\|-]+/g, '');
}

function includesMeaningfulToken(text: string, token: string): boolean {
  const compactToken = compactForLeakCheck(token);
  if (compactToken.length < 2) return false;
  return compactForLeakCheck(text).includes(compactToken);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesOptionLabelLeak(text: string, labels: string[]): boolean {
  return labels.some(label => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel || normalizedLabel.length > 3) return false;
    const escaped = escapeRegExp(normalizedLabel);
    return new RegExp(`(?:答案|应选|选|第|正确(?:的是|选项)?|应该是)\\s*${escaped}|${escaped}\\s*(?:项|选项)`, 'i')
      .test(text);
  });
}

function includesJudgementLeak(question: Question, text: string): boolean {
  if (question.type !== 'judge') return false;
  const answer = question.answer[0]?.trim().toLowerCase();
  if (answer === 'true') {
    return /(?:答案|结论|判断|这句|说法).{0,6}(?:正确|对|成立|为真)|(?:正确|对|成立|为真).{0,6}(?:答案|结论|判断)/.test(text);
  }
  if (answer === 'false') {
    return /(?:答案|结论|判断|这句|说法).{0,6}(?:错误|错|不成立|为假)|(?:错误|错|不成立|为假).{0,6}(?:答案|结论|判断)/.test(text);
  }
  return false;
}

function isGuidanceLikelyLeakingAnswer(question: Question, text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (/(?:答案是|正确答案|正确选项|应选|直接选|填入|填写为)/.test(trimmed)) {
    return true;
  }

  const optionEntries = question.options
    ? Object.entries(question.options).filter(([, value]) => String(value).trim())
    : [];
  if (optionEntries.length > 0) {
    const labels = optionEntries.map(([label]) => label);
    if (includesOptionLabelLeak(trimmed, labels)) return true;
    if (optionEntries.some(([, value]) => includesMeaningfulToken(trimmed, String(value)))) return true;
  }

  if (question.answer.some(answer => includesMeaningfulToken(trimmed, answer))) {
    return true;
  }

  return includesJudgementLeak(question, trimmed);
}

function sanitizeGuidanceText(question: Question, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (isGuidanceLikelyLeakingAnswer(question, trimmed)) {
    return GUIDANCE_FALLBACK_BY_TYPE[question.type];
  }
  return trimmed;
}

async function readAPIError(response: Response): Promise<string> {
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    return `${response.status} ${response.statusText}`.trim();
  }

  if (!raw.trim()) return `${response.status} ${response.statusText}`.trim();
  try {
    const data = JSON.parse(raw);
    const error = data?.error;
    if (typeof error?.message === 'string') return error.message;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // Fall through to raw response text.
  }
  return raw.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function parseSSELine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data: ')) return '';
  const data = trimmed.slice(6).trim();
  if (data === '[DONE]') return null;
  try {
    return extractCompletionText(JSON.parse(data));
  } catch {
    return '';
  }
}

async function readChatCompletion(
  response: Response,
  onChunk: (text: string) => void,
): Promise<string> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json') || !response.body) {
    const payload = await response.json();
    const text = extractCompletionText(payload);
    if (text) onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawText = '';
  let fullText = '';
  let doneEventSeen = false;

  while (!doneEventSeen) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    rawText += chunk;
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const content = parseSSELine(line);
      if (content === null) {
        doneEventSeen = true;
        break;
      }
      if (content) {
        fullText += content;
        onChunk(fullText);
      }
    }
  }

  const finalBuffer = buffer.trim();
  if (finalBuffer && !doneEventSeen) {
    const content = parseSSELine(finalBuffer);
    if (content) {
      fullText += content;
      onChunk(fullText);
    }
  }

  if (!fullText.trim() && rawText.trim()) {
    try {
      const fallbackText = extractCompletionText(JSON.parse(rawText));
      if (fallbackText) {
        onChunk(fallbackText);
        return fallbackText;
      }
    } catch {
      // The response was not JSON. Returning empty lets callers surface a clear error.
    }
  }

  return fullText;
}

/**
 * 从 /v1/models 拉取可用模型列表
 */
export async function fetchModels(endpoint: string, apiKey: string): Promise<string[]> {
  try {
    const url = getOpenAICompatUrl(endpoint, 'models');
    const res = await fetch(url, {
      headers: getAuthHeaders(apiKey),
    });
    if (!res.ok) {
      throw new Error(await readAPIError(res));
    }
    const data = await res.json();
    return data.data?.map((m: { id: string }) => m.id).filter(Boolean) ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`模型列表拉取失败：${message}`, { cause: error });
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

  const url = getOpenAICompatUrl(config.endpoint, 'chat/completions');

  const messages: ChatMessage[] = [
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
  ];
  const body = buildCompletionBody(config, messages, {
    temperature: 0.3,
    maxTokens: 600,
    preferStream: true,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(config.apiKey),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API 请求失败：${await readAPIError(response)}`);
  }

  const fullText = await readChatCompletion(response, onChunk);

  // 缓存结果
  if (fullText) {
    return cacheExplanation(question.id, fullText, existingCacheId, question.bankId, config.model);
  }
  throw new Error('AI 没有返回解析内容，请稍后重试');
}

/**
 * 构建答前引导消息。注意：这里刻意不传正确答案。
 */
export function buildGuidanceMessages(
  question: Question,
  chatHistory: GuidanceChatMessage[]
): ChatMessage[] {
  const typeLabel = getQuestionTypeLabel(question.type);
  const optionCount = question.options
    ? Object.values(question.options).filter(value => String(value).trim()).length
    : 0;

  const context =
    `题型：${typeLabel}\n` +
    `题目：${question.question}\n` +
    (optionCount > 0 ? `选项：共 ${optionCount} 项，内容已隐藏以避免泄题。\n` : '') +
    `状态：学生尚未提交答案，请只做答前引导。`;

  return [
    { role: 'system', content: GUIDANCE_SYSTEM_PROMPT },
    { role: 'user', content: context },
    ...chatHistory.map(message => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

/**
 * 答前 AI 引导（流式），只提供思路和知识点，不缓存、不传正确答案。
 */
export async function generateGuidance(
  question: Question,
  chatHistory: GuidanceChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error('请先在设置中配置 AI 接口');
  }

  const url = getOpenAICompatUrl(config.endpoint, 'chat/completions');
  const body = buildCompletionBody(config, buildGuidanceMessages(question, chatHistory), {
    temperature: 0.45,
    maxTokens: 160,
    preferStream: true,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(config.apiKey),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API 请求失败：${await readAPIError(response)}`);
  }

  const fullText = await readChatCompletion(response, () => {});
  if (!fullText.trim()) {
    throw new Error('AI 没有返回提示内容，请稍后重试');
  }

  const safeText = sanitizeGuidanceText(question, fullText);
  onChunk(safeText);
  return safeText;
}
