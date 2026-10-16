/** Language states from Settings → General (pure helpers). */

export interface LanguageSelection {
  /** Published languages. */
  readonly enabledLocales: readonly string[];
  /** Draft languages. */
  readonly draftLocales: readonly string[];
}

export const LanguageState = { Published: 'published', Draft: 'draft' } as const;
export type LanguageStateValue = (typeof LanguageState)[keyof typeof LanguageState];

/** Every selected language, published first: what the admin offers for editing. */
export function selectedLocales(selection: LanguageSelection): string[] {
  return [...selection.enabledLocales, ...selection.draftLocales];
}

export function languageState(selection: LanguageSelection, code: string): LanguageStateValue {
  return selection.draftLocales.includes(code) ? LanguageState.Draft : LanguageState.Published;
}

export interface LanguageSettings extends LanguageSelection {
  readonly defaultLocale: string;
}

/**
 * Transitions of the Languages list. Each returns new settings and never touches
 * other languages; the main language is always published and cannot be removed.
 */
export const languageTransitions = {
  /** New languages start as drafts. */
  add(settings: LanguageSettings, code: string): LanguageSettings {
    if (selectedLocales(settings).includes(code)) return settings;
    return { ...settings, draftLocales: [...settings.draftLocales, code] };
  },
  publish(settings: LanguageSettings, code: string): LanguageSettings {
    if (!settings.draftLocales.includes(code)) return settings;
    return {
      ...settings,
      enabledLocales: [...settings.enabledLocales, code],
      draftLocales: settings.draftLocales.filter((draft) => draft !== code),
    };
  },
  unpublish(settings: LanguageSettings, code: string): LanguageSettings {
    if (code === settings.defaultLocale || !settings.enabledLocales.includes(code)) return settings;
    return {
      ...settings,
      enabledLocales: settings.enabledLocales.filter((enabled) => enabled !== code),
      draftLocales: [...settings.draftLocales, code],
    };
  },
  /** Hides the language; its content is kept, so it can be added again. */
  remove(settings: LanguageSettings, code: string): LanguageSettings {
    if (code === settings.defaultLocale) return settings;
    return {
      ...settings,
      enabledLocales: settings.enabledLocales.filter((enabled) => enabled !== code),
      draftLocales: settings.draftLocales.filter((draft) => draft !== code),
    };
  },
  /** Only a published language can become the main one. */
  makeMain(settings: LanguageSettings, code: string): LanguageSettings {
    if (!settings.enabledLocales.includes(code)) return settings;
    return { ...settings, defaultLocale: code };
  },
};
