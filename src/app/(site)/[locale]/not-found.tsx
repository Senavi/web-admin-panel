import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/site/components/ui/button';
import { Container, Section } from '@/site/components/ui/layout';
import { Heading, Text } from '@/site/components/ui/typography';

/** Localized 404 inside the site layout (HTTP 404). */
export default async function SiteNotFound() {
  const t = await getTranslations('notFound');
  return (
    <Section labelledBy="not-found-title">
      <Container width="prose" className="flex flex-col items-start gap-6">
        <Text variant="overline" tone="primary">
          404
        </Text>
        <Heading level={1} id="not-found-title">
          {t('title')}
        </Heading>
        <Text variant="lead" tone="muted">
          {t('body')}
        </Text>
        <ButtonLink href="/">{t('back')}</ButtonLink>
      </Container>
    </Section>
  );
}
