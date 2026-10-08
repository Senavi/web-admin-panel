/**
 * Project configuration contract. The project layer provides a single
 * `project.config.ts` at the repository root built with `defineProjectConfig`.
 * Core code reads project-specific values only through this contract.
 */

export interface LocaleDefinition {
  /** BCP 47 code used in URLs and `<html lang>`, e.g. `en`, `uk`, `pt-BR`. */
  readonly code: string;
  /** Human readable name shown in the admin and the language switcher. */
  readonly label: string;
  /** Text direction. Defaults to `ltr`. */
  readonly dir?: 'ltr' | 'rtl';
}

export interface ProjectConfigInput<TLocale extends string = string> {
  /** Project name, used as the default site name and in the admin. */
  readonly name: string;
  /** All locales this project can ever serve. Admins enable a subset. */
  readonly supportedLocales: readonly (LocaleDefinition & { readonly code: TLocale })[];
  /** Fallback default locale when settings have not been saved yet. */
  readonly defaultLocale: NoInfer<TLocale>;
  /** URL path of the admin panel. Must start with `/`. Defaults to `/admin`. */
  readonly adminPath?: `/${string}`;
  /**
   * Public routes that are NOT pages in the content registry (e.g. `/legal`,
   * `/blog/:slug`, `/docs/*`). Any other unknown URL gets the localized 404.
   */
  readonly siteRoutes?: readonly string[];
  /** Brand defaults used before an admin uploads branding in Settings. */
  readonly brand?: {
    readonly themeColor?: string;
    /** Web app manifest background color. */
    readonly backgroundColor?: string;
  };
}

export interface ProjectConfig<TLocale extends string = string> extends Required<
  Omit<ProjectConfigInput<TLocale>, 'brand'>
> {
  readonly brand: { readonly themeColor: string; readonly backgroundColor: string };
  readonly localeCodes: readonly TLocale[];
}

const DEFAULT_ADMIN_PATH = '/admin';
const DEFAULT_THEME_COLOR = '#0a0a0a';
const DEFAULT_BACKGROUND_COLOR = '#ffffff';

export function defineProjectConfig<const TLocale extends string>(
  input: ProjectConfigInput<TLocale>,
): ProjectConfig<TLocale> {
  const localeCodes = input.supportedLocales.map((locale) => locale.code);

  if (localeCodes.length === 0) {
    throw new Error('project.config: `supportedLocales` must contain at least one locale.');
  }
  if (new Set(localeCodes).size !== localeCodes.length) {
    throw new Error('project.config: `supportedLocales` contains duplicate codes.');
  }
  if (!localeCodes.includes(input.defaultLocale)) {
    throw new Error(
      `project.config: default locale "${input.defaultLocale}" is not in supportedLocales.`,
    );
  }
  const adminPath = input.adminPath ?? DEFAULT_ADMIN_PATH;
  if (!/^\/[a-z0-9-]+$/.test(adminPath)) {
    throw new Error('project.config: `adminPath` must be a single lowercase path segment.');
  }

  return {
    name: input.name,
    supportedLocales: input.supportedLocales,
    defaultLocale: input.defaultLocale,
    adminPath,
    siteRoutes: input.siteRoutes ?? [],
    brand: {
      themeColor: input.brand?.themeColor ?? DEFAULT_THEME_COLOR,
      backgroundColor: input.brand?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    },
    localeCodes,
  };
}
