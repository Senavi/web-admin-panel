'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { localizedPath, splitLocale } from '@/core/i18n/routing';

import { cx } from '../components/ui/cn';

export interface SwitcherLocale {
  readonly code: string;
  readonly label: string;
}

export const SwitcherVariant = { Dropdown: 'dropdown', Tabs: 'tabs' } as const;
export type SwitcherVariant = (typeof SwitcherVariant)[keyof typeof SwitcherVariant];

/**
 * Links to the current page in every published locale (tiny client component:
 * needs the pathname). A dropdown with native names by default; `variant="tabs"`
 * shows the language codes side by side for sites with only a few languages.
 */
export function LanguageSwitcher({
  locales,
  current,
  defaultLocale,
  label,
  variant = SwitcherVariant.Dropdown,
}: {
  locales: readonly SwitcherLocale[];
  current: string;
  defaultLocale: string;
  label: string;
  variant?: SwitcherVariant;
}) {
  const pathname = usePathname();
  const { rest } = splitLocale(
    pathname,
    locales.map((locale) => locale.code),
  );
  if (locales.length < 2) return null;
  if (variant === SwitcherVariant.Dropdown) {
    return (
      <LanguageDropdown
        locales={locales}
        current={current}
        defaultLocale={defaultLocale}
        label={label}
        rest={rest}
      />
    );
  }
  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-1">
        {locales.map((locale) => {
          const active = locale.code === current;
          return (
            <li key={locale.code}>
              <Link
                href={localizedPath(rest, locale.code, defaultLocale)}
                hrefLang={locale.code}
                lang={locale.code}
                aria-current={active ? 'true' : undefined}
                title={locale.label}
                prefetch={false}
                className={cx(
                  'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 text-label uppercase transition-colors duration-fast',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {locale.code}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LanguageDropdown({
  locales,
  current,
  defaultLocale,
  label,
  rest,
}: {
  locales: readonly SwitcherLocale[];
  current: string;
  defaultLocale: string;
  label: string;
  rest: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = locales.find((locale) => locale.code === current);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const links = Array.from(root.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    if (!open) {
      setOpen(true);
      return;
    }
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    links[(index + step + links.length) % links.length]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${active?.label ?? current}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border-thin border-border px-3 text-label text-foreground transition-colors duration-fast hover:bg-surface-muted"
      >
        <span aria-hidden className="uppercase">
          {current}
        </span>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor">
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          aria-label={label}
          className="absolute top-full right-0 z-overlay mt-2 flex max-h-72 min-w-44 flex-col overflow-y-auto rounded-md border-thin border-border bg-background p-1 shadow-md"
        >
          {locales.map((locale) => {
            const isCurrent = locale.code === current;
            return (
              <li key={locale.code}>
                <Link
                  href={localizedPath(rest, locale.code, defaultLocale)}
                  hrefLang={locale.code}
                  lang={locale.code}
                  aria-current={isCurrent ? 'true' : undefined}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className={cx(
                    'flex min-h-9 items-center justify-between gap-3 rounded-sm px-3 text-label transition-colors duration-fast hover:bg-surface-muted',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span>{locale.label}</span>
                  {isCurrent ? <span aria-hidden>✓</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
