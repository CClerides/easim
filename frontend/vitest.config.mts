import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const here = import.meta.dirname

// Tests read the same .env.local the dev server does, so integration tests
// (Supabase RLS in particular) hit the real project without a second config.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
      // `server-only` throws when resolved outside a server bundle. That is
      // the point of it during a Next build, and a nuisance in a test runner,
      // so tests get a no-op instead. The real guard still protects the build.
      'server-only': resolve(here, 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    env: loadEnv(mode, here, ''),
    exclude: ['e2e/**', 'node_modules/**'],
    // Several suites are integration tests against one shared Supabase
    // project, and they claim eSIMs from the same finite pool. Running files
    // in parallel makes them interfere with each other's stock, which shows
    // up as failures that have nothing to do with the code under test.
    fileParallelism: false,
    // The webhook suite waits on asynchronous fulfilment over real HTTP.
    testTimeout: 30_000,
  },
}))
