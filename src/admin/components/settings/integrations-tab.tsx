'use client';

import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { LocalTime } from '@/admin/components/layout/local-time';
import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { DeveloperSection } from '@/admin/components/layout/developer-mode';
import { Alert, AlertDescription } from '@/admin/ui/alert';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { Input } from '@/admin/ui/input';
import { Label } from '@/admin/ui/label';
import { Switch } from '@/admin/ui/switch';
import {
  removeIntegrationSecretAction,
  sendTestEmailAction,
  setIntegrationSecretAction,
} from '@/core/integrations/actions';
import {
  ANALYTICS,
  type AnalyticsDefinition,
  EmailProviderKind,
  IntegrationStatus,
  SMTP_PRESETS,
  SmtpSecurity,
} from '@/core/integrations/model';
import type { SecretInfo, SecretName } from '@/core/integrations/secrets';
import { saveSettingsAction } from '@/core/settings/actions';
import type { SiteSettings } from '@/core/settings/schema';

type Analytics = SiteSettings['integrations']['analytics'];
type Email = SiteSettings['integrations']['email'];

/** What the server tells the Integrations tab besides the stored settings. */
export interface IntegrationsInfo {
  readonly secrets: Readonly<Record<SecretName, SecretInfo>>;
  /** `MAIL_PROVIDER` is set on the server: email is read-only here. */
  readonly emailFromServer: string | null;
}

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  [IntegrationStatus.Off]: 'Off',
  [IntegrationStatus.On]: 'On',
  [IntegrationStatus.Error]: 'Error',
};

