import { Container, Section } from '@/site/components/ui/layout';
import { Heading, Text } from '@/site/components/ui/typography';

/** Rare fallback (a stale session passed the proxy): the plain site look of a 404. */
export default function StorybookNotFound() {
  return (
    <Section>
      <Container width="prose" className="flex flex-col items-start gap-6">
        <Text variant="overline" tone="primary">
          404
        </Text>
        <Heading level={1}>Page not found</Heading>
      </Container>
    </Section>
  );
}
