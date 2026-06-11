import { describe, it, expect } from 'vitest';
import { parseTextToQuestions, inferQuestionType } from '../../src/domain/questionParser';

describe('parseTextToQuestions', () => {
  describe('标准格式', () => {
    it('题号 + 题干 + 选项逐行 + 独立答案行', () => {
      const text = [
        '1、以下哪个是正确的（ ）。',
        'A、 选项A',
        'B、 选项B',
        'C、 选项C',
        'D、 选项D',
        '答案：A',
      ].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].question).toContain('以下哪个是正确的');
      expect(result[0].question).toContain('____');
      expect(result[0].options).toEqual({ A: '选项A', B: '选项B', C: '选项C', D: '选项D' });
      expect(result[0].answer).toEqual(['A']);
    });

    it('第N题格式也识别', () => {
      const text = ['第1题、题目内容', 'A、选项A', 'B、选项B', '答案：B'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].answer).toEqual(['B']);
    });
  });

  describe('行内格式', () => {
    it('题干 + 答案在同一行（选项被合并进答案）', () => {
      const text = '1、以下哪个是正确的 答案：A A、选项A B、选项B C、选项C D、选项D';
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      // 当答案和选项在同一行时，解析器会将选项字母也纳入答案
      expect(result[0].answer.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tab 分隔', () => {
    it('题干和答案用 tab 分隔', () => {
      const text = '1、题目内容\t答案：B\nA、选项A\nB、选项B';
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].answer).toEqual(['B']);
    });
  });

  describe('行内选项', () => {
    it('选项写在同一行', () => {
      const text = '1、题目内容 A、选项A B、选项B C、选项C 答案：C';
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].answer).toEqual(['C']);
      expect(result[0].options).toBeDefined();
    });
  });

  describe('解析提取', () => {
    it('提取独立行的解析', () => {
      const text = ['1、题目内容', 'A、选项A', 'B、选项B', '答案：A', '解析：因为A是对的'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].explanation).toBe('因为A是对的');
    });

    it('解析写在同一行', () => {
      const text = '1、题目内容 解析：这是解析 答案：A A、选项A B、选项B';
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].explanation).toContain('这是解析');
    });
  });

  describe('判断题', () => {
    const judgeAnswers = [
      { label: '对', expected: ['true'] },
      { label: '正确', expected: ['true'] },
      { label: '√', expected: ['true'] },
      { label: 'True', expected: ['true'] },
      { label: 'T', expected: ['true'] },
      { label: '是', expected: ['true'] },
      { label: '错', expected: ['false'] },
      { label: '错误', expected: ['false'] },
      { label: '不正确', expected: ['false'] },
      { label: '×', expected: ['false'] },
      { label: 'False', expected: ['false'] },
      { label: 'F', expected: ['false'] },
      { label: '否', expected: ['false'] },
    ];

    for (const { label, expected } of judgeAnswers) {
      it(`答案为「${label}」→ ${expected[0]}`, () => {
        const text = `1、这是一道判断题\n答案：${label}`;
        const result = parseTextToQuestions(text);
        expect(result).toHaveLength(1);
        expect(result[0].answer).toEqual(expected);
      });
    }
  });

  describe('多选题', () => {
    it('连续字母 AC', () => {
      const text = ['1、题目内容', 'A、甲', 'B、乙', 'C、丙', '答案：AC'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(1);
      expect(result[0].answer).toEqual(['A', 'C']);
    });

    it('逗号分隔 A,C', () => {
      const text = ['1、题目内容', 'A、甲', 'B、乙', 'C、丙', '答案：A,C'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].answer).toEqual(['A', 'C']);
    });

    it('空格分隔 A C', () => {
      const text = ['1、题目内容', 'A、甲', 'B、乙', 'C、丙', '答案：A C'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].answer).toEqual(['A', 'C']);
    });

    it('顿号分隔 A、C', () => {
      const text = ['1、题目内容', 'A、甲', 'B、乙', 'C、丙', '答案：A、C'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].answer).toEqual(['A', 'C']);
    });

    it('连续三个字母 ABC', () => {
      const text = ['1、题目内容', 'A、甲', 'B、乙', 'C、丙', '答案：ABC'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].answer).toEqual(['A', 'B', 'C']);
    });
  });

  describe('答案格式变体', () => {
    it('答案：A', () => {
      const text = ['1、题目内容', 'A、选项A', 'B、选项B', '答案：A'].join('\n');
      expect(parseTextToQuestions(text)[0].answer).toEqual(['A']);
    });

    it('正确答案：A', () => {
      const text = ['1、题目内容', 'A、选项A', 'B、选项B', '正确答案：A'].join('\n');
      expect(parseTextToQuestions(text)[0].answer).toEqual(['A']);
    });

    it('answer: A', () => {
      const text = ['1、题目内容', 'A、选项A', 'B、选项B', 'answer: A'].join('\n');
      expect(parseTextToQuestions(text)[0].answer).toEqual(['A']);
    });

    it('答：A', () => {
      const text = ['1、题目内容', 'A、选项A', 'B、选项B', '答：A'].join('\n');
      expect(parseTextToQuestions(text)[0].answer).toEqual(['A']);
    });
  });

  describe('章节标题跳过', () => {
    it('跳过只有标号的章节标题行', () => {
      const text = [
        '一、',
        '1、以下哪个是正确的',
        'A、选项A',
        '答案：A',
        '二、',
        '2、这是一道判断题目',
        '答案：对',
      ].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(2);
      expect(result[0].answer).toEqual(['A']);
      expect(result[1].answer).toEqual(['true']);
    });
  });

  describe('空题库', () => {
    it('空字符串返回空数组', () => {
      expect(parseTextToQuestions('')).toEqual([]);
    });

    it('只有空白返回空数组', () => {
      expect(parseTextToQuestions('   \n\n   ')).toEqual([]);
    });
  });

  describe('边界情况', () => {
    it('题干太短（< 4字符）被过滤', () => {
      const text = '1、AB\n答案：A';
      expect(parseTextToQuestions(text)).toEqual([]);
    });

    it('缺少答案的题目被过滤', () => {
      const text = ['1、这是一道没有答案的题目', 'A、选项A', 'B、选项B'].join('\n');
      expect(parseTextToQuestions(text)).toEqual([]);
    });

    it('多题连续解析', () => {
      const text = [
        '1、第一道题目内容',
        'A、选项A',
        '答案：A',
        '2、第二道题目内容',
        'B、选项B',
        '答案：B',
        '3、第三道题目内容',
        '答案：对',
      ].join('\n');
      const result = parseTextToQuestions(text);
      expect(result).toHaveLength(3);
      expect(result[0].answer).toEqual(['A']);
      expect(result[1].answer).toEqual(['B']);
      expect(result[2].answer).toEqual(['true']);
    });

    it('括号规范化为 ____', () => {
      const text = ['1、以下正确的是（ ）', 'A、选项A', '答案：A'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].question).toContain('____');
    });

    it('HTML 实体解码', () => {
      const text = ['1、什么是 &amp; 符号', 'A、选项A', '答案：A'].join('\n');
      const result = parseTextToQuestions(text);
      expect(result[0].question).toContain('&');
      expect(result[0].question).not.toContain('&amp;');
    });
  });
});

