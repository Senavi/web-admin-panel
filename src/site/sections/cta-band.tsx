import type { SitePageContent } from '@/core/content/loader';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { RichText } from '../components/ui/rich-text';
import { Heading } from '../components/ui/typography';

type Props = { content: SitePageContent<'home'>['cta'] };

export function CtaBand({ content }: Props) {
  return (
    <Section tone="inverse" labelledBy="cta-title">
      <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-prose flex-col gap-3">
          <Heading level={2} id="cta-title" className="text-inverse-foreground">
            {content.title}
          </Heading>
          <RichText doc={content.body} />
        </div>
        <ButtonLink href={content.button.href} external={content.button.external} variant="inverse">
          {content.button.label}
        </ButtonLink>
      </Container>
    </Section>
  );
}
