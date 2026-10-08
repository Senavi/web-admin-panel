# Content schema

Pages are **fixed in code**: developers define their structure, admins and managers edit
their content and SEO. The admin editor, the TypeScript types the site receives, and the
validators are all **generated from the schema**, so adapting the admin to a new project
means writing schemas, not admin code.

```
src/content/
├─ index.ts            ← registry: every page of the site
├─ pages/<page>.ts     ← one definePage() per page
└─ seed/assets/        ← images referenced by seed content ({ asset: 'hero.webp' })
```

## Defining a page

```ts
// src/content/pages/home.ts
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';

export const homePage = definePage({
  id: 'home', // stable id: never rename after launch (it's the DB key)
  path: '/', // URL without locale prefix; '/about/team' for sub-pages
  label: 'Home', // admin label
  parent: null, // parent page id → page tree in the admin
  seo: { title: 'Home', description: '…' }, // defaults (admins override per locale)
  sections: [
    defineSection({
      id: 'hero',
      label: 'Hero',
      fields: {
        title: f.text({ label: 'Title', required: true, max: 120 }),
        image: f.image({ label: 'Hero image', localized: false, required: true }),
      },
    }),
  ],
  seed: {
    // initial content per locale (from the design)
    en: { hero: { title: 'Hello', image: { asset: 'hero.webp', alt: 'Description' } } },
    uk: { hero: { title: 'Привіт', image: { asset: 'hero.webp', alt: 'Опис' } } },
  },
});
```

Then register it in `src/content/index.ts`:

```ts
export const registry = createRegistry([homePage, aboutPage, teamPage, contactPage]);
```

The registry validates unique ids/paths, existing parents and the absence of cycles.

## Field types

Every builder accepts `label`, `help`, `required`, `localized` (default `true`) and `default`.

| Builder                 | Stored value                | Site receives                                                            | Extra options                   |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `f.text()`              | `string`                    | `string`                                                                 | `min`, `max`, `placeholder`     |
| `f.textarea()`          | `string`                    | `string`                                                                 | `max`, `rows`                   |
| `f.richText()`          | rich text JSON              | rich text JSON (render with `<RichText>`)                                | `max` (plain-text chars)        |
| `f.image()`             | `{ mediaId, alt }`          | `ResolvedImage \| null` (`src`, `width`, `height`, `alt`, `blurDataURL`) | `recommendedSize`               |
| `f.link()`              | `{ label, href, external }` | same                                                                     |                                 |
| `f.list({ of })`        | `Array<{ _key, …fields }>`  | same, images resolved                                                    | `min`, `max`, `itemLabelField`  |
| `f.boolean()`           | `boolean`                   | `boolean`                                                                |                                 |
| `f.number()`            | `number`                    | `number`                                                                 | `min`, `max`, `step`, `integer` |
| `f.select({ options })` | union of option values      | same                                                                     | `options: [{ value, label }]`   |
| `f.color()`             | `#rrggbb`                   | same                                                                     |                                 |

Notes:

- **Localized vs shared.** `localized: false` values are stored once and shown as "Shared
  across languages" in the editor. Image _alt text_ is always per locale, even for shared
  images.
- **Lists** are localized as a whole (`localized` on the list, not on item fields). Items
  carry a stable `_key` so editors can reorder them.
- **Rich text** allows paragraphs, headings (h2–h4), bullet/numbered lists, bold, italic and
  links (http(s), mailto:, tel:, relative paths, anchors). It is stored as JSON, validated on
  save and again on render, and never injected as HTML.
- Use `required` for editorial rules; stored data is read leniently (an invalid or missing
  value falls back, it never crashes the page).

## Reading content on the site

```ts
const route = createPageRoute('home', HomeView); // in src/app/(site)/[locale]/page.tsx
export default route.Page;
export const generateMetadata = route.generateMetadata;

export function HomeView({ content, locale }: PageViewProps<'home'>) {
  content.hero.title; // string
  content.hero.image; // ResolvedImage | null
}
```

`getPageContent(pageId, locale)` is fully typed from the schema (no manual types). The
fallback order for every field is:

1. the value saved for this locale,
2. the value saved for the default locale,
3. the page seed for this locale, then for the default locale,
4. the field default.

Reads are cached with `'use cache'` and tagged `content:{pageId}` and
`content:{pageId}:{locale}` (plus `settings`). Saving in the admin invalidates only those
tags, so pages stay statically rendered and update within seconds.

## Storage

- `page_content(page_id, locale)`: JSONB per locale with only localized values. The
  `_shared` row holds non-localized values. `version` is used for optimistic concurrency.
- `page_seo(page_id, locale)`: SEO overrides.
- `page_revisions`: the last 20 snapshots per (page, locale).

## Commands

| Command              | What it does                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm content:sync`  | Imports seed images, creates missing rows and fills **missing** fields from seeds/defaults. Never overwrites edited content. Reports orphaned fields (removed from the schema) without deleting them. Runs automatically on the first `pnpm dev`. |
| `pnpm content:check` | Fails when a registered page has no route, a route uses an unregistered page, or paths differ. Runs in CI.                                                                                                                                        |

## Adding a page (checklist)

1. Create `src/content/pages/<page>.ts` with `definePage` (+ seed content for each locale).
2. Add it to the registry in `src/content/index.ts`.
3. Build the view in `src/site/pages/<page>.tsx` from sections in `src/site/sections/`.
4. Create the route `src/app/(site)/[locale]/<path>/page.tsx` with `createPageRoute('<id>', View)`.
5. Run `pnpm content:sync` (or restart `pnpm dev`) and `pnpm content:check`.

Site routes that don't render managed content (e.g. a legal page written in code) must
contain the comment `// content-check: ignore`.

## Adding a field type

1. Add the kind to `FieldKind`, its descriptor interface and a builder in
   `src/core/content/fields.ts` (add it to `ScalarField` if it can appear in lists).
2. Add its Zod schema in `fieldSchema()` (`src/core/content/validation.ts`).
3. If the site receives a different shape than what is stored (like images), extend
   `ResolvedValue` in `define.ts` and the resolution in `values.ts` / `loader.ts`.
4. Add the editor control to the admin field registry (`src/admin/components/content/fields`).
5. Add unit tests in `tests/unit/content.test.ts`.
