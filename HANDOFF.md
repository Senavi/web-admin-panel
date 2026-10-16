# Handoff: v1.7.0 (work in progress)

Branch `v1.7.0-wip`, based on `main` = v1.6.0 (tag `v1.6.0`). Follow `CLAUDE.md`. Backward
compatible with v1.6.x projects. Keep preview mode, permissions, audit log, revisions and
conflict detection working. **No AI translation features anywhere.** The user speaks
Ukrainian: reply to them in Ukrainian. Ask before pushing `main`/tags.

Commit trailer for this session's model: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
pnpm: `export PATH=$HOME/.local/bin:$PATH`. Admin URL is `/stst-admin` (custom `adminPath`);
e2e uses `admin()` from `tests/e2e/support/admin.ts` and `test`/`expect` from
`tests/e2e/support/test.ts`. Run e2e with `pnpm e2e:prod tests/e2e/<file>` (production build,
~1 min); preview-mode e2e: `pnpm e2e:preview`. Dev server stale-cache loop after builds: delete
`.next/dev`.

## Status

| Part                                                                    | State                                                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 5. Fix "Choose a new password" loop                                     | **Done** (commit `7fc67a6`), e2e `pending-password.spec.ts`, unit `pending-password.test.ts` |
| 1. `/storybook`                                                         | **Done** (commit `b7e7fa5`), e2e `storybook.spec.ts`, unit `storybook-model.test.ts`         |
| 3. Any language added by the admin                                      | **Not started**                                                                              |
| 4. Interface texts editable in the admin                                | **Not started** (do after 3)                                                                 |
| 2. Settings → Integrations (+ cookie consent, email, encrypted secrets) | **Not started** (do after 4: the cookie banner texts are interface texts)                    |
| Release: docs, DECISIONS, CHANGELOG, version 1.7.0, tag `v1.7.0`        | **Not started**                                                                              |

Checks at hand-over: typecheck, lint, 172 unit tests, `content:check`, `tokens:check` pass.
Full e2e not run (only the new specs + managers/auth for part 5).

Recommended order: **3 → 4 → 2 → release.** Commit each part separately; only tag at the end.

### What parts 5 and 1 added (so you can reuse it)

