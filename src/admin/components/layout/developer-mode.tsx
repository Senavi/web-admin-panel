'use client';

import { CodeIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useTransition } from 'react';
import { toast } from 'sonner';

import { setDeveloperModeAction } from '@/core/auth/actions';

/**
 * Developer mode: a per-user display preference (Account / avatar menu) that
 * shows technical settings. It is not access control — every action still
 * checks permissions on the server.
 */
const DeveloperModeContext = createContext(false);

export function DeveloperModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return <DeveloperModeContext value={enabled}>{children}</DeveloperModeContext>;
}

export function useDeveloperMode(): boolean {
  return useContext(DeveloperModeContext);
}

/** Toggles developer mode and refreshes the screen (server-rendered parts depend on it). */
export function useToggleDeveloperMode() {
  const router = useRouter();
  const enabled = useDeveloperMode();
  const [pending, startTransition] = useTransition();
  const toggle = (next = !enabled) =>
    startTransition(async () => {
      const result = await setDeveloperModeAction({ enabled: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? 'Saved.');
      router.refresh();
    });
  return { enabled, pending, toggle };
}

/**
 * Technical settings, rendered only in developer mode (never just hidden with
 * CSS). One shared look: dashed border, "Developer settings".
 */
export function DeveloperSection({
  children,
  title = 'Developer settings',
  id,
}: {
  children: ReactNode;
  title?: string;
  /** Anchor for links (e.g. the local-database banner → Security). */
  id?: string;
}) {
  if (!useDeveloperMode()) return null;
  return (
    <section
      id={id}
      aria-label={title}
      className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-dashed p-4"
      data-developer-section
    >
      <div className="flex items-center gap-2">
        <CodeIcon aria-hidden className="size-4 text-muted-foreground" />
        <div className="flex flex-col">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">Only in developer mode</p>
        </div>
      </div>
      {children}
    </section>
  );
}
