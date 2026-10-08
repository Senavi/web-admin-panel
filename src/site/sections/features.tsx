import type { SitePageContent } from '@/core/content/loader';

import { FeatureIcon } from '../components/feature-icon';
import { Container, Section } from '../components/ui/layout';
import { Heading, Text } from '../components/ui/typography';

type Props = { content: SitePageContent<'home'>['features'] };

export function FeaturesSection({ content }: Props) {
  return (
    <Section tone="surface" labelledBy="features-title">
      <Container className="flex flex-col gap-stack">
        <div className="flex max-w-prose flex-col gap-3">
          <Heading level={2} id="features-title">
            {content.heading}
          </Heading>
          {content.intro ? (
            <Text variant="body-lg" tone="muted">
              {content.intro}
            </Text>
          ) : null}
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.items.map((item) => (
            <li
              key={item._key}
              className="flex flex-col gap-3 rounded-lg border-thin border-border bg-background p-6 shadow-sm"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <FeatureIcon name={item.icon} />
              </span>
              <Heading level={3} variant="h5">
                {item.title}
              </Heading>
              <Text variant="body-sm" tone="muted">
                {item.text}
              </Text>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
