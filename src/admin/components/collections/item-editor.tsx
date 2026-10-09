'use client';

import { EyeIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';

import {
  DocumentEditor,
  type DocumentSave,
  type LocaleOption,
} from '@/admin/components/content/document-editor';
import { errorsAt } from '@/admin/components/content/fields/field-shell';
import { SimpleSelect } from '@/admin/components/forms/simple-select';
import { useAction } from '@/admin/hooks/use-action';
import { useConfirm } from '@/admin/hooks/use-confirm';
import { Button } from '@/admin/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/admin/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/admin/ui/field';
import { Input } from '@/admin/ui/input';
import { checkSlugAction, deleteItemAction, saveItemAction } from '@/core/collections/actions';
import { type ItemMeta, itemMetaSchema } from '@/core/collections/meta';
import { CollectionItemStatus, ITEM_SECTION } from '@/core/content/collection';
import type { EditorData } from '@/core/content/editor-types';
import { slugify } from '@/core/content/slug';

export interface ItemEditorProps {
  readonly data: EditorData;
  readonly locales: readonly LocaleOption[];
  readonly basePath: string;
  readonly listHref: string;
  readonly collection: {
    readonly id: string;
    readonly itemLabel: string;
    readonly titleField: string;
    /** `/blog/` — shown before the slug. */
    readonly pathPrefix: string;
  };
  readonly itemId: string;
  readonly meta: ItemMeta;
  /** Title in the default locale (slug suggestions come from it). */
  readonly defaultTitle: string;
  readonly isDefaultLocale: boolean;
  readonly previewHref: string;
}

const STATUS_OPTIONS = [
  { value: CollectionItemStatus.Draft, label: 'Draft (only staff can preview)' },
  { value: CollectionItemStatus.Published, label: 'Published' },
];

/** Collection item editor: the generated document editor plus slug, status and date. */
export function ItemEditor(props: ItemEditorProps) {
  const { data, collection, itemId } = props;
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const extra = useMemo(() => ({ defaults: props.meta, schema: itemMetaSchema }), [props.meta]);

  const save: DocumentSave = useCallback(
    async (values, versions) => {
      const result = await saveItemAction({
        collectionId: collection.id,
        itemId,
        locale: data.locale,
        content: values.content,
        seo: values.seo,
        versions,
        meta: values.extra,
      });
      return result.ok
        ? { ...result, data: { versions: result.data.versions, extra: result.data.meta } }
        : result;
    },
    [collection.id, itemId, data.locale],
  );

  const remove = useAction(deleteItemAction, { onSuccess: () => router.push(props.listHref) });
  const onDelete = async () => {
    const yes = await confirm({
      title: `Delete this ${collection.itemLabel.toLowerCase()}?`,
      description: 'All languages, SEO settings and history are deleted. Its URL stops working.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (yes) await remove.run({ collectionId: collection.id, itemId });
  };

  const isDraft = props.meta.status === CollectionItemStatus.Draft;
  return (
    <>
      <DocumentEditor
        data={data}
        locales={props.locales}
        basePath={props.basePath}
        subtitle={`${collection.pathPrefix}${props.meta.slug}`}
        extra={extra}
        save={save}
        panel={<ItemSettings {...props} />}
        actions={
          <>
            {isDraft ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={props.previewHref} target="_blank" rel="noopener noreferrer" />}
              >
                <EyeIcon />
                Preview
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onDelete()}
              disabled={remove.pending}
            >
              <Trash2Icon />
              Delete
            </Button>
          </>
        }
      />
      {dialog}
    </>
  );
}

function MetaField({
  name,
  label,
  description,
  children,
}: {
  name: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { errors } = useFormState();
  const fieldErrors = errorsAt(errors, name);
  return (
    <Field data-invalid={fieldErrors.length > 0 || undefined}>
      <FieldLabel htmlFor={`item-${name}`}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={fieldErrors} />
    </Field>
  );
}

/** Slug (with suggestion + availability), status and publish date. */
function ItemSettings({
  collection,
  itemId,
  defaultTitle,
  isDefaultLocale,
  meta,
}: ItemEditorProps) {
  const { register, setValue, setError, clearErrors } = useFormContext();
  const title: unknown = useWatch({ name: `content.${ITEM_SECTION}.${collection.titleField}` });
  const [slugHint, setSlugHint] = useState<string | null>(null);
  const suggestionSource = isDefaultLocale && typeof title === 'string' ? title : defaultTitle;

  const check = async (slug: string) => {
    if (slug === meta.slug) {
      setSlugHint(null);
      return;
    }
    const result = await checkSlugAction({ collectionId: collection.id, itemId, slug });
    if (!result.ok) return;
    if (!result.data.valid) return; // the schema shows the format error
    if (result.data.available) {
      clearErrors('extra.slug');
      setSlugHint('Available.');
    } else {
      setSlugHint(null);
      setError('extra.slug', {
        type: 'server',
        message: 'Another item already uses this URL (or used it before).',
      });
    }
  };

  const suggest = () => {
    const slug = slugify(suggestionSource);
    if (!slug) return;
    setValue('extra.slug', slug, { shouldDirty: true, shouldValidate: true });
    void check(slug);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Publishing</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 xl:grid-cols-3">
          <MetaField
            name="extra.slug"
            label="URL slug"
            description={
              slugHint ??
              `${collection.pathPrefix}… · shared by all languages. Changing it keeps the old URL working.`
            }
          >
            <div className="flex gap-2">
              <Input
                id="item-extra.slug"
                className="font-mono"
                {...register('extra.slug', {
                  onBlur: (event) => void check(String(event.target.value)),
                })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={suggest}
                disabled={!suggestionSource}
                aria-label="Suggest a slug from the title"
                title="Suggest from the title"
              >
                <WandSparklesIcon />
              </Button>
            </div>
          </MetaField>
          <MetaField name="extra.status" label="Status">
            <StatusSelect />
          </MetaField>
          <MetaField
            name="extra.publishedAt"
            label="Publish date"
            description="Shown on the site; set automatically when you publish."
          >
            <Input id="item-extra.publishedAt" type="date" {...register('extra.publishedAt')} />
          </MetaField>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function StatusSelect() {
  const { setValue } = useFormContext();
  const value: unknown = useWatch({ name: 'extra.status' });
  return (
    <SimpleSelect
      id="item-extra.status"
      value={String(value ?? CollectionItemStatus.Draft)}
      onChange={(next) => setValue('extra.status', next, { shouldDirty: true })}
      options={STATUS_OPTIONS}
      ariaLabel="Status"
    />
  );
}
