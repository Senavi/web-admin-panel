# Customizing the template for a new project

The repository has a template-owned **core** and a replaceable **project layer**. A new
project replaces the demo site and keeps the core untouched, so template updates can still be
merged later. Everything marked `DEMO` in comments is meant to be replaced.

## Checklist

### 1. Start the project

```bash
git clone <template-url> my-site && cd my-site
git remote rename origin template          # keep the template for updates
git remote add origin <your-project-repo>
corepack enable pnpm && pnpm install
pnpm dev                                   # zero config: local DB, demo content, dev admin
```

The dev admin's credentials are in `.data/dev-admin-credentials.txt` (or set
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env.local` before the first `pnpm dev`).

### 2. Project config: `project.config.ts`

- `name`: default site name (admins can change it in Settings).
- `supportedLocales` / `defaultLocale`: every language the site can have. Admins enable a
  subset in Settings → General.
- `adminPath`: admin URL (default `/admin`).
- `siteRoutes`: public routes that are **not** content pages (`/legal`, `/blog/:slug`,
  `/docs/*`). Unknown URLs get the localized 404.
- `brand.themeColor`, `brand.backgroundColor`: defaults for browser UI and the manifest.
- `onUserInvited`: optional hook to email invites (otherwise the temporary password is shown once).

Rename `name` in `package.json` too.

### 3. Remove the demo site

Delete or replace:

- `src/content/pages/*`, `src/content/seed/assets/*` and the entries in `src/content/index.ts`
- `src/site/pages/*`, `src/site/sections/*`, `src/site/components/feature-icon.tsx`
- `src/site/navigation.ts`, and the demo strings in `src/site/messages/*.json`
- the route files under `src/app/(site)/[locale]/(pages)/` (keep `layout.tsx`, `not-found.tsx`,
  `[...rest]`, `error-404`)

Keep the infrastructure in `src/site`: `components/ui/*` (typography, layout, button,
image, rich text), `layout/*` (adapt the header/footer), `maintenance/`, `i18n/request.ts`.

### 4. Map the design to tokens

Follow docs/DESIGN_TOKENS.md: fonts in `src/site/theme/fonts.ts`, colors/typography/
spacing in `src/site/theme/tokens.css`, then `pnpm tokens:generate`. Components use only
semantic classes and text-style utilities. `pnpm tokens:check` enforces it.

### 5. Build sections and pages

For each page in the design:

1. Write the schema (`src/content/pages/<page>.ts`) with `definePage` and `f.*` fields
   (docs/CONTENT_SCHEMA.md). Put the design's copy into `seed` per locale and images into
   `src/content/seed/assets/`.
2. Register it in `src/content/index.ts`.
3. Build the sections in `src/site/sections/` and the view in `src/site/pages/`.
4. Add the route file under `src/app/(site)/[locale]/(pages)/<path>/page.tsx` with
   `createPageRoute('<id>', View)`.
5. `pnpm content:sync` (or restart `pnpm dev`) and `pnpm content:check`.

The admin editor for the page is generated automatically.

### 6. Languages

Add locales to `supportedLocales`, add `src/site/messages/<locale>.json`, add seed content per
locale and per-locale SEO defaults (`seo.localized`). Enable them in Settings → General.

### 7. Maintenance page and OG image

- Maintenance page: replace the re-export in `src/site/maintenance/index.tsx`.
- Default share image: edit `src/site/theme/og-image.tsx`.

### 8. Deploy

See docs/DEPLOYMENT.md (Supabase + Vercel or Netlify). In development you can move the local
data to Supabase with **Security → Connect Supabase**.

## Extension points (no core edits needed)

| Need                                                 | Extension point                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Project name, locales, admin URL, non-content routes | `project.config.ts`                                                  |
| Invite / password-reset emails                       | `projectConfig.onUserInvited`                                        |
| Third-party scripts, embeds, fonts (CSP sources)     | `projectConfig.csp`                                                  |
| Pages, fields, seed content                          | `src/content/**`                                                     |
| New field type                                       | docs/CONTENT_SCHEMA.md § Adding a field type (core change, upstream) |
| Custom JSON-LD per page                              | `definePage({ structuredData })`                                     |
| Per-locale SEO defaults                              | `definePage({ seo: { localized } })`                                 |
| Look & feel                                          | `src/site/theme/*`                                                   |
| Maintenance page                                     | `src/site/maintenance/index.tsx`                                     |
| Default OG image                                     | `src/site/theme/og-image.tsx`                                        |
| UI strings                                           | `src/site/messages/*.json`                                           |

### Content Security Policy for third parties

The site CSP allows only the site's own origin. To embed a map, a video or an analytics
script, add its sources in `project.config.ts`; they are merged into the site CSP (the
admin CSP is not affected):

```ts
csp: {
  scriptSrc: ['https://plausible.io'],
  connectSrc: ['https://plausible.io'],
  frameSrc: ['https://www.youtube-nocookie.com', 'https://www.google.com'],
},
```

Directives: `scriptSrc`, `styleSrc`, `imgSrc`, `fontSrc`, `connectSrc`, `frameSrc`,
`mediaSrc`, `formAction`. Sources are validated at startup (origins like
`https://*.example.com`, schemes like `data:`, quoted keywords). A bare `*`,
`'unsafe-eval'`, `'unsafe-hashes'`, scheme-wide script sources (`https:`, `data:` in
`scriptSrc`) and malformed values fail at startup with a clear error.

## Pulling template updates

The template uses semantic versioning (`CHANGELOG.md`, git tags `vX.Y.Z`).

```bash
git fetch template --tags
git merge v1.1.0          # or: git merge template/main
```

Conflicts should only appear in the project layer if you also changed core files. Prefer
contributing core changes upstream to the template.
