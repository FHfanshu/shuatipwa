const SYSTEM_PROMPT = `你是一位直爽的考试辅导老师。用大白话、简洁自然地解释这道题。要求：
1. 先说答案是什么
2. 用一句话解释为什么选这个
3. 如果有易错点，用一句话点破
4. 不要废话，不要用"首先""其次"这类套话，就像跟朋友聊天一样说
5. 控制在3-5句话内`;

export interface AIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export function getAIConfig(): AIConfig | null {
  const endpoint = localStorage.getItem('ai_endpoint');
  const apiKey = localStorage.getItem('ai_apiKey');
  const model = localStorage.getItem('ai_model');
  if (!endpoint || !apiKey || !model) return null;
  return { endpoint, apiKey, model };
}

export async function* streamExplanation(
  questionText: string,
  correctAnswer: string,
  userAnswer: string,
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';
  const body = {
    model: config.model,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `题目：${questionText}\n正确答案：${correctAnswer}\n学生答案：${userAnswer}\n\n请解析这道题。`,
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
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed JSON lines
      }
    }
  }
}
