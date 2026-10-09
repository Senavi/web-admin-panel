/**
 * DEMO FORM: contact form on the Contact page. Fields are fixed here; labels,
 * placeholders, help, option labels, consent text and messages are edited in
 * Pages → Forms → Contact form → Texts. See docs/CONTENT_SCHEMA.md § Forms.
 */
import { richTextFromParagraphs } from '@/core/content/rich-text';
import { defineForm, FormFieldType } from '@/core/forms/define';

export const contactForm = defineForm({
  id: 'contact',
  label: 'Contact form',
  fields: {
    name: { type: FormFieldType.Text, required: true, max: 100, label: 'Name' },
    email: { type: FormFieldType.Email, required: true, label: 'Email' },
    phone: { type: FormFieldType.Tel, label: 'Phone' },
    topic: {
      type: FormFieldType.Select,
      options: ['general', 'project', 'job'],
      label: 'Topic',
    },
    message: { type: FormFieldType.Textarea, required: true, max: 3000, label: 'Message' },
    consent: { type: FormFieldType.Consent, required: true },
  },
  seed: {
    en: {
      name: { label: 'Your name', placeholder: 'Jane Doe' },
      email: { label: 'Email', placeholder: 'you@example.com' },
      phone: { label: 'Phone (optional)' },
      topic: {
        label: 'Topic',
        option_general: 'General question',
        option_project: 'New project',
        option_job: 'Job application',
      },
      message: { label: 'Message', help: 'Tell us how we can help.' },
      consent: {
        label: richTextFromParagraphs('I agree that my data is used to answer my request.'),
      },
      messages: {
        submit: 'Send message',
        successTitle: 'Thank you!',
        successMessage: 'We received your message and will reply within one working day.',
      },
    },
    uk: {
      name: { label: 'Ваше ім’я', placeholder: 'Олена Коваль' },
      email: { label: 'Email', placeholder: 'you@example.com' },
      phone: { label: 'Телефон (необов’язково)' },
      topic: {
        label: 'Тема',
        option_general: 'Загальне питання',
        option_project: 'Новий проєкт',
        option_job: 'Робота в команді',
      },
      message: { label: 'Повідомлення', help: 'Розкажіть, чим ми можемо допомогти.' },
      consent: {
        label: richTextFromParagraphs('Я погоджуюся, що мої дані використають для відповіді.'),
      },
      messages: {
        submit: 'Надіслати',
        successTitle: 'Дякуємо!',
        successMessage: 'Ми отримали ваше повідомлення й відповімо протягом робочого дня.',
      },
    },
  },
});
