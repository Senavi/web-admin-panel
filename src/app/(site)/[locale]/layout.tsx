/**
 * PROJECT: root layout of the public site. Owns <html>, the site stylesheet and
 * fonts; never loads admin code. Locale comes from the [locale] root segment
 * (the proxy rewrites unprefixed URLs to the default locale). Page chrome
 * (header/footer) lives in (pages)/layout.tsx.
 */
import '@/site/theme/site.css';

import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import { getLocaleSettings, isEnabledLocale, localeInfo } from '@/core/i18n/locales';
import { getIconMetadata } from '@/core/media/branding';
import { buildSiteMetadata } from '@/core/seo/page-metadata';
import { getSiteSettings } from '@/core/settings/loader';
import { Analytics } from '@/site/layout/analytics';
import { StaffNotice } from '@/site/layout/staff-notice';
import { fontVariables } from '@/site/theme/fonts';

export async function generateStaticParams() {
  const { enabledLocales } = await getLocaleSettings();
  return enabledLocales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const [site, icons] = await Promise.all([buildSiteMetadata(), getIconMetadata()]);
  return { ...site, icons };
}

export async function generateViewport(): Promise<Viewport> {
  const { branding } = await getSiteSettings();
  return { themeColor: branding.themeColor, colorScheme: 'light' };
}

export default async function SiteRootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!(await isEnabledLocale(locale))) notFound();
  const { dir } = localeInfo(locale);

  return (
    <html lang={locale} dir={dir} className={fontVariables}>
      <body>
        {children}
        <StaffNotice />
        <Analytics />
      </body>
    </html>
  );
}
