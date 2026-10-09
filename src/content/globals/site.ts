/**
 * DEMO GLOBAL: header & footer content shared by every page (contacts, social
 * links, legal line). See docs/CONTENT_SCHEMA.md § Globals.
 */
import { defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import { defineGlobal } from '@/core/content/global';

export const SOCIAL_NETWORKS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'x', label: 'X' },
] as const;

export const siteGlobals = defineGlobal({
  id: 'site',
  label: 'Header & footer',
  sections: [
    defineSection({
      id: 'contacts',
      label: 'Contacts',
      description: 'Shown in the header, the footer and on the Contact page.',
      fields: {
        phone: f.phone({ label: 'Phone', localized: false }),
        email: f.email({ label: 'Email', localized: false }),
        address: f.textarea({ label: 'Address', max: 300, rows: 3 }),
      },
    }),
    defineSection({
      id: 'social',
      label: 'Social links',
      fields: {
        links: f.list({
          label: 'Links',
          max: 8,
          itemLabelField: 'network',
          localized: false,
          of: {
            network: f.select({ label: 'Network', options: SOCIAL_NETWORKS }),
            link: f.link({ label: 'Profile link', required: true }),
          },
        }),
      },
    }),
    defineSection({
      id: 'legal',
      label: 'Legal line',
      fields: {
        line: f.text({ label: 'Legal line', max: 160, help: 'Shown at the bottom of the footer.' }),
      },
    }),
  ],
  seed: {
    en: {
      contacts: {
        phone: '+380 44 000 00 00',
        email: 'hello@example.com',
        address: '1 Example Street\nKyiv, Ukraine',
      },
      social: {
        links: [
          {
            network: 'linkedin',
            link: { label: 'LinkedIn', href: 'https://www.linkedin.com/', external: true },
          },
          {
            network: 'instagram',
            link: { label: 'Instagram', href: 'https://www.instagram.com/', external: true },
          },
        ],
      },
      legal: { line: 'Demo site of the Next.js site starter.' },
    },
    uk: {
      contacts: { address: 'вул. Прикладна, 1\nКиїв, Україна' },
      legal: { line: 'Демо-сайт стартера на Next.js.' },
    },
  },
});
