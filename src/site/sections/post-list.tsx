import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { SiteCollectionItem } from '@/core/collections/loader';

import { SiteImage } from '../components/ui/site-image';
import { Heading, Text } from '../components/ui/typography';

export type BlogPost = SiteCollectionItem<'blog'>;

/** Localized long date, e.g. "15 January 2026" / "15 січня 2026 р.". */
export function formatPostDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

/** Post card: cover, date, title (the link), excerpt. */
export async function PostCard({
  post,
  locale,
  headingLevel = 2,
}: {
  post: BlogPost;
  locale: string;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations('blog');
  return (
    <article className="relative flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg">
        <SiteImage
          image={post.content.cover}
          sizes="(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw"
          className="aspect-media object-cover"
        />
      </div>
      <div className="flex flex-col gap-2">
        {post.publishedAt ? (
          <Text variant="caption" tone="muted">
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          </Text>
        ) : null}
        <Heading level={headingLevel} variant="h4">
          {/* The whole card is clickable through the title link. */}
          <Link href={post.href} className="after:absolute after:inset-0 hover:text-primary">
            {post.title}
          </Link>
        </Heading>
        {post.content.excerpt ? (
          <Text variant="body-sm" tone="muted">
            {post.content.excerpt}
          </Text>
        ) : null}
        <Text variant="label" tone="primary" aria-hidden>
          {t('readMore')} →
        </Text>
      </div>
    </article>
  );
}

export async function PostGrid({
  posts,
  locale,
  headingLevel = 2,
}: {
  posts: readonly BlogPost[];
  locale: string;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations('blog');
  if (posts.length === 0) {
    return <Text tone="muted">{t('empty')}</Text>;
  }
  return (
    <ul className="grid gap-stack sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} locale={locale} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
