# Content schema

Pages are **fixed in code**: developers define their structure, admins and managers edit
their content and SEO. Besides pages there are **collections** (repeatable items with their
own URL, e.g. blog posts), **globals** (content shared by many pages, e.g. footer contacts)
and **forms** (contact forms with an inbox). The admin editor, the TypeScript types the site receives, and the
validators are all **generated from the schema**, so adapting the admin to a new project
means writing schemas, not admin code.

```
src/content/
├─ index.ts              ← registry: pages, collections, globals, forms
├─ pages/<page>.ts       ← one definePage() per page
├─ collections/<id>.ts   ← defineCollection()
├─ globals/<id>.ts       ← defineGlobal()
├─ forms/<id>.ts         ← defineForm()
└─ seed/assets/          ← images referenced by seed content ({ asset: 'hero.webp' })
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
export const registry = createRegistry({
  pages: [homePage, aboutPage, blogPage, contactPage],
  collections: [blog], // optional
  globals: [siteGlobals], // optional
  forms: [contactForm], // optional
});
```

The v1.1 form `createRegistry([homePage, aboutPage])` still works (pages only). The registry
validates kebab-case ids (they are DB keys), unique ids per kind and paths, existing
parents, the absence of cycles, that a collection's `listPageId` is a registered page whose
path its `itemPath` starts with, that no page path matches a collection item URL, and that a
form's `successRedirectPageId` exists. `collections`, `site-wide` and `forms` are reserved
page ids (admin URLs).

## Field types

Every builder accepts `label`, `help`, `required`, `localized` (default `true`) and `default`.

| Builder                    | Stored value                | Site receives                                                            | Extra options                             |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `f.text()`                 | `string`                    | `string`                                                                 | `min`, `max`, `placeholder`               |
| `f.textarea()`             | `string`                    | `string`                                                                 | `max`, `rows`                             |
| `f.richText()`             | rich text JSON              | rich text JSON (render with `<RichText>`)                                | `max` (plain-text chars)                  |
| `f.image()`                | `{ mediaId, alt }`          | `ResolvedImage \| null` (`src`, `width`, `height`, `alt`, `blurDataURL`) | `recommendedSize`                         |
| `f.link()`                 | `{ label, href, external }` | same                                                                     |                                           |
| `f.list({ of })`           | `Array<{ _key, …fields }>`  | same, images resolved                                                    | `min`, `max`, `itemLabelField`, `display` |
| `f.list({ of: f.text() })` | `Array<{ _key, value }>`    | **plain values**: `string[]`                                             | `min`, `max`, `display`                   |
| `f.boolean()`              | `boolean`                   | `boolean`                                                                |                                           |
| `f.number()`               | `number`                    | `number`                                                                 | `min`, `max`, `step`, `integer`           |
| `f.select({ options })`    | union of option values      | same                                                                     | `options: [{ value, label }]`             |
| `f.color()`                | `#rrggbb`                   | same                                                                     |                                           |
| `f.email()`                | `string` (validated email)  | same; link with `mailtoHref()`                                           | `placeholder`                             |
| `f.phone()`                | `string` (validated phone)  | same; link with `telHref()`                                              | `placeholder`                             |

Notes:

- **Localized vs shared.** `localized: false` values are stored once and shown as "Shared
  across languages" in the editor. Image _alt text_ is always per locale, even for shared
  images.
