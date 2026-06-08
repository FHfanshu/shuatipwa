import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
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

  useEffect(() => {
    if (!needRefresh) return;

    let settled = false;
    const fallback = window.setTimeout(() => {
      if (!settled) window.location.reload();
    }, 1500);

    void updateServiceWorker(true)
      .catch(() => {
        window.location.reload();
      })
      .finally(() => {
        settled = true;
        window.clearTimeout(fallback);
      });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
