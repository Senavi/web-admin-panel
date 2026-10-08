/**
 * DEMO PAGE: replace with your project's pages (docs/CUSTOMIZING.md).
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';

const members = {
  en: [
    {
      name: 'Olena Kovalenko',
      role: 'Founder & design lead',
      photo: { asset: 'team-1.webp', alt: 'Portrait placeholder in warm orange tones' },
      bio: 'Turns brand ideas into calm, readable interfaces.',
      accent: '#f97316',
    },
    {
      name: 'Daniel Reyes',
      role: 'Engineering lead',
      photo: { asset: 'team-2.webp', alt: 'Portrait placeholder in blue tones' },
      bio: 'Keeps the stack fast, typed and boring in the best way.',
      accent: '#2563eb',
    },
    {
      name: 'Mariia Shevchenko',
      role: 'Content strategist',
      photo: { asset: 'team-3.webp', alt: 'Portrait placeholder in green tones' },
      bio: 'Plans content that works in every language.',
      accent: '#16a34a',
    },
  ],
  uk: [
    {
      name: 'Олена Коваленко',
      role: 'Засновниця та керівниця дизайну',
      photo: { asset: 'team-1.webp', alt: 'Портрет-заглушка в теплих помаранчевих тонах' },
      bio: 'Перетворює ідеї бренду на спокійні та зрозумілі інтерфейси.',
      accent: '#f97316',
    },
    {
      name: 'Деніел Рейєс',
      role: 'Керівник розробки',
      photo: { asset: 'team-2.webp', alt: 'Портрет-заглушка в синіх тонах' },
      bio: 'Підтримує технології швидкими, типізованими й передбачуваними.',
      accent: '#2563eb',
    },
    {
      name: 'Марія Шевченко',
      role: 'Контент-стратегиня',
      photo: { asset: 'team-3.webp', alt: 'Портрет-заглушка в зелених тонах' },
      bio: 'Планує контент, який працює будь-якою мовою.',
      accent: '#16a34a',
    },
  ],
} as const;

export const teamPage = definePage({
  id: 'team',
  path: '/about/team',
  label: 'Team',
  parent: 'about',
  seo: {
    title: 'Our team',
    description: 'The people who design and build our websites.',
    localized: {
      uk: { title: 'Наша команда', description: 'Люди, які проєктують і створюють наші сайти.' },
    },
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
      id: 'members',
      label: 'Team members',
      fields: {
        columns: f.number({
          label: 'Columns on wide screens',
          min: 2,
          max: 4,
          integer: true,
          default: 3,
          localized: false,
        }),
        showBios: f.boolean({ label: 'Show short bios', localized: false, default: true }),
        people: f.list({
          label: 'People',
          min: 1,
          max: 24,
          itemLabelField: 'name',
          of: {
            name: f.text({ label: 'Name', required: true, max: 80 }),
            role: f.text({ label: 'Role', max: 80 }),
            photo: f.image({ label: 'Photo', recommendedSize: '600×600, square' }),
            bio: f.textarea({ label: 'Short bio', max: 200 }),
            accent: f.color({ label: 'Accent color', help: 'Ring color around the photo.' }),
          },
        }),
      },
    }),
  ],
  seed: {
    en: {
      intro: {
        title: 'Our team',
        lead: 'Designers, engineers and writers who care about the details.',
      },
      members: { columns: 3, showBios: true, people: members.en },
    },
    uk: {
      intro: {
        title: 'Наша команда',
        lead: 'Дизайнери, розробники та автори, яким не байдужі деталі.',
      },
      members: { people: members.uk },
    },
  },
});
