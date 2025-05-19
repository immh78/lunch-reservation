import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv';
import { VitePWA } from 'vite-plugin-pwa'

// 현재 NODE_ENV에 따라 올바른 .env 파일 로드
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });


// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(),
    VitePWA({
      registerType: 'autoUpdate', // service worker가 변경되면 자동으로 업데이트
      //includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'], // 정적 파일
      manifest: {
        name: '경원이 영어 단어장',
        short_name: 'GW Eng word',
        description: '경원이 영어 단어장',
        theme_color: '#13547a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/eng-quiz-gw/',
        icons: [
          {
            src: 'notebook.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'notebook.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'notebook.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  base: "/eng-quiz-gw/",
  define: {
    // Vite에서는 process.env 대신 import.meta.env 사용이 권장됩니다
    // 하지만 define을 통해 전역 상수로 정의도 가능합니다 (선택적)
    'process.env': process.env,
  },
})
