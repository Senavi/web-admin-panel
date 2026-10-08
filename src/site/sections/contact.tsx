import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import type { SitePageContent } from '@/core/content/loader';

import { ButtonLink } from '../components/ui/button';
import { Container, Section } from '../components/ui/layout';
import { RichText } from '../components/ui/rich-text';
import { Heading, Text } from '../components/ui/typography';

type Details = SitePageContent<'contact'>['details'];

export async function ContactDetails({ content }: { content: Details }) {
  const t = await getTranslations('contact');
  return (
    <Section labelledBy="contact-details-title">
      <Container className="grid gap-stack md:grid-cols-2">
        <h2 id="contact-details-title" className="sr-only">
          {t('detailsTitle')}
        </h2>
        <dl className="flex flex-col gap-6">
          {content.email ? (
            <Item icon={<MailIcon aria-hidden className="size-5" />} label={t('email')}>
              <a
                href={`mailto:${content.email}`}
                className="text-primary underline underline-offset-4"
              >
                {content.email}
              </a>
            </Item>
          ) : null}
          {content.phone ? (
            <Item icon={<PhoneIcon aria-hidden className="size-5" />} label={t('phone')}>
              <a
                href={`tel:${content.phone.replace(/\s+/g, '')}`}
                className="text-primary underline underline-offset-4"
              >
                {content.phone}
              </a>
            </Item>
          ) : null}
          {content.address ? (
            <Item icon={<MapPinIcon aria-hidden className="size-5" />} label={t('address')}>
              <address className="whitespace-pre-line not-italic">{content.address}</address>
            </Item>
          ) : null}
        </dl>
        <div className="flex flex-col gap-6 rounded-lg bg-surface p-6">
          <Heading level={3} variant="h5" className="flex items-center gap-2">
            <ClockIcon aria-hidden className="size-5" />
            {t('hours')}
          </Heading>
          <RichText doc={content.hours} />
          {content.mapLink.href ? (
            <div>
              <ButtonLink
                href={content.mapLink.href}
                external={content.mapLink.external}
                variant="secondary"
              >
                {content.mapLink.label}
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}

function Item({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 text-primary">{icon}</span>
      <div className="flex flex-col gap-1">
        <dt>
          <Text as="span" variant="label" tone="muted">
            {label}
          </Text>
        </dt>
        <dd className="text-body-lg">{children}</dd>
      </div>
    </div>
  );
}
