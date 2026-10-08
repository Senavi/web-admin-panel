'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  SaveIcon,
  Undo2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { useHydrated } from '@/admin/hooks/use-hydrated';
import { confirmLeave, useUnsavedGuard } from '@/admin/hooks/use-unsaved-guard';
import { Alert, AlertDescription, AlertTitle } from '@/admin/ui/alert';
import { Badge } from '@/admin/ui/badge';
import { Button } from '@/admin/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/ui/tabs';
import { ActionErrorCode } from '@/core/actions/result';
import { savePageAction, type RevisionPreview } from '@/core/content/actions';
import type { EditorData, EditorVersions } from '@/core/content/editor-types';
import { pageContentSchema } from '@/core/content/validation';
import { adminHref, AdminRoute } from '@/core/project/paths';
import { pageSeoSchema } from '@/core/seo/page-seo';

import { EditorProvider } from './editor-context';
import { RevisionsSheet } from './revisions-sheet';
import { SectionFields } from './section-fields';
import { SeoPanel } from './seo-panel';

export interface LocaleOption {
  readonly code: string;
  readonly label: string;
}

function editorSchema(page: EditorData['page']) {
  return z.object({ content: pageContentSchema(page), seo: pageSeoSchema });
}
type EditorSchema = ReturnType<typeof editorSchema>;
type EditorValues = z.input<EditorSchema>;

export function PageEditor({
  data,
  locales,
}: {
  data: EditorData;
  locales: readonly LocaleOption[];
}) {
  const router = useRouter();
  const schema = useMemo(() => editorSchema(data.page), [data.page]);
  const form = useForm<EditorValues, unknown, z.output<EditorSchema>>({
    defaultValues: { content: data.content, seo: data.seo },
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });
  const [versions, setVersions] = useState<EditorVersions>(data.versions);
  const [conflict, setConflict] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('content');
  const { isDirty, isSubmitting } = form.formState;
  const hydrated = useHydrated();
  useUnsavedGuard(isDirty);

  const save = form.handleSubmit(
    async (values) => {
      const result = await savePageAction({
        pageId: data.page.id,
        locale: data.locale,
        content: values.content,
        seo: values.seo,
        versions,
      });
      if (result.ok) {
        setVersions(result.data.versions);
        setConflict(null);
        form.reset(values);
        toast.success(result.message ?? 'Saved.');
        router.refresh();
        return;
      }
      if (result.code === ActionErrorCode.Conflict) {
        setConflict(result.error);
        return;
      }
      for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(path as FieldPath<EditorValues>, { type: 'server', message: messages[0] });
      }
      if (Object.keys(result.fieldErrors ?? {}).some((path) => path.startsWith('seo.')))
        setTab('seo');
      toast.error(result.error);
    },
    (errors) => {
      if (errors.seo && !errors.content) setTab('seo');
      toast.error('Please fix the highlighted fields.');
    },
  );

  const onRestored = (values: RevisionPreview, next: EditorVersions) => {
    setVersions(next);
    setConflict(null);
    form.reset({ content: values.content, seo: values.seo });
    router.refresh();
  };

  const switchLocale = (code: string) => {
    if (code === data.locale || !confirmLeave(isDirty)) return;
    router.push(`${adminHref(AdminRoute.Pages)}/${data.page.id}?locale=${code}`);
  };

  return (
    <EditorProvider
      locale={data.locale}
      defaultLocale={data.defaultLocale}
      inherited={data.inherited}
      initialMedia={data.media}
    >
      <FormProvider {...form}>
        <form
          method="post"
          onSubmit={(event) => void save(event)}
          noValidate
          className="flex flex-col gap-6"
          data-hydrated={hydrated || undefined}
        >
          <div className="sticky top-14 z-[5] -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold truncate">{data.page.label}</h1>
              <p className="text-xs truncate font-mono text-muted-foreground">{data.page.path}</p>
            </div>
            <SimpleSelect
              value={data.locale}
              onChange={switchLocale}
              options={locales.map((locale) => ({
                value: locale.code,
                label: `${locale.label} (${locale.code})`,
              }))}
              ariaLabel="Language"
              className="w-44"
            />
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<a href={data.publicUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLinkIcon />
              View page
            </Button>
            <RevisionsSheet
              data={data}
              versions={versions}
              dirty={isDirty}
              onRestored={onRestored}
            />
            {isDirty ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-300"
                role="status"
              >
                Unsaved changes
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isDirty || isSubmitting}
              onClick={() => form.reset()}
            >
              <Undo2Icon />
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save
            </Button>
          </div>

          {conflict ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>This page was changed by someone else</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{conflict}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload latest version
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>
            <TabsContent value="content" keepMounted className="pt-4">
              <SectionFields sections={data.page.sections} />
            </TabsContent>
            <TabsContent value="seo" keepMounted className="pt-4">
              <SeoPanel publicUrl={data.publicUrl} defaults={data.page.seoDefaults} />
            </TabsContent>
          </Tabs>
        </form>
      </FormProvider>
    </EditorProvider>
  );
}
