import { getTranslations } from 'next-intl/server';

import { getSiteFormConfig } from '@/core/forms/site';
import { FormSecurityFields } from '@/core/forms/security-fields';
import { FormErrorCode } from '@/core/forms/validation';

import { ContactForm } from '../components/contact-form';
import { Container, Section } from '../components/ui/layout';
import { RichText } from '../components/ui/rich-text';

/** Contact page: the demo form with localized texts (edited in Pages → Forms). */
export async function ContactFormSection({ locale, title }: { locale: string; title: string }) {
  const [config, t] = await Promise.all([
    getSiteFormConfig('contact', locale),
    getTranslations('forms'),
  ]);
  const consentTexts = Object.fromEntries(
    config.fields
      .filter((field) => field.consentText)
      .map((field) => [
        field.name,
        field.consentText ? <RichText doc={field.consentText} /> : null,
      ]),
  );
  return (
    <Section tone="surface" labelledBy="contact-form-title">
      <Container width="prose" className="flex flex-col gap-stack">
        <h2 id="contact-form-title" className="text-h3">
          {title}
        </h2>
        <ContactForm
          config={config}
          messages={{
            ...Object.fromEntries(
              Object.values(FormErrorCode).map((code) => [code, t(`errors.${code}`)]),
            ),
            rateLimited: t('rateLimited'),
            confirm: t('confirm'),
            error: t('error'),
          }}
          strings={{
            summaryTitle: t('summaryTitle'),
            required: t('required'),
            sending: t('sending'),
            choose: t('choose'),
          }}
          security={<FormSecurityFields formId="contact" />}
          consentTexts={consentTexts}
        />
      </Container>
    </Section>
  );
}
