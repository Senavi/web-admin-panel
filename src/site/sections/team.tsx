import { getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';

import type { SitePageContent } from '@/core/content/loader';

import { cx } from '../components/ui/cn';
import { Container, Section } from '../components/ui/layout';
import { SiteImage } from '../components/ui/site-image';
import { Heading, Text } from '../components/ui/typography';

type Members = SitePageContent<'team'>['members'];

const COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export async function TeamGrid({ content }: { content: Members }) {
  const t = await getTranslations('nav');
  return (
    <Section labelledBy="team-title">
      <Container>
        <h2 id="team-title" className="sr-only">
          {t('team')}
        </h2>
        <ul className={cx('grid gap-stack sm:grid-cols-2', COLUMNS[content.columns] ?? COLUMNS[3])}>
          {content.people.map((person) => (
            <li key={person._key} className="flex flex-col gap-4">
              {/* The accent color is content (admin-editable), exposed as a CSS variable. */}
              <div
                className="overflow-hidden rounded-full border-thick border-(--person-accent) p-1"
                style={{ '--person-accent': person.accent } as CSSProperties}
              >
                <SiteImage
                  image={person.photo}
                  sizes="(min-width: 64rem) 25vw, 50vw"
                  className="aspect-portrait rounded-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Heading level={3} variant="h5">
                  {person.name}
                </Heading>
                {person.role ? (
                  <Text variant="body-sm" tone="primary">
                    {person.role}
                  </Text>
                ) : null}
                {content.showBios && person.bio ? (
                  <Text variant="body-sm" tone="muted">
                    {person.bio}
                  </Text>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
