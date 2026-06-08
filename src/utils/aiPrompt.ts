export const AI_PROMPT = `请将以下题目内容转换为 JSON 格式，严格遵循以下结构：

{
  "name": "题库名称",
  "questions": [
    {
      "type": "single",
      "question": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer": ["B"],
      "explanation": "解析（如有）"
    }
  ]
}

规则：
1. type 取值：single（单选）/ multiple（多选）/ judge（判断）/ blank（填空）/ short（简答）
2. 单选题 answer 为一个字母的数组，如 ["B"]
3. 多选题 answer 为多个字母的数组，如 ["A", "C"]
4. 判断题没有 options，answer 为 ["true"] 或 ["false"]
5. 填空题没有 options，answer 为答案文本数组
6. 简答题没有 options，answer 为参考答案数组
7. options 的 key 必须是大写字母 A/B/C/D/E...
8. 保持原题内容不变，不要修改题意
9. 只输出 JSON，不要其他内容

以下是题目内容：
`;
