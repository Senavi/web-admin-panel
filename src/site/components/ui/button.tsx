import Link from 'next/link';
import type { ReactNode } from 'react';

import { localizeHref } from '@/core/i18n/href';

import { buttonClasses, type ButtonVariant } from './button-styles';

export type { ButtonVariant } from './button-styles';

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
  const classes = buttonClasses(variant, className);
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
