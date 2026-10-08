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
| CSRF                      | Next.js server action origin protection; same-origin checks on mutating route handlers (`/api/media`, `/api/gate`, `/api/collect`).                                                                |
| Open redirects            | `safeRedirectPath` allows only same-origin relative paths.                                                                                                                                         |

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

## Secrets & data

- `src/core/env.ts` validates env at startup; production fails fast on missing values.
- Server-only modules import `server-only`; no `NEXT_PUBLIC_` secrets; secrets are never
  stored in the database; the Security page masks values.
- Supabase: RLS enabled on every table with no policies; service role key server-only;
  storage bucket public-read, server-write.
- Audit log of admin actions and sign-in attempts (IP stored only as a keyed hash).

## Privacy (analytics)

No cookies, no raw IPs. Visitor hash = SHA-256(daily salt | IP | UA | host); salts of past
days are deleted. Raw events are deleted after the retention period.

## Dependencies

Lockfile committed; pnpm build scripts allow-listed; `pnpm audit` in CI (non-blocking for
low severity).

## Known limitations

- Static pages need `'unsafe-inline'` for scripts (Next.js runtime). SRI is experimental.
- A demoted/disabled user's gate cookie stays valid until the proxy's state cache refreshes
  (a few seconds).
- Two admins disabling each other at the same moment is not serialized (race on the
  last-admin check).