function StatusBadge({ status }: { status: IntegrationStatus }) {
  return (
    <Badge
      variant={
        status === IntegrationStatus.Error
          ? 'destructive'
          : status === IntegrationStatus.On
            ? 'default'
            : 'outline'
      }
      data-status={status}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function IntegrationCard({
  id,
  name,
  description,
  status,
  children,
}: {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  children: ReactNode;
}) {
  return (
    <Card role="group" aria-label={name} data-integration={id}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <h3>{name}</h3>
          <StatusBadge status={status} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/** Settings → Integrations (admins only): analytics tools and email for forms. */
export function IntegrationsTab({
  settings,
  info,
}: {
  settings: SiteSettings;
  info: IntegrationsInfo;
}) {
  const [analytics, setAnalytics] = useState<Analytics>(settings.integrations.analytics);
  const anyAnalyticsOn = ANALYTICS.some((tool) => analytics[tool.id].enabled);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Email for forms" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Email for forms</h2>
        <EmailCard email={settings.integrations.email} info={info} />
      </section>
      <section aria-label="Analytics and marketing" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Analytics &amp; marketing</h2>
        <p className="text-sm text-muted-foreground">
          These tools use cookies, so visitors are asked to accept them in a small banner before
          anything loads.
          {anyAnalyticsOn ? '' : ' Nothing is on yet, so the banner is not shown.'}
        </p>
        {ANALYTICS.map((tool) => (
          <AnalyticsCard key={tool.id} tool={tool} analytics={analytics} onSaved={setAnalytics} />
        ))}
      </section>
    </div>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

function AnalyticsCard({
  tool,
  analytics,
  onSaved,
}: {
  tool: AnalyticsDefinition;
  analytics: Analytics;
  onSaved: (next: Analytics) => void;
}) {
  const router = useRouter();
  const saved = analytics[tool.id];
  const [enabled, setEnabled] = useState(saved.enabled);
  const [value, setValue] = useState(saved.id);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = enabled !== saved.enabled || value !== saved.id;
  const fieldId = `integration-${tool.id}-id`;

  const save = async () => {
    setSaving(true);
    setError(null);
    const next: Analytics = { ...analytics, [tool.id]: { enabled, id: value.trim() } };
    const result = await saveSettingsAction({
      groups: { integrations: { analytics: next } },
      localized: {},
    });
    setSaving(false);
    if (result.ok) {
      onSaved(next);
      setValue(value.trim());
      toast.success(`${tool.name} saved.`);
      router.refresh();
      return;
    }
    const message = Object.entries(result.fieldErrors ?? {}).find(([path]) =>
      path.endsWith(`${tool.id}.id`),
    )?.[1][0];
    setError(message ?? result.error);
  };

  return (
    <IntegrationCard
      id={tool.id}
      name={tool.name}
      description={tool.description}
      status={saved.enabled ? IntegrationStatus.On : IntegrationStatus.Off}
    >
      <div className="flex items-center gap-2">
        <Switch
          id={`integration-${tool.id}-enabled`}
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={`Turn on ${tool.name}`}
        />
        <Label htmlFor={`integration-${tool.id}-enabled`}>Turn on</Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>{tool.idLabel}</Label>
        <Input
          id={fieldId}
          value={value}
          placeholder={tool.placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? (
          <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {tool.performanceNote ? (
          <p className="text-sm text-muted-foreground">{tool.performanceNote}</p>
        ) : null}
      </div>
      <div>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          Save {tool.name}
        </Button>
      </div>
    </IntegrationCard>
  );
}

// ── Email ────────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: EmailProviderKind.None, label: 'Not connected' },
  { value: EmailProviderKind.Resend, label: 'Resend' },
  { value: EmailProviderKind.Smtp, label: 'SMTP (Brevo, Mailgun, Gmail…)' },
];
const SECURITY_OPTIONS = [
  { value: SmtpSecurity.StartTls, label: 'STARTTLS (port 587)' },
  { value: SmtpSecurity.Ssl, label: 'SSL/TLS (port 465)' },
  { value: SmtpSecurity.None, label: 'None (only for trusted networks)' },
];
const PRESET_OPTIONS = SMTP_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));

function emailStatus(email: Email, secretState: SecretInfo['state'] | null): IntegrationStatus {
  if (email.provider === EmailProviderKind.None) return IntegrationStatus.Off;
  if (secretState === 'unreadable' || (email.lastCheck && !email.lastCheck.ok))
    return IntegrationStatus.Error;
  return IntegrationStatus.On;
}

function EmailCard({ email, info }: { email: Email; info: IntegrationsInfo }) {
  const router = useRouter();
  const [saved, setSaved] = useState(email);
  const [form, setForm] = useState(email);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [secrets, setSecrets] = useState(info.secrets);
  const fromServer = info.emailFromServer;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const secretName = form.provider === EmailProviderKind.Resend ? 'resend.apiKey' : 'smtp.password';
  const secretState = form.provider === EmailProviderKind.None ? null : secrets[secretName].state;

  const patch = (changes: Partial<Email>) => setForm((current) => ({ ...current, ...changes }));
  const patchSmtp = (changes: Partial<Email['smtp']>) =>
    setForm((current) => ({ ...current, smtp: { ...current.smtp, ...changes } }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const result = await saveSettingsAction({
      groups: { integrations: { email: { ...form, lastCheck: saved.lastCheck } } },
      localized: {},
    });
    setSaving(false);
    if (result.ok) {
      setSaved(form);
      toast.success('Email saved.');
      router.refresh();
      return;
    }
    setErrors(
      Object.fromEntries(
        Object.entries(result.fieldErrors ?? {}).map(([path, messages]) => [
          path.replace('groups.integrations.email.', ''),
          messages[0] ?? '',
        ]),
      ),
    );
    toast.error(result.error);
  };

  const sendTest = async () => {
    setTesting(true);
    const result = await sendTestEmailAction();
    setTesting(false);
    if (result.ok) toast.success(result.message ?? 'Test email sent.');
    else toast.error(result.error);
    router.refresh();
  };

  return (
    <IntegrationCard
      id="email"
      name="Email"
      description="Sends form requests to your inbox."
      status={fromServer ? IntegrationStatus.On : emailStatus(saved, secretState)}
    >
      {fromServer ? (
        <Alert>
          <AlertDescription>
            Set on the server: {fromServer}. To use this card instead, remove MAIL_PROVIDER from the
            server settings.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="integration-email-provider">Email service</Label>
            <SimpleSelect
              id="integration-email-provider"
              value={form.provider}
              onChange={(value) => patch({ provider: value as Email['provider'] })}
              options={PROVIDER_OPTIONS}
              ariaLabel="Email service"
            />
          </div>
          {form.provider !== EmailProviderKind.None ? (
            <>
              <Field
                id="integration-email-from"
                label="Sender"
                value={form.from}
                placeholder="Website <forms@example.com>"
                error={errors.from}
                onChange={(value) => patch({ from: value })}
              />
              {form.provider === EmailProviderKind.Resend ? (
                <SecretField
                  name="resend.apiKey"
                  label="API key"
                  info={secrets['resend.apiKey']}
                  onChange={(next) =>
                    setSecrets((current) => ({ ...current, 'resend.apiKey': next }))
                  }
                />
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="integration-smtp-preset">Provider</Label>
                    <SimpleSelect
                      id="integration-smtp-preset"
                      value={form.smtp.preset}
                      onChange={(id) => {
                        const preset = SMTP_PRESETS.find((candidate) => candidate.id === id);
                        patchSmtp(
                          preset && preset.id !== 'other'
                            ? {
                                preset: id,
                                host: preset.host,
                                port: preset.port,
                                security: preset.security,
                              }
                            : { preset: id },
                        );
                      }}
                      options={PRESET_OPTIONS}
                      ariaLabel="SMTP provider"
                    />
                  </div>
                  <Field
                    id="integration-smtp-host"
                    label="SMTP server"
                    value={form.smtp.host}
                    placeholder="smtp.example.com"
                    error={errors['smtp.host']}
                    onChange={(value) => patchSmtp({ host: value })}
                  />
                  <Field
                    id="integration-smtp-port"
                    label="Port"
                    value={String(form.smtp.port)}
                    inputMode="numeric"
                    error={errors['smtp.port']}
                    onChange={(value) => patchSmtp({ port: Number(value.replace(/\D/g, '')) || 0 })}
                  />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="integration-smtp-security">Connection security</Label>
                    <SimpleSelect
                      id="integration-smtp-security"
                      value={form.smtp.security}
                      onChange={(value) => patchSmtp({ security: value as SmtpSecurity })}
                      options={SECURITY_OPTIONS}
                      ariaLabel="Connection security"
                    />
                  </div>
                  <Field
                    id="integration-smtp-user"
                    label="User name"
                    value={form.smtp.user}
                    placeholder={
                      SMTP_PRESETS.find((preset) => preset.id === form.smtp.preset)?.userHint
                    }
                    error={errors['smtp.user']}
                    onChange={(value) => patchSmtp({ user: value })}
                  />
                  <SecretField
                    name="smtp.password"
                    label="Password"
                    info={secrets['smtp.password']}
                    onChange={(next) =>
                      setSecrets((current) => ({ ...current, 'smtp.password': next }))
                    }
                  />
                </>
              )}
            </>
          ) : null}
        </>
      )}
      {saved.lastCheck ? (
        <p
          className={
            saved.lastCheck.ok ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'
          }
          role="status"
        >
          Last test: {saved.lastCheck.ok ? 'sent' : `failed (${saved.lastCheck.error ?? 'error'})`}{' '}
          · <LocalTime value={saved.lastCheck.at} />
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!fromServer ? (
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save email
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={testing || dirty || (!fromServer && saved.provider === EmailProviderKind.None)}
          onClick={() => void sendTest()}
        >
          {testing ? <Loader2Icon className="animate-spin" /> : null}
          Send test email
        </Button>
        {dirty ? <span className="text-sm text-muted-foreground">Save before testing.</span> : null}
      </div>
      <DeveloperSection>
        <p className="text-sm text-muted-foreground">
          Credentials are stored encrypted (AES-256-GCM) and never shown again. Environment
          variables (MAIL_PROVIDER, RESEND_API_KEY, SMTP_*) still work and take precedence.
        </p>
      </DeveloperSection>
    </IntegrationCard>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  inputMode?: 'numeric';
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A credential: shown as `••••1234` once saved, replaced or removed, never read back. */
function SecretField({
  name,
  label,
  info,
  onChange,
}: {
  name: SecretName;
  label: string;
  info: SecretInfo;
  onChange: (next: SecretInfo) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `secret-${name.replace('.', '-')}`;
  const unreadable = info.state === 'unreadable';
  const showInput = editing || info.state === 'none' || unreadable;

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await setIntegrationSecretAction({ name, value });
    setBusy(false);
    if (result.ok) {
      onChange({ state: 'set', hint: result.data.hint });
      setValue('');
      setEditing(false);
      toast.success(`${label} saved.`);
      router.refresh();
      return;
    }
    setError(
      result.fieldErrors
        ? (Object.values(result.fieldErrors)[0]?.[0] ?? result.error)
        : result.error,
    );
  };

  const remove = async () => {
    setBusy(true);
    const result = await removeIntegrationSecretAction({ name });
    setBusy(false);
    if (result.ok) {
      onChange({ state: 'none', hint: '' });
      toast.success(`${label} removed.`);
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="flex flex-col gap-1.5" data-secret={name} data-secret-state={info.state}>
      <Label htmlFor={id}>{label}</Label>
      {unreadable ? (
        <p className="text-sm text-destructive" role="alert">
          The saved value can’t be read any more (the server’s secret changed). Re-enter it.
        </p>
      ) : null}
      {showInput ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            type="password"
            value={value}
            autoComplete="new-password"
            className="max-w-sm"
            aria-invalid={error ? true : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="button" size="sm" disabled={!value || busy} onClick={() => void save()}>
            Save {label.toLowerCase()}
          </Button>
          {editing ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span id={id} className="text-sm font-mono" aria-label={`${label} is saved`}>
            {info.hint || '••••'}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Replace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
