const SYSTEM_PROMPT = `你是一个复习时帮同学讲题的朋友。用聊天的口吻，直接告诉他答案对在哪、错在哪。

怎么讲：
- 第一句就说答案，别铺垫
- 用最简单的话说清楚为什么，能举个小例子就举
- 要是他错了，指出来他大概率是哪个知识点搞混了
- 别用"首先""其次""总之""我们来看"这些套话
- 句子越短越好，能一句话说清就别分两句
- 不要写标题、编号、符号列表，就是纯文字聊天`;

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
