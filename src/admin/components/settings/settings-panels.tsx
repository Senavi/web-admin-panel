'use client';

import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';

import {
  RhfColor,
  RhfMedia,
  RhfNumber,
  RhfSelect,
  RhfSwitch,
  RhfText,
  RhfTextarea,
} from '@/admin/components/forms/rhf-fields';
import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { Checkbox } from '@/admin/ui/checkbox';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/admin/ui/field';
import { Label } from '@/admin/ui/label';
import { Separator } from '@/admin/ui/separator';
import type { MediaPreview } from '@/core/content/editor-types';
import {
  getLocalizedSettingsAction,
  saveAnalyticsSettingsAction,
  saveBrandingSettingsAction,
  saveGeneralSettingsAction,
  saveLocalizedSettingsAction,
  saveSecurityPolicyAction,
  saveSeoSettingsAction,
  saveSiteStatusAction,
} from '@/core/settings/actions';
import {
  analyticsSettingsSchema,
  brandingSettingsSchema,
  generalSettingsSchema,
  localizedSettingsSchema,
  type LocalizedSettings,
  securitySettingsSchema,
  seoSettingsSchema,
  type SiteSettings,
  siteStatusSettingsSchema,
} from '@/core/settings/schema';

import { SettingsForm } from './settings-form';

export interface LocaleOption {
  readonly code: string;
  readonly label: string;
}

const LOGO_ACCEPT = 'image/svg+xml,image/png,image/webp,image/jpeg';

/** All Settings cards. Each card validates and saves on its own. */
export function SettingsPanels({
  settings,
  localized,
  locales,
  initialMedia,
}: {
  settings: SiteSettings;
  localized: { locale: string; values: LocalizedSettings };
  locales: readonly LocaleOption[];
  initialMedia: Readonly<Record<string, MediaPreview>>;
}) {
  const [media, setMedia] = useState(initialMedia);
  const addMedia = useCallback(
    (preview: MediaPreview) => setMedia((current) => ({ ...current, [preview.id]: preview })),
    [],
  );
  const { confirm, dialog } = useConfirm();

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <SettingsForm
        id="general"
        title="General"
        description="Site name and languages."
        schema={generalSettingsSchema}
        defaultValues={settings.general}
        onSave={saveGeneralSettingsAction}
      >
        <RhfText name="siteName" label="Site name" />
        <FieldSet>
          <FieldLegend variant="label">Enabled languages</FieldLegend>
          <FieldDescription>Disabled languages return 404 and leave the sitemap.</FieldDescription>
          <Controller
            name="enabledLocales"
            render={({ field }) => {
              const value = (field.value as string[] | undefined) ?? [];
              return (
                <div className="flex flex-wrap gap-4">
                  {locales.map((locale) => (
                    <Field key={locale.code} orientation="horizontal" className="w-auto">
                      <Checkbox
                        id={`locale-${locale.code}`}
                        checked={value.includes(locale.code)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...value, locale.code]
                              : value.filter((code) => code !== locale.code),
                          )
                        }
                      />
                      <Label htmlFor={`locale-${locale.code}`} className="font-normal">
                        {locale.label} ({locale.code})
                      </Label>
                    </Field>
                  ))}
                </div>
              );
            }}
          />
        </FieldSet>
        <RhfSelect
          name="defaultLocale"
          label="Default language"
          description="Served without a URL prefix. Must be enabled."
          options={locales.map((locale) => ({
            value: locale.code,
            label: `${locale.label} (${locale.code})`,
          }))}
        />
      </SettingsForm>

      <LocalizedSeoCard
        initial={localized}
        locales={locales.filter((locale) => settings.general.enabledLocales.includes(locale.code))}
      />

      <SettingsForm
        id="seo"
        title="Search & social"
        description="Shared across languages."
        schema={seoSettingsSchema}
        defaultValues={settings.seo}
        onSave={saveSeoSettingsAction}
      >
        <RhfMedia
          name="defaultOgImageId"
          label="Default share image"
          description="Used when a page has no share image. Recommended 1200×630."
          media={media}
          onUploaded={addMedia}
        />
        <RhfText name="twitterHandle" label="X / Twitter handle" placeholder="@brand" />
        <Separator />
        <FieldLegend variant="label">Organization (structured data)</FieldLegend>
        <RhfText name="organization.name" label="Organization name" />
        <RhfText
          name="organization.url"
          label="Organization website"
          placeholder="https://example.com"
        />
        <RhfMedia
          name="organization.logoId"
          label="Organization logo"
          media={media}
          onUploaded={addMedia}
          uploadUrl="/api/media?kind=logo"
          accept={LOGO_ACCEPT}
        />
        <Controller
          name="organization.sameAs"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="same-as">Social profiles</FieldLabel>
              <textarea
                id="same-as"
                rows={3}
                className="text-sm rounded-md border bg-transparent px-3 py-2"
                value={((field.value as string[] | undefined) ?? []).join('\n')}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  )
                }
              />
              <FieldDescription>One URL per line.</FieldDescription>
            </Field>
          )}
        />
        <Separator />
        <FieldLegend variant="label">Search engine verification</FieldLegend>
        <RhfText
          name="verification.google"
          label="Google site verification"
          description="The content value of the google-site-verification meta tag."
        />
        <RhfText
          name="verification.bing"
          label="Bing site verification"
          description="The content value of the msvalidate.01 meta tag."
        />
      </SettingsForm>

      <SettingsForm
        id="branding"
        title="Branding"
        description="Logos, favicon and browser theme color."
        schema={brandingSettingsSchema}
        defaultValues={settings.branding}
        onSave={saveBrandingSettingsAction}
      >
        <RhfMedia
          name="logoLightId"
          label="Logo (light backgrounds)"
          description="SVG or PNG. SVGs are sanitized."
          media={media}
          onUploaded={addMedia}
          uploadUrl="/api/media?kind=logo"
          accept={LOGO_ACCEPT}
        />
        <RhfMedia
          name="logoDarkId"
          label="Logo (dark backgrounds)"
          media={media}
          onUploaded={addMedia}
          uploadUrl="/api/media?kind=logo"
          accept={LOGO_ACCEPT}
        />
        <RhfMedia
          name="faviconId"
          label="Favicon"
          description="Square image, at least 512×512. ICO, PNG and Apple touch icons are generated."
          media={media}
          onUploaded={addMedia}
          uploadUrl="/api/media?kind=favicon"
        />
        <RhfColor name="themeColor" label="Theme color" description="Browser UI color on mobile." />
      </SettingsForm>

      <SettingsForm
        id="site-status"
        title="Site status"
        description="Control who can see the site and whether search engines index it."
        schema={siteStatusSettingsSchema}
        defaultValues={settings.status}
        onSave={saveSiteStatusAction}
        beforeSave={async (values, initial) => {
          if (values.maintenance.enabled && !initial.maintenance?.enabled) {
            if (
              !(await confirm({
                title: 'Turn on maintenance mode?',
                description:
                  'Visitors will see the maintenance page (HTTP 503). Signed-in staff can still browse the site.',
                confirmLabel: 'Turn on',
                destructive: true,
              }))
            )
              return false;
          }
          if (values.privateMode && !initial.privateMode) {
            if (
              !(await confirm({
                title: 'Make the site private?',
                description:
                  'Only users from the admin user list can see the site after signing in. Search engines will not index it.',
                confirmLabel: 'Make private',
                destructive: true,
              }))
            )
              return false;
          }
          if (!values.indexing && initial.indexing !== false) {
            if (
              !(await confirm({
                title: 'Stop search engine indexing?',
                description:
                  'robots.txt will disallow everything and pages will send noindex. Existing search results will disappear over time.',
                confirmLabel: 'Stop indexing',
                destructive: true,
              }))
            )
              return false;
          }
          return true;
        }}
      >
        <RhfSwitch
          name="maintenance.enabled"
          label="Maintenance mode"
          description="Shows the maintenance page with HTTP 503 and Retry-After, so search engines keep your pages."
        />
        <RhfTextarea
          name="maintenance.message"
          label="Maintenance message"
          description="Optional. Shown on the maintenance page."
          rows={2}
        />
        <RhfSwitch
          name="indexing"
          label="Search engine indexing"
          description="When off, robots.txt disallows everything and every response sends X-Robots-Tag: noindex."
        />
        <RhfSwitch
          name="privateMode"
          label="Private mode"
          description="Visitors must sign in with an admin or manager account. Forces noindex."
        />
      </SettingsForm>

      <SettingsForm
        id="analytics"
        title="Analytics"
        schema={analyticsSettingsSchema}
        defaultValues={settings.analytics}
        onSave={saveAnalyticsSettingsAction}
      >
        <RhfSwitch
          name="excludeStaff"
          label="Exclude staff visits"
          description="Don’t count page views from signed-in admins and managers."
        />
        <RhfNumber
          name="retentionMonths"
          label="Keep raw analytics for (months)"
          min={1}
          max={60}
          description="Older events are deleted; daily totals are kept."
        />
      </SettingsForm>

      <SettingsForm
        id="security-policy"
        title="Security policy"
        schema={securitySettingsSchema}
        defaultValues={settings.security}
        onSave={saveSecurityPolicyAction}
      >
        <RhfSwitch
          name="requireTwoFactorForAdmins"
          label="Require two-factor authentication for admins"
          description="Admins without 2FA are sent to their Account page until they set it up."
        />
        <RhfNumber
          name="sessionLifetimeDays"
          label="Session lifetime (days)"
          min={1}
          max={90}
          description="Applies to new sign-ins."
        />
      </SettingsForm>
    </div>
  );
}

