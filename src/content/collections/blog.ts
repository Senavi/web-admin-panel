/**
 * DEMO COLLECTION: blog posts. Replace or remove (docs/CUSTOMIZING.md
 * § Remove the demo blog). See docs/CONTENT_SCHEMA.md § Collections.
 */
import {
  defineCollection,
  MissingTranslation,
  StructuredDataType,
} from '@/core/content/collection';
import { f } from '@/core/content/fields';
import { richTextFromParagraphs } from '@/core/content/rich-text';

export const blog = defineCollection({
  id: 'blog',
  label: 'Blog',
  itemLabel: 'Post',
  listPageId: 'blog',
  itemPath: '/blog/:slug',
  fields: {
    title: f.text({ label: 'Title', required: true, max: 120 }),
    excerpt: f.textarea({ label: 'Short description', max: 300 }),
    cover: f.image({ label: 'Cover image', localized: false, recommendedSize: '1600×900' }),
    body: f.richText({ label: 'Text', required: true }),
  },
  titleField: 'title',
  summaryField: 'excerpt',
  imageField: 'cover',
  sort: { by: 'publishedAt', direction: 'desc' },
  pageSize: 3,
  missingTranslation: MissingTranslation.Fallback,
  structuredData: StructuredDataType.BlogPosting,
  seed: [
    {
      slug: 'hello-world',
      publishedAt: '2026-01-15',
      content: {
        en: {
          title: 'Hello, world',
          excerpt: 'Our new website is live: fast, accessible and easy to update.',
          cover: { asset: 'hero.webp', alt: 'Laptop with the new website on screen' },
          body: richTextFromParagraphs(
            'Our new website is live. It loads fast on any device and works well with screen readers.',
            'Every page can be edited by our team in the admin panel, in every language we support.',
          ),
        },
        uk: {
          title: 'Привіт, світе',
          excerpt: 'Наш новий сайт запрацював: швидкий, доступний і простий в оновленні.',
          cover: { asset: 'hero.webp', alt: 'Ноутбук із новим сайтом на екрані' },
          body: richTextFromParagraphs(
            'Наш новий сайт запрацював. Він швидко завантажується на будь-якому пристрої та добре працює з програмами зчитування екрана.',
            'Кожну сторінку наша команда може редагувати в адмін-панелі будь-якою мовою.',
          ),
        },
      },
    },
    {
      slug: 'how-we-work',
      publishedAt: '2026-02-03',
      content: {
        en: {
          title: 'How we work',
          excerpt: 'Small steps, short feedback loops and a lot of listening.',
          cover: { asset: 'about.webp', alt: 'Team discussing a plan at a table' },
          body: richTextFromParagraphs(
            'We start every project by listening: to clients, to users and to the data.',
            'Then we ship in small steps, measure, and improve. Short feedback loops keep everyone on the same page.',
          ),
        },
        uk: {
          title: 'Як ми працюємо',
          excerpt: 'Невеликі кроки, швидкий зворотний зв’язок і уважне слухання.',
          cover: { asset: 'about.webp', alt: 'Команда обговорює план за столом' },
          body: richTextFromParagraphs(
            'Кожен проєкт ми починаємо зі слухання: клієнтів, користувачів і даних.',
            'Потім робимо невеликі кроки, вимірюємо результат і покращуємо. Короткий цикл зворотного зв’язку тримає всіх в курсі.',
          ),
        },
      },
    },
    {
      slug: 'meet-the-team',
      publishedAt: '2026-03-10',
      content: {
        en: {
          title: 'Meet the team',
          excerpt: 'The people behind the projects, and what they care about.',
          cover: { asset: 'team-1.webp', alt: 'Portrait of a team member' },
          body: richTextFromParagraphs(
            'Our team brings together design, engineering and content.',
            'What we share is care for detail and for the people who use what we build.',
          ),
        },
        uk: {
          title: 'Знайомтеся з командою',
          excerpt: 'Люди, які стоять за проєктами, і те, що для них важливо.',
          cover: { asset: 'team-1.webp', alt: 'Портрет учасника команди' },
          body: richTextFromParagraphs(
            'Наша команда поєднує дизайн, розробку та контент.',
            'Нас об’єднує увага до деталей і до людей, які користуються тим, що ми створюємо.',
          ),
        },
      },
    },
  ],
});
