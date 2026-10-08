/** PROJECT: localized 404 content (used by the 404 route and the not-found boundary). */
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { Heading, Text } from '../components/ui/typography';

export async function NotFoundView() {
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
