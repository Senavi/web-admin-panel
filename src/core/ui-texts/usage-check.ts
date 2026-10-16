/**
 * `content:check` for interface texts (pure): finds the message keys the site
 * code reads with next-intl and compares them with the English message file,
 * the admin catalog and the namespaces pages declare.
 */
import type { UiTextCatalog } from './model';

export interface SourceFile {
  readonly file: string;
  readonly source: string;
}

export interface MessageUsage {
  readonly file: string;
  readonly namespace: string;
  /** Flat key (`errors.required`), or null for a namespace that is only opened. */
  readonly key: string | null;
}

const TRANSLATOR = String.raw`(?:getTranslations|useTranslations)\(\s*['"](\w+)['"]\s*\)`;
const SINGLE_BINDING = new RegExp(
  String.raw`(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?${TRANSLATOR}`,
  'g',
);
const PROMISE_ALL = /(?:const|let)\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\s*\[/g;
const OBJECT_FORM = /getTranslations\(\s*\{[^}]*namespace:\s*['"](\w+)['"]/g;

/** Splits `a, f(b, c), d` at top-level commas. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** The text of the array literal that starts right after `start` (an opening `[`). */
function arrayBody(source: string, start: number): string {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if ('([{'.includes(char ?? '')) depth += 1;
    if (')]}'.includes(char ?? '')) depth -= 1;
    index += 1;
  }
  return source.slice(start, index - 1);
}

function bindings(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of source.matchAll(SINGLE_BINDING)) {
    if (match[1] && match[2]) result.set(match[1], match[2]);
  }
  for (const match of source.matchAll(PROMISE_ALL)) {
    const names = (match[1] ?? '').split(',').map((name) => name.trim());
    const elements = splitTopLevel(arrayBody(source, (match.index ?? 0) + match[0].length));
    elements.forEach((element, index) => {
      const namespace = new RegExp(TRANSLATOR).exec(element)?.[1];
      const name = names[index];
      if (namespace && name) result.set(name, namespace);
    });
  }
  return result;
}

export function findMessageUsages(files: readonly SourceFile[]): MessageUsage[] {
  const usages: MessageUsage[] = [];
  for (const { file, source } of files) {
    for (const [name, namespace] of bindings(source)) {
      usages.push({ file, namespace, key: null });
      const call = new RegExp(
        String.raw`(?<![\w.])${name}(?:\.(?:rich|raw|markup|has))?\(\s*(['"])([\w.]+)\1`,
        'g',
      );
      for (const match of source.matchAll(call)) {
        if (match[2]) usages.push({ file, namespace, key: match[2] });
      }
    }
    for (const match of source.matchAll(OBJECT_FORM)) {
      if (match[1]) usages.push({ file, namespace: match[1], key: null });
    }
  }
  return usages;
}

export interface UiTextsCheckInput {
  readonly catalog: UiTextCatalog;
  readonly files: readonly SourceFile[];
  /** Namespaces declared by at least one page, global, collection or form. */
  readonly declared: ReadonlySet<string>;
}

export function checkUiTexts({ catalog, files, declared }: UiTextsCheckInput): string[] {
  const problems: string[] = [];
  const usages = findMessageUsages(files);

  const seen = new Set<string>();
  for (const usage of usages) {
    const id = `${usage.file}|${usage.namespace}|${usage.key ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!catalog.namespaceIds.includes(usage.namespace)) {
      problems.push(
        `${usage.file}: interface text namespace "${usage.namespace}" is not in src/content/ui-texts.ts.`,
      );
      continue;
    }
    if (usage.key !== null && !(usage.key in catalog.fileTexts('en', usage.namespace))) {
      problems.push(
        `${usage.file}: message "${usage.namespace}.${usage.key}" is missing in src/site/messages/en.json.`,
      );
    }
  }

  const used = new Set(usages.map((usage) => usage.namespace));
  for (const namespace of used) {
    if (catalog.namespaceIds.includes(namespace) && !declared.has(namespace)) {
      problems.push(
        `Interface texts "${namespace}" are used by the site but no page, global, collection or form declares them (add uiTexts: ['${namespace}'] where they appear).`,
      );
    }
  }
  for (const namespace of declared) {
    if (!catalog.namespaceIds.includes(namespace)) {
      problems.push(`uiTexts: "${namespace}" is declared but missing in src/content/ui-texts.ts.`);
    }
  }
  for (const namespace of catalog.namespaceIds) {
    const keys = catalog.keys(namespace);
    const labels = Object.keys(catalog.namespaces[namespace]?.texts ?? {});
    for (const key of keys.filter((candidate) => !labels.includes(candidate))) {
      problems.push(`ui-texts: "${namespace}.${key}" has no description for the admin.`);
    }
    for (const key of labels.filter((candidate) => !keys.includes(candidate))) {
      problems.push(`ui-texts: description for "${namespace}.${key}", which is not in en.json.`);
    }
  }
  return problems;
}