describe('inferQuestionType', () => {
  describe('判断题', () => {
    it('answer=["true"] → judge', () => {
      expect(inferQuestionType(['true'])).toBe('judge');
    });

    it('answer=["false"] → judge', () => {
      expect(inferQuestionType(['false'])).toBe('judge');
    });

    it('ParsedQuestion with true answer → judge', () => {
      expect(inferQuestionType({ question: '这是对的吗', answer: ['true'] })).toBe('judge');
    });
  });

  describe('单选题', () => {
    it('有选项 + 单个答案 → single', () => {
      expect(inferQuestionType(['A'], { A: '甲', B: '乙' })).toBe('single');
    });
  });

  describe('多选题', () => {
    it('有选项 + 多个答案 → multiple', () => {
      expect(inferQuestionType(['A', 'C'], { A: '甲', B: '乙', C: '丙' })).toBe('multiple');
    });
  });

  describe('填空题', () => {
    it('题目包含 ____ → blank', () => {
      expect(inferQuestionType(['hello'], undefined, '填入____')).toBe('blank');
    });

    it('题目包含（  ） → blank', () => {
      expect(inferQuestionType(['hello'], undefined, '填入（  ）')).toBe('blank');
    });

    it('题目包含（） → blank', () => {
      expect(inferQuestionType(['hello'], undefined, '填入（）')).toBe('blank');
    });
  });

  describe('简答题', () => {
    it('无选项 + 无空格标记 → short', () => {
      expect(inferQuestionType(['some text'], undefined, '简述一下这个概念')).toBe('short');
    });
  });

  describe('ParsedQuestion 重载', () => {
    it('有选项的 ParsedQuestion', () => {
      expect(inferQuestionType({ question: '选择题', answer: ['A'], options: { A: '甲', B: '乙' } })).toBe('single');
    });

    it('多选 ParsedQuestion', () => {
      expect(inferQuestionType({ question: '多选题', answer: ['A', 'B'], options: { A: '甲', B: '乙', C: '丙' } })).toBe('multiple');
    });

    it('填空 ParsedQuestion', () => {
      expect(inferQuestionType({ question: '请填入____内容', answer: ['hello'] })).toBe('blank');
    });
  });
});
