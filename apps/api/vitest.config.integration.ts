import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['test/**/*.integration-spec.ts'],
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});
