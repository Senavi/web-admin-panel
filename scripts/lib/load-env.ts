import nextEnv from '@next/env';

// Load .env* files with the same precedence rules as `next dev` / `next build`.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', {
  info: () => undefined,
  error: console.error,
});
