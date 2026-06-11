import { describe, it, expect } from 'vitest';

// 测试 ImportPage 中的 classifyError 纯函数
// 该函数未导出，复制实现进行测试

interface ImportError {
  message: string;
  reason?: string;
  suggestions?: string[];
  showAiPrompt?: boolean;
}

function classifyError(msg: string): ImportError {
  if (msg.includes('未能从文件中解析出任何题目')) {
    return {
      message: msg,
      reason: '未能解析出任何题目',
      suggestions: [
        '检查是否包含「答案：A」格式的答案行',
        '检查选项是否为 A. / B. / C. / D. 格式',
        '如果格式较乱，试试用 AI 转换成标准 JSON',
      ],
      showAiPrompt: true,
    };
  }
  if (msg.includes('JSON 格式不正确')) {
    return {
      message: msg,
      reason: 'JSON 格式不正确',
      suggestions: [
        'JSON 需要是数组 [{...}] 或包含 questions 数组的对象',
        '用 JSON 校验工具检查语法是否正确',
      ],
    };
  }
  if (msg.includes('不支持的文件格式')) {
    return {
      message: msg,
      reason: '文件格式不支持',
      suggestions: ['请使用 JSON、CSV、Excel、Word 或文本文件'],
    };
  }
  return { message: msg };
}

describe('classifyError', () => {
  it('解析失败 → 显示 AI 提示按钮', () => {
    const result = classifyError('未能从文件中解析出任何题目');
    expect(result.reason).toBe('未能解析出任何题目');
    expect(result.showAiPrompt).toBe(true);
    expect(result.suggestions).toHaveLength(3);
  });

  it('JSON 格式错误 → 提示 JSON 格式', () => {
    const result = classifyError('JSON 格式不正确：Unexpected token');
    expect(result.reason).toBe('JSON 格式不正确');
    expect(result.suggestions).toHaveLength(2);
    expect(result.showAiPrompt).toBeUndefined();
  });

  it('不支持的文件格式 → 提示格式', () => {
    const result = classifyError('不支持的文件格式 .xyz');
    expect(result.reason).toBe('文件格式不支持');
    expect(result.suggestions).toHaveLength(1);
  });

  it('未知错误 → 只返回 message', () => {
    const result = classifyError('网络连接失败');
    expect(result.message).toBe('网络连接失败');
    expect(result.reason).toBeUndefined();
    expect(result.suggestions).toBeUndefined();
  });

  it('保留原始错误信息', () => {
    const msg = '未能从文件中解析出任何题目，请检查文件内容';
    const result = classifyError(msg);
    expect(result.message).toBe(msg);
  });
});
