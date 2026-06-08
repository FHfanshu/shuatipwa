import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { forcePwaUpdate } from '../utils/pwaUpdate';

export default function UpdatePrompt() {
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      await updateServiceWorker(true);
      window.setTimeout(() => {
        void forcePwaUpdate();
      }, 800);
    } catch {
      await forcePwaUpdate();
    }
  };

  return (
    <div className="fixed left-4 right-4 bottom-24 z-[80] rounded-2xl border border-border-default bg-bg-card p-4 shadow-lg">
      <div className="text-sm font-medium text-text-primary">发现新版本</div>
      <div className="mt-1 text-xs text-text-secondary">
        点击更新后会重新加载页面，本地题库和做题记录仍保存在浏览器中。
      </div>
      <button
        type="button"
        disabled={updating}
        className="mt-3 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white disabled:opacity-60 active:scale-[0.98]"
        onClick={handleUpdate}
      >
        {updating ? '正在更新...' : '立即更新'}
      </button>
    </div>
  );
}
