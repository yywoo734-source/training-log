import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// SINGLE=1 로 빌드하면 서비스워커 없이 파일 하나로 합칠 수 있는 결과물이 나온다
const single = !!process.env.SINGLE

export default defineConfig({
  // 정적 호스팅 어디에 올려도 되도록 상대경로로 뽑는다. GitHub Pages처럼 하위경로면 BASE로 알려준다
  base: process.env.BASE ?? './',
  plugins: [
    react(),
    ...(single ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-180.png'],
      manifest: {
        name: '훈련기록',
        short_name: '훈련기록',
        description: '운동·식단·회복을 기록하고 다음 행동을 추천받는 개인용 앱',
        lang: 'ko',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9ebee',
        theme_color: '#e9ebee',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 헬스장 지하에서 신호가 없어도 열려야 한다
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    })]),
  ],
})
