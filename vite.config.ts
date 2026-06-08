import { execSync } from 'node:child_process';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function getGitInfo() {
  const fallback = { commit: 'unknown', commitShort: 'unknown', commitTime: 'unknown' };
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
    const commitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
    const commitTime = execSync('git show -s --format=%cI HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
    return { commit, commitShort, commitTime };
  } catch {
    return fallback;
  }
}

export default defineConfig(({ mode }) => {
  const isVercel = !!process.env.VERCEL
  const base = isVercel ? '/' : mode === 'production' ? '/shuatipwa/' : '/'

  const git = getGitInfo();
  const buildInfo = {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'unknown'),
    __GIT_COMMIT__: JSON.stringify(process.env.VITE_GIT_COMMIT ?? process.env.GITHUB_SHA ?? git.commit),
    __GIT_COMMIT_SHORT__: JSON.stringify(
      process.env.VITE_GIT_COMMIT
        ? process.env.VITE_GIT_COMMIT.slice(0, 7)
        : process.env.GITHUB_SHA
          ? process.env.GITHUB_SHA.slice(0, 7)
          : git.commitShort
    ),
    __GIT_COMMIT_TIME__: JSON.stringify(process.env.VITE_GIT_COMMIT_TIME ?? git.commitTime),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  };

  return {
    base,
    define: buildInfo,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: '刷题助手 - 本地离线刷题',
          short_name: '刷题助手',
          description: '本地离线刷题 PWA，数据不离开你的设备',
          start_url: base,
          scope: base,
          theme_color: '#faf8f5',
          background_color: '#f9fafb',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.(html|htm)$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
  }
})
