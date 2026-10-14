/**
 * Connect Supabase: where to find each key and how to add the variables on a
 * hosting platform. Text between `**` is shown in bold. Update this file when
 * a dashboard changes; the wizard renders whatever is listed here.
 */

export const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard/projects';

export const CREATE_PROJECT_STEPS: readonly string[] = [
  'Open Supabase and sign in (a free account is enough to start).',
  'Click **New project**. Name it after the site, for example **acme-studio**.',
  'Choose the **same region as your hosting’s server functions** (Vercel: Project → Settings → Functions → Region; Netlify: the functions region in Site configuration). Every database query travels between them; pages for visitors are cached anyway.',
  'Make up a database password and **save it**. You will need it in the next step.',
];

export interface KeyField {
  readonly name: 'serviceRoleKey' | 'databaseUrl' | 'anonKey';
  readonly label: string;
  readonly where: string;
  readonly placeholder: string;
  readonly secret: boolean;
  readonly optional?: boolean;
}

export const KEY_FIELDS: readonly KeyField[] = [
  {
    name: 'databaseUrl',
    label: 'Connection string',
    where:
      'Connect (top of the project) → Shared pooler → Transaction pooler (the address with pooler.supabase.com:6543). Put your database password instead of [YOUR-PASSWORD]',
    placeholder:
      'postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-….pooler.supabase.com:6543/postgres',
    secret: true,
  },
  {
    name: 'serviceRoleKey',
    label: 'Secret key (service_role)',
    where: 'Project Settings → API Keys → service_role → Reveal',
    placeholder: 'eyJhbGciOi…',
    secret: true,
  },
  {
    name: 'anonKey',
    label: 'Public key (anon), optional',
    where: 'Project Settings → API Keys → anon public. Only used to double-check the project',
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

/** How the hosting step adds variables: one paste ("Copy all") or one by one (setup page). */
export type HostingStepMode = 'copy' | 'manual';

export interface HostingGuide {
  readonly id: HostingPlatform;
  readonly label: string;
  readonly open: string;
  readonly add: Readonly<Record<HostingStepMode, string>>;
  readonly scope: string;
  readonly redeploy: string;
}

export const HOSTING_GUIDES: readonly HostingGuide[] = [
  {
    id: HostingPlatform.Vercel,
    label: 'Vercel',
    open: 'Open your project on **vercel.com** → **Settings** → **Environment Variables**.',
    add: {
      copy: 'Click **Copy all** below and paste into the **Key** field. Vercel fills in every variable at once.',
      manual: 'Add each variable below: its name in **Key**, its value in **Value**.',
    },
    scope: 'Under **Environments**, leave only **Production**, then click **Save**.',
    redeploy: 'Go to **Deployments**, open the latest one, **⋯** → **Redeploy**.',
  },
  {
    id: HostingPlatform.Netlify,
    label: 'Netlify',
    open: 'Open your site on **app.netlify.com** → **Site configuration** → **Environment variables**.',
    add: {
      copy: 'Click **Add a variable** → **Import from a .env file**, then click **Copy all** below and paste it there.',
      manual: 'Click **Add a variable** → **Add a single variable** for each variable below.',
    },
    scope: 'Set deploy contexts to **Production** and save.',
    redeploy: 'Go to **Deploys** → **Trigger deploy** → **Deploy site**.',
  },
];

/** The four steps of one hosting guide. */
export function hostingSteps(guide: HostingGuide, mode: HostingStepMode): string[] {
  return [guide.open, guide.add[mode], guide.scope, guide.redeploy];
}

/** Variables for the hosting platform, in the order they are shown and copied. */
export const HostingVariable = {
  DatabaseUrl: 'DATABASE_URL',
  ServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
  SiteUrl: 'NEXT_PUBLIC_SITE_URL',
  AuthSecret: 'AUTH_SECRET',
  CronSecret: 'CRON_SECRET',
} as const;
export type HostingVariable = (typeof HostingVariable)[keyof typeof HostingVariable];

/**
 * The only variables a Supabase deploy needs (D-086): the project URL and the
 * migration connection are derived from DATABASE_URL.
 */
export const REQUIRED_HOSTING_VARIABLES = [
  HostingVariable.DatabaseUrl,
  HostingVariable.ServiceRoleKey,
] as const;

/** Optional extras the person can add in the Connect dialog. */
export const OPTIONAL_HOSTING_VARIABLES: ReadonlyArray<{
  readonly name: HostingVariable;
  readonly label: string;
  readonly help: string;
}> = [
  {
    name: HostingVariable.SiteUrl,
    label: 'Site address',
    help: 'Only for your own domain. Otherwise the hosting address is used.',
  },
  {
    name: HostingVariable.AuthSecret,
    label: 'Own sign-in secret',
    help: 'Otherwise it is derived from the secret key; changing that key then signs everyone out.',
  },
  {
    name: HostingVariable.CronSecret,
    label: 'Cron secret',
    help: 'Turns on the daily maintenance job (it also runs on its own when needed).',
  },
];

/** Plain-language description of each variable (setup page). */
export const HOSTING_VARIABLE_HELP: Readonly<Record<HostingVariable, string>> = {
  [HostingVariable.DatabaseUrl]:
    'Connection string (Shared pooler → Transaction pooler, port 6543)',
  [HostingVariable.ServiceRoleKey]: 'Secret key (service_role)',
  [HostingVariable.SiteUrl]: 'Your own domain, optional',
  [HostingVariable.AuthSecret]: 'Optional',
  [HostingVariable.CronSecret]: 'Optional',
};

/** Variables whose values are hidden on screen (copied in full). */
export const SECRET_HOSTING_VARIABLES: ReadonlySet<HostingVariable> = new Set([
  HostingVariable.DatabaseUrl,
  HostingVariable.ServiceRoleKey,
  HostingVariable.AuthSecret,
  HostingVariable.CronSecret,
]);
