'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { CharCounter } from '@/admin/components/forms/char-counter';
import { MediaPicker } from '@/admin/components/media/media-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/ui/card';
import { FieldGroup } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { Switch } from '@/admin/ui/switch';
import { Textarea } from '@/admin/ui/textarea';
import { SEO_LIMITS } from '@/core/seo/page-seo';

import { FieldShell } from './fields/field-shell';
import { useEditor } from './editor-context';

function useText(name: string): string {
  const value: unknown = useWatch({ name });
  return typeof value === 'string' ? value : '';
}

/** Google-like result preview: shows how title/description may appear in search. */
function SearchPreview({
  url,
  fallbackTitle,
  fallbackDescription,
}: {
  url: string;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const title = useText('seo.title') || fallbackTitle;
  const description = useText('seo.description') || fallbackDescription;
  return (
    <div className="rounded-md border bg-background p-4" aria-label="Search result preview">
      <p className="text-xs truncate text-muted-foreground">{url}</p>
      <p className="text-lg text-blue-700 dark:text-blue-400 truncate">
        {title.slice(0, 70) || 'Untitled'}
      </p>
      <p className="text-sm line-clamp-2 text-muted-foreground">
        {description.slice(0, 160) || 'No description.'}
      </p>
    </div>
  );
}

export function SeoPanel({
  publicUrl,
  defaults,
}: {
  publicUrl: string;
  defaults: { title: string; description: string };
}) {
  const { register } = useFormContext();
  const title = useText('seo.title');
  const description = useText('seo.description');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Search engines</h2>
          </CardTitle>
          <CardDescription>
            Leave empty to use the page defaults (“{defaults.title}”).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SearchPreview
              url={publicUrl}
              fallbackTitle={defaults.title}
              fallbackDescription={defaults.description}
            />
            <FieldShell
              id="seo-title"
              name="seo.title"
              label="Meta title"
              aside={
                <CharCounter
                  length={title.length}
                  recommended={SEO_LIMITS.title}
                  max={SEO_LIMITS.hardTitle}
                />
              }
            >
              <Input id="seo-title" placeholder={defaults.title} {...register('seo.title')} />
            </FieldShell>
            <FieldShell
              id="seo-description"
              name="seo.description"
              label="Meta description"
              aside={
                <CharCounter
                  length={description.length}
                  recommended={SEO_LIMITS.description}
                  max={SEO_LIMITS.hardDescription}
                />
              }
            >
              <Textarea
                id="seo-description"
                rows={3}
                placeholder={defaults.description}
                {...register('seo.description')}
              />
            </FieldShell>
            <FieldShell
              id="seo-canonical"
              name="seo.canonical"
              label="Canonical URL"
              help="Only set this when the same content lives at another URL."
            >
              <Input id="seo-canonical" placeholder="https://…" {...register('seo.canonical')} />
            </FieldShell>
            <FieldShell
              id="seo-noindex"
              name="seo.noindex"
              label="Hide this page from search engines"
              help="Adds noindex and removes it from the sitemap."
            >
              <Controller
                name="seo.noindex"
                render={({ field }) => (
                  <Switch
                    id="seo-noindex"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                )}
              />
            </FieldShell>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Social sharing (Open Graph)</h2>
          </CardTitle>
          <CardDescription>
            Used when the page is shared on social networks and messengers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldShell id="seo-og-title" name="seo.ogTitle" label="Share title">
              <Input
                id="seo-og-title"
                placeholder="Defaults to the meta title"
                {...register('seo.ogTitle')}
              />
            </FieldShell>
            <FieldShell id="seo-og-description" name="seo.ogDescription" label="Share description">
              <Textarea
                id="seo-og-description"
                rows={2}
                placeholder="Defaults to the meta description"
                {...register('seo.ogDescription')}
              />
            </FieldShell>
            <OgImage />
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}

function OgImage() {
  const { media, addMedia } = useEditor();
  return (
    <FieldShell
      id="seo-og-image"
      name="seo.ogImageId"
      label="Share image"
      help="Recommended: 1200×630. Defaults to the site’s default share image."
    >
      <Controller
        name="seo.ogImageId"
        render={({ field }) => {
          const mediaId = (field.value as string | null) ?? null;
          return (
            <MediaPicker
              id="seo-og-image"
              label="Share image"
              mediaId={mediaId}
              preview={mediaId ? media[mediaId] : undefined}
              onChange={field.onChange}
              onUploaded={addMedia}
            />
          );
        }}
      />
    </FieldShell>
  );
}
