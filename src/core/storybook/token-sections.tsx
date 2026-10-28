import type { ReactNode } from 'react';

import {
  cleanFamily,
  colorGroups,
  type ColorSwatch,
  contrastLevel,
  DESKTOP_VIEWPORT,
  formatPx,
  MOBILE_VIEWPORT,
  type ResolvedTextStyle,
  type StorybookTokens,
  textStyles,
  TOKEN_SECTIONS,
  utilityName,
} from './model';

/**
 * The token part of `/storybook`, rendered automatically from
 * `tokens.generated.ts`. Everything is a server component; samples use the
 * site's own CSS variables, so they show the real look.
 */

const kebab = (name: string) => name.replace(/([A-Z])/g, '-$1').toLowerCase();

export function StorybookSectionShell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-h3">
          {title}
        </h2>
        {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ratioLabel(ratio: number | null): string {
  return ratio === null ? '—' : `${ratio.toFixed(1)}:1 ${contrastLevel(ratio)}`;
}

function Swatch({ swatch, detailed }: { swatch: ColorSwatch; detailed: boolean }) {
  return (
    <li className="border-thin flex flex-col overflow-hidden rounded-lg border-border">
      <div
        className="border-thin h-16 border-b border-border"
        style={{ backgroundColor: swatch.value }}
        role="img"
        aria-label={`${swatch.name} ${swatch.value}`}
      />
      <div className="flex flex-col gap-0.5 p-3">
        <span className="text-label">{swatch.name}</span>
        <code className="text-caption text-muted-foreground">{swatch.value}</code>
        {detailed ? (
          <dl className="text-caption flex flex-col text-muted-foreground">
            <div className="flex justify-between gap-2">
              <dt>On background</dt>
              <dd>{ratioLabel(swatch.onBackground)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>On foreground</dt>
              <dd>{ratioLabel(swatch.onForeground)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </li>
  );
}

export function ColorSection({ tokens }: { tokens: StorybookTokens }) {
  const { semantic, palette } = colorGroups(tokens.color);
  return (
    <StorybookSectionShell
      id="colors"
      title="Colors"
      description="Semantic tokens are what components use. Contrast is the WCAG ratio of the color against the page background and foreground (4.5:1 passes AA for body text)."
    >
      <h3 className="text-h5">Semantic</h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {semantic.map((swatch) => (
          <Swatch key={swatch.name} swatch={swatch} detailed />
        ))}
      </ul>
      <h3 className="text-h5">Palette</h3>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {palette.map((swatch) => (
          <Swatch key={swatch.name} swatch={swatch} detailed={false} />
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

export function FontSection({ tokens }: { tokens: StorybookTokens }) {
  return (
    <StorybookSectionShell id="fonts" title="Fonts" description="Font families of the site.">
      <ul className="grid gap-4 md:grid-cols-3">
        {Object.entries(tokens.font).map(([name, stack]) => (
          <li key={name} className="border-thin flex flex-col gap-2 rounded-lg border-border p-4">
            <span className="text-label">{name}</span>
            <span className="text-h2" style={{ fontFamily: `var(--font-${name})` }}>
              Aa Bb Cc 123
            </span>
            <span className="text-body" style={{ fontFamily: `var(--font-${name})` }}>
              The quick brown fox jumps over the lazy dog.
            </span>
            <code className="text-caption wrap-break-word text-muted-foreground">
              {cleanFamily(stack)}
            </code>
          </li>
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

function TextStyleRow({ style }: { style: ResolvedTextStyle }) {
  const variable = (property: string) => `var(--type-${kebab(style.name)}-${property})`;
  return (
    <li className="border-thin flex flex-col gap-3 border-b border-border py-6 last:border-b-0 lg:flex-row lg:gap-8">
      <div className="flex shrink-0 flex-col gap-1 lg:w-72">
        <span className="text-label">{style.name}</span>
        <code className="text-caption text-muted-foreground">{utilityName(style.name)}</code>
        <table className="text-caption mt-2 w-full text-muted-foreground">
          <caption className="sr-only">Metrics of {style.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-start" />
              <th scope="col" className="ps-4 text-end">
                Mobile {MOBILE_VIEWPORT}px
              </th>
              <th scope="col" className="ps-4 text-end">
                Desktop {DESKTOP_VIEWPORT}px
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="text-start">
                Size
              </th>
              <td className="ps-4 text-end">{formatPx(style.sizePx.mobile)}</td>
              <td className="ps-4 text-end">{formatPx(style.sizePx.desktop)}</td>
            </tr>
            <tr>
              <th scope="row" className="text-start">
                Line height
              </th>
              <td className="ps-4 text-end">{formatPx(style.lineHeightPx.mobile)}</td>
              <td className="ps-4 text-end">{formatPx(style.lineHeightPx.desktop)}</td>
            </tr>
            <tr>
              <th scope="row" className="text-start">
                Letter spacing
              </th>
              <td className="ps-4 text-end">{formatPx(style.letterSpacingPx.mobile)}</td>
              <td className="ps-4 text-end">{formatPx(style.letterSpacingPx.desktop)}</td>
            </tr>
            <tr>
              <th scope="row" className="text-start">
                Weight
              </th>
              <td className="ps-4 text-end" colSpan={2}>
                {style.weight} ({style.letterSpacing} tracking)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        className="min-w-0 flex-1 text-foreground"
        style={{
          fontFamily: variable('family'),
          fontSize: variable('size'),
          lineHeight: variable('line-height'),
          letterSpacing: variable('letter-spacing'),
          fontWeight: variable('weight'),
        }}
      >
        The quick brown fox jumps over the lazy dog
      </p>
    </li>
  );
}

export function TextStyleSection({ tokens }: { tokens: StorybookTokens }) {
  return (
    <StorybookSectionShell
      id="text-styles"
      title="Text styles"
      description="Every text style with its size, line height, letter spacing and weight for a phone and a desktop viewport (sizes are fluid between them)."
    >
      <ul>
        {textStyles(tokens).map((style) => (
          <TextStyleRow key={style.name} style={style} />
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

export function SpacingSection({ tokens }: { tokens: StorybookTokens }) {
  return (
    <StorybookSectionShell
      id="spacing"
      title="Spacing"
      description="Layout spacing tokens and container widths."
    >
      <ul className="flex flex-col gap-3">
        {Object.entries(tokens.spacing).map(([name, value]) => (
          <li key={name} className="flex flex-wrap items-center gap-4">
            <span className="text-label w-32 shrink-0">{name}</span>
            <span
              className="h-4 rounded-sm bg-primary"
              style={{ width: `min(${value}, 100%)` }}
              role="img"
              aria-label={`${name}: ${value}`}
            />
            <code className="text-caption text-muted-foreground">{value}</code>
          </li>
        ))}
        {Object.entries(tokens.container ?? {}).map(([name, value]) => (
          <li key={`container-${name}`} className="flex flex-wrap items-center gap-4">
            <span className="text-label w-32 shrink-0">container {name}</span>
            <span
              className="h-4 rounded-sm bg-accent"
              style={{ width: `min(${value}, 100%)` }}
              role="img"
              aria-label={`container ${name}: ${value}`}
            />
            <code className="text-caption text-muted-foreground">{value}</code>
          </li>
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

export function RadiusSection({ tokens }: { tokens: StorybookTokens }) {
  return (
    <StorybookSectionShell id="radii" title="Radii">
      <ul className="flex flex-wrap gap-6">
        {Object.entries(tokens.radius).map(([name, value]) => (
          <li key={name} className="flex flex-col items-center gap-2">
            <span
              className="border-thin size-20 border-border bg-accent"
              style={{ borderRadius: value }}
              role="img"
              aria-label={`${name}: ${value}`}
            />
            <span className="text-label">{name}</span>
            <code className="text-caption text-muted-foreground">{value}</code>
          </li>
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

export function ShadowSection({ tokens }: { tokens: StorybookTokens }) {
  return (
    <StorybookSectionShell id="shadows" title="Shadows">
      <ul className="flex flex-wrap gap-8">
        {Object.entries(tokens.shadow).map(([name, value]) => (
          <li key={name} className="flex flex-col items-center gap-3">
            <span
              className="size-24 rounded-lg bg-background"
              style={{ boxShadow: value }}
              role="img"
              aria-label={`${name}: ${value}`}
            />
            <span className="text-label">{name}</span>
          </li>
        ))}
      </ul>
    </StorybookSectionShell>
  );
}

/** Jump links to every section (token sections first, then the project's). */
export function StorybookNav({
  projectSections,
}: {
  projectSections: ReadonlyArray<{ id: string; title: string }>;
}) {
  const links = [...TOKEN_SECTIONS, ...projectSections];
  return (
    <nav aria-label="Storybook sections" className="flex flex-wrap gap-x-5 gap-y-2">
      {links.map((link) => (
        <a key={link.id} href={`#${link.id}`} className="text-nav hover:text-primary">
          {link.title}
        </a>
      ))}
    </nav>
  );
}

/** All token sections, in order. */
export function TokenSections({ tokens }: { tokens: StorybookTokens }) {
  return (
    <>
      <ColorSection tokens={tokens} />
      <FontSection tokens={tokens} />
      <TextStyleSection tokens={tokens} />
      <SpacingSection tokens={tokens} />
      <RadiusSection tokens={tokens} />
      <ShadowSection tokens={tokens} />
    </>
  );
}
