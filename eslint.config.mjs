import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

/**
 * Import boundaries (docs/ARCHITECTURE.md#boundaries):
 * - core + admin never import the project site layer (`src/site`).
 * - the public site never imports admin UI or server internals of core.
 * - core never imports admin UI.
 */
const SITE_IMPORTS = {
  group: ['@/site', '@/site/*', '**/site/**'],
  message: 'Core and admin must not depend on the project site layer (src/site).',
};
const ADMIN_IMPORTS = {
  group: ['@/admin', '@/admin/*'],
  message: 'Only admin routes may import admin UI (src/admin).',
};
const CORE_SERVER_INTERNALS = {
  group: ['@/core/db', '@/core/db/*', '@/core/auth/server', '@/core/auth/server/*'],
  message:
    'The site reads data through core loaders (e.g. @/core/content), never the DB or auth internals.',
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.data/**',
    'next-env.d.ts',
    'src/core/db/migrations/**',
  ]),
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [SITE_IMPORTS, ADMIN_IMPORTS] }],
    },
  },
  {
    files: ['src/admin/**', 'src/app/(admin)/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [SITE_IMPORTS] }],
    },
  },
  {
    files: ['src/site/**', 'src/app/(site)/**', 'src/content/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ADMIN_IMPORTS, CORE_SERVER_INTERNALS] }],
    },
  },
  {
    files: ['scripts/**', 'tests/**', '*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
