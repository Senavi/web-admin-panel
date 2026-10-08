/**
 * DEMO PAGE: replace with your project's pages (docs/CUSTOMIZING.md).
 */
import { definePage, defineSection } from '@/core/content/define';
import { f } from '@/core/content/fields';
import { richTextFromParagraphs } from '@/core/content/rich-text';

export const FEATURE_ICONS = [
  { value: 'layout', label: 'Layout' },
  { value: 'shield', label: 'Shield' },
  { value: 'globe', label: 'Globe' },
  { value: 'chart', label: 'Chart' },
  { value: 'zap', label: 'Lightning' },
  { value: 'image', label: 'Image' },
] as const;

export const homePage = definePage({
  id: 'home',
  path: '/',
  label: 'Home',
  parent: null,
  seo: {
    title: 'Home',
    description: 'A fast, accessible website with a custom admin panel.',
    localized: {
      uk: { title: 'Головна', description: 'Швидкий, доступний сайт із власною адмін-панеллю.' },
    },
  },
  sections: [
    defineSection({
      id: 'hero',
      label: 'Hero',
      fields: {
        eyebrow: f.text({ label: 'Eyebrow', max: 40 }),
        title: f.text({ label: 'Title', required: true, max: 120 }),
        body: f.textarea({ label: 'Body', max: 400 }),
        image: f.image({
          label: 'Hero image',
          localized: false,
          required: true,
          recommendedSize: '1600×1000',
        }),
        primaryCta: f.link({ label: 'Primary button' }),
        secondaryCta: f.link({ label: 'Secondary button' }),
      },
    }),
    defineSection({
      id: 'features',
      label: 'Features',
      fields: {
        heading: f.text({ label: 'Heading', required: true, max: 80 }),
        intro: f.textarea({ label: 'Intro', max: 300 }),
        items: f.list({
          label: 'Features',
          min: 1,
          max: 6,
          itemLabelField: 'title',
          of: {
            icon: f.select({ label: 'Icon', options: FEATURE_ICONS }),
            title: f.text({ label: 'Title', required: true, max: 60 }),
            text: f.textarea({ label: 'Text', max: 240 }),
          },
        }),
      },
    }),
    defineSection({
      id: 'stats',
      label: 'Numbers',
      fields: {
        items: f.list({
          label: 'Numbers',
          max: 4,
          itemLabelField: 'label',
          of: {
            value: f.number({ label: 'Value', min: 0, integer: true }),
            suffix: f.text({ label: 'Suffix', max: 4, help: 'e.g. %, +, k' }),
            label: f.text({ label: 'Label', required: true, max: 40 }),
          },
        }),
      },
    }),
    defineSection({
      id: 'cta',
      label: 'Call to action',
      fields: {
        title: f.text({ label: 'Title', required: true, max: 80 }),
        body: f.richText({ label: 'Text', max: 500 }),
        button: f.link({ label: 'Button', required: true }),
      },
    }),
  ],
  seed: {
    en: {
      hero: {
        eyebrow: 'Site starter',
        title: 'Launch a fast website your team can edit',
        body: 'A clean Next.js foundation with a custom admin panel, built-in SEO, analytics and multilingual content.',
        image: { asset: 'hero.webp', alt: 'Abstract blue and violet shapes' },
        primaryCta: { label: 'About us', href: '/about', external: false },
        secondaryCta: { label: 'Contact', href: '/contact', external: false },
      },
      features: {
        heading: 'Everything a modern site needs',
        intro: 'Content, SEO and settings are managed in the admin. The design stays in code.',
        items: [
          {
            icon: 'layout',
            title: 'Schema-driven editing',
            text: 'Pages define their fields once; the admin forms are generated.',
          },
          {
            icon: 'globe',
            title: 'Multilingual',
            text: 'Every page in every enabled language, with sensible fallbacks.',
          },
          {
            icon: 'shield',
            title: 'Secure by default',
            text: 'Roles, two-factor sign-in, audit log and strict headers.',
          },
          {
            icon: 'chart',
            title: 'Privacy-friendly analytics',
            text: 'Visitors and page views without cookies.',
          },
        ],
      },
      stats: {
        items: [
          { value: 100, suffix: '', label: 'SEO score' },
          { value: 2, suffix: '', label: 'Languages' },
          { value: 0, suffix: '', label: 'Cookies for analytics' },
        ],
      },
      cta: {
        title: 'Ready to start your project?',
        body: richTextFromParagraphs(
          'Tell us about your idea and we will get back to you within one business day.',
        ),
        button: { label: 'Get in touch', href: '/contact', external: false },
      },
    },
    uk: {
      hero: {
        eyebrow: 'Стартовий шаблон',
        title: 'Запустіть швидкий сайт, який легко редагувати',
        body: 'Надійна основа на Next.js з власною адмін-панеллю, вбудованим SEO, аналітикою та багатомовним контентом.',
        image: { asset: 'hero.webp', alt: 'Абстрактні сині та фіолетові фігури' },
        primaryCta: { label: 'Про нас', href: '/about', external: false },
        secondaryCta: { label: 'Контакти', href: '/contact', external: false },
      },
      features: {
        heading: 'Усе, що потрібно сучасному сайту',
        intro: 'Контент, SEO та налаштування керуються в адмінці. Дизайн залишається в коді.',
        items: [
          {
            icon: 'layout',
            title: 'Редагування за схемою',
            text: 'Сторінки описують поля один раз, а форми адмінки створюються автоматично.',
          },
          {
            icon: 'globe',
            title: 'Багатомовність',
            text: 'Кожна сторінка всіма увімкненими мовами з розумними резервними значеннями.',
          },
          {
            icon: 'shield',
            title: 'Безпека за замовчуванням',
            text: 'Ролі, двофакторний вхід, журнал дій і суворі заголовки.',
          },
          {
            icon: 'chart',
            title: 'Аналітика без cookie',
            text: 'Відвідувачі та перегляди сторінок без файлів cookie.',
          },
        ],
      },
      stats: {
        items: [
          { value: 100, suffix: '', label: 'Оцінка SEO' },
          { value: 2, suffix: '', label: 'Мови' },
          { value: 0, suffix: '', label: 'Cookie для аналітики' },
        ],
      },
      cta: {
        title: 'Готові почати проєкт?',
        body: richTextFromParagraphs(
          'Розкажіть нам про свою ідею, і ми відповімо протягом одного робочого дня.',
        ),
        button: { label: 'Зв’язатися', href: '/contact', external: false },
      },
    },
  },
});
