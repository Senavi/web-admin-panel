'use client';

import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react';
import { type ReactElement, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/admin/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Checkbox } from '@/admin/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/admin/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { Label } from '@/admin/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/ui/tabs';
import type { ActionResult } from '@/core/actions/result';
import { ConnectionKind, describeConnection, IPV6_ONLY_MESSAGE } from '@/core/db/connection-info';
import {
  migrateSupabaseAction,
  migrateSupabaseDataAction,
  secureSupabaseAction,
  testSupabaseAction,
  writeSupabaseEnvAction,
} from '@/core/database/actions';
import type { CheckResult } from '@/core/database/supabase-connect';

import { GuideSteps as Steps } from './guide-text';
import {
  CREATE_PROJECT_STEPS,
  HOSTING_GUIDES,
  HostingPlatform,
  hostingSteps,
  HostingVariable,
  KEY_FIELDS,
  type KeyField,
  OPTIONAL_HOSTING_VARIABLES,
  PREPARE_TASKS,
  REQUIRED_HOSTING_VARIABLES,
  SECRET_HOSTING_VARIABLES,
  SUPABASE_DASHBOARD_URL,
} from './hosting-guides';

const STEP_LABELS = [
  'Create project',
  'Paste keys',
  'Prepare database',
  'Add to hosting',
  'Done',
] as const;
const LAST_STEP = STEP_LABELS.length;
const SECRET_BYTES = 32;

type Keys = Record<KeyField['name'], string>;
type TaskState = 'idle' | 'running' | 'done' | 'failed';

/** A random secret (base64url), generated in the browser for the hosting variables. */
function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function mask(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '****';
      return url.toString();
    }
  } catch {
    // Not a URL.
  }
  return value.length <= 8 ? '••••' : `••••${value.slice(-4)}`;
}

function TaskIcon({ state, index }: { state: TaskState; index: number }) {
  if (state === 'running')
    return <Loader2Icon className="size-4 animate-spin" aria-label="In progress" />;
  if (state === 'done')
    return (
      <CheckIcon className="text-emerald-600 dark:text-emerald-400 size-4" aria-label="Done" />
    );
  if (state === 'failed')
    return <XCircleIcon className="text-destructive size-4" aria-label="Failed" />;
  return (
    <span className="text-xs w-4 text-center text-muted-foreground" aria-hidden>
      {index + 1}
    </span>
  );
}

/** The transaction pooler is accepted, but the session pooler is what works reliably on Netlify. */
const TRANSACTION_POOLER_NOTE =
  'Works, but on Netlify the Session pooler (…pooler.supabase.com:5432) is the reliable choice. If you see database errors after deploying, switch to it.';

const CONNECTION_LABELS: Record<ConnectionKind, string> = {
  [ConnectionKind.SharedTransaction]: 'Shared pooler, transaction mode',
  [ConnectionKind.SharedSession]: 'Shared pooler, session mode',
  [ConnectionKind.Direct]: 'Direct connection',
  [ConnectionKind.Dedicated]: 'Dedicated pooler',
  [ConnectionKind.OtherPostgres]: 'Not a Supabase address',
};

/** Detected connection type with an IPv4 / IPv6 badge (Netlify and Vercel need IPv4). */
function ConnectionTypeBadge({ url }: { url: string }) {
  const info = describeConnection(url);
  if (!url.trim() || !info) return null;
  const supabase = info.kind !== ConnectionKind.OtherPostgres;
  return (
    <div role="status" aria-label="Connection type" className="flex flex-col gap-1.5">
      <div className="text-sm flex flex-wrap items-center gap-2">
        <span>{CONNECTION_LABELS[info.kind]}</span>
        {info.kind === ConnectionKind.SharedSession ? <Badge>Recommended</Badge> : null}
        {supabase ? (
          info.ipv4 ? (
            <Badge variant="secondary">IPv4 ✓</Badge>
          ) : (
            <Badge variant="destructive">IPv6 only ⚠</Badge>
          )
        ) : null}
      </div>
      {supabase && !info.ipv4 ? (
        <p className="text-xs text-destructive">{IPV6_ONLY_MESSAGE}</p>
      ) : null}
      {info.kind === ConnectionKind.SharedTransaction ? (
        <p className="text-xs text-muted-foreground">{TRANSACTION_POOLER_NOTE}</p>
      ) : null}
    </div>
  );
}

