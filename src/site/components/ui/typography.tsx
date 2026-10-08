import type { ElementType, ReactNode } from 'react';

import { cx } from './cn';

/**
 * Typed typography: every text style is one utility from tokens.css. Components
 * never combine size, leading and tracking themselves.
 */
export type HeadingVariant = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type TextVariant =
  'lead' | 'body-lg' | 'body' | 'body-sm' | 'caption' | 'overline' | 'label';
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_CLASS: Record<HeadingVariant, string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  h4: 'text-h4',
  h5: 'text-h5',
  h6: 'text-h6',
};

const TEXT_CLASS: Record<TextVariant, string> = {
  lead: 'text-lead',
  'body-lg': 'text-body-lg',
  body: 'text-body',
  'body-sm': 'text-body-sm',
  caption: 'text-caption',
  overline: 'text-overline',
  label: 'text-label',
};

export function Heading({
  level,
  variant,
  className,
  id,
  children,
}: {
  /** Semantic level (document outline). */
  level: HeadingLevel;
  /** Visual style; defaults to the matching level. */
  variant?: HeadingVariant;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      id={id}
      className={cx(
        'text-balance text-foreground',
        HEADING_CLASS[variant ?? `h${level}`],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Text({
  as: Tag = 'p',
  variant = 'body',
  tone = 'default',
  className,
  children,
}: {
  as?: ElementType;
  variant?: TextVariant;
  tone?: 'default' | 'muted' | 'primary' | 'inverse';
  className?: string;
  children: ReactNode;
}) {
  const toneClass = {
    default: '',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
    inverse: 'text-inverse-foreground',
  }[tone];
  return <Tag className={cx(TEXT_CLASS[variant], toneClass, className)}>{children}</Tag>;
}
