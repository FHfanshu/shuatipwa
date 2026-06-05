import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { QuestionBank, PracticeMode } from '../types';
import { useState } from 'react';
import Icon from '../components/Icon';

export default function HomePage() {
  const banks = useLiveQuery(() => db.banks.orderBy('updatedAt').reverse().toArray());
  const navigate = useNavigate();
  const [showModeModal, setShowModeModal] = useState<string | null>(null);

  if (!banks) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] px-8 text-center">
        <Icon name="book" size={64} className="text-blue-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">还没有题库</h2>
        <p className="text-gray-500 mb-6 text-sm leading-relaxed">
          点击底部「导入」按钮，<br />
          上传 JSON / CSV / Excel / 文本文件
        </p>
        <button
          onClick={() => navigate('/import')}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700"
        >
          去导入题库
        </button>
      </div>
    );
  }

  const startPractice = (bankId: string, mode: PracticeMode) => {
    setShowModeModal(null);
    navigate(`/practice/${bankId}/${mode}`);
  };

  const modes: { mode: PracticeMode; icon: string; label: string; desc: string }[] = [
    { mode: 'sequential', icon: 'list', label: '顺序练习', desc: '从第1题开始' },
    { mode: 'random', icon: 'shuffle', label: '随机练习', desc: '打乱顺序' },
    { mode: 'wrong', icon: 'x-circle', label: '只刷错题', desc: '复习做错的' },
    { mode: 'favorite', icon: 'star', label: '收藏题目', desc: '只看收藏的' },
    { mode: 'exam', icon: 'exam', label: '模拟考试', desc: '限时测试' },
  ];

  return (
    <div className="px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">刷题宝</h1>
        <p className="text-sm text-gray-500 mt-1">本地离线刷题，数据不离开你的设备</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{banks.length}</div>
          <div className="text-xs text-blue-400 mt-1">题库</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {banks.reduce((sum, b) => sum + b.questionCount, 0)}
          </div>
          <div className="text-xs text-green-400 mt-1">总题数</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">--</div>
          <div className="text-xs text-purple-400 mt-1">正确率</div>
        </div>
      </div>

      {/* 题库列表 */}
      <div className="space-y-3">
        {banks.map(bank => (
          <BankCard
            key={bank.id}
            bank={bank}
            onStart={() => setShowModeModal(bank.id)}
            onDelete={async () => {
              if (confirm(`确定删除「${bank.name}」？\n此操作不可撤销！`)) {
                await db.questions.where('bankId').equals(bank.id).delete();
                await db.records.where('bankId').equals(bank.id).delete();
                await db.favorites.where('bankId').equals(bank.id).delete();
                await db.banks.delete(bank.id);
              }
            }}
          />
        ))}
      </div>

      {/* 选择模式弹窗 */}
      {showModeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowModeModal(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pt-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-4">选择练习模式</h3>
            <div className="space-y-2">
              {modes.map(m => (
                <button
                  key={m.mode}
                  onClick={() => startPractice(showModeModal, m.mode)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <Icon name={m.icon} size={22} className="text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-500">{m.desc}</div>
                  </div>
                  <Icon name="chevron-right" size={18} className="ml-auto text-gray-300" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModeModal(null)}
              className="w-full mt-4 py-3 text-gray-500 font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BankCard({ bank, onStart, onDelete }: { bank: QuestionBank; onStart: () => void; onDelete: () => void }) {
  const stats = useLiveQuery(async () => {
    const records = await db.records.where('bankId').equals(bank.id).toArray();
    const correct = records.filter(r => r.status === 'correct').length;
    const wrong = records.filter(r => r.status === 'wrong').length;
    const uniqueAnswered = new Set(records.map(r => r.questionId)).size;
    return { correct, wrong, uniqueAnswered };
  }, [bank.id]);

  const progress = stats ? Math.round((stats.uniqueAnswered / bank.questionCount) * 100) : 0;
  const accuracy = stats && (stats.correct + stats.wrong) > 0
    ? Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-base">{bank.name}</h3>
          {bank.description && <p className="text-xs text-gray-500 mt-0.5">{bank.description}</p>}
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 p-1">
          <Icon name="trash" size={18} />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><Icon name="file-text" size={14} /> {bank.questionCount} 题</span>
        {stats && <span className="flex items-center gap-1"><Icon name="check-circle" size={14} className="text-green-500" /> 已练 {stats.uniqueAnswered} 题</span>}
        {stats && stats.wrong > 0 && <span className="flex items-center gap-1 text-red-500"><Icon name="x-circle" size={14} /> {stats.wrong} 错</span>}
      </div>

      {/* 进度条 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {progress > 0 ? `进度 ${progress}% · 正确率 ${accuracy}%` : '尚未开始练习'}
        </div>
        <button
          onClick={onStart}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg active:bg-blue-700"
        >
          开始练习
        </button>
      </div>
    </div>
  );
}
