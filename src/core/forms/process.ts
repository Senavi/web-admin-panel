import 'server-only';

import { browserName } from '@/core/analytics/user-agent';
import { getCurrentUser } from '@/core/auth/server/session';
import type { AnyForm } from '@/core/forms/define';
import { contentRegistry } from '@/core/content/project-registry';
import { getDb } from '@/core/db/client';
import { formSubmissions } from '@/core/db/schema';
import { localizedPath } from '@/core/i18n/routing';
import { safeRedirectPath } from '@/core/project/paths';
import { getClientIp, hashIp } from '@/core/security/request';
import { isLocked, recordFailure } from '@/core/security/throttle';
import { readSiteSettings } from '@/core/settings/repository';
import type { SiteSettings } from '@/core/settings/schema';

import { DeliveryStatus, deliverSubmission, enabledDestinations } from './delivery';
import { FormHiddenField } from './fields';
import {
  checkFormToken,
  formThrottleKeys,
  issueFormToken,
  TokenCheck,
  turnstileEnabled,
  verifyTurnstile,
} from './spam';
import { type FormSubmitState, FormSubmitStatus } from './state';
import { validateSubmission, valuesFromFormData } from './validation';

const PAGE_PATH_MAX = 512;

/** What spam gets back: indistinguishable from a real success (bots learn nothing). */
const SILENT_SUCCESS: FormSubmitState = { status: FormSubmitStatus.Success };

export interface SubmissionOutcome {
  /** State shown with the form (a fresh timing token is added when the form is shown again). */
  readonly state: FormSubmitState;
  readonly form: AnyForm | null;
  readonly locale: string;
  /** Thank-you page (localized path) after a success, when the form has one. */
  readonly redirectTo?: string;
}

/**
 * One public form submission, shared by the server action (JavaScript) and
 * the `/api/forms/submit` route (no JavaScript). Order: honeypot → signed
 * minimum fill time (a missing token asks for a confirmation, see
 * `FormSubmitStatus.Confirm`) → Turnstile (if enabled) → rate limit →
 * validation → store → deliver. Submission data is never logged. Visitors see
 * success once the submission is stored, even if a delivery fails (it is
 * retried by the maintenance job).
 */
export async function processSubmission(
  data: FormData,
  requestHeaders: Headers,
): Promise<SubmissionOutcome> {
  const form = contentRegistry.formById(String(data.get(FormHiddenField.Form) ?? ''));
  if (!form) return { state: { status: FormSubmitStatus.Error }, form: null, locale: '' };
  const db = await getDb();
  const settings = await readSiteSettings(db);
  // Forms are part of the gated site: while it is private or in maintenance only staff may post.
  if (!(await formsOpen(settings))) {
    return { state: { status: FormSubmitStatus.Error }, form: null, locale: '' };
  }
  const localeInput = String(data.get(FormHiddenField.Locale) ?? '');
  const locale = settings.general.enabledLocales.includes(localeInput)
    ? localeInput
    : settings.general.defaultLocale;
  const values = valuesFromFormData(form, data);

  const done = (state: FormSubmitState, redirectTo?: string): SubmissionOutcome => ({
    state,
    form,
    locale,
    ...(redirectTo ? { redirectTo } : {}),
  });
  const thankYou = form.successRedirectPageId
    ? contentRegistry.byId(form.successRedirectPageId)
    : undefined;
  const successRedirect = thankYou
    ? localizedPath(thankYou.path, locale, settings.general.defaultLocale)
    : undefined;
  const silentSuccess = () => done(SILENT_SUCCESS, successRedirect);

  const honeypot = data.get(FormHiddenField.Honeypot);
  if (typeof honeypot === 'string' && honeypot !== '') return silentSuccess();
  const token = data.get(FormHiddenField.Token);
  if (token === null) {
    // No token yet (JavaScript off, or submitted before it streamed in): ask to confirm.
    return done({ status: FormSubmitStatus.Confirm, values });
  }
  if ((await checkFormToken(form.id, token)) !== TokenCheck.Ok) return silentSuccess();

  const ip = getClientIp(requestHeaders);
  if (turnstileEnabled() && !(await verifyTurnstile(data.get(FormHiddenField.Turnstile), ip))) {
    return done({ status: FormSubmitStatus.Error, values });
  }

  const ipHash = await hashIp(ip);
  const keys = formThrottleKeys(form.id, ipHash);
  if (await isLocked(db, keys)) return done({ status: FormSubmitStatus.RateLimited, values });
  await recordFailure(db, keys);

  const result = validateSubmission(form, values);
  if (!result.ok) return done({ status: FormSubmitStatus.Invalid, errors: result.errors, values });

  const pagePath = safeRedirectPath(data.get(FormHiddenField.Page), '').slice(0, PAGE_PATH_MAX);
  const config = settings.forms.destinations[form.id];
  const destinations = enabledDestinations(config);
  const now = new Date();
  const [stored] = await db
    .insert(formSubmissions)
    .values({
      formId: form.id,
      locale,
      data: result.values,
      pagePath: pagePath || null,
      ipHash,
      userAgent: browserName(requestHeaders.get('user-agent') ?? ''),
      createdAt: now,
      delivery: Object.fromEntries(
        destinations.map((destination) => [
          destination,
          { status: DeliveryStatus.Pending, attempts: 0, at: now.toISOString() },
        ]),
      ),
    })
    .returning({ id: formSubmissions.id });
  if (!stored) return done({ status: FormSubmitStatus.Error, values });

  if (config && destinations.length > 0) {
    await deliverSubmission(
      db,
      form,
      {
        id: stored.id,
        formId: form.id,
        locale,
        pagePath: pagePath || null,
        createdAt: now,
        data: result.values,
      },
      config,
      destinations,
    );
  }

  return done({ status: FormSubmitStatus.Success }, successRedirect);
}

/** False while the site is private or in maintenance, unless a staff member is signed in. */
export async function formsOpen(settings: SiteSettings): Promise<boolean> {
  if (!settings.status.maintenance.enabled && !settings.status.privateMode) return true;
  return (await getCurrentUser()) !== null;
}

/** Every answer that shows the form again carries a fresh timing token. */
export async function withFreshToken(outcome: SubmissionOutcome): Promise<FormSubmitState> {
  const { state, form } = outcome;
  if (state.status === FormSubmitStatus.Success || !form) return state;
  return { ...state, token: await issueFormToken(form.id) };
}
