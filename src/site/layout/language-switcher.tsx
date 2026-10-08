'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { localizedPath, splitLocale } from '@/core/i18n/routing';

import { cx } from '../components/ui/cn';

export interface SwitcherLocale {
  readonly code: string;
  readonly label: string;
}

/** Links to the current page in every enabled locale (tiny client component: needs the pathname). */
export function LanguageSwitcher({
  locales,
  current,
  defaultLocale,
  label,
}: {
  locales: readonly SwitcherLocale[];
  current: string;
  defaultLocale: string;
  label: string;
}) {
  const pathname = usePathname();
  const { rest } = splitLocale(
    pathname,
    locales.map((locale) => locale.code),
  );
  if (locales.length < 2) return null;
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
