/**
 * Connect Neon: where to find each value in the Neon console and where each
 * environment's variables go on Netlify and Vercel (D-096, D-097). Text between
 * `**` is bold. Update this file when a dashboard changes.
 */
import { HostingPlatform } from './hosting-guides';

export const NEON_CONSOLE_URL = 'https://console.neon.tech/app/projects';

export const NEON_CREATE_STEPS: readonly string[] = [
  'Open **neon.com** and sign in with the agency account. Create the project **there**, not through a Vercel or Netlify integration: only projects created on neon.com can later be handed to the client (**Settings → Transfer project**).',
  'Click **New project**. Name it after the site. Choose the region **closest to your hosting’s server functions** (Netlify: usually US East (Ohio) unless changed; Vercel: Project → Settings → Functions → Region). Object storage exists in AWS US East (Ohio, Virginia), Frankfurt and Singapore.',
  'The default branch is **production**. Open **Branches → New branch**, name it **staging**, parent **production**.',
  'In the **production** branch → **Object storage** → **New bucket** named **media** (access level **private**: the site serves files itself). The staging branch sees it too (copy-on-write: what staging uploads or deletes never reaches production).',
  'For **each branch** create a credential: **Settings → Credentials → New credential** on that branch with **storage:read** and **storage:write**. Copy the key ID (nak_…) and the secret (nsk_…) right away: they are shown once.',
];

export const NEON_TRANSFER_NOTE =
  'Handing the site over: in Neon → **Settings → Transfer project** create a claim link for the client. Works only for projects created on neon.com.';

export interface NeonField {
  readonly name:
    | 'databaseUrl'
    | 'storageEndpoint'
    | 'storageRegion'
    | 'bucket'
    | 'accessKeyId'
    | 'secretAccessKey';
  readonly label: string;
  readonly where: string;
  readonly placeholder: string;
  readonly secret: boolean;
}

export const NEON_FIELDS: readonly NeonField[] = [
  {
    name: 'databaseUrl',
    label: 'Connection string (pooled)',
    where:
      '**Connect** on the project page → choose the branch → **Connection pooling** on → copy. The address contains **-pooler**',
    placeholder:
      'postgresql://neondb_owner:…@ep-…-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    secret: true,
  },
  {
    name: 'storageEndpoint',
    label: 'Storage endpoint',
    where: 'The branch → **Object storage** (the S3 endpoint of this branch)',
    placeholder: 'https://br-….storage.c-1.eu-central-1.aws.neon.tech',
    secret: false,
  },
  {
    name: 'storageRegion',
    label: 'Storage region',
    where: 'Same page, e.g. **eu-central-1**',
    placeholder: 'eu-central-1',
    secret: false,
  },
  {
    name: 'bucket',
    label: 'Bucket',
    where: 'The bucket you created',
    placeholder: 'media',
    secret: false,
  },
  {
    name: 'accessKeyId',
    label: 'Access key ID',
    where: 'The credential of this branch (**nak_…**)',
    placeholder: 'nak_live_…',
    secret: true,
  },
  {
    name: 'secretAccessKey',
    label: 'Secret access key',
    where: 'The credential of this branch (**nsk_…**), shown once',
    placeholder: 'nsk_live_…',
    secret: true,
  },
];

export const NeonEnvironment = { Production: 'production', Staging: 'staging' } as const;
export type NeonEnvironment = (typeof NeonEnvironment)[keyof typeof NeonEnvironment];

export const NEON_ENVIRONMENT_LABELS: Record<NeonEnvironment, string> = {
  production: 'Production (branch main)',
  staging: 'Staging (branch staging)',
};

export type NeonValues = Record<NeonField['name'], string>;

export const EMPTY_NEON_VALUES: NeonValues = {
  databaseUrl: '',
  storageEndpoint: '',
  storageRegion: '',
  bucket: 'media',
  accessKeyId: '',
  secretAccessKey: '',
};

/**
 * Variables of one environment for the hosting platform, in order. Each environment
 * gets its own AUTH_SECRET (staging ≠ production). Staging also marks its database
 * as its own (deploys migrate it) and sends form emails to the team only.
 */
export function neonVariables(
  environment: NeonEnvironment,
  values: NeonValues,
  authSecret: string,
  stagingMailTo: string,
): Array<readonly [string, string]> {
  const variables: Array<readonly [string, string]> = [
    ['DATABASE_URL', values.databaseUrl.trim()],
    ['AUTH_SECRET', authSecret],
    ['S3_ENDPOINT', values.storageEndpoint.trim()],
    ['S3_REGION', values.storageRegion.trim()],
    ['S3_BUCKET', values.bucket.trim()],
    ['S3_ACCESS_KEY_ID', values.accessKeyId.trim()],
    ['S3_SECRET_ACCESS_KEY', values.secretAccessKey.trim()],
  ];
  if (environment === NeonEnvironment.Staging) {
    variables.push(['PREVIEW_DATABASE_ISOLATED', 'true']);
    if (stagingMailTo.trim()) variables.push(['STAGING_MAIL_TO', stagingMailTo.trim()]);
  }
  return variables;
}

/** Variables whose values are masked on screen (copied in full). */
export const SECRET_NEON_VARIABLES: ReadonlySet<string> = new Set([
  'DATABASE_URL',
  'AUTH_SECRET',
  'S3_SECRET_ACCESS_KEY',
]);

/** Where each environment's block goes, per platform. */
export const ENVIRONMENT_HOSTING_STEPS: Readonly<
  Record<HostingPlatform, Readonly<Record<NeonEnvironment, readonly string[]>>>
> = {
  [HostingPlatform.Netlify]: {
    production: [
      '**Site configuration → Environment variables → Add a variable → Import from a .env file**: paste the **Production** block.',
      'Deploy contexts: **Production** only. Save.',
    ],
    staging: [
      '**Site configuration → Build & deploy → Branches and deploy contexts → Branch deploys → Let me add individual branches**: add **staging**.',
      '**Environment variables → Import from a .env file**: paste the **Staging** block with the deploy context **Branch deploys** only.',
      'Leave **Deploy Previews** without database variables: pull-request previews run in preview mode.',
      'Redeploy production and push the staging branch.',
    ],
  },
  [HostingPlatform.Vercel]: {
    production: [
      '**Settings → Environment Variables**: paste the **Production** block into **Key**.',
      'Environments: **Production** only. Save.',
    ],
    staging: [
      'Same page: paste the **Staging** block. Environments: **Preview** only, and choose the branch **staging** (“Select a custom Preview branch”). Save.',
      'Other previews get no database variables: pull-request previews run in preview mode.',
      'Redeploy production and push the staging branch.',
    ],
  },
};
