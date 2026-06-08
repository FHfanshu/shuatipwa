/**
 * 强制 PWA 更新：先尝试 registration.update() + SKIP_WAITING，
 * 失败时退化为普通 reload。
 */
export async function forcePwaUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    window.location.reload();
    return;
  }

  await registration.update();

  if (registration.waiting) {
    let reloaded = false;

    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(reload, 1500);
    return;
  }

  window.location.reload();
}
