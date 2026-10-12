/**
 * Connect Supabase: where to find each key and how to add the variables on a
 * hosting platform. Text between `**` is shown in bold. Update this file when
 * a dashboard changes; the wizard renders whatever is listed here.
 */

export const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard/projects';

export const CREATE_PROJECT_STEPS: readonly string[] = [
  'Open Supabase and sign in (a free account is enough to start).',
  'Click **New project**. Name it after the site, for example **acme-studio**.',
  'Choose the region closest to your visitors, for example **Frankfurt**.',
  'Make up a database password and **save it**. You will need it in the next step.',
];

export interface KeyField {
  readonly name: 'supabaseUrl' | 'serviceRoleKey' | 'databaseUrl' | 'directUrl' | 'anonKey';
  readonly label: string;
  readonly where: string;
  readonly placeholder: string;
  readonly secret: boolean;
  readonly optional?: boolean;
}

export const KEY_FIELDS: readonly KeyField[] = [
  {
    name: 'supabaseUrl',
    label: 'Project URL',
    where: 'Project Settings → Data API',
    placeholder: 'https://xxxx.supabase.co',
    secret: false,
  },
  {
    name: 'serviceRoleKey',
    label: 'Secret key (service_role)',
    where: 'Project Settings → API Keys → service_role → Reveal',
    placeholder: 'eyJhbGciOi…',
    secret: true,
  },
  {
    name: 'databaseUrl',
    label: 'Connection string',
    where:
      'Connect (top of the project) → Transaction pooler (port 6543). Put your database password instead of [PASSWORD]',
    placeholder: 'postgresql://postgres.xxxx:[PASSWORD]@…:6543/postgres',
    secret: true,
  },
  {
    name: 'directUrl',
    label: 'Direct connection string',
    where: 'Connect → Direct connection (port 5432, same password)',
    placeholder: 'postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres',
    secret: true,
  },
  {
    name: 'anonKey',
    label: 'Public key (anon), optional',
    where: 'Project Settings → API Keys → anon public. Only used to double-check the project URL',
    placeholder: 'eyJhbGciOi…',
    secret: true,
    optional: true,
  },
];

export const PREPARE_TASKS = [
  'Create the tables',
  'Copy content, images and users',
  'Protect the tables from outside access and create storage for images',
  'Save the keys on this computer (.env.local)',
] as const;

export const HostingPlatform = { Vercel: 'vercel', Netlify: 'netlify' } as const;
export type HostingPlatform = (typeof HostingPlatform)[keyof typeof HostingPlatform];

export interface HostingGuide {
  readonly id: HostingPlatform;
  readonly label: string;
  readonly steps: readonly string[];
}

export const HOSTING_GUIDES: readonly HostingGuide[] = [
  {
    id: HostingPlatform.Vercel,
    label: 'Vercel',
    steps: [
      'Open your project on **vercel.com** → **Settings** → **Environment Variables**.',
      'Click **Copy all** below and paste into the **Key** field. Vercel fills in every variable at once.',
      'Under **Environments**, leave only **Production**, then click **Save**.',
      'Go to **Deployments**, open the latest one, **⋯** → **Redeploy**.',
    ],
  },
  {
    id: HostingPlatform.Netlify,
    label: 'Netlify',
    steps: [
      'Open your site on **app.netlify.com** → **Site configuration** → **Environment variables**.',
      'Click **Add a variable** → **Import from a .env file**.',
      'Click **Copy all** below, paste it there, set deploy contexts to **Production** and click **Import variables**.',
      'Go to **Deploys** → **Trigger deploy** → **Deploy site**.',
    ],
  },
];

/** Variables for the hosting platform, in the order they are shown and copied. */
export const HostingVariable = {
  SiteUrl: 'NEXT_PUBLIC_SITE_URL',
  DatabaseUrl: 'DATABASE_URL',
  DirectUrl: 'DIRECT_URL',
  SupabaseUrl: 'SUPABASE_URL',
  ServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
  AuthSecret: 'AUTH_SECRET',
  CronSecret: 'CRON_SECRET',
} as const;
export type HostingVariable = (typeof HostingVariable)[keyof typeof HostingVariable];

/** Variables whose values are hidden on screen (copied in full). */
export const SECRET_HOSTING_VARIABLES: ReadonlySet<HostingVariable> = new Set([
  HostingVariable.DatabaseUrl,
  HostingVariable.DirectUrl,
  HostingVariable.ServiceRoleKey,
  HostingVariable.AuthSecret,
  HostingVariable.CronSecret,
]);