/**
 * Connect Supabase (development only): create a project, paste the keys, let
 * the app prepare the database and write `.env.local`, then copy the variables
 * to Vercel or Netlify. Five steps with a progress bar.
 */
export function ConnectSupabaseWizard({
  trigger,
  siteUrl,
}: {
  trigger: ReactNode;
  /** Prefilled NEXT_PUBLIC_SITE_URL for the hosting step. */
  siteUrl: string;
}) {
  const [step, setStep] = useState(1);
  const [keys, setKeys] = useState<Keys>({ databaseUrl: '', serviceRoleKey: '', anonKey: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<readonly CheckResult[] | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [copyData, setCopyData] = useState(true);
  const [tasks, setTasks] = useState<TaskState[]>(PREPARE_TASKS.map(() => 'idle'));
  const [taskError, setTaskError] = useState<string | null>(null);
  const [host, setHost] = useState<HostingPlatform>(HostingPlatform.Vercel);
  const [address, setAddress] = useState(siteUrl);
  const [extras, setExtras] = useState<ReadonlySet<HostingVariable>>(new Set());
  const [secrets, setSecrets] = useState<{ auth: string; cron: string } | null>(null);

  const connected = checks !== null && checks.every((check) => check.ok);
  const preparing = tasks.includes('running');
  const prepared = tasks.every((state) => state === 'done');
  const input = { ...keys, bucket: 'media' };

  const setKey = (name: KeyField['name'], value: string) => {
    setKeys((current) => ({ ...current, [name]: value }));
    setChecks(null);
  };

  const checkConnection = async () => {
    setChecking(true);
    setCheckError(null);
    setFieldErrors({});
    const result = await testSupabaseAction(input);
    setChecking(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setCheckError(result.error);
      return;
    }
    setChecks(result.data);
  };

  const prepare = async () => {
    setTaskError(null);
    const steps: Array<() => Promise<ActionResult<unknown>>> = [
      () => migrateSupabaseAction(input),
      () => migrateSupabaseDataAction(input),
      () => secureSupabaseAction(input),
      () => writeSupabaseEnvAction(input),
    ];
    for (const [index, run] of steps.entries()) {
      if (tasks[index] === 'done') continue;
      if (index === 1 && !copyData) {
        setTasks((current) => current.map((state, i) => (i === index ? 'done' : state)));
        continue;
      }
      setTasks((current) => current.map((state, i) => (i === index ? 'running' : state)));
      const result = await run();
      setTasks((current) =>
        current.map((state, i) => (i === index ? (result.ok ? 'done' : 'failed') : state)),
      );
      if (!result.ok) {
        setTaskError(result.error);
        return;
      }
    }
  };

  /** The 2 required variables and the optional ones chosen. */
  const variables = (
    generated: { auth: string; cron: string } | null,
  ): Array<readonly [HostingVariable, string]> => {
    const values: Record<HostingVariable, string> = {
      [HostingVariable.DatabaseUrl]: keys.databaseUrl.trim(),
      [HostingVariable.ServiceRoleKey]: keys.serviceRoleKey.trim(),
      [HostingVariable.SiteUrl]: address.trim(),
      [HostingVariable.AuthSecret]: generated?.auth ?? '',
      [HostingVariable.CronSecret]: generated?.cron ?? '',
    };
    const names: HostingVariable[] = [
      ...REQUIRED_HOSTING_VARIABLES,
      ...OPTIONAL_HOSTING_VARIABLES.map((option) => option.name).filter((name) => extras.has(name)),
    ];
    return names.map((name) => [name, values[name]] as const);
  };

  const toggleExtra = (name: HostingVariable, on: boolean) =>
    setExtras((current) => {
      const next = new Set(current);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  const copyAll = async () => {
    const generated = secrets ?? { auth: randomSecret(), cron: randomSecret() };
    setSecrets(generated);
    const text = variables(generated)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`${text}\n`);
      toast.success(`Copied ${variables(generated).length} variables`);
    } catch {
      toast.error('Could not copy. Allow clipboard access and try again.');
    }
  };

  const next = (): { label: string; disabled: boolean; run: () => void } => {
    switch (step) {
      case 1:
        return { label: 'I have created the project', disabled: false, run: () => setStep(2) };
      case 2:
        return connected
          ? { label: 'Next', disabled: false, run: () => setStep(3) }
          : {
              label: checking ? 'Checking…' : 'Check connection',
              disabled: checking,
              run: () => void checkConnection(),
            };
      case 3:
        return prepared
          ? { label: 'Next', disabled: false, run: () => setStep(4) }
          : {
              label: preparing ? 'Preparing…' : 'Prepare database',
              disabled: preparing,
              run: () => void prepare(),
            };
      case 4:
        return {
          label: 'I have added them and redeployed',
          disabled: false,
          run: () => setStep(5),
        };
      default:
        return { label: '', disabled: true, run: () => undefined };
    }
  };
  const primary = next();

  return (
    <Dialog>
      <DialogTrigger render={trigger as ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Supabase</DialogTitle>
          <DialogDescription>Takes about 5 minutes. You do it once per site.</DialogDescription>
        </DialogHeader>

        <ol aria-label="Progress" className="grid grid-cols-5 gap-2">
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? 'step' : undefined}
              className="flex flex-col gap-1.5"
            >
              <span
                className={cn('h-1 rounded-full', step >= index + 1 ? 'bg-primary' : 'bg-muted')}
              />
              <span
                className={cn(
                  'text-xs hidden sm:block',
                  step === index + 1 ? 'font-medium' : 'text-muted-foreground',
                )}
              >
                {index + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <section aria-label={STEP_LABELS[step - 1]} className="flex flex-col gap-4">
          {step === 1 ? (
            <>
              <h3 className="font-medium">Create a Supabase project</h3>
              <Steps items={CREATE_PROJECT_STEPS} />
              <div>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a href={SUPABASE_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  Open Supabase
                  <ExternalLinkIcon />
                </Button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h3 className="font-medium">Paste the keys</h3>
              <p className="text-sm text-muted-foreground">
                In your Supabase project, copy each value and paste it here. They are saved only on
                this computer, never in the database.
              </p>
              <FieldGroup>
                {KEY_FIELDS.map((field) => {
                  const error = fieldErrors[field.name]?.[0];
                  return (
                    <Field key={field.name} data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor={`sb-${field.name}`}>{field.label}</FieldLabel>
                      <Input
                        id={`sb-${field.name}`}
                        type={field.secret ? 'password' : 'url'}
                        autoComplete="off"
                        placeholder={field.placeholder}
                        value={keys[field.name]}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => setKey(field.name, event.target.value)}
                      />
                      <FieldDescription>Where: {field.where}</FieldDescription>
                      {field.name === 'databaseUrl' ? (
                        <ConnectionTypeBadge url={keys.databaseUrl} />
                      ) : null}
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                })}
              </FieldGroup>
              {checkError ? (
                <Alert variant="destructive">
                  <XCircleIcon />
                  <AlertDescription>{checkError}</AlertDescription>
                </Alert>
              ) : null}
              {checks && !connected ? (
                <Alert variant="destructive">
                  <XCircleIcon />
                  <AlertTitle>Some keys don’t work</AlertTitle>
                  <AlertDescription>
                    <ul>
                      {checks
                        .filter((check) => !check.ok)
                        .map((check) => (
                          <li key={check.name}>
                            {check.name}: {check.message}
                          </li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {connected ? (
                <Alert>
                  <CheckCircle2Icon />
                  <AlertDescription>Connected. Database and file storage answer.</AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h3 className="font-medium">Prepare the database</h3>
              <p className="text-sm text-muted-foreground">
                One click. Your local content, images and admin users move to Supabase.
              </p>
              <ol aria-label="Preparation" className="flex flex-col gap-2">
                {PREPARE_TASKS.map((task, index) => (
                  <li key={task} className="text-sm flex items-center gap-3">
                    <TaskIcon state={tasks[index] ?? 'idle'} index={index} />
                    <span
                      className={cn(tasks[index] === 'idle' && 'text-muted-foreground')}
                      data-state={tasks[index]}
                    >
                      {task}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sb-copy"
                  checked={copyData}
                  disabled={preparing || tasks[1] === 'done'}
                  onCheckedChange={(checked) => setCopyData(checked === true)}
                />
                <Label htmlFor="sb-copy" className="text-sm font-normal">
                  Copy my local content, images and users
                </Label>
              </div>
              {taskError ? (
                <Alert variant="destructive">
                  <XCircleIcon />
                  <AlertTitle>A step failed</AlertTitle>
                  <AlertDescription>{taskError} Fix it and click Prepare again.</AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h3 className="font-medium">Add the keys to your hosting</h3>
              <Tabs value={host} onValueChange={(value) => setHost(value as HostingPlatform)}>
                <p className="text-sm mb-2 text-muted-foreground">Where is the site published?</p>
                <TabsList>
                  {HOSTING_GUIDES.map((guide) => (
                    <TabsTrigger key={guide.id} value={guide.id}>
                      {guide.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {HOSTING_GUIDES.map((guide) => (
                  <TabsContent key={guide.id} value={guide.id} className="pt-3">
                    <Steps items={hostingSteps(guide, 'copy')} />
                  </TabsContent>
                ))}
              </Tabs>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium mb-2">Optional extras</legend>
                {OPTIONAL_HOSTING_VARIABLES.map((option) => (
                  <div key={option.name} className="flex items-start gap-2">
                    <Checkbox
                      id={`sb-extra-${option.name}`}
                      checked={extras.has(option.name)}
                      onCheckedChange={(checked) => toggleExtra(option.name, checked === true)}
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor={`sb-extra-${option.name}`} className="text-sm font-normal">
                        {option.label} ({option.name})
                      </Label>
                      <span className="text-xs text-muted-foreground">{option.help}</span>
                    </div>
                  </div>
                ))}
              </fieldset>
              {extras.has(HostingVariable.SiteUrl) ? (
                <Field>
                  <FieldLabel htmlFor="sb-site-url">Site address</FieldLabel>
                  <Input
                    id="sb-site-url"
                    type="url"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </Field>
              ) : null}
              <div className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {variables(secrets).length} variables
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Secret values are hidden here, copied in full
                    </span>
                  </div>
                  <Button type="button" size="sm" onClick={() => void copyAll()}>
                    <CopyIcon />
                    Copy all
                  </Button>
                </div>
                <dl aria-label="Variables" className="text-xs flex flex-col divide-y font-mono">
                  {variables(secrets).map(([name, value]) => (
                    <div key={name} className="flex flex-wrap justify-between gap-x-4 px-3 py-2">
                      <dt>{name}</dt>
                      <dd className="break-all text-muted-foreground">
                        {!value
                          ? name === HostingVariable.AuthSecret ||
                            name === HostingVariable.CronSecret
                            ? 'generated when you copy'
                            : 'not set'
                          : SECRET_HOSTING_VARIABLES.has(name)
                            ? mask(value)
                            : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="text-sm text-muted-foreground">
                Two variables are enough: the project address and the migration connection are
                derived from the connection string. Keep the copied text private: it gives full
                access to the database.
              </p>
            </>
          ) : null}

          {step === LAST_STEP ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2Icon
                aria-hidden
                className="text-emerald-600 dark:text-emerald-400 size-8"
              />
              <h3 className="font-medium">Supabase is connected</h3>
              <p className="text-sm max-w-md text-muted-foreground">
                Restart the local server (stop <code>pnpm dev</code> and start it again). After the
                redeploy finishes, the live site uses the same database.
              </p>
            </div>
          ) : null}
        </section>

        <DialogFooter>
          {step > 1 && step < LAST_STEP ? (
            <Button
              type="button"
              variant="outline"
              disabled={preparing || checking}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          ) : null}
          {step === LAST_STEP ? (
            <DialogClose render={<Button type="button" />}>Done</DialogClose>
          ) : (
            <Button type="button" disabled={primary.disabled} onClick={primary.run}>
              {primary.disabled ? <Loader2Icon className="animate-spin" /> : null}
              {primary.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
