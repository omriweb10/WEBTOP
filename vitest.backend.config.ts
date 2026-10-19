import { defineConfig } from 'vitest/config';

/** Backend tests run against the local Supabase-equivalent stack (npm run stack). */
export default defineConfig({
  test: {
    include: ['tests/backend/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
