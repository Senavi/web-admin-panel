/** DEMO VIEW: replace with your project's pages. */
import type { PageViewProps } from '@/core/content/page-route';

import { ContactDetails } from '../sections/contact';
import { PageIntro } from '../sections/page-intro';

export function ContactView({ content }: PageViewProps<'contact'>) {
  return (
    <>
      <PageIntro title={content.intro.title} lead={content.intro.lead} />
      <ContactDetails content={content.details} />
    </>
  );
}
