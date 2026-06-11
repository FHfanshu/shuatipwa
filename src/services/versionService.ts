const GITHUB_REPO = 'FHfanshu/shuatipwa';

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    const tags = await res.json();
    const latest = tags[0]?.name?.replace(/^v/, '') || '';
    return latest || null;
  } catch {
    return null;
  }
}

export async function applyUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch {
    // fall through to reload
  }
  window.location.reload();
}
