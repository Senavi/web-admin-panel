import { DatabaseIcon, ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/admin/components/layout/page-header';
import { GuideSteps } from '@/admin/components/security/guide-text';
import {
  CREATE_PROJECT_STEPS,
  HOSTING_GUIDES,
  HOSTING_VARIABLE_HELP,
  hostingSteps,
  KEY_FIELDS,
  REQUIRED_HOSTING_VARIABLES,
  SUPABASE_DASHBOARD_URL,
} from '@/admin/components/security/hosting-guides';
import { Button } from '@/admin/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { isPreviewMode } from '@/core/preview/mode';

export const metadata: Metadata = { title: 'Connect a database' };
export const instant = false;

/** Where each required variable comes from in Supabase (from the Connect dialog's key fields). */
const WHERE: Record<(typeof REQUIRED_HOSTING_VARIABLES)[number], string> = {
  DATABASE_URL: KEY_FIELDS.find((field) => field.name === 'databaseUrl')?.where ?? '',
  SUPABASE_SERVICE_ROLE_KEY:
    KEY_FIELDS.find((field) => field.name === 'serviceRoleKey')?.where ?? '',
};

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {number}. {title}
          </h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Preview mode only (production without a database): the one admin page, a
 * public setup guide. No login, no data. With a database it does not exist.
 */
export default function SetupPage() {
  if (!isPreviewMode()) notFound();
  const variables = REQUIRED_HOSTING_VARIABLES;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="This site isn’t connected to a database yet"
        description="It shows its demo content and can’t be edited. Connect a free Supabase database and add two values on your hosting: about 5 minutes, once per site."
      />
      <Step number={1} title="Create a Supabase project">
        <GuideSteps items={CREATE_PROJECT_STEPS} />
        <div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={SUPABASE_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" />}
          >
            Open Supabase
            <ExternalLinkIcon />
          </Button>
        </div>
      </Step>
      <Step
        number={2}
        title="Copy two values"
        description="In your Supabase project. Keep them private: they give full access to the database. Use the Session pooler address (pooler.supabase.com:5432): Netlify and Vercel connect over IPv4 only."
      >
        <dl aria-label="Values to copy" className="flex flex-col divide-y rounded-md border">
          {variables.map((name) => (
            <div key={name} className="flex flex-col gap-1 p-3">
              <dt className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <code className="font-mono font-medium">{name}</code>
                <span className="text-muted-foreground">{HOSTING_VARIABLE_HELP[name]}</span>
              </dt>
              <dd className="text-xs text-muted-foreground">Where: {WHERE[name]}</dd>
            </div>
          ))}
        </dl>
      </Step>
      <Step
        number={3}
        title="Add them on your hosting and redeploy"
        description="The database is prepared automatically during the deploy (tables, protection, storage for images, demo content)."
      >
        {HOSTING_GUIDES.map((guide) => (
          <section key={guide.id} aria-label={guide.label} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{guide.label}</h3>
            <GuideSteps items={hostingSteps(guide, 'manual')} />
          </section>
        ))}
      </Step>
      <Step number={4} title="Create your admin account">
        <p className="text-sm">
          There is no public sign-up. From a copy of the project on your computer, run this once
          with the same <code className="font-mono">DATABASE_URL</code>, then sign in at this
          address:
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs">
          DATABASE_URL=&quot;…&quot; pnpm admin:create
        </pre>
      </Step>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <DatabaseIcon aria-hidden className="size-4" />
        Until then the site stays hidden from search engines and forms don’t send anything.
      </p>
    </main>
  );
}
