/**
 * DEMO PAGE: replace with your project's pages (docs/CUSTOMIZING.md).
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import { richTextFromParagraphs } from '@/core/content/rich-text';

export const contactPage = definePage({
  id: 'contact',
  path: '/contact',
  label: 'Contact',
  parent: null,
  seo: {
    title: 'Contact',
    description: 'Get in touch with our team.',
    localized: { uk: { title: 'Контакти', description: 'Зв’яжіться з нашою командою.' } },
  },
  sections: [
    defineSection({
      id: 'intro',
      label: 'Intro',
      fields: {
        title: f.text({ label: 'Title', required: true, max: 80 }),
        lead: f.textarea({ label: 'Lead', max: 300 }),
      },
    }),
    defineSection({
      id: 'details',
      label: 'Contact details',
      description: 'Email, phone and address are edited in Pages → Site-wide → Header & footer.',
      fields: {
        hours: f.richText({ label: 'Opening hours', max: 500 }),
        mapLink: f.link({ label: 'Map link' }),
      },
    }),
  ],
  seed: {
    en: {
      intro: {
        title: 'Contact us',
        lead: 'Questions, ideas or a project in mind? We would love to hear from you.',
      },
      details: {
        hours: richTextFromParagraphs('Monday to Friday: 9:00–18:00', 'Weekends: closed'),
        mapLink: { label: 'Open in maps', href: 'https://www.openstreetmap.org/', external: true },
      },
    },
    uk: {
      intro: {
        title: 'Контакти',
        lead: 'Маєте запитання, ідеї чи проєкт? Ми будемо раді вас почути.',
      },
      details: {
        hours: richTextFromParagraphs('Понеділок–п’ятниця: 9:00–18:00', 'Вихідні: зачинено'),
        mapLink: {
          label: 'Відкрити на мапі',
          href: 'https://www.openstreetmap.org/',
          external: true,
        },
      },
    },
  },
});
