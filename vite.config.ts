import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isVercel = !!process.env.VERCEL
  const base = isVercel ? '/' : mode === 'production' ? '/shuatipwa/' : '/'
  return {
    base,
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
