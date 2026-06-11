import { useState, useRef, useEffect, type ReactNode } from 'react';
import { clearAllData } from '../repositories/bankRepo';
import { exportAllAsZip } from '../services/exportService';
import { downloadBlob } from '../utils/export';
import { importFullBackup } from '../services/importService';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/useTheme';
import type { Theme, ColorPalette } from '../contexts/ThemeContext';
import { PALETTE_LABELS, PALETTE_PREVIEW } from '../contexts/themeConstants';
import { BUILD_INFO, formatBuildTime } from '../utils/buildInfo';
import { AI_PROMPT } from '../utils/aiPrompt';
import { getAIConfig, saveAIConfig } from '../repositories/settingsRepo';
import { fetchModels } from '../services/aiService';
import { fetchLatestVersion, applyUpdate } from '../services/versionService';
import ModelSelect from '../components/ModelSelect';

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (open && ref.current) {
      setHeight(ref.current.scrollHeight);
    }
  }, [open]);

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${open ? 'overflow-visible' : 'overflow-hidden'}`}
      style={{ maxHeight: open ? Math.max(height, 720) : 0, opacity: open ? 1 : 0 }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-2 pt-5">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</span>
      </div>
      <div className="bg-bg-card rounded-xl border border-border-subtle divide-y divide-border-subtle">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon, iconBg, iconColor, label, sub, right, onClick, danger,
}: {
  icon: string; iconBg: string; iconColor: string;
  label: string; sub?: string; right?: ReactNode;
  onClick?: () => void; danger?: boolean;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`w-full flex items-center gap-3.5 px-5 py-4 text-left ${onClick ? 'hover:bg-bg-secondary active:scale-[0.99] cursor-pointer' : ''} transition-all`}
    >
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon name={icon} size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-text-primary'}`}>{label}</div>
        {sub && <div className="text-xs text-text-muted mt-0.5 truncate">{sub}</div>}
      </div>
      {right ?? <Icon name="chevron-right" size={16} className="text-text-muted shrink-0" />}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
        copied
          ? 'bg-emerald-500 text-white'
          : 'bg-accent text-white active:bg-accent-hover'
      }`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
      {copied ? '已复制到剪贴板' : '复制提示词'}
    </button>
  );
}

export default function SettingsPage() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ step: string; percent: number } | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const { theme, actualTheme, palette, setTheme, setPalette } = useTheme();

  // AI 配置从 IndexedDB 加载（异步），localStorage 作为 fallback
  const [aiEndpoint, setAiEndpoint] = useState('https://api.deepseek.com');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');

  useEffect(() => {
    getAIConfig().then(config => {
      if (config) {
        setAiEndpoint(config.endpoint);
        setAiKey(config.apiKey);
        setAiModel(config.model);
      }
    });
  }, []);

  // 模型列表：手动拉取，避免输入 API Key 时频繁请求
  const [modelList, setModelList] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const aiConfigured = Boolean(aiEndpoint && aiKey && aiModel);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2500);
  };

  const handleFetchModels = async () => {
    const endpoint = aiEndpoint.trim();
    const apiKey = aiKey.trim();
    if (!endpoint || !apiKey) {
      showToast('error', '请先填写 API 地址和 API Key');
      return;
    }

    setModelsLoading(true);
    try {
      const list = await fetchModels(endpoint, apiKey);
      setModelList(list);
      if (list.length > 0) {
        showToast('success', `已拉取 ${list.length} 个模型`);
      } else {
        showToast('error', '没有拉到模型列表，可手动输入模型名');
      }
    } catch (error) {
      setModelList([]);
      showToast('error', error instanceof Error ? error.message : '模型列表拉取失败');
    } finally {
      setModelsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportProgress({ step: '准备中...', percent: 0 });
      const blob = await exportAllAsZip((step, percent) => {
        setExportProgress({ step, percent });
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `刷题助手备份_${date}.zip`);
      setExportProgress(null);
      showToast('success', '备份已下载');
    } catch (e: unknown) {
      setExportProgress(null);
      showToast('error', '导出失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm('恢复备份将覆盖当前所有数据，确定继续？')) return;
      try {
        await importFullBackup(file);
        showToast('success', '数据恢复成功');
      } catch (err: unknown) {
        showToast('error', '恢复失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
    };
    input.click();
  };

  const saveAI = async () => {
    await saveAIConfig(aiEndpoint.trim(), aiKey.trim(), aiModel.trim());
    // 同步写 localStorage 作为 fallback（兼容旧代码）
    localStorage.setItem('ai_endpoint', aiEndpoint.trim());
    localStorage.setItem('ai_apiKey', aiKey.trim());
    localStorage.setItem('ai_model', aiModel.trim());
    showToast('success', 'AI 设置已保存');
    setAiExpanded(false);
  };

  const handleClearAll = async () => {
    if (!confirm('确定清空所有数据？\n此操作不可撤销！')) return;
    if (!confirm('再次确认：删除所有题库、做题记录和收藏？')) return;
    try {
      await clearAllData();
      showToast('success', '所有数据已清空');
    } catch (e: unknown) {
      showToast('error', '清空失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Header */}
      <div className="px-5 pt-6 pb-1">
        <h1 className="font-display text-3xl font-semibold leading-tight text-text-primary tracking-tight">设置</h1>
      </div>

      <div className="px-5 pb-6 space-y-4">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-in-right ${
              toast.type === 'success'
                ? 'bg-accent text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <Icon name={toast.type === 'success' ? 'check' : 'x'} size={14} />
            {toast.text}
          </div>
        )}

        {/* Export Progress */}
        {exportProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40">
            <div className="bg-bg-card rounded-2xl p-6 w-72 shadow-xl border border-border-subtle space-y-4">
              <div className="text-sm font-medium text-text-primary text-center">{exportProgress.step}</div>
              <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${exportProgress.percent}%` }}
                />
              </div>
              <div className="text-xs text-text-muted text-center">{exportProgress.percent}%</div>
            </div>
          </div>
        )}

        {/* AI 设置 */}
        <Section title="AI">
          <div>
            <Row
              icon="zap"
              iconBg={aiConfigured ? 'bg-accent/10' : 'bg-bg-secondary'}
              iconColor={aiConfigured ? 'text-accent' : 'text-text-muted'}
              label="AI 解析"
              sub={aiConfigured ? `${aiModel} · 已启用` : '答错时自动生成解析'}
              right={
                <div className="flex items-center gap-2 shrink-0">
                  {aiConfigured && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  <Icon name="chevron-right" size={16} className={`text-text-muted transition-transform duration-200 ${aiExpanded ? 'rotate-90' : ''}`} />
                </div>
              }
              onClick={() => setAiExpanded(v => !v)}
            />
            <Collapse open={aiExpanded}>
              <div className="px-4 pb-4 pt-1 space-y-3">
                <form onSubmit={e => e.preventDefault()} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">API 地址</label>
                    <input
                      type="text"
                      value={aiEndpoint}
                      onChange={e => setAiEndpoint(e.target.value)}
                      placeholder="https://api.deepseek.com"
                      className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-bg-secondary text-text-primary placeholder:text-text-muted focus:bg-bg-card focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">API Key</label>
                    <div className="relative">
                      <input
                        type={showAiKey ? 'text' : 'password'}
                        autoComplete="off"
                        value={aiKey}
                        onChange={e => setAiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full border border-border-default rounded-lg py-2 pl-3 pr-10 text-sm bg-bg-secondary text-text-primary placeholder:text-text-muted focus:bg-bg-card focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAiKey(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-secondary active:bg-bg-card"
                        title={showAiKey ? '隐藏 API Key' : '显示 API Key'}
                        aria-label={showAiKey ? '隐藏 API Key' : '显示 API Key'}
                      >
                        <Icon name={showAiKey ? 'eye-off' : 'eye'} size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-text-secondary">模型名称</label>
                      <button
                        type="button"
                        onClick={handleFetchModels}
                        disabled={modelsLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-secondary px-2.5 py-1 text-xs font-medium text-text-secondary transition-all hover:text-accent active:scale-[0.98] disabled:opacity-50"
                      >
                        <Icon name="refresh-cw" size={12} className={modelsLoading ? 'animate-spin' : ''} />
                        {modelsLoading ? '拉取中' : '拉取模型'}
                      </button>
                    </div>
                    <ModelSelect
                      models={modelList}
                      value={aiModel}
                      onChange={setAiModel}
                      loading={modelsLoading}
                    />
                  </div>
                </form>
                <button
                  onClick={saveAI}
                  className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-semibold active:bg-accent-hover active:scale-[0.98] transition-all"
                >
                  保存
                </button>
                <p className="text-xs text-text-muted text-center">
                  支持 OpenAI 兼容协议接口，推荐 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">DeepSeek</a>
                </p>
              </div>
            </Collapse>
          </div>
        </Section>

        {/* 外观 */}
        <Section title="外观">
          <Row
            icon={actualTheme === 'dark' ? 'moon' : 'sun'}
            iconBg="bg-accent/10"
            iconColor="text-accent"
            label="主题模式"
            sub={theme === 'system' ? '跟随系统设置' : actualTheme === 'dark' ? '深色模式' : '浅色模式'}
            right={
              <div className="flex gap-1">
                {(['light', 'dark', 'system'] as Theme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      theme === t
                        ? 'bg-accent text-white'
                        : 'bg-bg-secondary text-text-muted hover:opacity-80'
                    }`}
                  >
                    {t === 'light' ? '浅' : t === 'dark' ? '深' : '自动'}
                  </button>
                ))}
              </div>
            }
          />
          <div className="px-5 py-4">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Icon name="star" size={16} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">配色方案</div>
                <div className="text-xs text-text-muted mt-0.5">选择你喜欢的主题色</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(PALETTE_LABELS) as ColorPalette[]).map(p => {
                const preview = PALETTE_PREVIEW[p];
                const isActive = palette === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPalette(p)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3.5 transition-all active:scale-[0.97] ${
                      isActive
                        ? 'border-accent bg-accent/5 shadow-sm'
                        : 'border-border-subtle bg-bg-card hover:border-border-default'
                    }`}
                  >
                    <div className="flex gap-1.5">
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: actualTheme === 'dark' ? preview.darkAccent : preview.accent }} />
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: actualTheme === 'dark' ? preview.dark : preview.light }} />
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-text-secondary'}`}>
                      {PALETTE_LABELS[p]}
                    </span>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                        <Icon name="check" size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* 数据 */}
        <Section title="数据">
          <Row
            icon="download"
            iconBg="bg-accent/10"
            iconColor="text-accent"
            label="导出备份"
            sub="下载全部数据为 ZIP"
            onClick={handleExport}
          />
          <Row
            icon="upload"
            iconBg="bg-accent/10"
            iconColor="text-accent"
            label="恢复备份"
            sub="从 ZIP/JSON 文件导入"
            onClick={handleRestore}
          />
          <Row
            icon="trash"
            iconBg="bg-red-500/10"
            iconColor="text-red-500"
            label="清空所有数据"
            sub="删除所有题库和记录"
            onClick={handleClearAll}
            danger
          />
        </Section>

        {/* 转换提示词 */}
        <Section title="工具">
          <div>
            <Row
              icon="file-text"
              iconBg="bg-accent/10"
              iconColor="text-accent"
              label="AI 转换提示词"
              sub="将 Word/PDF 转为可导入的 JSON"
              right={
                <Icon name="chevron-right" size={16} className={`text-text-muted transition-transform duration-200 shrink-0 ${promptExpanded ? 'rotate-90' : ''}`} />
              }
              onClick={() => setPromptExpanded(v => !v)}
            />
            <Collapse open={promptExpanded}>
              <div className="px-4 pb-4 pt-1 space-y-3">
                <p className="text-xs text-text-secondary">把题库内容粘贴给 AI，配合此提示词一键转换格式。</p>
                <div className="bg-bg-secondary rounded-lg p-3 max-h-32 overflow-y-auto border border-border-subtle">
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed font-mono">{AI_PROMPT}</pre>
                </div>
                <CopyButton text={AI_PROMPT} />
              </div>
            </Collapse>
          </div>
        </Section>

        {/* 提示 */}
        <div className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden divide-y divide-border-subtle">
          <div className="flex items-start gap-3 px-5 py-4">
            <Icon name="smartphone" size={14} className="text-text-muted mt-0.5 shrink-0" />
            <span className="text-xs text-text-secondary leading-relaxed">添加到主屏幕后可像 App 一样使用，支持离线访问</span>
          </div>
          <div className="flex items-start gap-3 px-5 py-4">
            <Icon name="refresh-cw" size={14} className="text-text-muted mt-0.5 shrink-0" />
            <span className="text-xs text-text-secondary leading-relaxed">建议定期导出备份，防止数据丢失</span>
          </div>
        </div>

        {/* 版本 */}
        <div className="text-center pt-4 pb-2 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-text-muted font-mono">
              v{BUILD_INFO.version} · {BUILD_INFO.commitShort}
            </span>
            <button
              onClick={async () => {
                if (latestVersion) {
                  showToast('success', `正在更新到 v${latestVersion}...`);
                  await applyUpdate();
                  return;
                }
                if (checking) return;
                setChecking(true);
                showToast('success', '正在检查更新...');
                const latest = await fetchLatestVersion();
                setChecking(false);
                if (latest && latest !== BUILD_INFO.version) {
                  setLatestVersion(latest);
                  showToast('success', `发现新版本 v${latest}`);
                } else {
                  showToast('success', '已是最新版本');
                }
              }}
              disabled={checking}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs active:bg-bg-secondary ${
                latestVersion ? 'text-accent font-medium' : 'text-text-muted'
              }`}
              title={latestVersion ? `点击更新到 v${latestVersion}` : '检查并刷新应用'}
            >
              <Icon name={latestVersion ? 'download' : 'refresh-cw'} size={13} />
              {checking ? '检查中...' : latestVersion ? `v${latestVersion} → 更新` : '检查更新'}
            </button>
          </div>
          <div className="text-[11px] text-text-muted/70">
            提交：{formatBuildTime(BUILD_INFO.commitTime)} · 构建：{formatBuildTime(BUILD_INFO.buildTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
