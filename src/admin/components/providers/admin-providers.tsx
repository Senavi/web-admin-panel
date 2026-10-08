'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { Toaster } from '@/admin/ui/sonner';
import { TooltipProvider } from '@/admin/ui/tooltip';

/** Client providers for every admin screen: theme (dark by default), tooltips, toasts. */
export function AdminProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="admin-theme"
      disableTransitionOnChange
      nonce={nonce}
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}
