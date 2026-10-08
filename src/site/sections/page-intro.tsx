import type { ResolvedImage } from '@/core/content/define';

import { Container, Section } from '../components/ui/layout';
import { SiteImage } from '../components/ui/site-image';
import { Heading, Text } from '../components/ui/typography';

/** Shared intro block for inner pages (one h1 per page). */
export function PageIntro({
  title,
  lead,
  image,
}: {
  title: string;
  lead?: string;
  image?: ResolvedImage | null;
}) {
  return (
    <Section labelledBy="page-title" spacing="tight" className="border-thin border-b border-border">
      <Container className={image ? 'grid items-center gap-stack lg:grid-cols-2' : undefined}>
        <div className="flex max-w-prose flex-col gap-4">
          <Heading level={1} id="page-title">
            {title}
          </Heading>
          {lead ? (
            <Text variant="lead" tone="muted">
              {lead}
            </Text>
          ) : null}
        </div>
        {image ? (
          <div className="overflow-hidden rounded-xl shadow-md">
            <SiteImage
              image={image}
              sizes="(min-width: 64rem) 50vw, 100vw"
              priority
              className="aspect-media object-cover"
            />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
