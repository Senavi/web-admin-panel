'use client';

import {
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import { Checkbox } from '@/admin/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/admin/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { Label } from '@/admin/ui/label';
import type { ActionResult } from '@/core/actions/result';
import {
  migrateSupabaseAction,
  migrateSupabaseDataAction,
  secureSupabaseAction,
  testSupabaseAction,
  writeSupabaseEnvAction,
} from '@/core/database/actions';

const FIELDS = [
  {
    name: 'supabaseUrl',
    label: 'Project URL',
    where: 'Project Settings → Data API → Project URL',
    secret: false,
    placeholder: 'https://xyz.supabase.co',
  },
  {
    name: 'anonKey',
    label: 'anon (public) key',
    where: 'Project Settings → API Keys → anon public',
    secret: true,
    placeholder: '',
  },
  {
    name: 'serviceRoleKey',
    label: 'service_role key',
    where: 'Project Settings → API Keys → service_role (secret)',
    secret: true,
    placeholder: '',
  },
  {
    name: 'databaseUrl',
    label: 'Pooled DATABASE_URL',
    where: 'Connect → Transaction pooler (port 6543)',
    secret: true,
    placeholder: 'postgresql://postgres.xyz:…@…pooler.supabase.com:6543/postgres',
  },
  {
    name: 'directUrl',
    label: 'Direct DIRECT_URL',
    where: 'Connect → Direct connection / Session pooler (port 5432)',
    secret: true,
    placeholder: 'postgresql://postgres:…@db.xyz.supabase.co:5432/postgres',
  },
] as const;

type Values = Record<(typeof FIELDS)[number]['name'], string> & { bucket: string };
type StepState = 'idle' | 'running' | 'done' | 'failed';

const STEPS = [
  'Test connection',
  'Run migrations',
  'Migrate data',
  'Secure the database',
  'Save to .env.local',
] as const;

function StepIcon({ state }: { state: StepState }) {
  if (state === 'running')
    return <Loader2Icon className="size-4 animate-spin" aria-label="Running" />;
  if (state === 'done')
    return <CheckCircle2Icon className="text-emerald-600 size-4" aria-label="Done" />;
  if (state === 'failed')
    return <XCircleIcon className="text-destructive size-4" aria-label="Failed" />;
  return <CircleIcon className="size-4 text-muted-foreground" aria-hidden />;
}

/** Multi-step dialog that moves the local database to Supabase (development only). */
export function ConnectSupabaseWizard({ trigger }: { trigger: ReactNode }) {
  const [values, setValues] = useState<Values>({
    supabaseUrl: '',
    anonKey: '',
    serviceRoleKey: '',
    databaseUrl: '',
    directUrl: '',
    bucket: 'media',
  });
  const [states, setStates] = useState<StepState[]>(STEPS.map(() => 'idle'));
  const [details, setDetails] = useState<ReactNode[]>(STEPS.map(() => null));
  const [copyData, setCopyData] = useState(true);
  const filled = FIELDS.every((field) => values[field.name].trim() !== '');

  const runStep = async <T,>(
    index: number,
    action: (input: unknown) => Promise<ActionResult<T>>,
    describe: (data: T) => ReactNode,
  ) => {
    setStates((current) => current.map((state, i) => (i === index ? 'running' : state)));
    const result = await action(values);
    const failedChecks =
      result.ok &&
      Array.isArray(result.data) &&
      result.data.some((check: { ok: boolean }) => !check.ok);
    setStates((current) =>
      current.map((state, i) =>
        i === index ? (result.ok && !failedChecks ? 'done' : 'failed') : state,
      ),
    );
    setDetails((current) =>
      current.map((detail, i) =>
        i === index ? (
          result.ok ? (
            describe(result.data)
          ) : (
            <span className="text-destructive">{result.error}</span>
          )
        ) : (
          detail
        ),
      ),
    );
    if (result.ok && result.message) toast.success(result.message);
  };

  const canRun = (index: number) =>
    filled &&
    states.slice(0, index).every((state, i) => state === 'done' || (i === 2 && !copyData));

  return (
    <Dialog>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Supabase</DialogTitle>
          <DialogDescription>
            Moves this project from the local database to Supabase Postgres + Storage. Values are
            written to <code>.env.local</code> only and never stored in the database.{' '}
            <a
              href="https://supabase.com/dashboard/projects"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              Open Supabase <ExternalLinkIcon className="size-3" />
            </a>
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {FIELDS.map((field) => (
            <Field key={field.name}>
              <FieldLabel htmlFor={`sb-${field.name}`}>{field.label}</FieldLabel>
              <Input
                id={`sb-${field.name}`}
                type={field.secret ? 'password' : 'url'}
                autoComplete="off"
                placeholder={field.placeholder}
                value={values[field.name]}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
              <FieldDescription>Where to find it: {field.where}</FieldDescription>
            </Field>
          ))}
        </FieldGroup>

        <ol className="mt-4 flex flex-col gap-3" aria-label="Steps">
          {STEPS.map((step, index) => (
            <li key={step} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <StepIcon state={states[index] ?? 'idle'} />
                <span className="text-sm font-medium flex-1">
                  {index + 1}. {step}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !canRun(index) || states[index] === 'running' || (index === 2 && !copyData)
                  }
                  onClick={() => {
                    if (index === 0)
                      void runStep(0, testSupabaseAction, (checks) => (
                        <ul className="text-xs">
                          {checks.map((check) => (
                            <li key={check.name} className={check.ok ? '' : 'text-destructive'}>
                              {check.ok ? '✓' : '✗'} {check.name}: {check.message}
                            </li>
                          ))}
                        </ul>
                      ));
                    if (index === 1)
                      void runStep(1, migrateSupabaseAction, () => 'Schema is up to date.');
                    if (index === 2)
                      void runStep(
                        2,
                        migrateSupabaseDataAction,
                        (data) =>
                          `${Object.values(data.rows).reduce((a, b) => a + b, 0)} rows and ${data.files} files copied.`,
                      );
                    if (index === 3)
                      void runStep(
                        3,
                        secureSupabaseAction,
                        (data) =>
                          `RLS enabled on ${data.tables.length} tables; bucket is public-read, server-write.`,
                      );
                    if (index === 4)
                      void runStep(
                        4,
                        writeSupabaseEnvAction,
                        (data) => `Wrote ${data.variables.join(', ')}.`,
                      );
                  }}
                >
                  Run
                </Button>
              </div>
              {index === 2 ? (
                <div className="flex items-center gap-2 ps-6">
                  <Checkbox
                    id="sb-copy"
                    checked={copyData}
                    onCheckedChange={(checked) => setCopyData(checked === true)}
                  />
                  <Label htmlFor="sb-copy" className="text-xs font-normal">
                    Copy users, settings, content, revisions and media (recommended)
                  </Label>
                </div>
              ) : null}
              {details[index] ? (
                <div className="text-xs ps-6 text-muted-foreground">{details[index]}</div>
              ) : null}
            </li>
          ))}
        </ol>
        {states[4] === 'done' ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Restart the dev server</AlertTitle>
            <AlertDescription>
              Stop and start <code>pnpm dev</code>. The local database banner disappears once the
              app runs on Supabase.
            </AlertDescription>
          </Alert>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
