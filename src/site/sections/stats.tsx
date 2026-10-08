import type { SitePageContent } from '@/core/content/loader';

import { Container, Section } from '../components/ui/layout';
import { Text } from '../components/ui/typography';

type Props = { content: SitePageContent<'home'>['stats']; locale: string };

export function StatsSection({ content, locale }: Props) {
  if (content.items.length === 0) return null;
  const format = new Intl.NumberFormat(locale);
  return (
    <Section spacing="tight">
      <Container>
        <dl className="grid gap-6 sm:grid-cols-3">
          {content.items.map((item) => (
            <div
              key={item._key}
              className="flex flex-col-reverse gap-1 border-s-thick border-primary ps-4"
            >
              <dt>
                <Text as="span" variant="body-sm" tone="muted">
                  {item.label}
                </Text>
              </dt>
              <dd className="text-h2 text-foreground">
                {format.format(item.value)}
                {item.suffix}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
