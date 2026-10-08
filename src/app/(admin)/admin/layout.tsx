import '@/admin/styles/admin.css';

import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';

import { AdminProviders } from '@/admin/components/providers/admin-providers';
import { adminMono, adminSans } from '@/admin/fonts';
import { projectConfig } from '@project/config';

export const metadata: Metadata = {
  title: { default: 'Admin', template: `%s · Admin · ${projectConfig.name}` },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
};

/** Root layout of the admin app. Never shares CSS or JS with the public site. */
/** The admin is per-request (auth-gated); opt out of instant-navigation validation. */
export const instant = false;

/**
 * Fully dynamic on purpose: with no static shell to flush early, guards like
 * notFound() (manager opening /admin/settings) still produce a real 404 status.
 */
export default async function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  await connection();
  return (
    <html
      lang="en"
      className={`${adminSans.variable} ${adminMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-svh antialiased">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
