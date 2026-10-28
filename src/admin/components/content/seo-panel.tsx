'use client';

import { useState } from 'react';
import { Controller, useFormContext, useFormState, useWatch } from 'react-hook-form';

import { AccordionSection } from '@/admin/components/layout/accordion';
import { CharCounter } from '@/admin/components/forms/char-counter';
import { MediaPicker } from '@/admin/components/media/media-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/admin/ui/card';
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
    <div className="rounded-md border bg-background p-4" aria-label="Google preview">
      <p className="truncate text-xs text-muted-foreground">{url}</p>
      <p className="truncate text-lg text-blue-700 dark:text-blue-400">
        {title.slice(0, 70) || 'Untitled'}
      </p>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {description.slice(0, 160) || 'No description.'}
      </p>
    </div>
  );
}

/** Fields in the closed "Advanced" block (it opens when one of them has an error). */
const ADVANCED_FIELDS = ['noindex', 'canonical', 'ogTitle', 'ogDescription'] as const;

/**
 * The "Google & sharing" tab of a page editor: a Google preview, title,
 * description and share picture; rarely needed options (hide from Google,
 * canonical address, share texts) sit in a closed "Advanced" block.
 */
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { errors, submitCount } = useFormState({ name: 'seo' });
  const seoErrors = (errors.seo ?? {}) as Record<string, unknown>;
  const advancedInvalid = ADVANCED_FIELDS.some((field) => seoErrors[field] !== undefined);

  // An error inside opens the block after a save attempt, until it is closed again.
  const [closedAtSubmit, setClosedAtSubmit] = useState(0);
  const open = advancedOpen || (advancedInvalid && submitCount > closedAtSubmit);
  const onOpenChange = (next: boolean) => {
    setAdvancedOpen(next);
    if (!next) setClosedAtSubmit(submitCount);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>How it looks in Google</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SearchPreview
            url={publicUrl}
            fallbackTitle={defaults.title}
            fallbackDescription={defaults.description}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FieldGroup>
            <FieldShell
              id="seo-title"
              name="seo.title"
              label="Title in Google"
              help={`Leave empty to use “${defaults.title}”.`}
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
              label="Description in Google"
              help="One or two sentences."
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
            <OgImage />
          </FieldGroup>
        </CardContent>
      </Card>

      <AccordionSection
        title="Advanced"
        summary="Rarely needed"
        open={open}
        onOpenChange={onOpenChange}
        invalid={advancedInvalid}
      >
        <FieldGroup>
          <FieldShell
            id="seo-noindex"
            name="seo.noindex"
            label="Hide this page from Google"
            help="The page stays on the site but doesn’t appear in search."
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
          <FieldShell
            id="seo-canonical"
            name="seo.canonical"
            label="Main address of this content"
            help="Only if the same text is published at another address."
          >
            <Input id="seo-canonical" placeholder="Leave empty" {...register('seo.canonical')} />
          </FieldShell>
          <FieldShell
            id="seo-og-title"
            name="seo.ogTitle"
            label="Title when shared"
            help="Leave empty to use the title in Google."
          >
            <Input id="seo-og-title" {...register('seo.ogTitle')} />
          </FieldShell>
          <FieldShell
            id="seo-og-description"
            name="seo.ogDescription"
            label="Description when shared"
            help="Leave empty to use the description in Google."
          >
            <Textarea id="seo-og-description" rows={2} {...register('seo.ogDescription')} />
          </FieldShell>
        </FieldGroup>
      </AccordionSection>
    </div>
  );
}

function OgImage() {
  const { media, addMedia } = useEditor();
  return (
    <FieldShell
      id="seo-og-image"
      name="seo.ogImageId"
      label="Picture when shared in messengers"
      help="Optional. 1200×630 works best. The site’s default picture is used otherwise."
    >
      <Controller
        name="seo.ogImageId"
        render={({ field }) => {
          const mediaId = (field.value as string | null) ?? null;
          return (
            <MediaPicker
              id="seo-og-image"
              label="Picture when shared in messengers"
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
