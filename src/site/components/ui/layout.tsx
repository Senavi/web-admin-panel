import type { ReactNode } from 'react';

import { cx } from './cn';

/** Horizontal container: max width and gutters come from tokens. */
export function Container({
  width = 'content',
  className,
  children,
}: {
  width?: 'content' | 'wide' | 'prose';
  className?: string;
  children: ReactNode;
}) {
  const widthClass = { content: 'max-w-content', wide: 'max-w-wide', prose: 'max-w-prose' }[width];
  return <div className={cx('mx-auto w-full px-gutter', widthClass, className)}>{children}</div>;
}

/** Vertical rhythm + surface for a page section. */
export function Section({
  tone = 'default',
  spacing = 'default',
  labelledBy,
  className,
  children,
}: {
  tone?: 'default' | 'surface' | 'inverse' | 'accent';
  spacing?: 'default' | 'tight';
  /** id of the section heading (accessible name). */
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = {
    default: 'bg-background text-foreground',
    surface: 'bg-surface text-foreground',
    inverse: 'bg-inverse text-inverse-foreground',
    accent: 'bg-accent text-accent-foreground',
  }[tone];
  const spacingClass = spacing === 'tight' ? 'py-section-tight' : 'py-section';
  return (
    <section aria-labelledby={labelledBy} className={cx(toneClass, spacingClass, className)}>
      {children}
    </section>
  );
}

/** Vertical stack with token spacing. */
export function Stack({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('flex flex-col gap-stack', className)}>{children}</div>;
}
