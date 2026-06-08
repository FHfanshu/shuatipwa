import { useState, useEffect } from 'react';

export const CURRENT_VERSION = '0.2.0';
const GITHUB_REPO = 'FHfanshu/shuatipwa';
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return;
        const tags = await res.json();
        const latest = tags[0]?.name?.replace(/^v/, '') || '';
        if (latest && latest !== CURRENT_VERSION) {
          setLatestVersion(latest);
          setHasUpdate(true);
        }
      } catch {
        // ignore network errors
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const applyUpdate = () => {
    // Try service worker update first, then hard reload
    navigator.serviceWorker?.getRegistration().then(reg => {
      if (reg) {
        reg.update().then(() => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }).catch(() => {
      window.location.reload();
    });
  };

  return { hasUpdate, latestVersion, applyUpdate };
}
