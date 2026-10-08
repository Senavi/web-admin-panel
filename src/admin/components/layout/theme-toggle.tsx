'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/admin/ui/button';

/** Light/dark toggle. Icons switch via the `dark` class, so server and client markup match. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle light/dark theme"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
    </Button>
  );
}
