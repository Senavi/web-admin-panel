'use server';

import { sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { z } from 'zod';

import { projectConfig } from '@project/config';

import { ok, type ActionResult } from '@/core/actions/result';
import { runAction } from '@/core/actions/run';
import { Permission } from '@/core/auth/permissions';
import { assertPermission } from '@/core/auth/server/session';
import { CacheTag } from '@/core/cache/tags';
import { getDb } from '@/core/db/client';
import { settings, settingsLocalized } from '@/core/db/schema';
import { AuditAction, writeAudit } from '@/core/security/audit';

import { readLocalizedSettings, readSiteSettings } from './repository';
import {
  analyticsSettingsSchema,
  formsSettingsSchema,
  brandingSettingsSchema,
  generalSettingsSchema,
  localizedSettingsSchema,
  securitySettingsSchema,
  seoSettingsSchema,
  type SettingsGroup,
  siteStatusSettingsSchema,
} from './schema';

const GROUP_SCHEMAS = {
  general: generalSettingsSchema,
  seo: seoSettingsSchema,
  branding: brandingSettingsSchema,
  status: siteStatusSettingsSchema,
  analytics: analyticsSettingsSchema,
  security: securitySettingsSchema,
  forms: formsSettingsSchema,
} satisfies Record<SettingsGroup, z.ZodType>;

/** Keys whose value changed (audit summary; never values of secrets). */
function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

async function saveGroup<G extends SettingsGroup>(
  group: G,
  input: unknown,
  permission: Permission = Permission.SettingsManage,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission(permission);
    const value = GROUP_SCHEMAS[group].parse(input) as Record<string, unknown>;
    const db = await getDb();
    const current = await readSiteSettings(db);
    const before = current[group] as Record<string, unknown>;
    const next = { ...current, [group]: value };
    await db
      .insert(settings)
      .values({ id: 1, data: next, updatedBy: user.id })
      .onConflictDoUpdate({
        target: settings.id,
        set: {
          data: next,
          version: sql`${settings.version} + 1`,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
      });
    await writeAudit(db, {
      action: AuditAction.SettingsSave,
      actor: { id: user.id, email: user.email },
      target: `settings:${group}`,
      summary: { changed: changedKeys(before, value) },
    });
    // Settings feed every page, the request proxy and metadata routes.
    updateTag(CacheTag.Settings);
    updateTag(CacheTag.Sitemap);
    return ok(undefined, 'Settings saved.');
  });
}

/** Settings → Forms: delivery destinations per form and retention (admins only). */
export async function saveFormsSettingsAction(input: unknown): Promise<ActionResult> {
  return saveGroup('forms', input, Permission.FormsSettings);
}

export async function saveGeneralSettingsAction(input: unknown): Promise<ActionResult> {
  return saveGroup('general', input);
}
export async function saveSeoSettingsAction(input: unknown): Promise<ActionResult> {
  return saveGroup('seo', input);
}
export async function saveBrandingSettingsAction(input: unknown): Promise<ActionResult> {
  return saveGroup('branding', input);
}
export async function saveSiteStatusAction(input: unknown): Promise<ActionResult> {
  return saveGroup('status', input);
}
export async function saveAnalyticsSettingsAction(input: unknown): Promise<ActionResult> {
  return saveGroup('analytics', input);
}
export async function saveSecurityPolicyAction(input: unknown): Promise<ActionResult> {
  return saveGroup('security', input);
}

const localeSchema = z.enum(projectConfig.localeCodes as [string, ...string[]]);

/** Per-locale SEO defaults (title template, description, OG defaults). */
export async function saveLocalizedSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission(Permission.SettingsManage);
    const { locale, values } = z
      .object({ locale: localeSchema, values: localizedSettingsSchema })
      .parse(input);
    const db = await getDb();
    const before = await readLocalizedSettings(db, locale);
    await db
      .insert(settingsLocalized)
      .values({ locale, data: values, updatedBy: user.id })
      .onConflictDoUpdate({
        target: settingsLocalized.locale,
        set: { data: values, updatedAt: new Date(), updatedBy: user.id },
      });
    await writeAudit(db, {
      action: AuditAction.SettingsSave,
      actor: { id: user.id, email: user.email },
      target: `settings:seo:${locale}`,
      summary: { changed: changedKeys(before, values) },
    });
    updateTag(CacheTag.Settings);
    return ok(undefined, 'Settings saved.');
  });
}

/** Reads one locale's settings for the SEO card's locale dropdown. */
export async function getLocalizedSettingsAction(
  input: unknown,
): Promise<ActionResult<z.output<typeof localizedSettingsSchema>>> {
  return runAction(async () => {
    await assertPermission(Permission.SettingsManage);
    const { locale } = z.object({ locale: localeSchema }).parse(input);
    return ok(await readLocalizedSettings(await getDb(), locale));
  });
}
