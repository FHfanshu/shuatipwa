import { Component, type ErrorInfo, type ReactNode } from 'react';
import Icon from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('应用渲染失败:', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.hash = '#/';
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary px-5">
        <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Icon name="alert-circle" size={28} />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">页面遇到问题</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            当前页面渲染失败，已拦截错误以避免白屏。你可以刷新页面，或回到首页重新进入练习。
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={this.goHome}
              className="flex-1 rounded-xl border border-border-subtle bg-bg-card px-4 py-2.5 text-sm font-medium text-text-secondary active:scale-[0.98]"
            >
              回首页
            </button>
            <button
              onClick={this.reload}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
            >
              刷新
            </button>
          </div>
        </div>
      </div>
    );
  }
}
