import type { SitePageContent } from '@/core/content/loader';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { SiteImage } from '../components/ui/site-image';
import { Heading, Text } from '../components/ui/typography';

type Props = { content: SitePageContent<'home'>['hero'] };

export function HeroSection({ content }: Props) {
  return (
    <Section labelledBy="hero-title" className="overflow-hidden">
      <Container className="grid items-center gap-stack lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {content.eyebrow ? (
            <Text variant="overline" tone="primary">
              {content.eyebrow}
            </Text>
          ) : null}
          <Heading level={1} variant="display" id="hero-title">
            {content.title}
          </Heading>
          {content.body ? (
            <Text variant="lead" tone="muted" className="max-w-prose">
              {content.body}
            </Text>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {content.primaryCta.href ? (
              <ButtonLink href={content.primaryCta.href} external={content.primaryCta.external}>
                {content.primaryCta.label}
              </ButtonLink>
            ) : null}
            {content.secondaryCta.href ? (
              <ButtonLink
                href={content.secondaryCta.href}
                external={content.secondaryCta.external}
                variant="secondary"
              >
                {content.secondaryCta.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl shadow-lg">
          <SiteImage
            image={content.image}
            sizes="(min-width: 64rem) 50vw, 100vw"
            priority
            className="aspect-hero object-cover"
          />
        </div>
      </Container>
    </Section>
  );
}
