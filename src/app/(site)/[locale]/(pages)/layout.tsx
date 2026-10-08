/** PROJECT: header + footer around every public page. */
import { getLocaleSettings } from '@/core/i18n/locales';
import { getSiteLogo } from '@/core/media/branding';
import { getSiteSettings } from '@/core/settings/loader';
import { SiteLayout } from '@/site/layout/site-layout';

export default async function PagesLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const [settings, { defaultLocale, enabledLocales }, logo] = await Promise.all([
    getSiteSettings(),
    getLocaleSettings(),
    getSiteLogo(),
  ]);
  return (
    <SiteLayout
      locale={locale}
      defaultLocale={defaultLocale}
      enabledLocales={enabledLocales}
      siteName={settings.general.siteName}
      logo={logo}
    >
      {children}
    </SiteLayout>
  );
}
