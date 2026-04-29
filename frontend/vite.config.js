import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Cache-bust: 2026-02-25
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    force: true,
  },
})
