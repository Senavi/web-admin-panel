import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

import { DEMO_PRESENT } from './tests/e2e/support/demo';

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
    // Tests of the demo content run only while it is there (pnpm demo:remove deletes both).
    exclude: DEMO_PRESENT
      ? configDefaults.exclude
      : [...configDefaults.exclude, 'tests/unit/demo/**'],
    environment: 'node',
    restoreMocks: true,
    // Suites set up migrated in-memory PGlite databases; under parallel load that can exceed 10 s.
    hookTimeout: 30_000,
  },
});
