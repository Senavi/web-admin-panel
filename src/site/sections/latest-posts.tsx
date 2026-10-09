import { getTranslations } from 'next-intl/server';

import { getCollectionList } from '@/core/collections/loader';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { Heading } from '../components/ui/typography';
import { PostGrid } from './post-list';

const LATEST_COUNT = 3;

/** Home block: the newest posts of the demo blog. */
export async function LatestPosts({ locale }: { locale: string }) {
  const [t, list] = await Promise.all([
    getTranslations('blog'),
    getCollectionList('blog', locale, { page: 1 }),
  ]);
  if (list.items.length === 0) return null;
  return (
    <Section tone="surface" labelledBy="latest-posts-title">
      <Container className="flex flex-col gap-stack">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Heading level={2} id="latest-posts-title">
            {t('latestTitle')}
          </Heading>
          <ButtonLink href="/blog" variant="secondary">
            {t('allPosts')}
          </ButtonLink>
        </div>
        <PostGrid posts={list.items.slice(0, LATEST_COUNT)} locale={locale} headingLevel={3} />
      </Container>
    </Section>
  );
}
