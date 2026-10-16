/**
 * PROJECT: `/storybook`, the site's living style guide for staff (any valid admin session;
 * everyone else gets the site 404). Token sections are rendered by core from
 * `tokens.generated.ts`; the project's sections come from `src/site/storybook.tsx`.
 */
import { connection } from 'next/server';

import { requireStaffOrNotFound } from '@/core/storybook/access';
import {
  StorybookNav,
  StorybookSectionShell,
  TokenSections,
} from '@/core/storybook/token-sections';
import { Container } from '@/site/components/ui/layout';
import { Heading, Text } from '@/site/components/ui/typography';
import { storybookSections } from '@/site/storybook';
import { tokens } from '@/site/theme/tokens.generated';

export const instant = false;

export default async function StorybookPage() {
  // Per request: the guard reads the session (and answers with a real 404 status).
  await connection();
  await requireStaffOrNotFound();
  return (
    <main className="py-section-tight">
      <Container className="flex flex-col gap-section-tight">
        <header className="flex flex-col gap-4">
          <Text variant="overline" tone="primary">
            Staff only
          </Text>
          <Heading level={1} variant="h2">
            Storybook
          </Heading>
          <Text tone="muted">
            Design tokens and components of this site, as they really look. Not indexed, not linked.
          </Text>
          <StorybookNav projectSections={storybookSections} />
        </header>
        <TokenSections tokens={tokens} />
        {storybookSections.map((section) => (
          <StorybookSectionShell
            key={section.id}
            id={section.id}
            title={section.title}
            description={section.description}
          >
            {section.render()}
          </StorybookSectionShell>
        ))}
      </Container>
    </main>
  );
}
