# Security

Threats considered and how the template mitigates them. Rules that must never be relaxed are
summarized in CLAUDE.md.

## Authentication & sessions

| Threat                                               | Mitigation                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential stuffing / brute force                    | DB-backed login throttle per email and per hashed IP with exponential backoff (5 / 20 free attempts, up to 15 min / 1 h); Better Auth's DB rate limiter on its HTTP endpoints; generic error messages for unknown email, wrong password and disabled users. |
| Weak passwords                                       | Min 12 chars, common-password list (NCSC top passwords ≥12 chars), repetition and email checks; memory-hard scrypt hashing (Better Auth).                                                                                                                   |
| Bypassing our checks via the auth library's HTTP API | `/api/auth/*` forwards only `get-session`, `sign-out`, `ok`; sign-in/2FA/password changes run in server actions.                                                                                                                                            |
| Session theft                                        | httpOnly, `Secure` (production, `__Secure-` prefix), SameSite=Lax cookies; configurable lifetime; sessions revoked on password change, reset and disable; admins can revoke any session.                                                                    |
| Account takeover with password only                  | Optional TOTP 2FA (backup codes); policy to require it for admins.                                                                                                                                                                                          |
| Default credentials                                  | None ship. First admin via `pnpm admin:create`; in development a random password is written to a gitignored file.                                                                                                                                           |
| Temporary passwords                                  | Shown once, must be changed at first sign-in.                                                                                                                                                                                                               |
| Credentials in URLs before hydration                 | Login is a server-action form (works without JS, POST); all admin forms use `method="post"`.                                                                                                                                                                |

## Authorization

- Central permission map (`src/core/auth/permissions.ts`). Every admin page calls
  `requirePermission`, every server action / route handler `assertPermission`. Hiding UI
  is not access control (an e2e test replays a settings action as a manager).
- Guards: no self delete/disable/demote; the last active admin can't be removed or demoted.
- Proxy-level early 404 for admin-only sections uses the signed, version-checked gate cookie
  (defense in depth only).

## Site gate (maintenance / private mode)

- The proxy has no DB access; staff are recognized by an HMAC-signed `site_gate` cookie whose
  session version must match the published staff list. Forged, expired, outdated (password
  changed, disabled, role changed) cookies are rejected.
- The internal `/api/site-state` endpoint requires an HMAC key derived from `AUTH_SECRET`.
- **Fails closed:** if the proxy cannot load the site state (cold instance, database down)
  and has no last-known state, public pages return `503` with `Retry-After` instead of
  being served. Private or maintenance mode can never be skipped by an outage.

## Input & content

| Threat                    | Mitigation                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid / malicious input | Zod validation of every action and route input, env vars and content.                                                                                                                              |
| Stored XSS via rich text  | Rich text is JSON validated against an allowlist on save **and** render; rendered by a JSON→React renderer (no HTML injection); links limited to http(s), mailto, tel, relative paths and anchors. |
| JSON-LD injection         | `<` escaped in JSON-LD scripts.                                                                                                                                                                    |
| CSRF                      | Next.js server action origin protection; same-origin checks on mutating route handlers (`/api/media`, `/api/gate`, `/api/collect`, `/api/forms/submit`, `/api/preview/exit`).                      |
| Open redirects            | `safeRedirectPath` allows only same-origin relative paths.                                                                                                                                         |

## Collections and previews

- Item mutations (create, save, publish, delete) check `pages.edit` on the server, validate
  with Zod (slug format and uniqueness, publish date) and write audit entries naming the
  item ("Blog: Hello world"); conflicts are detected per content row and on the item row.
- Drafts never reach visitors: list/item loaders read published items only; unknown, draft
  and hidden slugs get a 404 from the proxy. **Preview** (`/api/preview`) requires a signed-in
  user with `pages.view`, redirects to a URL built from the database, and enables Draft Mode
  with a cookie scoped to that item's path; the item route re-checks the session before
  showing a draft.

## Forms

- **Public endpoints** `/api/forms/submit` and `/api/forms/token` are same-origin checked
  (submit), closed to visitors while the site is private or in maintenance, and never log
  submission data.
- **Spam:** honeypot field; signed minimum fill time (HMAC token, ≥ 3 s, ≤ 24 h; without
  JavaScript one confirm step); DB rate limits (5 per visitor per 10 min, 200 per form per
  hour, keyed by a hashed IP); optional Cloudflare Turnstile. Spam gets a fake success.
- **Validation:** schema derived from the form definition, the same in the browser and on
  the server; plain-text emails; header values stripped of CR/LF; fallback pages escape all
  output.
