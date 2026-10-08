/**
 * PROJECT: root layout of the public site. Owns <html>, the site stylesheet and
 * fonts; never loads admin code. Locale comes from the [locale] root segment
 * (the proxy rewrites unprefixed URLs to the default locale).
 */
import '@/site/theme/site.css';

import type { Viewport } from 'next';
import { notFound } from 'next/navigation';

import { getLocaleSettings, isEnabledLocale, localeInfo } from '@/core/i18n/locales';
import { getSiteSettings } from '@/core/settings/loader';
import { SiteLayout } from '@/site/layout/site-layout';
import { fontVariables } from '@/site/theme/fonts';

export async function generateStaticParams() {
  const { enabledLocales } = await getLocaleSettings();
  return enabledLocales.map((locale) => ({ locale }));
}

export async function generateViewport(): Promise<Viewport> {
  const { branding } = await getSiteSettings();
  return { themeColor: branding.themeColor, colorScheme: 'light' };
}

export default async function SiteRootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!(await isEnabledLocale(locale))) notFound();
  const [settings, { defaultLocale, enabledLocales }] = await Promise.all([
    getSiteSettings(),
    getLocaleSettings(),
  ]);
  const { dir } = localeInfo(locale);

  return (
    <html lang={locale} dir={dir} className={fontVariables}>
      <body>
        <SiteLayout
          locale={locale}
          defaultLocale={defaultLocale}
          enabledLocales={enabledLocales}
          siteName={settings.general.siteName}
        >
          {children}
        </SiteLayout>
      </body>
    </html>
  );
}
