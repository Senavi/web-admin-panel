/** DEMO VIEW: replace with your project's pages. */
import type { PageViewProps } from '@/core/content/page-route';

import { StorySection, TeamTeaserSection, ValuesSection } from '../sections/about';
import { PageIntro } from '../sections/page-intro';

export function AboutView({ content }: PageViewProps<'about'>) {
  return (
    <>
      <PageIntro
        title={content.intro.title}
        lead={content.intro.lead}
        image={content.intro.image}
      />
      <StorySection content={content.story} />
      <ValuesSection content={content.values} />
      <TeamTeaserSection content={content.teamTeaser} />
    </>
  );
}
