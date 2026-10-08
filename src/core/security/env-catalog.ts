/** Every environment variable the app reads, for the Security page and docs. */
export const EnvRequirement = {
  Production: 'production',
  Optional: 'optional',
  DevOnly: 'development',
} as const;
export type EnvRequirement = (typeof EnvRequirement)[keyof typeof EnvRequirement];

export interface EnvVariable {
  readonly name: string;
  readonly description: string;
  readonly requirement: EnvRequirement;
  /** Secrets are never shown in full. */
  readonly secret: boolean;
}

export const ENV_CATALOG: readonly EnvVariable[] = [
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    description: 'Public origin (canonical URLs, sitemap, OG).',
    requirement: 'production',
    secret: false,
  },
  {
    name: 'DATABASE_URL',
    description: 'Pooled Postgres URL (Supabase transaction pooler, port 6543).',
    requirement: 'production',
    secret: true,
  },
  {
    name: 'DIRECT_URL',
    description: 'Direct Postgres URL for migrations (port 5432).',
    requirement: 'optional',
    secret: true,
  },
  {
    name: 'AUTH_SECRET',
    description: 'Signs sessions and the site-gate cookie (min 32 chars).',
    requirement: 'production',
    secret: true,
  },
  {
    name: 'STORAGE_DRIVER',
    description: '`supabase` or `local`.',
    requirement: 'optional',
    secret: false,
  },
  {
    name: 'SUPABASE_URL',
    description: 'Supabase project URL (storage).',
    requirement: 'production',
    secret: false,
  },
  {
    name: 'SUPABASE_ANON_KEY',
    description: 'Public anon key (connection check only).',
    requirement: 'optional',
    secret: true,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Service role key for storage uploads. Server only.',
    requirement: 'production',
    secret: true,
  },
  {
    name: 'SUPABASE_STORAGE_BUCKET',
    description: 'Storage bucket for media (default `media`).',
    requirement: 'optional',
    secret: false,
  },
  {
    name: 'CRON_SECRET',
    description: 'Protects /api/cron/maintenance (min 16 chars).',
    requirement: 'optional',
    secret: true,
  },
  {
    name: 'PREVIEW_DATABASE_ISOLATED',
    description: '`true` lets preview deploys migrate their own (non-production) database.',
    requirement: 'optional',
    secret: false,
  },
  {
    name: 'SEED_ADMIN_EMAIL',
    description: 'Development only: initial admin email.',
    requirement: 'development',
    secret: false,
  },
  {
    name: 'SEED_ADMIN_PASSWORD',
    description: 'Development only: initial admin password.',
    requirement: 'development',
    secret: true,
  },
];

/** Masks a value for display: secrets show only the last 4 characters; URLs hide credentials. */
export function maskEnvValue(value: string, secret: boolean): string {
  try {
    const url = new URL(value);
    if (url.password || url.username) {
      // ASCII only: URL serialization would percent-encode bullets (%E2%80%A2).
      url.password = url.password ? '****' : '';
      url.username = url.username ? '****' : '';
      return url.toString();
    }
    if (!secret) return value;
  } catch {
    // Not a URL.
  }
  if (!secret) return value;
  return value.length <= 8 ? '••••' : `••••${value.slice(-4)}`;
}

export interface EnvStatus extends EnvVariable {
  readonly set: boolean;
  readonly masked: string | null;
}

export function envStatus(source: Record<string, string | undefined>): EnvStatus[] {
  return ENV_CATALOG.map((variable) => {
    const value = source[variable.name]?.trim();
    return {
      ...variable,
      set: Boolean(value),
      masked: value ? maskEnvValue(value, variable.secret) : null,
    };
  });
}
