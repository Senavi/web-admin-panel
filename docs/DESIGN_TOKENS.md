# Design tokens

Every visual value of the public site lives in **one place**: `src/site/theme/`.
Components never contain raw values. Changing a token restyles the whole site, and no other
file needs to change.

```
src/site/theme/
├─ tokens.css            ← the ONLY file with raw values (Tailwind v4 @theme + :root)
├─ fonts.ts              ← the ONLY place fonts are declared (next/font)
├─ site.css              ← stylesheet entry: imports Tailwind + tokens, base styles
└─ tokens.generated.ts   ← GENERATED from tokens.css for TypeScript consumers
```

The admin uses shadcn's own theme (`src/admin/styles/admin.css`) and is not affected.

## Token layers

### 1. Primitives (raw palette)

`--color-brand-50 … 950`, `--color-neutral-0 … 950`, and single status hues
(`--color-green-600`, `--color-amber-600`, `--color-red-600`). Components **never** use
primitives directly.

### 2. Semantic colors (what components use)

| Token                                                                    | Tailwind classes                                                  | Meaning                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------- |
| `--color-background` / `--color-foreground`                              | `bg-background`, `text-foreground`                                | page surface and text       |
| `--color-surface`, `--color-surface-muted`                               | `bg-surface`, `bg-surface-muted`                                  | cards, alternating sections |
| `--color-muted-foreground`                                               | `text-muted-foreground`                                           | secondary text              |
| `--color-border`                                                         | `border-border`                                                   | dividers, outlines          |
| `--color-primary`, `--color-primary-hover`, `--color-primary-foreground` | `bg-primary`, `hover:bg-primary-hover`, `text-primary-foreground` | main actions, links         |
| `--color-accent`, `--color-accent-foreground`                            | `bg-accent`, `text-accent-foreground`                             | highlights, chips           |
| `--color-inverse`, `--color-inverse-foreground`                          | `bg-inverse`, `text-inverse-foreground`                           | dark bands                  |
| `--color-success`, `--color-warning`, `--color-danger`                   | `text-success`, …                                                 | status                      |
| `--color-focus-ring`                                                     | `outline-focus-ring`                                              | keyboard focus              |
| `--color-overlay`                                                        | `bg-overlay`                                                      | modal backdrops             |

A dark theme overrides **semantic tokens only** (see the commented block in tokens.css).

### 3. Typography

Font families: `--font-heading`, `--font-body`, `--font-mono` (`font-heading`, …), mapped
to the variables declared in `fonts.ts`.

Text styles are **composite tokens**: each style defines size, line height, letter spacing,
weight and family (`--type-<style>-size`, `-line-height`, `-letter-spacing`, `-weight`,
`-family`). Responsive sizes use `clamp()` inside the token. Each style is exposed as one
utility class:

`text-display`, `text-h1` … `text-h6`, `text-lead`, `text-body-lg`, `text-body`,
`text-body-sm`, `text-caption`, `text-overline`, `text-label`, `text-button`, `text-nav`.

In components use `<Heading level={2} variant="h3">` / `<Text variant="lead" tone="muted">`
(`src/site/components/ui/typography.tsx`) or the single class. Never combine size, leading
and tracking yourself.

### Layout, shape and motion

| Group         | Tokens                                                                                                          | Usage                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Spacing       | `--spacing` (scale base), `--spacing-gutter`, `--spacing-section`, `--spacing-section-tight`, `--spacing-stack` | `p-4`, `px-gutter`, `py-section`, `gap-stack`   |
| Containers    | `--container-content`, `--container-wide`, `--container-prose`                                                  | `<Container width="prose">`, `max-w-content`    |
| Breakpoints   | `--breakpoint-sm/md/lg/xl`                                                                                      | `md:`, `lg:` variants                           |
| Radii         | `--radius-sm/md/lg/xl/full`                                                                                     | `rounded-lg`                                    |
| Borders       | `--border-width-thin/thick`                                                                                     | `border-thin`, `border-thick`, `border-s-thick` |
| Shadows       | `--shadow-sm/md/lg`                                                                                             | `shadow-md`                                     |
| Aspect ratios | `--aspect-hero/portrait/media`                                                                                  | `aspect-hero`                                   |
| z-index       | `--z-header/overlay/skip-link`                                                                                  | `z-header`                                      |
| Motion        | `--ease-standard/emphasized`, `--duration-fast/normal/slow`                                                     | `ease-standard duration-normal`                 |

Section rhythm and containers come from `<Section>` / `<Container>`
(`src/site/components/ui/layout.tsx`).

Tailwind's default palette, fonts, type scale, radii and shadows are **reset**
(`--color-*: initial`, …) so only project tokens exist. A stray `text-blue-500` or `text-xl`
does not produce any CSS.

## Rules (enforced by `pnpm tokens:check`)

Not allowed in `src/site/**` (outside `src/site/theme/`) or `src/app/(site)/**`:

- hex/rgb/hsl/oklch/… color literals;
- raw `font-size` / `line-height` / `letter-spacing` (CSS) or `fontSize` / … (JS);
- arbitrary Tailwind values (`text-[17px]`, `bg-[#123456]`, `p-[13px]`, `[&>p]:…`);
- inline `style` with visual properties. Only CSS custom properties are allowed, for values
  that come from content: `style={{ '--person-accent': person.accent }}`;
- palette primitives in classes (`text-brand-500`, `bg-white`, `bg-blue-600`).

`tokens:check` also fails when `tokens.generated.ts` is stale.

## TypeScript access

`pnpm tokens:generate` parses `tokens.css`, resolves `var()` references and writes
`tokens.generated.ts`:

```ts
import { tokens } from '@/site/theme/tokens.generated';
tokens.color.primary; // '#2546ea'
tokens.type.h1.size; // 'clamp(…)'
```

Direction is **CSS → TS**: edit `tokens.css`, run `pnpm tokens:generate`, and commit both.
Never edit the generated file.

## Mapping a design to tokens

1. **Collect** colors, fonts and text styles from the design (Figma styles/variables,
   screenshots or existing CSS). List every distinct text style with its size, line height,
   letter spacing, weight and family on mobile and desktop.
2. **Primitives:** put brand and neutral scales in `--color-<name>-<step>`. Keep only hues
   that the design actually uses.
3. **Semantic tokens:** map each role (background, text, muted text, borders, primary
   action, accent, inverse band, status) to a primitive. If the design has a dark theme, add
   a block that overrides semantic tokens only.
4. **Fonts:** declare them in `fonts.ts` (Google via `next/font/google`, or local files via
   `next/font/local`) with the subsets you need (e.g. `cyrillic`). Keep the three
   variables (`--font-family-heading/body/mono`).
5. **Text styles:** fill the `--type-*` tokens. For responsive sizes use
   `clamp(min, preferred, max)`, e.g. mobile 36px → desktop 56px:
   `clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)`.
6. **Layout:** set container widths, gutters, section spacing, radii and shadows.
7. Run `pnpm tokens:generate && pnpm tokens:check` and review the demo pages.

## Adding a value

- **New color:** add a primitive if needed, then a semantic token
  (`--color-highlight: var(--color-brand-100)`). Use it as `bg-highlight`.
- **New text style:** add the five `--type-<name>-*` tokens and an `@utility text-<name>`
  block, then add the variant to `typography.tsx`.
- **New spacing value:** `--spacing-<name>: …` in `@theme` → `p-<name>`, `gap-<name>`, …
- **Non-namespace token** (z-index, durations, border widths): add it to `:root` and an
  `@utility` that reads it.

Always run `pnpm tokens:generate` afterwards.
