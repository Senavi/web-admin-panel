'use client';

import { PlusIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { projectConfig } from '@project/config';

import { useConfirm } from '@/admin/hooks/use-confirm';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { FieldDescription, FieldLegend, FieldSet } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import {
  LANGUAGES,
  LANGUAGE_WARNING_TEXT,
  findLanguage,
  languageWarnings,
} from '@/core/i18n/languages';
import {
  languageTransitions,
  type LanguageSettings,
  selectedLocales,
} from '@/core/i18n/language-state';

const FIELD = {
  enabled: 'groups.general.enabledLocales',
  draft: 'groups.general.draftLocales',
  main: 'groups.general.defaultLocale',
} as const;
const MAX_RESULTS = 8;

function displayName(code: string): string {
  const language = findLanguage(code);
  return language ? `${language.native} · ${language.name}` : code;
}

/** Settings → General → Languages: pick languages, publish them, choose the main one. */
export function LanguagesField() {
  const form = useFormContext();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState('');
  const enabledLocales = (useWatch({ name: FIELD.enabled }) as string[] | undefined) ?? [];
  const draftLocales = (useWatch({ name: FIELD.draft }) as string[] | undefined) ?? [];
  const defaultLocale = (useWatch({ name: FIELD.main }) as string | undefined) ?? '';
  const settings: LanguageSettings = { enabledLocales, draftLocales, defaultLocale };
  const selected = selectedLocales(settings);

  const apply = (next: LanguageSettings) => {
    const options = { shouldDirty: true, shouldValidate: false } as const;
    form.setValue(FIELD.enabled, next.enabledLocales, options);
    form.setValue(FIELD.draft, next.draftLocales, options);
    form.setValue(FIELD.main, next.defaultLocale, options);
  };

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? LANGUAGES.filter(
        (language) =>
          !selected.includes(language.code) &&
          [language.code, language.name, language.native].some((text) =>
            text.toLowerCase().includes(needle),
          ),
      ).slice(0, MAX_RESULTS)
    : [];

  return (
    <FieldSet>
      {dialog}
      <FieldLegend variant="label">Languages</FieldLegend>
      <ul className="flex flex-col divide-y rounded-lg border" aria-label="Site languages">
        {selected.map((code) => {
          const isMain = code === defaultLocale;
          const isDraft = draftLocales.includes(code);
          const warnings = languageWarnings(code, projectConfig.fontScripts);
          return (
            <li
              key={code}
              data-language={code}
              data-state={isDraft ? 'draft' : 'published'}
              className="flex flex-col gap-2 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{displayName(code)}</span>
                <span className="text-xs text-muted-foreground uppercase">{code}</span>
                {isMain ? <Badge>Main</Badge> : null}
                <Badge variant={isDraft ? 'outline' : 'secondary'}>
                  {isDraft ? 'Draft' : 'Published'}
                </Badge>
                <span className="ml-auto flex flex-wrap gap-2">
                  {isDraft ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => apply(languageTransitions.publish(settings, code))}
                    >
                      Publish language
                    </Button>
                  ) : null}
                  {!isDraft && !isMain ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Make ${displayName(code)} the main language?`,
                            description:
                              'The main language opens at the site address without a prefix, and other languages fall back to it. Page addresses of both languages change.',
                            confirmLabel: 'Make main',
                          });
                          if (ok) apply(languageTransitions.makeMain(settings, code));
                        }}
                      >
                        Make main
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Unpublish this language?',
                            description:
                              'It disappears from the site. The content stays and you can publish it again.',
                            confirmLabel: 'Unpublish',
                            destructive: true,
                          });
                          if (ok) apply(languageTransitions.unpublish(settings, code));
                        }}
                      >
                        Unpublish
                      </Button>
                    </>
                  ) : null}
                  {!isMain ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Remove this language?',
                          description:
                            'It is hidden everywhere. Its content is kept, so you can add the language again later.',
                          confirmLabel: 'Remove',
                          destructive: true,
                        });
                        if (ok) apply(languageTransitions.remove(settings, code));
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </span>
              </div>
              {warnings.length > 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {LANGUAGE_WARNING_TEXT}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add a language: search by name or code"
          aria-label="Add a language"
          className="pl-8"
        />
      </div>
      {needle ? (
        matches.length > 0 ? (
          <ul className="flex flex-col rounded-lg border" aria-label="Languages found">
            {matches.map((language) => (
              <li key={language.code}>
                <button
                  type="button"
                  className="text-sm hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left"
                  onClick={() => {
                    apply(languageTransitions.add(settings, language.code));
                    setQuery('');
                  }}
                >
                  <PlusIcon className="size-4 text-muted-foreground" aria-hidden />
                  <span>{language.native}</span>
                  <span className="text-muted-foreground">{language.name}</span>
                  <span className="text-xs ml-auto text-muted-foreground uppercase">
                    {language.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No language found.</p>
        )
      ) : null}
      <FieldDescription>
        New languages start as drafts: you can fill them in here while visitors do not see them.
        Publish a language to show it on the site.
      </FieldDescription>
    </FieldSet>
  );
}
