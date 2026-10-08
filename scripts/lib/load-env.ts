import { loadEnvConfig } from '@next/env';

// Load .env* files with the same precedence rules as `next dev` / `next build`.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', {
  info: () => undefined,
  error: console.error,
});
