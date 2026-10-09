/** DEMO VIEW: replace with your project's pages. */
import { getGlobalContent } from '@/core/content/loader';
import type { PageViewProps } from '@/core/content/page-route';

import { ContactDetails } from '../sections/contact';
import { PageIntro } from '../sections/page-intro';

export async function ContactView({ content, locale }: PageViewProps<'contact'>) {
  const { contacts } = await getGlobalContent('site', locale);
  return (
    <>
      <PageIntro title={content.intro.title} lead={content.intro.lead} />
      <ContactDetails content={content.details} contacts={contacts} />
    </>
  );
}
