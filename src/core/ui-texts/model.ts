/**
 * Interface texts: the small texts of the public site ("Read more", form
 * messages, "Menu"…). Defaults live in the project's message files
 * (`src/site/messages/<locale>.json`); admins override them per language.
 * Pure (client-safe). docs/DECISIONS.md D-090.
 */

/** Messages as next-intl reads them: `{ namespace: { key: text | { nested: text } } }`. */
export type MessageTree = { readonly [key: string]: string | MessageTree };

/** Texts of one namespace as a flat map; nested keys are joined with dots (`errors.required`). */
export type FlatTexts = Readonly<Record<string, string>>;

/** Language that is always the last fallback. */
export const FALLBACK_LOCALE = 'en';

export const MAX_UI_TEXT_LENGTH = 500;
const NAMESPACE = /^[a-zA-Z][a-zA-Z0-9]*$/;

export function flattenTexts(tree: MessageTree | undefined, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[path] = value;
    else Object.assign(result, flattenTexts(value, path));
  }
  return result;
}

export function unflattenTexts(flat: FlatTexts): MessageTree {
  const root: Record<string, string | Record<string, unknown>> = {};
  for (const [path, text] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = root as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (typeof next !== 'object' || next === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1] ?? ''] = text;
  }
  return root as MessageTree;
}

export interface UiNamespaceInput {
  /** Admin name, e.g. "Blog". */
  readonly label: string;
  /** Human description per text key (flat keys): "Button on blog cards". */
  readonly texts: Readonly<Record<string, string>>;
}

export interface UiTextsInput {
  /** Default texts per language, imported from the message files. `en` is required. */
  readonly messages: Readonly<Record<string, MessageTree>>;
  readonly namespaces: Readonly<Record<string, UiNamespaceInput>>;
}

export interface UiTextCatalog {
  readonly namespaces: Readonly<Record<string, UiNamespaceInput>>;
  readonly namespaceIds: readonly string[];
  /** Default texts of a namespace in a language (empty when the language has no file). */
  fileTexts(locale: string, namespace: string): FlatTexts;
  hasFile(locale: string): boolean;
  /** Keys of a namespace, in the order of the English file. */
  keys(namespace: string): readonly string[];
  /** Every `namespace.key` of the English file. */
  allKeys(): readonly string[];
}

export function defineUiTexts(input: UiTextsInput): UiTextCatalog {
  const english = input.messages[FALLBACK_LOCALE];
  if (!english) throw new Error(`ui-texts: messages for "${FALLBACK_LOCALE}" are required.`);
  for (const id of Object.keys(input.namespaces)) {
    if (!NAMESPACE.test(id)) throw new Error(`ui-texts: namespace "${id}" must be camelCase.`);
  }
  const flat = new Map<string, FlatTexts>();
  const fileTexts = (locale: string, namespace: string): FlatTexts => {
    const cacheKey = `${locale}:${namespace}`;
    let texts = flat.get(cacheKey);
    if (!texts) {
      const tree = input.messages[locale]?.[namespace];
      texts = typeof tree === 'object' ? flattenTexts(tree) : {};
      flat.set(cacheKey, texts);
    }
    return texts;
  };
  return {
    namespaces: input.namespaces,
    namespaceIds: Object.keys(input.namespaces),
    fileTexts,
    hasFile: (locale) => locale in input.messages,
    keys: (namespace) => Object.keys(fileTexts(FALLBACK_LOCALE, namespace)),
    allKeys: () =>
      Object.keys(input.namespaces).flatMap((namespace) =>
        Object.keys(fileTexts(FALLBACK_LOCALE, namespace)).map((key) => `${namespace}.${key}`),
      ),
  };
}

export const UiTextSource = {
  /** Edited for this language in the admin. */
  Edited: 'edited',
  /** From this language's message file. */
  File: 'file',
  /** Not translated: shows the main language's text. */
  Main: 'main',
  /** Not translated and not in the main language either: shows English. */
  English: 'english',
} as const;
export type UiTextSource = (typeof UiTextSource)[keyof typeof UiTextSource];

export interface UiTextLayers {
  /** Overrides saved in the admin, per language: `{ [locale]: { [key]: text } }` of one namespace. */
  readonly overrides: Readonly<Record<string, FlatTexts>>;
  readonly locale: string;
  readonly mainLocale: string;
}

export interface ResolvedUiText {
  readonly value: string;
  readonly source: UiTextSource;
  /** The text this language falls back to when it has no edit (what "Reset" returns to). */
  readonly inherited: string;
}

/**
 * Text of a key. Order: this language's edit → this language's file → the main
 * language's edit → the main language's file → English. A language without its
 * own file therefore starts from the main language's texts.
 */
export function resolveUiText(
  catalog: UiTextCatalog,
  namespace: string,
  key: string,
  layers: UiTextLayers,
): ResolvedUiText {
  const file = (locale: string) => catalog.fileTexts(locale, namespace)[key];
  const edit = (locale: string) => layers.overrides[locale]?.[key];
  const english = file(FALLBACK_LOCALE) ?? '';
  const ownFile = file(layers.locale);
  const mainText =
    layers.locale === layers.mainLocale
      ? undefined
      : (edit(layers.mainLocale) ?? file(layers.mainLocale));
  const inherited = ownFile ?? mainText ?? english;
  const edited = edit(layers.locale);
  if (edited !== undefined) return { value: edited, source: UiTextSource.Edited, inherited };
  if (ownFile !== undefined) return { value: ownFile, source: UiTextSource.File, inherited };
  if (mainText !== undefined) return { value: mainText, source: UiTextSource.Main, inherited };
  return { value: english, source: UiTextSource.English, inherited };
}

/** All texts of a namespace for a language (what the site renders). */
export function resolveNamespace(
  catalog: UiTextCatalog,
  namespace: string,
  layers: UiTextLayers,
): Record<string, string> {
  return Object.fromEntries(
    catalog
      .keys(namespace)
      .map((key) => [key, resolveUiText(catalog, namespace, key, layers).value]),
  );
}

/** Messages for next-intl: every namespace of the catalog resolved for a language. */
export function resolveMessages(
  catalog: UiTextCatalog,
  overridesByNamespace: Readonly<Record<string, Readonly<Record<string, FlatTexts>>>>,
  locale: string,
  mainLocale: string,
): MessageTree {
  const result: Record<string, MessageTree> = {};
  for (const namespace of catalog.namespaceIds) {
    result[namespace] = unflattenTexts(
      resolveNamespace(catalog, namespace, {
        overrides: overridesByNamespace[namespace] ?? {},
        locale,
        mainLocale,
      }),
    );
  }
  return result;
}

export type UiTextEdits = Readonly<Record<string, string | null>>;

/** Applies edits (`null` = back to the default) to the stored overrides; returns the new overrides. */
export function applyUiTextEdits(
  stored: FlatTexts,
  edits: UiTextEdits,
  inheritedOf: (key: string) => string,
): Record<string, string> {
  const next: Record<string, string> = { ...stored };
  for (const [key, value] of Object.entries(edits)) {
    // An edit equal to what the language inherits anyway is not stored.
    if (value === null || value === inheritedOf(key)) delete next[key];
    else next[key] = value;
  }
  return next;
}
