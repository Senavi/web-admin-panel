import '@/admin/styles/admin.css';

import type { Metadata } from 'next';

import { adminMono, adminSans } from '@/admin/fonts';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/** Neutral root layout for the private-mode sign-in page (no site or admin chrome). */
export default function AccessRootLayout({ children }: LayoutProps<'/access'>) {
  return (
    <html lang="en" className={`${adminSans.variable} ${adminMono.variable}`}>
      <body className="bg-muted/40 flex min-h-svh flex-col antialiased">{children}</body>
    </html>
  );
}
