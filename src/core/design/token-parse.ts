/**
 * Parses CSS custom properties from tokens.css and resolves `var()` references,
 * so TypeScript consumers (OG images, charts) read the same values as CSS.
 */
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;
const VAR_REFERENCE = /var\((--[\w-]+)(?:\s*,[^)]*)?\)/g;

export function parseCustomProperties(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const result = new Map<string, string>();
  for (const match of withoutComments.matchAll(DECLARATION)) {
    const [, name, value] = match;
    if (!name || !value || value.trim() === 'initial') continue;
    result.set(name, value.trim().replace(/\s+/g, ' '));
  }
  return result;
}

/** Resolves var(--x) references recursively (unknown references are kept as-is). */
export function resolveTokens(raw: ReadonlyMap<string, string>): Map<string, string> {
  const resolved = new Map<string, string>();
  const resolve = (name: string, seen: Set<string>): string => {
    const cached = resolved.get(name);
    if (cached !== undefined) return cached;
    const value = raw.get(name);
    if (value === undefined) return `var(${name})`;
    if (seen.has(name)) throw new Error(`Circular token reference: ${[...seen, name].join(' → ')}`);
    const next = new Set(seen).add(name);
    const output = value.replace(VAR_REFERENCE, (_, ref: string) => resolve(ref, next));
    resolved.set(name, output);
    return output;
  };
  for (const name of raw.keys()) resolve(name, new Set());
  return resolved;
}

const camel = (value: string) =>
  value.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());

/** Groups resolved tokens by prefix into the shape of `tokens.generated.ts`. */
export function groupTokens(tokens: ReadonlyMap<string, string>) {
  const group = (prefix: string) =>
    Object.fromEntries(
      [...tokens]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, value]) => [camel(name.slice(prefix.length)), value]),
    );
  const typeStyles: Record<string, Record<string, string>> = {};
  for (const [name, value] of tokens) {
    const match = /^--type-(.+)-(size|line-height|letter-spacing|weight|family)$/.exec(name);
    if (!match?.[1] || !match[2]) continue;
    (typeStyles[camel(match[1])] ??= {})[camel(match[2])] = value;
  }
  return {
    color: group('--color-'),
    font: group('--font-'),
    type: typeStyles,
    spacing: group('--spacing-'),
    container: group('--container-'),
    breakpoint: group('--breakpoint-'),
    radius: group('--radius-'),
    shadow: group('--shadow-'),
    aspect: group('--aspect-'),
    ease: group('--ease-'),
    duration: group('--duration-'),
    z: group('--z-'),
  };
}
