export const BUILD_INFO = {
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  commitShort: __GIT_COMMIT_SHORT__,
  commitTime: __GIT_COMMIT_TIME__,
  buildTime: __BUILD_TIME__,
};

export function formatBuildTime(value: string): string {
  if (!value || value === 'unknown') return 'unknown';
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
