import '@/site/theme/site.css';

import { projectConfig } from '@project/config';

export default function SiteRootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang={projectConfig.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
