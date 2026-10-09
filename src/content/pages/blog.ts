/**
 * DEMO PAGE: the blog list (renders the `blog` collection). Remove it together
 * with src/content/collections/blog.ts (docs/CUSTOMIZING.md).
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';

export const blogPage = definePage({
  id: 'blog',
  path: '/blog',
  label: 'Blog',
  parent: null,
  seo: {
    title: 'Blog',
    description: 'News, guides and stories from our team.',
    localized: { uk: { title: 'Блог', description: 'Новини, поради та історії нашої команди.' } },
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
  ],
  seed: {
    en: {
      intro: {
        title: 'Blog',
        lead: 'News, guides and stories from our team.',
      },
    },
    uk: {
      intro: {
        title: 'Блог',
        lead: 'Новини, поради та історії нашої команди.',
      },
    },
  },
});
