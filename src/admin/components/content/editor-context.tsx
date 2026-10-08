'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { MediaPreview } from '@/core/content/editor-types';

interface EditorContextValue {
  readonly locale: string;
  readonly defaultLocale: string;
  readonly inherited: ReadonlySet<string>;
  readonly media: Readonly<Record<string, MediaPreview>>;
  readonly addMedia: (preview: MediaPreview) => void;
  readonly readOnly: boolean;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  locale,
  defaultLocale,
  inherited,
  initialMedia,
  readOnly = false,
  children,
}: {
  locale: string;
  defaultLocale: string;
  inherited: readonly string[];
  initialMedia: Readonly<Record<string, MediaPreview>>;
  readOnly?: boolean;
  children: ReactNode;
}) {
  const [media, setMedia] = useState(initialMedia);
  const addMedia = useCallback(
    (preview: MediaPreview) => setMedia((current) => ({ ...current, [preview.id]: preview })),
    [],
  );
  const value = useMemo(
    () => ({ locale, defaultLocale, inherited: new Set(inherited), media, addMedia, readOnly }),
    [locale, defaultLocale, inherited, media, addMedia, readOnly],
  );
  return <EditorContext value={value}>{children}</EditorContext>;
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside <EditorProvider>.');
  return value;
}
