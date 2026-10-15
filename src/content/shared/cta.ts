/**
 * DEMO SHARED SECTION: the call-to-action band on Home and About. Edited from
 * either page (or Pages → Every page); saving updates both. See
 * docs/CONTENT_SCHEMA.md § Shared sections.
 */
import { f } from '@/core/content/fields';
import { richTextFromParagraphs } from '@/core/content/rich-text';
import { defineSharedSection } from '@/core/content/shared-section';

export const ctaShared = defineSharedSection({
  id: 'cta',
  label: 'Call to action',
  fields: {
    title: f.text({ label: 'Title', required: true, max: 80 }),
    body: f.richText({ label: 'Text', max: 500 }),
    button: f.link({ label: 'Button', required: true }),
  },
  seed: {
    en: {
      title: 'Ready to start your project?',
      body: richTextFromParagraphs(
        'Tell us about your idea and we will get back to you within one business day.',
      ),
      button: { label: 'Get in touch', href: '/contact', external: false },
    },
    uk: {
      title: 'Готові почати проєкт?',
      body: richTextFromParagraphs(
        'Розкажіть нам про свою ідею, і ми відповімо протягом одного робочого дня.',
      ),
      button: { label: 'Зв’язатися', href: '/contact', external: false },
    },
  },
});