- **PII:** submissions store the form values, locale, page path, a keyed IP hash and the
  browser family only. They are deleted after the retention period (Settings → Requests) and
  can be deleted one by one by admins (GDPR requests). Exports are audited and escape
  spreadsheet formulas.
- **Permissions:** managers read, mark and export (`forms.view`); deleting
  (`forms.delete`) and Settings → Requests (`forms.settings`) are admin only.
- **Delivery:** secrets only in env; webhooks are signed, sent to https (or localhost) URLs
  set by admins, without following redirects; Telegram errors never include the token.

## Uploads

- Type detected from magic bytes (not the name); allowlist JPEG/PNG/WebP/GIF/AVIF; 4 MB limit;
  decompression-bomb pixel limit; min/max dimensions.
- Images are re-encoded to WebP (EXIF/GPS metadata stripped) under random keys.
- SVG only for logos: sanitized with svgo + strict deny-list (scripts, event handlers,
  foreignObject, external references, entities); served with `Content-Security-Policy: sandbox`.
- Local media is served with `nosniff` and a sandboxing CSP.

## Headers

Every response: HSTS (production), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
`Cross-Origin-Opener-Policy: same-origin`, restrictive `Permissions-Policy`.

CSP: static site pages `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (Next.js's
inline runtime; no nonces are possible on static pages), `object-src 'none'`,
`frame-ancestors 'none'`, `base-uri`/`form-action 'self'`, `upgrade-insecure-requests`.
Admin: per-request nonce with `'strict-dynamic'`. An e2e test fails on CSP violations.
Projects add third-party sources to the **site** CSP only, via `projectConfig.csp`
(validated; see CUSTOMIZING.md).

Admin responses: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.

## Preview mode

Without `DATABASE_URL` nothing is stored or authenticated: no admin login, sign-in or
draft-preview routes (404), forms refuse with 503, analytics are off, and the site is
never indexable. The internal proxy ↔ site-state key uses a fixed public value in this
mode only; with a database it is always a real secret (D-079).

## Secrets & data

- `src/core/env.ts` validates env at startup; production fails fast on missing values.
- `AUTH_SECRET` defaults to HKDF-SHA256 of `SUPABASE_SERVICE_ROLE_KEY` (D-080); set it
  explicitly to rotate the two independently. Development uses only the generated dev secret.
- Server-only modules import `server-only`; no `NEXT_PUBLIC_` secrets; database and auth
  secrets are never stored in the database; the admin never shows their values (Connect
  Supabase masks them).
- **Integration credentials** (email API key, SMTP password; Settings → Integrations, admins
  only) are the one exception: stored AES-256-GCM encrypted with a key derived by HKDF from
  the auth secret (own `info` label, random IV per value, bound to the value's name). They are
  never returned to the browser (only `••••1234`), never written to the audit log and decrypted
  only server-side when sending. A rotated `AUTH_SECRET` makes them unreadable: the admin is
  asked to enter them again (D-092).
- Supabase: RLS enabled on every table with no policies; service role key server-only;
  storage bucket public-read, server-write.
- Activity log (audit log) of admin actions and sign-in attempts (IP stored only as a keyed hash).

## Integrations and consent

- Analytics and marketing scripts (GA4, GTM, Hotjar, HubSpot, Meta Pixel) load only after the
  visitor accepts the cookie banner, only on the public site, and their origins are added to
  the site CSP at runtime from the published state; the admin CSP never changes (D-093).
- IDs are validated per tool before they are embedded in a script.
- Draft languages answer the 404 to everyone except signed-in staff (D-090).

## Privacy (analytics)

No cookies, no raw IPs. Visitor hash = SHA-256(daily salt | IP | UA | host); salts of past
days are deleted. Raw events are deleted after the retention period.

## Dependencies

Lockfile committed; pnpm build scripts allow-listed; `pnpm audit` in CI (non-blocking for
low severity).

## Known limitations

- Static pages need `'unsafe-inline'` for scripts (Next.js runtime). SRI is experimental.
- A demoted/disabled user's gate cookie stays valid until the proxy's state refreshes in the
  background (`SITE_STATE_TTL_MS`, 15 s by default; D-084). Lower it for faster revocation.
- Two admins disabling each other at the same moment is not serialized (race on the
  last-admin check).
- Webhook URLs are set by admins and may point to internal hosts (localhost is allowed for
  local tools); treat Settings → Requests as admin-only configuration.
- Collection slug changes and new items reach other visitors within the proxy's state TTL
  (15 s by default); the person who published sees them at once.
- Next.js logs an "Unexpected cache miss" warning while a staff preview renders (Draft
  Mode bypasses caches); harmless.
