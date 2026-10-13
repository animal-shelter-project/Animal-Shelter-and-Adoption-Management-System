import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Vitest (npm test) reads this block; Vite ignores it.
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
