import Link from 'next/link';
import type { ReactNode } from 'react';

import type { RichTextDoc } from '@/core/content/rich-text';
import {
  RichText as RichTextRenderer,
  type RichTextComponents,
} from '@/core/content/rich-text-render';
import { localizeHref } from '@/core/i18n/href';

import { cx } from './cn';

const components: RichTextComponents = {
  paragraph: ({ children }: { children: ReactNode }) => <p className="text-body-lg">{children}</p>,
  heading: ({ level, children }) => {
    const Tag = `h${level}` as const;
    const style = { 2: 'text-h3', 3: 'text-h4', 4: 'text-h5' }[level];
    return <Tag className={cx(style, 'mt-4')}>{children}</Tag>;
  },
  list: ({ ordered, children }) => {
    const Tag = ordered ? 'ol' : 'ul';
    return (
      <Tag
        className={cx(
          'flex flex-col gap-2 ps-6 text-body-lg',
          ordered ? 'list-decimal' : 'list-disc',
        )}
      >
        {children}
      </Tag>
    );
  },
  link: ({ href, external, children }) =>
    external ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4"
      >
        {children}
      </a>
    ) : (
      <InternalLink href={href}>{children}</InternalLink>
    ),
};

async function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={await localizeHref(href)} className="text-primary underline underline-offset-4">
      {children}
    </Link>
  );
}

/** Project styling for CMS rich text. */
export function RichText({ doc, className }: { doc: RichTextDoc; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <RichTextRenderer doc={doc} components={components} />
    </div>
  );
}
