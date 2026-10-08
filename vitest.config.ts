import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@project/config': fromRoot('./project.config.ts'),
      '@': fromRoot('./src'),
      // `server-only` throws outside the React server condition; unit tests run in plain Node.
      'server-only': fromRoot('./tests/support/empty-module.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
