import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  // Vitest 3 dùng Vite 7 bên trong (esbuild), cần bật JSX runtime tự động cho file test .jsx
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // Giá trị giả để src/config/supabase.js không báo thiếu .env; test không gọi mạng
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