- Part 5: `src/core/auth/server/pending-password.ts` (30-min pending session, enforced from the
  session's `createdAt` in `getCurrentUser`; Better Auth would otherwise refresh the expiry),
  login page notice, change-password sign-out button, `changePasswordAction` extends the
  user's sessions to the normal lifetime.
- Part 1: `src/core/storybook/{model,slot,access,token-sections}.ts(x)`, route
  `src/app/(site)/storybook/` (own root layout), proxy `storybookResponse()` (valid signed gate
  cookie → page, else the identical site 404; noindex, no-store), project slot
  `src/site/storybook.tsx` (`storybookSections`; `content:check` verifies it), button variants
  in `src/site/components/ui/button-styles.ts`, form styles in `form-styles.ts`.

## Codebase pointers for the remaining parts

- **Languages today:** `projectConfig.supportedLocales` / `localeCodes` (`project.config.ts`,
  `src/core/project/define.ts`); stored `settings.general.enabledLocales` + `defaultLocale`
  (`src/core/settings/schema.ts`); `src/core/i18n/locales.ts` (`localeInfo`, `getLocaleSettings`,
  `isEnabledLocale`), `src/core/i18n/routing.ts` + `route-match.ts`; the proxy gets
  `enabledLocales` / `supportedLocales` from the published site state
  (`src/core/site-gate/state.ts`, `state-server.ts`, `src/proxy.ts`); `generateStaticParams` in
  `src/app/(site)/[locale]/layout.tsx`; next-intl config `src/site/i18n/request.ts` (imports
  `../messages/<locale>.json`, restricted to `projectConfig.localeCodes`); language switcher
  `src/site/layout/language-switcher.tsx`; settings language UI in
  `src/admin/components/settings/settings-screen.tsx` (General tab); the admin locale
  switcher: `src/admin/server/editor-locale.ts` (`resolveEditorLocale`), `DocumentEditor`.
  Content tables key rows by locale string already, so new locales need no migration.
  Fonts: `src/site/theme/fonts.ts` (Inter latin + cyrillic subsets) for the script warning.
- **Documents/editing:** `src/core/content/{document,editor,save,actions,loader}.ts`; shared
  sections (`shared-section.ts`, D-087) are the model for "Also on: …" notes and for stored
  per-namespace interface texts; cache tags in `src/core/cache/tags.ts`;
  `src/core/content/sync.ts` seeds; `section-fields.tsx` renders section accordions.
- **Settings:** tabs in `settings-screen.tsx`, one save per tab through `saveSettingsAction`
  (`src/core/settings/actions.ts`: partial per group/locale, one transaction, audit per group,
  `GROUP_PERMISSIONS`), schema groups in `src/core/settings/schema.ts`
  (`general`, `seo`, `branding`, `status`, `analytics`, `security`, `forms`), localized settings
  table `settings_localized`.
- **Forms/email today:** `src/core/forms/delivery.ts` reads the provider from env only
  (`MAIL_PROVIDER`), `src/core/forms/mail-status.ts`, per-form recipients in the `forms`
  settings group, retry job in `src/core/forms/maintenance.ts`, dev transport writes
  `.data/mail/`. env schema `src/core/env-schema.ts`.
- **Secrets key derivation precedent:** `src/core/auth/secret.ts` (`deriveAuthSecret`, HKDF with
  an `info` label, `getAuthSecret()`).
- **CSP:** static CSP comes from `next.config.ts` headers (`staticPageCsp(projectConfig.csp)` in
  `src/core/security/headers.ts`) for non-admin paths; admin gets a nonce CSP from the proxy.
  Part 2 needs the proxy to build the site CSP at runtime from the published site state.
- **Migrations:** Drizzle, `pnpm db:generate` after schema changes (additive), files in
  `src/core/db/migrations`; copy list for Supabase data copy `src/core/database/copy.ts`
  (`COPY_TABLES`), RLS is automatic for new tables.
- Decisions are numbered; the last is **D-089**. Next: D-090…

## Remaining spec (verbatim intent)

### 3. Any language, added by the admin

- Ship a master list of languages (BCP 47 code, English name, native name, direction, script)
  covering at least the ~100 most used. `project.config.ts` keeps `supportedLocales` only as
  the initial set and default; the **stored settings become the source of truth**.
- Settings → General → Languages: a searchable multi-select of all languages. Each selected
  language has a state: **Draft** (editable in the admin, hidden on the site) or **Published**.
  New languages start as Draft; "Publish language" makes them live. The main language is always
  published and cannot be removed.
- Never break existing languages: adding, unpublishing or removing a language never changes
  other languages' content; removing hides it and keeps its content (can be re-added);
  changing the main language requires the new one to be published and confirmed. Migration from
  v1.6: current enabled locales become Published, nothing else changes.
- Everywhere content is per language, the admin offers all selected languages (Draft marked):
  pages, shared sections, globals, collections, forms texts, SEO, settings SEO defaults,
  interface texts; completeness badges per language.
- Site: only Published languages are routed, in the switcher, sitemap and hreflang. Draft
  languages are previewable by staff (`?preview-lang=` or the staff session). Routing and static
  generation read the published list at runtime (new languages render on demand and are cached;
  publishing revalidates).
- Script warning: selecting a language whose script the site fonts don't cover (check font
  subsets) or an RTL language shows "Check with your developer: fonts/layout may need changes
  for this language". RTL sets `dir="rtl"`.
- Language switcher on the site is a dropdown by default (native names, current marked,
  keyboard accessible, also in the mobile menu); a prop allows tabs for projects that want
  them. Update the demo.

### 4. Interface texts editable in the admin, on the pages where they appear

All small site texts (buttons like "Read more", "Send", form validation messages, "Menu",
pagination, cookie banner, 404 texts, date labels) become editable per language.

- Keep `src/site/messages/<locale>.json` as defaults (seeds); store overrides per language in the
  database; reading merges override → default language override → file default → English
  fallback. A new language starts from the main language's texts (marked "not translated").
- Group texts by namespace (`blog`, `forms`, `nav`, `cookie`, `common`…). Pages declare which
  namespaces they show: `definePage({ …, uiTexts: ['blog', 'common'] })`; collections, forms,
  globals and the layout too (header/footer → `nav`, `common`).
- Editor: at the end of each page's sections, an accordion item "Interface texts" with the texts
  that page shows (labels are human: "Button on blog cards: Read more"). A namespace used on
  several pages shows "Also on: …" exactly like shared sections; editing it anywhere updates it
  everywhere. "Every page" lists all interface texts for overview.
