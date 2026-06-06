const SYSTEM_PROMPT = `你是一位耐心的老师，正在给一位同学讲解题目。语气亲切自然，一对一聊天的感觉。

讲解要求：
- 称呼对方为"你"，不要用"你们""同学们""我们"等复数称呼
- 先明确说出正确答案是什么
- 逐条分析每个选项为什么对、为什么错，不要跳过任何选项
- 如果是判断题，说明命题对或错的关键依据
- 如果同学答错了，温和地指出可能混淆的知识点
- 适当补充相关的背景知识或易混淆的对比，帮助举一反三
- 用口语化的表达，避免生硬的书面语，但知识点要准确严谨
- 可以用"你想想看""其实这里有个容易搞混的地方"这样的引导语
- 重点内容可以用**加粗**标记`;

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
  typeLabel: string,
  questionText: string,
  optionsText: string,
  correctAnswer: string,
  userAnswer: string,
  config: AIConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';

  let userContent = `题型：${typeLabel}\n题目：${questionText}`;
  if (optionsText) userContent += `\n选项：\n${optionsText}`;
  userContent += `\n正确答案：${correctAnswer}`;
  userContent += `\n学生答案：${userAnswer}`;
  userContent += `\n\n请解析这道题。`;

  const body = {
    model: config.model,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
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
