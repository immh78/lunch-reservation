import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv';

// 현재 NODE_ENV에 따라 올바른 .env 파일 로드
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });


// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(),
  ],
  base: "/lunch-reservation/",
  define: {
    // Vite에서는 process.env 대신 import.meta.env 사용이 권장됩니다
    // 하지만 define을 통해 전역 상수로 정의도 가능합니다 (선택적)
    'process.env': process.env,
  },
})
