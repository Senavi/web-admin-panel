import Link from 'next/link';
import type { ReactNode } from 'react';

import { localizeHref } from '@/core/i18n/href';

import { cx } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'inverse';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border-thin border-border bg-background text-foreground hover:bg-surface-muted',
  inverse: 'bg-inverse-foreground text-inverse hover:bg-accent',
};

/** Link styled as a button. Internal links get the locale prefix; external links open safely. */
export async function ButtonLink({
  href,
  external = false,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  external?: boolean;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const classes = cx(
    'text-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 transition-colors duration-normal ease-standard',
    VARIANT_CLASS[variant],
    className,
  );
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={await localizeHref(href)} className={classes}>
      {children}
    </Link>
  );
}
