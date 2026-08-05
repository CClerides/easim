import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Tests read the same .env.local the dev server does, so integration tests
// (Supabase RLS in particular) hit the real project without a second config.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    env: loadEnv(mode, __dirname, ''),
    exclude: ['e2e/**', 'node_modules/**'],
  },
}))
