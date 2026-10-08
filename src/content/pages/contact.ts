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
      fields: {
        email: f.text({ label: 'Email', localized: false, max: 120 }),
        phone: f.text({ label: 'Phone', localized: false, max: 40 }),
        address: f.textarea({ label: 'Address', max: 300, rows: 3 }),
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
        email: 'hello@example.com',
        phone: '+380 44 000 00 00',
        address: '1 Example Street\nKyiv, Ukraine',
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
        address: 'вул. Прикладна, 1\nКиїв, Україна',
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
