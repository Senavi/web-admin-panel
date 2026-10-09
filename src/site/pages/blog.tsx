/** DEMO VIEW: blog list with pagination. */
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { CollectionListViewProps } from '@/core/collections/list-route';

import { Container, Section } from '../components/ui/layout';
import { Text } from '../components/ui/typography';
import { PageIntro } from '../sections/page-intro';
import { PostGrid } from '../sections/post-list';

export async function BlogView({
  content,
  list,
  locale,
  pageHref,
}: CollectionListViewProps<'blog', 'blog'>) {
  const t = await getTranslations('blog');
  return (
    <>
      <PageIntro title={content.intro.title} lead={content.intro.lead} />
      <Section labelledBy="page-title">
        <Container className="flex flex-col gap-stack">
          <PostGrid posts={list.items} locale={locale} />
          {list.pageCount > 1 ? (
            <nav aria-label={t('pagination')} className="flex items-center justify-between gap-4">
              {list.page > 1 ? (
                <Link href={pageHref(list.page - 1)} rel="prev" className="text-label text-primary">
                  ← {t('previous')}
                </Link>
              ) : (
                <span />
              )}
              <Text variant="caption" tone="muted">
                {t('pageOf', { page: list.page, count: list.pageCount })}
              </Text>
              {list.page < list.pageCount ? (
                <Link href={pageHref(list.page + 1)} rel="next" className="text-label text-primary">
                  {t('next')} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </Container>
      </Section>
    </>
  );
}
