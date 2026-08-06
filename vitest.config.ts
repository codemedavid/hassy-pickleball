import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const COVERAGE_THRESHOLD = 80

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // See test/server-only-stub.ts — the real guard still applies at build time.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/features/**/*.ts',
        'src/features/**/*.tsx',
        'src/components/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        // Thin factories over the Supabase SDK with no branching of our own.
        'src/lib/supabase/**',
        // Type-only alias modules.
        'src/lib/repositories/rows.ts',
        'src/lib/domain/types.ts',
        // 'use server' boundaries: one-line delegations to ./server modules,
        // which are the ones under test. Nothing here branches.
        'src/features/**/actions.ts',
      ],
      thresholds: {
        branches: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        lines: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
})