function LocalizedSeoCard({
  initial,
  locales,
}: {
  initial: { locale: string; values: LocalizedSettings };
  locales: readonly LocaleOption[];
}) {
  const [current, setCurrent] = useState(initial);
  const switchLocale = async (locale: string) => {
    const result = await getLocalizedSettingsAction({ locale });
    if (result.ok) setCurrent({ locale, values: result.data });
    else toast.error(result.error);
  };
  return (
    <SettingsForm
      key={current.locale}
      id="seo-defaults"
      title="SEO defaults"
      description={
        <span className="flex flex-wrap items-center gap-2">
          Per language. Language:
          <SimpleSelect
            value={current.locale}
            onChange={(locale) => void switchLocale(locale)}
            options={locales.map((locale) => ({
              value: locale.code,
              label: `${locale.label} (${locale.code})`,
            }))}
            ariaLabel="SEO defaults language"
            className="h-8 w-44"
          />
        </span>
      }
      schema={localizedSettingsSchema}
      defaultValues={current.values}
      onSave={(values) => saveLocalizedSettingsAction({ locale: current.locale, values })}
    >
      <RhfText
        name="titleTemplate"
        label="Title template"
        description="%s is replaced with the page title, e.g. “%s | Brand”."
        placeholder="%s | Brand"
      />
      <RhfTextarea
        name="description"
        label="Default description"
        description="Used when a page has no description."
      />
      <RhfText name="ogTitle" label="Default share title" />
      <RhfTextarea name="ogDescription" label="Default share description" rows={2} />
    </SettingsForm>
  );
}
