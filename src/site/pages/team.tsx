/** DEMO VIEW: replace with your project's pages. */
import type { PageViewProps } from '@/core/content/page-route';

import { PageIntro } from '../sections/page-intro';
import { TeamGrid } from '../sections/team';

export function TeamView({ content }: PageViewProps<'team'>) {
  return (
    <>
      <PageIntro title={content.intro.title} lead={content.intro.lead} />
      <TeamGrid content={content.members} />
    </>
  );
}
