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
  /**
   * Extra sources for the public site's Content-Security-Policy (third-party
   * analytics, video embeds, maps, form widgets…). The admin CSP is not affected.
   * Example: `{ scriptSrc: ['https://www.googletagmanager.com'], frameSrc: ['https://www.youtube-nocookie.com'] }`.
   */
  readonly csp?: SiteCspSources;
  /**
   * Extension point: called (server-side) after an admin creates a user or resets
   * a password, e.g. to email an invite. Without it the temporary password is
   * only shown once in the admin.
   */
  readonly onUserInvited?: (invite: UserInvite) => Promise<void>;
  /** Brand defaults used before an admin uploads branding in Settings. */
  readonly brand?: {
    readonly themeColor?: string;
    /** Web app manifest background color. */
    readonly backgroundColor?: string;
  };
}

export interface SiteCspSources {
  readonly scriptSrc?: readonly string[];
  readonly styleSrc?: readonly string[];
  readonly imgSrc?: readonly string[];
  readonly fontSrc?: readonly string[];
  readonly connectSrc?: readonly string[];
  readonly frameSrc?: readonly string[];
  readonly mediaSrc?: readonly string[];
  readonly formAction?: readonly string[];
}

export interface UserInvite {
  readonly email: string;
  readonly name: string;
  readonly temporaryPassword: string;
  readonly loginUrl: string;
  readonly reason: 'created' | 'password-reset';
}

export interface ProjectConfig<TLocale extends string = string> extends Required<
  Omit<ProjectConfigInput<TLocale>, 'brand' | 'onUserInvited' | 'csp'>
> {
  readonly onUserInvited?: (invite: UserInvite) => Promise<void>;
  readonly csp: SiteCspSources;
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
    onUserInvited: input.onUserInvited,
    csp: validateCsp(input.csp ?? {}),
    brand: {
      themeColor: input.brand?.themeColor ?? DEFAULT_THEME_COLOR,
      backgroundColor: input.brand?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    },
    localeCodes,
  };
}

/** CSP sources: origins (`https://example.com`, `https://*.example.com`), schemes (`data:`) or quoted keywords. */
const CSP_SOURCE =
  /^(?:'[a-z0-9-]+'|[a-z][a-z0-9+.-]*:|(?:https?|wss?):\/\/(?:\*\.)?[a-z0-9.-]+(?::\d+)?(?:\/[^\s;,']*)?)$/i;

/** Sources that would defeat the CSP: eval, and scheme-wide script origins (`https:`, `data:`). */
const UNSAFE_CSP_KEYWORDS = new Set(["'unsafe-eval'", "'unsafe-hashes'"]);
const SCHEME_SOURCE = /^[a-z][a-z0-9+.-]*:$/i;

function validateCsp(csp: SiteCspSources): SiteCspSources {
  for (const [directive, sources] of Object.entries(csp) as Array<
    [string, readonly string[] | undefined]
  >) {
    for (const source of sources ?? []) {
      if (!CSP_SOURCE.test(source)) {
        throw new Error(`project.config: invalid CSP source "${source}" in csp.${directive}.`);
      }
      const unsafe =
        UNSAFE_CSP_KEYWORDS.has(source.toLowerCase()) ||
        (directive === 'scriptSrc' && SCHEME_SOURCE.test(source));
      if (unsafe) {
        throw new Error(`project.config: unsafe CSP source "${source}" in csp.${directive}.`);
      }
    }
  }
  return csp;
}