- **Lists** are localized as a whole (`localized` on the list, not on item fields). Items
  carry a stable `_key` so editors can reorder them. See [Lists](#lists) for layouts.
- **Rich text** allows paragraphs, headings (h2–h4), bullet/numbered lists, bold, italic and
  links (http(s), mailto:, tel:, relative paths, anchors). It is stored as JSON, validated on
  save and again on render, and never injected as HTML.
- Use `required` for editorial rules; stored data is read leniently (an invalid or missing
  value falls back, it never crashes the page).

## Lists

`of` is either **one field** (a list of plain values: tags, bullet points; the site receives
`string[]`) or **a map of fields** (a list of objects). The editor layout is chosen from the
item shape, or set with `display`:

| Item shape                                                     | Auto `display` | Editor                                                                                                     |
| -------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| one text (`max` ≤ 40) or select, or `display: 'tags'`          | `tags`         | chips: type + Enter adds, × or Delete removes, Alt+←/→ or drag to reorder, paste comma/line-separated text |
| one text (`max` ≤ 120, or no `max`)                            | `lines`        | stacked inputs, all visible: Enter adds the next line, Backspace on an empty line removes it, paste lines  |
| 2–3 short fields (text, number, select, link, boolean, email…) | `rows`         | a row per item, all visible, column headers                                                                |
| image, rich text, textarea, or more than 3 fields              | `cards`        | compact cards with a preview (thumbnail + `itemLabelField`); collapsed, a new card opens                   |

```ts
tags: f.list({ label: 'Tags', of: f.text({ max: 30 }), max: 8 }),            // tags → string[]
highlights: f.list({ label: 'Highlights', of: f.text({ max: 100 }) }),        // lines → string[]
stats: f.list({ of: { value: f.number(), suffix: f.text(), label: f.text() } }), // rows
team: f.list({ of: { photo: f.image(), name: f.text(), bio: f.textarea() }, itemLabelField: 'name' }), // cards
```

Prefer the simplest data shape: a list of strings for tags or bullet points (not objects
with one field), no nested lists, and only the fields the design needs. Only sections and
`cards` collapse; `tags`, `lines` and `rows` always show every item. `min`/`max` and per-item
validation apply to every layout; every layout works with the keyboard (move buttons or
Alt+arrows) and screen readers. An explicit `display` that can't show the item shape throws
when the schema loads.

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

## Collections

Repeatable items with their own URL: posts, projects, vacancies. Developers define the
fields; editors create, publish, unpublish and delete items in **Pages → Blog & lists**.

```ts
// src/content/collections/blog.ts
import {
  defineCollection,
  MissingTranslation,
  StructuredDataType,
} from '@/core/content/collection';
import { f } from '@/core/content/fields';

export const blog = defineCollection({
  id: 'blog', // stable DB key, kebab-case, never renamed
  label: 'Blog', // admin group label
  itemLabel: 'Post', // "New post"
  listPageId: 'blog', // registered page that renders the list (/blog)
  itemPath: '/blog/:slug', // must start with the list page path
  fields: {
    // same f.* builders as pages (no sections level)
    title: f.text({ label: 'Title', required: true, max: 120 }),
    excerpt: f.textarea({ label: 'Short description', max: 300 }),
    cover: f.image({ label: 'Cover image', localized: false, recommendedSize: '1600×900' }),
    body: f.richText({ label: 'Text', required: true }),
  },
  titleField: 'title', // admin table, default SEO title, slug suggestion
  summaryField: 'excerpt', // default meta description
  imageField: 'cover', // default OG image
  sort: { by: 'publishedAt', direction: 'desc' }, // or a field name
  pageSize: 12,
  missingTranslation: MissingTranslation.Fallback, // or Hide (item hidden in that locale)
  structuredData: StructuredDataType.BlogPosting, // Article | NewsArticle | 'none' | (ctx) => [...]
  seed: [
    {
      slug: 'hello-world',
      publishedAt: '2026-01-15',
      content: {
        en: { title: 'Hello', body: richTextFromParagraphs('…') },
        uk: { title: 'Привіт' },
      },
    },
  ],
});
```

Item fields are typed from `fields` like pages. Slugs are lowercase `[a-z0-9-]`, max 100
chars, unique per collection and shared by all languages; the editor suggests one from the
title (Cyrillic is transliterated). Changing a slug keeps the old URL working with a 308.

**Routes.** The list page uses `createCollectionListRoute` (real `?page=N` URLs, a self
canonical per page, 404 beyond the last page) and the item route
`createCollectionItemRoute`:

```tsx
// src/app/(site)/[locale]/(pages)/blog/page.tsx
const route = createCollectionListRoute('blog', 'blog', BlogView); // pageId, collectionId
export default route.Page;
export const generateMetadata = route.generateMetadata;
export const instant = false;

// src/app/(site)/[locale]/(pages)/blog/[slug]/page.tsx
const route = createCollectionItemRoute('blog', PostView);
export default route.Page;
export const generateMetadata = route.generateMetadata;
export const generateStaticParams = route.generateStaticParams;
export const instant = false;
```

Views receive typed data: `CollectionListViewProps<'blog', 'blog'>` (`content` of the list
page, `list.items`, `list.page`, `list.pageCount`, `pageHref(n)`) and
`CollectionItemViewProps<'blog'>` (`item.title`, `item.href`, `item.publishedAt`,
`item.content.cover`…, `preview` while staff preview a draft). Anywhere else:

```ts
const { items, page, pageCount, total } = await getCollectionList('blog', locale, { page: 1 });
const post = await getCollectionItem('blog', 'hello-world', locale); // null if unknown/draft
```

Only published items are shown; drafts are visible to staff through **Preview** (Draft
Mode). Unknown slugs, drafts and hidden translations return the localized 404 (decided by
the request proxy before rendering), old slugs a 308. Items appear in the sitemap with
hreflang alternates and `lastModified`, carry JSON-LD (`structuredData` + BreadcrumbList
Home → list → item) and their views are attributed to the collection in analytics.

Storage: `collection_items` (slug, status, publish date, version), `collection_item_content`,
`collection_item_seo`, `collection_item_revisions` (last 20) and `collection_slug_redirects`.
Cache tags: `collection:{id}`, `collection:{id}:list`, `collection:{id}:{slug}`.

## Shared sections

A **section of page content that repeats** on several pages (CTA band, testimonials, "why
us") is a shared section: defined once, placed in each page in site order, stored once, and
editable from every page that uses it. In the admin each page shows all its sections in
order; the shared one has a "Shared" badge and "Also on: About, Services. Changes here update
all 3 pages." Saving the page saves an edited shared section in the same transaction; a
concurrent edit is reported as a conflict naming the section.

```ts
// src/content/shared/cta.ts
export const ctaShared = defineSharedSection({
  id: 'cta', // stable DB key and the section id in pages
  label: 'Call to action',
  fields: { title: f.text({ label: 'Title' }), button: f.link({ label: 'Button' }) },
  seed: { en: { title: 'Ready?', button: { label: 'Contact', href: '/contact', external: false } } },
});

// in a page: sections in site order
sections: [heroSection, useShared(ctaShared), faqSection],

// src/content/index.ts
createRegistry({ pages, …, sharedSections: [ctaShared] });

// in the view: like any section
<CtaBand content={content.cta} /> // type: SharedSectionContent<typeof ctaShared>
```

- The page's own seed doesn't include shared sections (they are seeded in their definition).
- Cache tag `shared:{id}`: saving it revalidates every page that uses it.
- **Pages → Every page** lists shared sections with "Used on N pages"; opening one edits it
  directly.
- `content:check` warns about a shared section no page uses; using an unregistered one fails
  when the registry loads.
- **Moving an existing section:** give the shared section the same id as the repeated
  section (or the global's section) and replace it with `useShared()`. On the next
  `pnpm content:sync` (or `pnpm dev` start / deploy), the shared section adopts the values
  saved under that id on the first page that uses it, or in a global section with that id.
  The old values stay where they were (reported as orphans, never deleted).

**Rule:** globals are for layout chrome (header, footer, contacts, socials, announcement
bar). A section of page content that repeats is a shared section, never a global: otherwise
it disappears from the pages it appears on in the admin.

## Globals

Layout chrome shared by every page (header/footer texts, contacts, social links, legal line,
announcement bar): sections and seed like a page, but no route and no SEO. Edited in
**Pages → Every page**. Repeated page sections are [shared sections](#shared-sections).

```ts
// src/content/globals/site.ts
export const siteGlobals = defineGlobal({
  id: 'site',
  label: 'Header & footer',
  sections: [
    defineSection({
      id: 'contacts',
      label: 'Contacts',
      fields: {
        phone: f.phone({ label: 'Phone', localized: false }),
        email: f.email({ label: 'Email', localized: false }),
        address: f.textarea({ label: 'Address' }),
      },
    }),
    defineSection({
      id: 'social',
      label: 'Social links',
      fields: {
        links: f.list({
          label: 'Links',
          of: { network: f.select({ options: SOCIAL_NETWORKS }), link: f.link() },
        }),
      },
    }),
  ],
  seed: { en: { contacts: { phone: '+380 44 000 00 00' } } },
});

// in a layout component
const { contacts, social } = await getGlobalContent('site', locale);
<a href={telHref(contacts.phone)}>{contacts.phone}</a>;
```

`getGlobalContent` is typed from the definition, uses the same fallback chain as pages and is
cached with the tag `global:{id}`: saving updates every page that rendered it. Globals are
stored in the page tables under the key `global:<id>` and need no route.

## Forms

Fields are fixed in code; their visible copy (labels, placeholders, help, option labels,
consent text, submit label, success and confirmation messages) is edited per language in
**Pages → Forms → Texts**. Submissions land in the form's **Inbox**.

```ts
// src/content/forms/contact.ts
export const contactForm = defineForm({
  id: 'contact',
  label: 'Contact form',
  fields: {
    name: { type: FormFieldType.Text, required: true, max: 100, label: 'Name' },
    email: { type: FormFieldType.Email, required: true },
    phone: { type: FormFieldType.Tel },
    topic: { type: FormFieldType.Select, options: ['general', 'project', 'job'] },
    message: { type: FormFieldType.Textarea, required: true, max: 3000 },
    consent: { type: FormFieldType.Consent, required: true },
  },
  successRedirectPageId: undefined, // optional thank-you page; otherwise inline success
  seed: { en: { name: { label: 'Your name' }, messages: { submit: 'Send message' } } },
});
```

Field types: `text`, `email`, `tel`, `textarea`, `select` (options are kebab-case values;
their labels are texts `option_<value>`), `checkbox`, `consent` (rich-text agreement).

**On the site** the core gives you data and behaviour, the project renders the markup with
its own primitives and tokens (see `src/site/components/contact-form.tsx`):

```tsx
// server component
const config = await getSiteFormConfig('contact', locale); // definition + texts
<ContactForm config={config} messages={…} security={<FormSecurityFields formId="contact" />} />

// client component
const summaryRef = useRef<HTMLDivElement>(null);
const form = useSiteForm({ config, messages, summaryRef });
<form {...form.formProps}>
  {form.hiddenFields}
  {security}
  {/* summary: ref={summaryRef} tabIndex={-1}, items in form.summary */}
  {config.fields.map((field) => /* form.field(name): inputProps, error, ids */)}
</form>;
```

Without JavaScript the form posts to `/api/forms/submit` with native browser validation and
gets a small confirm/success page (or the thank-you page). With JavaScript it validates
inline (same rules as the server), focuses an error summary, shows a pending state and the
success message without reloading. Validation messages are UI strings (`forms.errors.*` in
`src/site/messages`) with English defaults.

Spam protection (honeypot, signed minimum fill time, rate limits, optional Turnstile),
delivery (email, webhook, Telegram), retention and permissions: docs/SECURITY.md § Forms
and docs/DEPLOYMENT.md § Forms.

## Interface texts

The small texts of the public site (buttons, form messages, pagination, cookie banner, 404) are
not page content. They are read with next-intl (`getTranslations('blog')`) and stay editable:

1. Defaults: `src/site/messages/<locale>.json` (nested objects are allowed: `forms.errors.required`).
2. Catalog: `src/content/ui-texts.ts` (`defineUiTexts`) registers the message files and gives
   every key a human description ("Button on blog cards"), grouped by namespace.
3. Declare where a namespace appears: `uiTexts: ['blog', 'common']` on `definePage`,
   `defineGlobal`, `defineCollection` and `defineForm`. The header/footer namespaces (`nav`,
   `footer`, `common`, `cookie`, `notFound`) belong to the `site` global.

Admins edit a namespace on any page that declares it (an accordion item "Interface texts" with
"Also on: …"; changes update every place) or in Pages → Every page → Interface texts.
Edits are stored per language in `ui_texts`; the shown text is the language's edit, its file,
the main language's edit and file, then English (D-091). Cache tag `ui:{namespace}`. Placeholders
like `{date}` must stay in the text. `pnpm content:check` verifies the keys used in site code
and the declarations.

## Seeds after launch

Seeds are not only for the first start. `content:sync` (every `pnpm dev`, every deploy)
remembers, per field and language, which seed value it last applied (`content_seed_state`,
D-095):

- a field whose value is still that seed value (nobody edited it) **follows a changed seed**:
  fixing a typo in a seed fixes it on every database where that text was never edited, the
  live site included; a replaced seed image (new file, or new bytes under the same name) is
  imported again and used wherever the old one was untouched;
- a field someone edited is **never touched**;
- every update is a system revision ("Update from code") that can be restored from
  **History**, and the sync writes one activity-log entry;
- the first sync after upgrading to 1.7.1 only records the current seeds and changes nothing.

Interface texts (`src/site/messages/*.json`) always follow the code: only edits are stored.

**Reset to code defaults** (editor → ⋯): puts the code's values back in the current language,
for all sections or one (a shared section changes on every page that uses it). It lists the
fields that will change, saves a normal revision (undo from History) and is logged. Not offered
for collection items people created (they have no seed).

## Commands

| Command              | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm content:sync`  | Imports seed images (again when a seed file changed), creates missing rows and fills **missing** fields from seeds/defaults (pages, shared sections, globals, form texts, seed collection items), and creates seed collection items once (deleted or renamed seed items don't come back). A field nobody edited follows a changed seed ("updated from code", see [Seeds after launch](#seeds-after-launch)); edited content is never overwritten. Reports orphaned fields without deleting them. Runs on every `pnpm dev` and deploy. |
| `pnpm db:reset`      | Local only: deletes the local database, uploads and dev emails, then fills everything again from the code (prints the new dev admin). Refuses when `DATABASE_URL` is set or in production.                                                                                                                                                                                                                                                                                                                                            |
| `pnpm content:check` | Fails when a registered page or collection has no route, a route uses an unregistered page/collection, or paths differ. Globals and forms need no routes. Also checks the interface texts (keys used in site code exist in `en.json`, every used namespace is declared by a page, global, collection or form). Runs in CI.                                                                                                                                                                                                            |

## Adding a page (checklist)

1. Create `src/content/pages/<page>.ts` with `definePage` (+ seed content for each locale).
2. Add it to the registry in `src/content/index.ts`.
3. Build the view in `src/site/pages/<page>.tsx` from sections in `src/site/sections/`.
4. Create the route `src/app/(site)/[locale]/(pages)/<path>/page.tsx` with `createPageRoute('<id>', View)`.
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
