import type { Question } from '../types';

function normalizeText(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。；：]/g, m => ({ '，': ',', '。': '.', '；': ';', '：': ':' }[m] ?? m));
}

export function buildContentKey(q: Question): string {
  const options = q.options
    ? Object.entries(q.options)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${normalizeText(v)}`)
        .join('|')
    : '';
  return [
    q.type,
    normalizeText(q.question),
    options,
  ].join('\n');
}

export function buildAnswerKey(q: Question): string {
  return [...q.answer].sort().join(',');
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function attachQuestionHashes(questions: Question[]): Promise<Question[]> {
  return Promise.all(
    questions.map(async q => {
      const contentHash = await sha256(buildContentKey(q));
      const answerHash = await sha256(buildAnswerKey(q));
      return { ...q, contentHash, answerHash };
    })
  );
}
