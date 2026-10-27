'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import {
  RhfColor,
  RhfMedia,
  RhfNumber,
  RhfSwitch,
  RhfText,
  RhfTextarea,
} from '@/admin/components/forms/rhf-fields';
import { DeveloperSection } from '@/admin/components/layout/developer-mode';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/admin/ui/field';
import { Alert, AlertDescription } from '@/admin/ui/alert';
import { INDEXING_LABELS } from '@/core/deployment/rules';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/ui/tabs';
import { Textarea } from '@/admin/ui/textarea';
import type { MediaPreview } from '@/core/content/editor-types';
import { selectedLocales } from '@/core/i18n/language-state';
import {
  formDestinationsSchema,
  type LocalizedSettings,
  type SiteSettings,
} from '@/core/settings/schema';

import { IntegrationsTab, type IntegrationsInfo } from './integrations-tab';
import { LanguagesField } from './languages-field';
import { SettingsTabForm, type SettingsTabValues } from './settings-tab-form';

export const SettingsTab = {
  General: 'general',
  Brand: 'brand',
  Search: 'search',
  Requests: 'requests',
  Integrations: 'integrations',
  Access: 'access',
} as const;
export type SettingsTab = (typeof SettingsTab)[keyof typeof SettingsTab];

const TAB_LABELS: Record<SettingsTab, string> = {
  [SettingsTab.General]: 'General',
  [SettingsTab.Brand]: 'Brand',
  [SettingsTab.Search]: 'Google & sharing',
  [SettingsTab.Requests]: 'Requests',
  [SettingsTab.Integrations]: 'Integrations',
  [SettingsTab.Access]: 'Site access',
};

const LOGO_ACCEPT = 'image/svg+xml,image/png,image/webp,image/jpeg';
/** Title template meaning "page title only". */
const TITLE_ONLY = '%s';

export interface LocaleOption {
  readonly code: string;
  readonly label: string;
  readonly draft?: boolean;
}

export interface FormSettingsInfo {
  readonly id: string;
  readonly label: string;
}

export interface SettingsScreenProps {
  readonly settings: SiteSettings;
  /** Per-language settings of every enabled language. */
  readonly localized: Readonly<Record<string, LocalizedSettings>>;
  readonly locales: readonly LocaleOption[];
  readonly media: Readonly<Record<string, MediaPreview>>;
  readonly forms: readonly FormSettingsInfo[];
  /** Telegram delivery is offered only when TELEGRAM_BOT_TOKEN is set. */
  readonly telegramAvailable: boolean;
  /** Plain description of the email provider, e.g. "Resend · forms@example.com". */
  readonly emailProvider: string;
  /** Present for admins: the Integrations tab. */
  readonly integrations: IntegrationsInfo | null;
  /** Email is connected but no form has recipients: requests are saved, not emailed. */
  readonly noRecipientsWarning: boolean;
  /** Staging only: the addresses form emails go to instead (empty: not emailed). */
  readonly stagingMailTo: readonly string[] | null;
  /** Staging is never indexed: the Google switch is replaced by a note. */
  readonly staging: boolean;
}

function visibleTabs(props: Pick<SettingsScreenProps, 'forms' | 'integrations'>): SettingsTab[] {
  return Object.values(SettingsTab).filter(
    (value) =>
      (value !== SettingsTab.Requests || props.forms.length > 0) &&
      (value !== SettingsTab.Integrations || props.integrations !== null),
  );
}

function isTab(value: string | null, visible: readonly SettingsTab[]): value is SettingsTab {
  return visible.some((tab) => tab === value);
}

