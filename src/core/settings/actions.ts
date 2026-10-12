'use server';

import { sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { z } from 'zod';

import { projectConfig } from '@project/config';

import { ActionErrorCode, fail, ok, type ActionResult } from '@/core/actions/result';
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
  brandingSettingsSchema,
  formsSettingsSchema,
  generalSettingsSchema,
  type LocalizedSettings,
  localizedSettingsSchema,
  securitySettingsSchema,
  seoSettingsSchema,
  type SettingsGroup,
  type SiteSettings,
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

/** Groups that need more than `settings.manage`. */
const GROUP_PERMISSIONS: Partial<Record<SettingsGroup, Permission>> = {
  forms: Permission.FormsSettings,
};

const GROUPS = Object.keys(GROUP_SCHEMAS) as SettingsGroup[];
const looseRecord = z.record(z.string(), z.unknown());
const localeSchema = z.enum(projectConfig.localeCodes as [string, ...string[]]);

const saveInputSchema = z.object({
  /** Partial values per group; merged into the stored group, then validated whole. */
  groups: z.partialRecord(z.enum(GROUPS as [SettingsGroup, ...SettingsGroup[]]), looseRecord),
  /** Partial per-language values (title template, description, share texts). */
  localized: z.partialRecord(localeSchema, looseRecord).default({}),
});

/** Keys whose value changed (audit summary; never values of secrets). */
function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function collectErrors(prefix: string, error: z.ZodError, into: Record<string, string[]>): void {
  for (const issue of error.issues)
    (into[[prefix, ...issue.path].join('.')] ??= []).push(issue.message);
}

/**
 * Saves one Settings tab: any mix of settings groups and per-language values in
 * one write. Each group is checked against its permission, merged with the
 * stored values (fields a tab doesn't show are kept) and validated whole.
 * Field errors are keyed like the form: `groups.<group>.<field>` /
 * `localized.<locale>.<field>`.
 */
export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const { groups, localized } = saveInputSchema.parse(input);
    const groupNames = GROUPS.filter((group) => groups[group] !== undefined);
    const permissions = new Set(
      groupNames.map((group) => GROUP_PERMISSIONS[group] ?? Permission.SettingsManage),
    );
    if (Object.keys(localized).length > 0) permissions.add(Permission.SettingsManage);
    if (permissions.size === 0) permissions.add(Permission.SettingsManage);
    let user = await assertPermission(Permission.SettingsManage);
    for (const permission of permissions) user = await assertPermission(permission);

    const db = await getDb();
    const current = await readSiteSettings(db);
    const next: Record<string, unknown> = { ...current };
    const fieldErrors: Record<string, string[]> = {};
    for (const group of groupNames) {
      const merged = { ...(current[group] as Record<string, unknown>), ...groups[group] };
      const result = GROUP_SCHEMAS[group].safeParse(merged);
      if (result.success) next[group] = result.data;
      else collectErrors(`groups.${group}`, result.error, fieldErrors);
    }
    const nextLocalized: Array<{
      locale: string;
      before: LocalizedSettings;
      value: LocalizedSettings;
    }> = [];
    for (const [locale, patch] of Object.entries(localized)) {
      const before = await readLocalizedSettings(db, locale);
      const result = localizedSettingsSchema.safeParse({ ...before, ...patch });
      if (result.success) nextLocalized.push({ locale, before, value: result.data });
      else collectErrors(`localized.${locale}`, result.error, fieldErrors);
    }
    if (Object.keys(fieldErrors).length > 0) {
      return fail('Please fix the highlighted fields.', ActionErrorCode.Validation, fieldErrors);
    }

    await db.transaction(async (tx) => {
      if (groupNames.length > 0) {
        await tx
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
      }
      for (const { locale, value } of nextLocalized) {
        await tx
          .insert(settingsLocalized)
          .values({ locale, data: value, updatedBy: user.id })
          .onConflictDoUpdate({
            target: settingsLocalized.locale,
            set: { data: value, updatedAt: new Date(), updatedBy: user.id },
          });
      }
    });

    const actor = { id: user.id, email: user.email };
    for (const group of groupNames) {
      const changed = changedKeys(
        current[group] as Record<string, unknown>,
        next[group] as SiteSettings[typeof group] & Record<string, unknown>,
      );
      if (changed.length > 0) {
        await writeAudit(db, {
          action: AuditAction.SettingsSave,
          actor,
          target: `settings:${group}`,
          summary: { changed },
        });
      }
    }
    for (const { locale, before, value } of nextLocalized) {
      const changed = changedKeys(before, value);
      if (changed.length > 0) {
        await writeAudit(db, {
          action: AuditAction.SettingsSave,
          actor,
          target: `settings:seo:${locale}`,
          summary: { changed },
        });
      }
    }
    // Settings feed every page, the request proxy and metadata routes.
    updateTag(CacheTag.Settings);
    updateTag(CacheTag.Sitemap);
    return ok(undefined, 'Settings saved.');
  });
}