- Cache: tag `ui:{namespace}`; saving revalidates affected pages. Revisions and audit as for
  content.
- `content:check`: every message key used in site code exists in the default locale file; every
  namespace used is declared by at least one page/global.

### 2. Settings → Integrations (admins only; a new tab)

Each integration is a card: logo/name, one-line description, status (Off / On / Error), fields,
Save, and where useful "Send test" / "Check".

- **Analytics & marketing** (IDs are not secrets): Google Analytics 4 (`G-…`), Google Tag Manager
  (`GTM-…`), Hotjar (Site ID), HubSpot (Portal ID; tracking code), Meta Pixel (Pixel ID). Validate
  formats. When on: scripts load on the public site only, after consent, with
  `afterInteractive`/`lazyOnload`; the needed origins are added to the site CSP automatically at
  runtime (the proxy builds the CSP from the published site state, so no rebuild is needed).
  Short note on the heavier ones ("may slow the site down a little").
- **Email for forms:** Resend (API key, From) and SMTP with presets (Brevo, Mailgun, Postmark,
  SendGrid, Gmail/Google Workspace, Other: host, port, user, password, TLS). One active provider.
  "Send test email" to the signed-in admin's address with a clear result. Replaces the `MAIL_*`
  env-only setup for clients; env vars still work and take precedence (show "Set on the server"
  read-only then).
- **Form emails must actually go out once email is connected here.** Provider resolution: env (if
  set) → the provider configured in Integrations → `dev` in development → none. Recipients: add
  "Default recipients" in Settings → Requests (used by every form with no own list), per-form lists
  stay as overrides; a form with recipients (own or default) and a working provider sends every
  submission by email. When a provider is connected and no recipients exist anywhere, show a
  warning in Settings → Requests and on Overview ("Requests are saved but not emailed: add
  recipients"). Submissions that failed before the provider was set are retried by the existing
  retry job. E2E: connect SMTP via the dev transport, set default recipients, submit each demo form
  → an email per submission to the right recipients.
- **Secrets storage:** API keys, SMTP passwords etc. encrypted in the database with AES-256-GCM,
  key derived with HKDF from `AUTH_SECRET` (or its derived value) with a dedicated `info` label;
  per-value random IV; never returned to the browser after saving (show `••••1234`, "Replace",
  "Remove"); decrypted only server-side when used; audit entries without values; admin-only server
  actions. If the key changes (secret rotated), stored secrets become unreadable: show "Re-enter
  the key" instead of crashing. Update SECURITY.md and DECISIONS (this replaces "never store
  secrets in the database" for integration credentials only; database and auth secrets stay in
  env). Also update the CLAUDE.md security rule wording accordingly.
- **Cookie consent:** when any integration that sets cookies is on, a small accessible banner
  bottom-right (not a full-width bar): one sentence + link to the privacy page, "Accept" and
  "Decline" (equal weight), remembered for 6 months; scripts load only after Accept; a "Cookie
  settings" link in the footer reopens it. Texts are editable interface texts (part 4), styled
  with site tokens via a project-overridable component `src/site/components/cookie-banner.tsx`. No
  banner when nothing needs consent.
- Security → status card includes integrations with errors.

### Checks and release

Unit tests: encryption round-trip and key-rotation failure, integration ID validation, CSP from
state, language states and routing rules, UI text fallback chain. E2E: storybook (done); GA on →
banner → Accept loads the script, Decline doesn't; send test email with the dev provider; add a
language as Draft (site unchanged, existing languages intact) → translate a page → Publish →
appears in switcher and sitemap; edit an interface text on Blog → changes on Home teasers too;
SMTP + default recipients → an email per submission. Typecheck, lint, unit, content/tokens checks;
e2e for new specs + editor + settings suites. Docs (CUSTOMIZING, CONTENT_SCHEMA, SECURITY,
DEPLOYMENT), DECISIONS, CHANGELOG (upgrade notes), version 1.7.0, tag `v1.7.0`.

## Finishing

1. Do parts 3 → 4 → 2, one commit each (`v1.7 part N: …`).
2. Release commit: docs + DECISIONS + CHANGELOG `[1.7.0]` (include parts 5 and 1) + version.
3. Delete this file, merge `v1.7.0-wip` into `main`, tag `v1.7.0`, **ask the user before pushing**.
