import { useState, useEffect } from 'react';
import type { Question, AnswerStatus } from '../types';
import { checkAnswer, getQuestionTypeLabel, getQuestionTypeColor } from '../utils/helper';
import { db } from '../db';
import Icon from './Icon';

interface Props {
  question: Question;
  bankId: string;
  index: number;
  total: number;
  onAnswer?: (status: AnswerStatus) => void;
  showAnswerImmediately?: boolean;
}

export default function QuestionCard({ question, bankId, index, total, onAnswer }: Props) {
  const [userAnswer, setUserAnswer] = useState<string[]>([]);
  const [blankInput, setBlankInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<AnswerStatus>('unanswered');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    setUserAnswer([]);
    setBlankInput('');
    setSubmitted(false);
    setStatus('unanswered');
  }, [question.id]);

  useEffect(() => {
    db.favorites.where('[bankId+questionId]').equals([bankId, question.id]).first().then(f => {
      setIsFavorite(!!f);
    });
  }, [bankId, question.id]);

  const toggleOption = (opt: string) => {
    if (submitted) return;
    if (question.type === 'single' || question.type === 'judge') {
      setUserAnswer([opt]);
    } else {
      setUserAnswer(prev =>
        prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
      );
    }
  };

  const handleSubmit = () => {
    if (submitted) return;
    let answer = userAnswer;
    if (question.type === 'blank' || question.type === 'short') {
      answer = blankInput.trim() ? [blankInput.trim()] : [];
    }
    if (answer.length === 0) return;

    const result = checkAnswer(question, answer);
    setStatus(result);
    setSubmitted(true);

    db.records.add({
      bankId,
      questionId: question.id,
      userAnswer: answer,
      status: result,
      timestamp: Date.now(),
    });
    onAnswer?.(result);
  };

  const toggleFavorite = async () => {
    const existing = await db.favorites.where('[bankId+questionId]').equals([bankId, question.id]).first();
    if (existing) {
      await db.favorites.delete(existing.id!);
      setIsFavorite(false);
    } else {
      await db.favorites.add({ bankId, questionId: question.id, timestamp: Date.now() });
      setIsFavorite(true);
    }
  };

  const isSelfGrade = question.type === 'blank' || question.type === 'short';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 font-mono">{index + 1}/{total}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getQuestionTypeColor(question.type)}`}>
            {getQuestionTypeLabel(question.type)}
          </span>
          {question.tags?.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {tag}
            </span>
          ))}
        </div>
        <button onClick={toggleFavorite} className="active:scale-90 transition-transform text-yellow-500">
          <Icon name={isFavorite ? 'star' : 'star-empty'} size={24} />
        </button>
      </div>

      {/* 题干 */}
      <div className="text-base font-medium text-gray-900 mb-4 leading-relaxed whitespace-pre-wrap">
        {question.question}
      </div>

      {/* 选项 */}
      {question.options && (question.type === 'single' || question.type === 'multiple') && (
        <div className="space-y-2 mb-4">
          {Object.entries(question.options).map(([key, value]) => {
            const selected = userAnswer.includes(key);
            const isCorrect = question.answer.includes(key);
            let optionClass = 'border-gray-200 bg-white hover:border-blue-300';

            if (submitted) {
              if (isCorrect) {
                optionClass = 'border-green-500 bg-green-50 text-green-800';
              } else if (selected && !isCorrect) {
                optionClass = 'border-red-500 bg-red-50 text-red-800';
              } else {
                optionClass = 'border-gray-200 bg-gray-50 opacity-60';
              }
            } else if (selected) {
              optionClass = 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200';
            }

            return (
              <button
                key={key}
                onClick={() => toggleOption(key)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 ${optionClass}`}
              >
                <span className="font-bold text-sm mt-0.5 shrink-0">{key}</span>
                <span className="text-sm leading-relaxed">{value}</span>
                {submitted && isCorrect && <Icon name="check" size={16} className="ml-auto text-green-600" />}
                {submitted && selected && !isCorrect && <Icon name="x" size={16} className="ml-auto text-red-600" />}
              </button>
            );
          })}
        </div>
      )}

      {/* 判断题选项 */}
      {question.type === 'judge' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[{ key: 'true', label: '正确' }, { key: 'false', label: '错误' }].map(({ key, label }) => {
            const selected = userAnswer.includes(key);
            const isCorrect = question.answer.includes(key);
            let cls = 'border-gray-200 bg-white';
            if (submitted) {
              if (isCorrect) cls = 'border-green-500 bg-green-50 text-green-800';
              else if (selected) cls = 'border-red-500 bg-red-50 text-red-800';
              else cls = 'border-gray-200 bg-gray-50 opacity-60';
            } else if (selected) {
              cls = 'border-blue-500 bg-blue-50 ring-2 ring-blue-200';
            }
            return (
              <button
                key={key}
                onClick={() => toggleOption(key)}
                disabled={submitted}
                className={`py-4 rounded-xl border-2 text-base font-medium transition-all flex items-center justify-center gap-2 ${cls}`}
              >
                <Icon name={key === 'true' ? 'check' : 'x'} size={18} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 填空/简答输入 */}
      {(question.type === 'blank' || question.type === 'short') && (
        <div className="mb-4">
          <textarea
            value={blankInput}
            onChange={e => setBlankInput(e.target.value)}
            disabled={submitted}
            placeholder={question.type === 'blank' ? '请输入答案...' : '请输入你的回答...'}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none disabled:bg-gray-50"
            rows={question.type === 'short' ? 4 : 2}
          />
        </div>
      )}

      {/* 提交按钮 */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={
            (question.type !== 'blank' && question.type !== 'short' && userAnswer.length === 0) ||
            ((question.type === 'blank' || question.type === 'short') && !blankInput.trim())
          }
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl active:bg-blue-700 disabled:opacity-40 disabled:active:bg-blue-600 transition-colors"
        >
          提交答案
        </button>
      )}

      {/* 结果 & 解析 */}
      {submitted && (
        <div className="mt-4 space-y-3">
          {isSelfGrade && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm font-medium text-blue-800 mb-2">参考答案：</div>
              <div className="text-sm text-blue-700 whitespace-pre-wrap">{question.answer.join(' / ')}</div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setStatus('correct'); onAnswer?.('correct'); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${status === 'correct' ? 'bg-green-500 text-white' : 'bg-white border border-green-300 text-green-700'}`}
                >
                  <Icon name="check" size={14} /> 我答对了
                </button>
                <button
                  onClick={() => { setStatus('wrong'); onAnswer?.('wrong'); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${status === 'wrong' ? 'bg-red-500 text-white' : 'bg-white border border-red-300 text-red-700'}`}
                >
                  <Icon name="x" size={14} /> 我答错了
                </button>
              </div>
            </div>
          )}

          {!isSelfGrade && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${status === 'correct' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <Icon name={status === 'correct' ? 'check-circle' : 'x-circle'} size={20} />
              <span className="font-medium">{status === 'correct' ? '回答正确！' : '回答错误'}</span>
              {status === 'wrong' && (
                <span className="ml-auto text-sm">正确答案: {question.answer.join(', ')}</span>
              )}
            </div>
          )}

          {question.explanation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <Icon name="lightbulb" size={14} /> 解析
              </div>
              <div className="text-sm text-amber-700 leading-relaxed whitespace-pre-wrap">{question.explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
