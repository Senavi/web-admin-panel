/**
 * DEMO PAGE: replace with your project's pages (docs/CUSTOMIZING.md).
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import type { RichTextDoc } from '@/core/content/rich-text';

const storyEn: RichTextDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'We started as a small studio building websites for local businesses. ',
        },
        {
          type: 'text',
          text: 'Every project needed the same foundation',
          marks: [{ type: 'bold' }],
        },
        { type: 'text', text: ', so we turned it into a reusable starter.' },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'What we believe' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Fast pages respect people’s time.' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Editors deserve tools that are hard to break.' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Accessibility is not optional. Read the ' },
                {
                  type: 'text',
                  text: 'WCAG guidelines',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
                        target: '_blank',
                      },
                    },
                  ],
                },
                { type: 'text', text: '.' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const storyUk: RichTextDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Ми почали як невелика студія, що створювала сайти для місцевого бізнесу. ',
        },
        {
          type: 'text',
          text: 'Кожен проєкт потребував тієї самої основи',
          marks: [{ type: 'bold' }],
        },
        { type: 'text', text: ', тож ми перетворили її на шаблон.' },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'У що ми віримо' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Швидкі сторінки поважають час людей.' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Редактори заслуговують на інструменти, які важко зламати.' },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Доступність обов’язкова. Ознайомтеся з ' },
                {
                  type: 'text',
                  text: 'настановами WCAG',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
                        target: '_blank',
                      },
                    },
                  ],
                },
                { type: 'text', text: '.' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const aboutPage = definePage({
  id: 'about',
  path: '/about',
  label: 'About',
  parent: null,
  seo: {
    title: 'About us',
    description: 'Who we are and how we work.',
    localized: { uk: { title: 'Про нас', description: 'Хто ми та як працюємо.' } },
  },
  sections: [
    defineSection({
      id: 'intro',
      label: 'Intro',
      fields: {
        title: f.text({ label: 'Title', required: true, max: 80 }),
        lead: f.textarea({ label: 'Lead', max: 300 }),
        image: f.image({ label: 'Image', recommendedSize: '1200×900' }),
      },
    }),
    defineSection({
      id: 'story',
      label: 'Our story',
      fields: {
        heading: f.text({ label: 'Heading', required: true, max: 80 }),
        body: f.richText({ label: 'Story', max: 3000 }),
      },
    }),
    defineSection({
      id: 'values',
      label: 'Values',
      fields: {
        visible: f.boolean({ label: 'Show this section', localized: false, default: true }),
        heading: f.text({ label: 'Heading', max: 80 }),
        items: f.list({
          label: 'Values',
          max: 6,
          itemLabelField: 'title',
          of: {
            title: f.text({ label: 'Title', required: true, max: 60 }),
            text: f.textarea({ label: 'Text', max: 240 }),
          },
        }),
      },
    }),
    defineSection({
      id: 'teamTeaser',
      label: 'Team teaser',
      fields: {
        heading: f.text({ label: 'Heading', max: 80 }),
        link: f.link({ label: 'Link to the team page' }),
      },
    }),
  ],
  seed: {
    en: {
      intro: {
        title: 'About us',
        lead: 'A small, senior team that builds fast, accessible websites and the tools to run them.',
        image: { asset: 'about.webp', alt: 'Soft green and teal gradient shapes' },
      },
      story: { heading: 'Our story', body: storyEn },
      values: {
        visible: true,
        heading: 'Our values',
        items: [
          { title: 'Clarity', text: 'Simple structures that are easy to understand and change.' },
          { title: 'Craft', text: 'Details matter: typography, performance and accessibility.' },
          { title: 'Care', text: 'We build for the people who use and maintain the site.' },
        ],
      },
      teamTeaser: {
        heading: 'Meet the people behind the work',
        link: { label: 'Our team', href: '/about/team', external: false },
      },
    },
    uk: {
      intro: {
        title: 'Про нас',
        lead: 'Невелика команда досвідчених фахівців, що створює швидкі та доступні сайти й інструменти для них.',
        image: { asset: 'about.webp', alt: 'М’які зелені та бірюзові градієнтні фігури' },
      },
      story: { heading: 'Наша історія', body: storyUk },
      values: {
        heading: 'Наші цінності',
        items: [
          { title: 'Ясність', text: 'Прості структури, які легко зрозуміти та змінити.' },
          { title: 'Майстерність', text: 'Деталі важливі: типографіка, швидкодія та доступність.' },
          {
            title: 'Турбота',
            text: 'Ми створюємо для людей, які користуються сайтом і підтримують його.',
          },
        ],
      },
      teamTeaser: {
        heading: 'Познайомтеся з людьми, які стоять за роботою',
        link: { label: 'Наша команда', href: '/about/team', external: false },
      },
    },
  },
});
