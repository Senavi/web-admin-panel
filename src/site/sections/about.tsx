import { ArrowRightIcon } from 'lucide-react';

import type { SitePageContent } from '@/core/content/loader';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { RichText } from '../components/ui/rich-text';
import { Heading, Text } from '../components/ui/typography';

type About = SitePageContent<'about'>;

export function StorySection({ content }: { content: About['story'] }) {
  return (
    <Section labelledBy="story-title">
      <Container width="prose" className="flex flex-col gap-6">
        <Heading level={2} id="story-title">
          {content.heading}
        </Heading>
        <RichText doc={content.body} />
      </Container>
    </Section>
  );
}

export function ValuesSection({ content }: { content: About['values'] }) {
  if (!content.visible || content.items.length === 0) return null;
  return (
    <Section tone="surface" labelledBy="values-title">
      <Container className="flex flex-col gap-stack">
        <Heading level={2} id="values-title">
          {content.heading}
        </Heading>
        <ul className="grid gap-6 md:grid-cols-3">
          {content.items.map((item) => (
            <li
              key={item._key}
              className="flex flex-col gap-2 rounded-lg bg-background p-6 shadow-sm"
            >
              <Heading level={3} variant="h4">
                {item.title}
              </Heading>
              <Text tone="muted">{item.text}</Text>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export function TeamTeaserSection({ content }: { content: About['teamTeaser'] }) {
  if (!content.link.href) return null;
  return (
    <Section spacing="tight" labelledBy="team-teaser-title">
      <Container className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <Heading level={2} variant="h3" id="team-teaser-title">
          {content.heading}
        </Heading>
        <ButtonLink href={content.link.href} external={content.link.external} variant="secondary">
          {content.link.label}
          <ArrowRightIcon aria-hidden className="size-4" />
        </ButtonLink>
      </Container>
    </Section>
  );
}
