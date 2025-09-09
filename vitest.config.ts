import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/**/*.spec.ts'],
    watchExclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['tests/**', 'dist/**'],
    },
  },
});
