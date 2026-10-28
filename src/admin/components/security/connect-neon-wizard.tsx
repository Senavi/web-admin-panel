'use client';

import { CheckCircle2Icon, CopyIcon, ExternalLinkIcon, InfoIcon, XCircleIcon } from 'lucide-react';
import { type ReactElement, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/admin/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Button } from '@/admin/ui/button';
import { Checkbox } from '@/admin/ui/checkbox';
import {
  Dialog,
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
import { inspectNeonAction, prepareNeonAction, testNeonAction } from '@/core/database/actions';
import {
  describeRemoteContent,
  hasRemoteContent,
  type RemoteContentSummary,
} from '@/core/database/remote-summary';
import type { CheckResult } from '@/core/database/supabase-connect';

import { GuideSteps as Steps, GuideText } from './guide-text';
import { HOSTING_GUIDES, HostingPlatform } from './hosting-guides';
import {
  EMPTY_NEON_VALUES,
  ENVIRONMENT_HOSTING_STEPS,
  NEON_CONSOLE_URL,
  NEON_CREATE_STEPS,
  NEON_ENVIRONMENT_LABELS,
  NEON_FIELDS,
  NEON_TRANSFER_NOTE,
  NeonEnvironment,
  type NeonValues,
  neonVariables,
  SECRET_NEON_VARIABLES,
} from './neon-guides';
import { mask, randomSecret, TaskIcon, type TaskState } from './wizard-parts';

const STEP_LABELS = [
  'Create project',
  'Paste values',
  'Prepare',
  'Add to hosting',
  'Done',
] as const;
const LAST_STEP = STEP_LABELS.length;
const ENVIRONMENTS = [NeonEnvironment.Production, NeonEnvironment.Staging] as const;

type Values = Record<NeonEnvironment, NeonValues>;

/**
 * Connect Neon (recommended): one Neon project, branches `production` and
 * `staging`, Object Storage. Checks both environments, optionally prepares
 * production now, and gives a "Copy all" block per environment with its own
 * AUTH_SECRET. Nothing is written to this computer: development stays local.
 */
export function ConnectNeonWizard({
  trigger,
  staffEmail,
}: {
  trigger: ReactNode;
  /** Default for STAGING_MAIL_TO (the signed-in admin). */
  staffEmail: string;
}) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>({
    production: EMPTY_NEON_VALUES,
    staging: EMPTY_NEON_VALUES,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<readonly CheckResult[] | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [online, setOnline] = useState<RemoteContentSummary | null>(null);
  const [copyLocal, setCopyLocal] = useState(false);
  const [prepare, setPrepare] = useState<TaskState>('idle');
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [host, setHost] = useState<HostingPlatform>(HostingPlatform.Netlify);
  const [mailTo, setMailTo] = useState(staffEmail);
  // One fresh secret per environment (staging ≠ production), generated on first copy.
  const [secrets, setSecrets] = useState<Record<NeonEnvironment, string> | null>(null);

  const connected = checks !== null && checks.every((check) => check.ok);

  const setValue = (environment: NeonEnvironment, name: keyof NeonValues, value: string) => {
    setValues((current) => ({
      ...current,
      [environment]: { ...current[environment], [name]: value },
    }));
    setChecks(null);
  };

  const check = async () => {
    setChecking(true);
    setCheckError(null);
    setErrors({});
    const result = await testNeonAction(values);
    setChecking(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setCheckError(result.error);
      return;
    }
    setChecks(result.data);
    if (result.data.every((item) => item.ok)) {
      const summary = await inspectNeonAction(values.production);
      setOnline(summary.ok ? summary.data : null);
    }
  };

  const runPrepare = async () => {
    setPrepare('running');
    setPrepareError(null);
    const result = await prepareNeonAction({ production: values.production, copyLocal });
    if (!result.ok) {
      setPrepare('failed');
      setPrepareError(result.error);
      return;
    }
    setPrepare('done');
    toast.success(result.message ?? 'Database prepared.');
  };

  const copyBlock = async (environment: NeonEnvironment) => {
    const generated = secrets ?? { production: randomSecret(), staging: randomSecret() };
    setSecrets(generated);
    const text = neonVariables(environment, values[environment], generated[environment], mailTo)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`${text}\n`);
      toast.success(`Copied the ${environment} variables`);
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
              run: () => void check(),
            };
      case 3:
        return prepare === 'done'
          ? { label: 'Next', disabled: false, run: () => setStep(4) }
          : {
              label: prepare === 'running' ? 'Preparing…' : 'Prepare production',
              disabled: prepare === 'running',
              run: () => void runPrepare(),
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
          <DialogTitle>Connect Neon</DialogTitle>
          <DialogDescription>
            Database and file storage for production and staging. About 10 minutes, once per site.
          </DialogDescription>
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
                  'hidden text-xs sm:block',
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
              <h3 className="font-medium">Create the Neon project</h3>
              <Steps items={NEON_CREATE_STEPS} />
              <p className="text-sm text-muted-foreground">
                <GuideText text={NEON_TRANSFER_NOTE} />
              </p>
              <div>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={NEON_CONSOLE_URL} target="_blank" rel="noopener noreferrer" />}
                >
                  Open Neon
                  <ExternalLinkIcon />
                </Button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h3 className="font-medium">Paste the values of both branches</h3>
              <p className="text-sm text-muted-foreground">
                They stay in this dialog: nothing is saved on this computer or in the database.
              </p>
              {ENVIRONMENTS.map((environment) => (
                <fieldset key={environment} className="flex flex-col gap-3 rounded-lg border p-4">
                  <legend className="px-1 text-sm font-medium">
                    {NEON_ENVIRONMENT_LABELS[environment]}
                  </legend>
                  <FieldGroup>
                    {NEON_FIELDS.map((field) => {
                      const id = `neon-${environment}-${field.name}`;
                      const error = errors[`${environment}.${field.name}`]?.[0];
                      return (
                        <Field key={field.name} data-invalid={error ? true : undefined}>
                          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
                          <Input
                            id={id}
                            type={field.secret ? 'password' : 'text'}
                            autoComplete="off"
                            placeholder={field.placeholder}
                            value={values[environment][field.name]}
                            aria-invalid={error ? true : undefined}
                            onChange={(event) =>
                              setValue(environment, field.name, event.target.value)
                            }
                          />
                          <FieldDescription>
                            Where: <GuideText text={field.where} />
                          </FieldDescription>
                          {error ? <FieldError>{error}</FieldError> : null}
                        </Field>
                      );
                    })}
                  </FieldGroup>
                </fieldset>
              ))}
              {checkError ? (
                <Alert variant="destructive">
                  <XCircleIcon />
                  <AlertDescription>{checkError}</AlertDescription>
                </Alert>
              ) : null}
              {checks ? (
                <ul aria-label="Connection checks" className="flex flex-col gap-1.5 text-sm">
                  {checks.map((item) => (
                    <li key={item.name} className="flex items-start gap-2">
                      {item.ok ? (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <span>
                        <span className="font-medium">{item.name}</span> · {item.message}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h3 className="font-medium">Prepare the production database</h3>
              <p className="text-sm text-muted-foreground">
                Creates the tables now (every deploy does it too). Staging is prepared by its first
                deploy.
              </p>
              <div className="flex items-center gap-3 text-sm">
                <TaskIcon state={prepare} index={0} />
                <span>Create the tables{copyLocal ? ', copy content, images and users' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="neon-copy"
                  checked={copyLocal}
                  disabled={prepare === 'running' || prepare === 'done'}
                  onCheckedChange={(checked) => setCopyLocal(checked === true)}
                />
                <Label htmlFor="neon-copy" className="text-sm font-normal">
                  Copy my local content, images and users
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Working in a team? Leave this off: the online database fills itself from the code.
                Copy only if your local content is the real content.
              </p>
              {online && hasRemoteContent(online) ? (
                <Alert>
                  <InfoIcon />
                  <AlertTitle>The production database is not empty</AlertTitle>
                  <AlertDescription>
                    It already has {describeRemoteContent(online)}. Copying never overwrites
                    anything there: what exists online stays as it is, and only what is missing is
                    added from your computer.
                  </AlertDescription>
                </Alert>
              ) : null}
              {prepareError ? (
                <Alert variant="destructive">
                  <XCircleIcon />
                  <AlertDescription>{prepareError}</AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h3 className="font-medium">Add the values to your hosting</h3>
              <Field>
                <FieldLabel htmlFor="neon-mail-to">Staging emails go to</FieldLabel>
                <Input
                  id="neon-mail-to"
                  value={mailTo}
                  onChange={(event) => setMailTo(event.target.value)}
                  placeholder="team@agency.example"
                />
                <FieldDescription>
                  Form requests on staging are emailed only to these addresses (comma-separated),
                  never to the client.
                </FieldDescription>
              </Field>
              <Tabs value={host} onValueChange={(value) => setHost(value as HostingPlatform)}>
                <TabsList>
                  {HOSTING_GUIDES.map((guide) => (
                    <TabsTrigger key={guide.id} value={guide.id}>
                      {guide.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {HOSTING_GUIDES.map((guide) => (
                  <TabsContent key={guide.id} value={guide.id} className="flex flex-col gap-4 pt-3">
                    {ENVIRONMENTS.map((environment) => (
                      <div
                        key={environment}
                        className="flex flex-col gap-3 rounded-lg border p-4"
                        aria-label={`${guide.label}: ${NEON_ENVIRONMENT_LABELS[environment]}`}
                        role="group"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-medium">
                            {NEON_ENVIRONMENT_LABELS[environment]}
                          </h4>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyBlock(environment)}
                          >
                            <CopyIcon />
                            Copy all
                          </Button>
                        </div>
                        <Steps items={ENVIRONMENT_HOSTING_STEPS[guide.id][environment]} />
                        <ul className="flex flex-col gap-1 rounded-md bg-muted p-3 font-mono text-xs">
                          {neonVariables(
                            environment,
                            values[environment],
                            secrets?.[environment] ?? '(generated when you copy)',
                            mailTo,
                          ).map(([name, value]) => (
                            <li key={name} className="break-all">
                              {name}=
                              {SECRET_NEON_VARIABLES.has(name) && secrets ? mask(value) : value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          ) : null}

          {step === LAST_STEP ? (
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>
                Production deploys from main, staging from the staging branch, pull-request previews
                in preview mode. Keep developing on your local database: seeds travel in git.
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        {step < LAST_STEP ? (
          <DialogFooter>
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : null}
            <Button onClick={primary.run} disabled={primary.disabled}>
              {primary.label}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