/** Settings as tabs (`?tab=`), one Save per tab. */
export function SettingsScreen(props: SettingsScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const tabs = visibleTabs(props);
  const tab = isTab(requested, tabs) ? requested : SettingsTab.General;
  const [media, setMedia] = useState(props.media);
  const addMedia = useCallback(
    (preview: MediaPreview) => setMedia((current) => ({ ...current, [preview.id]: preview })),
    [],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', String(value));
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      {/* On phones the tab bar scrolls sideways instead of wrapping. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          {tabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="max-w-3xl pt-4">
        <TabsContent value={SettingsTab.General}>
          <GeneralTab {...props} />
        </TabsContent>
        <TabsContent value={SettingsTab.Brand}>
          <BrandTab media={media} onUploaded={addMedia} settings={props.settings} />
        </TabsContent>
        <TabsContent value={SettingsTab.Search}>
          <SearchTab {...props} media={media} onUploaded={addMedia} />
        </TabsContent>
        {props.forms.length > 0 ? (
          <TabsContent value={SettingsTab.Requests}>
            <RequestsTab {...props} />
          </TabsContent>
        ) : null}
        {props.integrations ? (
          <TabsContent value={SettingsTab.Integrations}>
            <IntegrationsTab settings={props.settings} info={props.integrations} />
          </TabsContent>
        ) : null}
        <TabsContent value={SettingsTab.Access}>
          <AccessTab settings={props.settings} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

// ── General ──────────────────────────────────────────────────────────────────

function GeneralTab({ settings }: SettingsScreenProps) {
  return (
    <SettingsTabForm
      label={TAB_LABELS[SettingsTab.General]}
      defaultValues={{ groups: { general: { ...settings.general } } }}
    >
      <RhfText name="groups.general.siteName" label="Site name" />
      <LanguagesField />
    </SettingsTabForm>
  );
}

// ── Brand ────────────────────────────────────────────────────────────────────

interface MediaProps {
  readonly media: Readonly<Record<string, MediaPreview>>;
  readonly onUploaded: (preview: MediaPreview) => void;
}

function BrandTab({ settings, media, onUploaded }: MediaProps & { settings: SiteSettings }) {
  return (
    <SettingsTabForm
      label={TAB_LABELS[SettingsTab.Brand]}
      defaultValues={{ groups: { branding: { ...settings.branding } } }}
    >
      <RhfMedia
        name="groups.branding.logoLightId"
        label="Logo"
        description="SVG or PNG."
        media={media}
        onUploaded={onUploaded}
        uploadUrl="/api/media?kind=logo"
        accept={LOGO_ACCEPT}
      />
      <RhfMedia
        name="groups.branding.faviconId"
        label="Browser tab icon"
        description="A square image. All sizes are made automatically."
        media={media}
        onUploaded={onUploaded}
        uploadUrl="/api/media?kind=favicon"
      />
      <DeveloperSection>
        <RhfMedia
          name="groups.branding.logoDarkId"
          label="Logo for dark backgrounds"
          media={media}
          onUploaded={onUploaded}
          uploadUrl="/api/media?kind=logo"
          accept={LOGO_ACCEPT}
        />
        <RhfColor
          name="groups.branding.themeColor"
          label="Browser theme color"
          description="Color of the browser bar on phones."
        />
      </DeveloperSection>
    </SettingsTabForm>
  );
}

// ── Google & sharing ─────────────────────────────────────────────────────────

interface SearchValues extends SettingsTabValues {
  readonly ui: { readonly siteNameInTitles: boolean };
}

function titleWithSiteName(siteName: string): string {
  return `${TITLE_ONLY} — ${siteName}`;
}

function SearchTab({
  settings,
  localized,
  locales,
  media,
  onUploaded,
  staging,
}: SettingsScreenProps & MediaProps) {
  const { confirm, dialog } = useConfirm();
  const selected = selectedLocales(settings.general);
  const enabled = locales.filter((locale) => selected.includes(locale.code));
  const siteName = settings.general.siteName;
  const defaultValues: SearchValues = {
    groups: {
      status: { indexing: settings.status.indexing },
      seo: { ...settings.seo },
    },
    localized: Object.fromEntries(
      enabled.map((locale) => [locale.code, { ...localized[locale.code] }]),
    ),
    ui: {
      siteNameInTitles: enabled.some(
        (locale) => (localized[locale.code]?.titleTemplate ?? TITLE_ONLY) !== TITLE_ONLY,
      ),
    },
  };
  return (
    <SettingsTabForm
      label={TAB_LABELS[SettingsTab.Search]}
      defaultValues={defaultValues}
      toSave={(values, initial) => {
        // The switch rewrites every title template; otherwise the (developer) templates are kept.
        if (values.ui.siteNameInTitles === initial.ui.siteNameInTitles) return values;
        const template = values.ui.siteNameInTitles ? titleWithSiteName(siteName) : TITLE_ONLY;
        return {
          ...values,
          localized: Object.fromEntries(
            Object.entries(values.localized ?? {}).map(([code, value]) => [
              code,
              { ...value, titleTemplate: template },
            ]),
          ),
        };
      }}
      beforeSave={async (values, initial) => {
        const indexing = values.groups.status?.indexing;
        if (indexing === false && initial.groups.status?.indexing !== false) {
          return confirm({
            title: 'Hide the site from Google?',
            description:
              'Search engines are asked not to show the site. Existing results disappear over time. Turn it back on when the site is ready.',
            confirmLabel: 'Hide from Google',
            destructive: true,
          });
        }
        return true;
      }}
    >
      {dialog}
      {staging ? (
        <Alert data-testid="staging-indexing-note">
          <AlertDescription>
            {INDEXING_LABELS.staging}: staging is never shown in Google, whatever the live site’s
            setting is. Change it on the live site’s admin.
          </AlertDescription>
        </Alert>
      ) : (
        <RhfSwitch
          name="groups.status.indexing"
          label="Show the site in Google"
          description="Turn off while the site is being prepared."
        />
      )}
      {enabled.map((locale) => (
        <RhfTextarea
          key={locale.code}
          name={`localized.${locale.code}.description`}
          label={`Site description (${locale.label})`}
          description="Used in Google for pages that don't have their own description."
          rows={2}
        />
      ))}
      <RhfSwitch
        name="ui.siteNameInTitles"
        label="Add the site name to page titles"
        description={<TitleExample siteName={siteName} />}
      />
      <RhfMedia
        name="groups.seo.defaultOgImageId"
        label="Picture when shared in messengers"
        description="1200 × 630. Shown in Telegram, Facebook, Viber when someone shares a link."
        media={media}
        onUploaded={onUploaded}
      />
      <DeveloperSection>
        <RhfText
          name="groups.seo.verification.google"
          label="Google verification code"
          description="The content of the google-site-verification meta tag."
        />
        <RhfText
          name="groups.seo.verification.bing"
          label="Bing verification code"
          description="The content of the msvalidate.01 meta tag."
        />
        {enabled.map((locale) => (
          <FieldSet key={locale.code}>
            <FieldLegend variant="label">{locale.label}</FieldLegend>
            <RhfText
              name={`localized.${locale.code}.titleTemplate`}
              label="Title template"
              description="%s is the page title, e.g. “%s — Brand”. The switch above overwrites it."
            />
            <RhfText name={`localized.${locale.code}.ogTitle`} label="Share title" />
            <RhfTextarea
              name={`localized.${locale.code}.ogDescription`}
              label="Share description"
              rows={2}
            />
          </FieldSet>
        ))}
        <RhfText name="groups.seo.twitterHandle" label="X (Twitter) handle" placeholder="@brand" />
        <FieldSet>
          <FieldLegend variant="label">Organization data for Google</FieldLegend>
          <FieldDescription>
            Empty fields are filled automatically from the site name and logo.
          </FieldDescription>
          <RhfText name="groups.seo.organization.name" label="Organization name" />
          <RhfText
            name="groups.seo.organization.url"
            label="Organization website"
            placeholder="https://example.com"
          />
          <RhfMedia
            name="groups.seo.organization.logoId"
            label="Organization logo"
            media={media}
            onUploaded={onUploaded}
            uploadUrl="/api/media?kind=logo"
            accept={LOGO_ACCEPT}
          />
          <LinesField
            name="groups.seo.organization.sameAs"
            label="Social profiles"
            description="One URL per line."
          />
        </FieldSet>
      </DeveloperSection>
    </SettingsTabForm>
  );
}

function TitleExample({ siteName }: { siteName: string }) {
  const on = useWatch({ name: 'ui.siteNameInTitles' }) as boolean;
  return (
    <>
      Example: <span className="font-medium">About us{on ? ` — ${siteName}` : ''}</span>
    </>
  );
}

/** Textarea bound to a string[] (one value per line). */
function LinesField({
  name,
  label,
  description,
}: {
  name: string;
  label: string;
  description?: string;
}) {
  const id = `field-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  return (
    <Controller
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Textarea
            id={id}
            rows={3}
            value={((field.value as string[] | undefined) ?? []).join('\n')}
            onChange={(event) =>
              field.onChange(
                event.target.value
                  .split(/[\n,;]+/)
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
            onBlur={field.onBlur}
          />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          {fieldState.error?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {fieldState.error.message}
            </p>
          ) : null}
        </Field>
      )}
    />
  );
}

// ── Requests (forms) ─────────────────────────────────────────────────────────

function RequestsTab({
  settings,
  forms,
  telegramAvailable,
  emailProvider,
  noRecipientsWarning,
  stagingMailTo,
}: SettingsScreenProps) {
  const destinations = Object.fromEntries(
    forms.map((form) => [
      form.id,
      formDestinationsSchema.parse(settings.forms.destinations[form.id] ?? {}),
    ]),
  );
  return (
    <SettingsTabForm
      label={TAB_LABELS[SettingsTab.Requests]}
      defaultValues={{
        groups: {
          forms: {
            retentionMonths: settings.forms.retentionMonths,
            defaultRecipients: settings.forms.defaultRecipients,
            destinations,
          },
        },
      }}
      toSave={(values) => {
        const forms = values.groups.forms as {
          destinations: Record<string, { email: { recipients: string[] } }>;
        };
        // Recipients decide whether email is sent.
        const next = Object.fromEntries(
          Object.entries(forms.destinations).map(([id, value]) => [
            id,
            { ...value, email: { ...value.email, enabled: value.email.recipients.length > 0 } },
          ]),
        );
        return { groups: { forms: { ...forms, destinations: next } } };
      }}
    >
      <p className="text-sm text-muted-foreground">
        Every request is saved in Pages → Forms. Here you choose who also gets it by email.
      </p>
      {stagingMailTo ? (
        <Alert data-testid="staging-mail-note">
          <AlertDescription>
            {stagingMailTo.length > 0
              ? `Staging: emails go to ${stagingMailTo.join(', ')} only (the recipients below get nothing from staging).`
              : 'Staging: requests are saved but not emailed. Set STAGING_MAIL_TO to receive them.'}
          </AlertDescription>
        </Alert>
      ) : null}
      {noRecipientsWarning ? (
        <Alert role="alert" data-testid="no-recipients-warning">
          <AlertDescription>
            Requests are saved but not emailed: add recipients below.
          </AlertDescription>
        </Alert>
      ) : null}
      <LinesField
        name="groups.forms.defaultRecipients"
        label="Default recipients"
        description="Email addresses, one per line. Used by every form that has no list of its own."
      />
      {forms.map((form) => (
        <FieldSet key={form.id}>
          <FieldLegend>{form.label}</FieldLegend>
          <LinesField
            name={`groups.forms.destinations.${form.id}.email.recipients`}
            label="Send requests to"
            description="Email addresses, one per line. Leave empty to use the default recipients."
          />
          <DeveloperSection>
            <RhfSwitch
              name={`groups.forms.destinations.${form.id}.webhook.enabled`}
              label="Webhook (CRM, Zapier, Make)"
              description="Signed with FORMS_WEBHOOK_SECRET."
            />
            <RhfText
              name={`groups.forms.destinations.${form.id}.webhook.url`}
              label="Webhook URL"
              placeholder="https://hooks.example.com/…"
            />
            {telegramAvailable ? (
              <>
                <RhfSwitch
                  name={`groups.forms.destinations.${form.id}.telegram.enabled`}
                  label="Telegram"
                  description="Uses the bot from TELEGRAM_BOT_TOKEN."
                />
                <RhfText
                  name={`groups.forms.destinations.${form.id}.telegram.chatId`}
                  label="Telegram chat id"
                  placeholder="-1001234567890"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Telegram: not available, TELEGRAM_BOT_TOKEN is not set on the server.
              </p>
            )}
          </DeveloperSection>
        </FieldSet>
      ))}
      <DeveloperSection>
        <RhfNumber
          name="groups.forms.retentionMonths"
          label="Keep requests for (months)"
          description="Older requests are deleted automatically."
          min={1}
          max={60}
        />
        <Field>
          <FieldLabel>Email provider</FieldLabel>
          <FieldDescription>{emailProvider}</FieldDescription>
        </Field>
      </DeveloperSection>
    </SettingsTabForm>
  );
}

// ── Site access ──────────────────────────────────────────────────────────────

function AccessTab({ settings }: { settings: SiteSettings }) {
  const { confirm, dialog } = useConfirm();
  return (
    <SettingsTabForm
      label={TAB_LABELS[SettingsTab.Access]}
      defaultValues={{
        groups: {
          status: {
            maintenance: { ...settings.status.maintenance },
            privateMode: settings.status.privateMode,
          },
          analytics: { ...settings.analytics },
          security: { ...settings.security },
        },
      }}
      beforeSave={async (values, initial) => {
        const status = values.groups.status as {
          maintenance: { enabled: boolean };
          privateMode: boolean;
        };
        const before = initial.groups.status as typeof status;
        if (status.maintenance.enabled && !before.maintenance.enabled) {
          const yes = await confirm({
            title: 'Pause the site?',
            description:
              'Visitors will see a "We\'ll be back soon" page. Google keeps your pages. You still see the site normally.',
            confirmLabel: 'Pause the site',
            destructive: true,
          });
          if (!yes) return false;
        }
        if (status.privateMode && !before.privateMode) {
          return confirm({
            title: 'Make the site private?',
            description:
              'Only people from Managers can open the site, after signing in. It is hidden from Google while this is on.',
            confirmLabel: 'Make private',
            destructive: true,
          });
        }
        return true;
      }}
    >
      {dialog}
      <RhfSwitch
        name="groups.status.maintenance.enabled"
        label="Pause the site"
        description="Visitors see a “We’ll be back soon” page. Google keeps your pages. You still see the site normally."
      />
      <MaintenanceMessage />
      <RhfSwitch
        name="groups.status.privateMode"
        label="Private site"
        description="Only people from Managers can open the site, after signing in. Useful before launch. The site is hidden from Google while this is on."
      />
      <DeveloperSection>
        <RhfSwitch
          name="groups.analytics.excludeStaff"
          label="Don't count visits of signed-in staff"
        />
        <RhfNumber
          name="groups.analytics.retentionMonths"
          label="Keep detailed statistics for (months)"
          description="Older visits are deleted; daily totals are kept."
          min={1}
          max={60}
        />
        <RhfSwitch
          name="groups.security.requireTwoFactorForAdmins"
          label="Require two-factor sign-in for admins"
          description="Admins without it are sent to their Account page until they set it up."
        />
        <RhfNumber
          name="groups.security.sessionLifetimeDays"
          label="Stay signed in for (days)"
          description="Applies to new sign-ins."
          min={1}
          max={90}
        />
      </DeveloperSection>
    </SettingsTabForm>
  );
}

/** The visitor message is only relevant while the site is paused. */
function MaintenanceMessage() {
  const { control } = useFormContext();
  const paused = useWatch({ control, name: 'groups.status.maintenance.enabled' }) as boolean;
  if (!paused) return null;
  return (
    <RhfTextarea
      name="groups.status.maintenance.message"
      label="Message for visitors"
      description="Optional. Shown on the pause page."
      rows={2}
    />
  );
}
