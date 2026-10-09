/** DEMO VIEW: one blog post. */
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { CollectionItemViewProps } from '@/core/collections/item-route';
import { PREVIEW_EXIT_PATH } from '@/core/collections/preview-paths';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { RichText } from '../components/ui/rich-text';
import { SiteImage } from '../components/ui/site-image';
import { Heading, Text } from '../components/ui/typography';
import { formatPostDate } from '../sections/post-list';

export async function BlogPostView({ item, locale, preview }: CollectionItemViewProps<'blog'>) {
  const t = await getTranslations('blog');
  const { content } = item;
  return (
    <>
      {preview ? (
        <div role="status" className="bg-accent text-accent-foreground">
          <Container className="flex flex-wrap items-center justify-between gap-4 py-4">
            <Text variant="body-sm">{t('preview')}</Text>
            <form method="post" action={PREVIEW_EXIT_PATH}>
              <input type="hidden" name="returnTo" value={item.href} />
              <button type="submit" className="text-label underline">
                {t('exitPreview')}
              </button>
            </form>
          </Container>
        </div>
      ) : null}
      <Section labelledBy="page-title" spacing="tight">
        <Container width="prose" className="flex flex-col gap-6">
          <Link href={localeBlogHref(item.href)} className="text-label text-primary">
            ← {t('backToBlog')}
          </Link>
          {item.publishedAt ? (
            <Text variant="caption" tone="muted">
              <time dateTime={item.publishedAt}>
                {t('published', { date: formatPostDate(item.publishedAt, locale) })}
              </time>
            </Text>
          ) : null}
          <Heading level={1} id="page-title">
            {content.title}
          </Heading>
          {content.excerpt ? (
            <Text variant="lead" tone="muted">
              {content.excerpt}
            </Text>
          ) : null}
        </Container>
      </Section>
      {content.cover ? (
        <Container width="wide">
          <div className="overflow-hidden rounded-xl">
            <SiteImage
              image={content.cover}
              sizes="(min-width: 80rem) 80rem, 100vw"
              priority
              className="aspect-hero object-cover"
            />
          </div>
        </Container>
      ) : null}
      <Section>
        <Container width="prose" className="flex flex-col gap-stack">
          <RichText doc={content.body} />
          <div>
            <ButtonLink href="/blog" variant="secondary">
              {t('allPosts')}
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}

/** List URL in the post's locale: `/uk/blog/hello` → `/uk/blog`. */
function localeBlogHref(postHref: string): string {
  return postHref.slice(0, postHref.lastIndexOf('/')) || '/';
}
