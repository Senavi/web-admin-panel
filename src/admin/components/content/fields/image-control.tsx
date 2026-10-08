'use client';

import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { MediaPicker } from '@/admin/components/media/media-picker';
import { Input } from '@/admin/ui/input';
import type { ImageField } from '@/core/content/fields';

import { useEditor } from '../editor-context';
import { FieldShell } from './field-shell';
import { controlId, type FieldControlProps } from './types';

/** Image field: media picker (shared or per locale) + per-locale alt text. */
export function ImageControl({ name, field, label, contentPath }: FieldControlProps<ImageField>) {
  const { register } = useFormContext();
  const { media, addMedia, readOnly } = useEditor();
  const id = controlId(name);
  const altId = useId();
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      help={[field.help, field.recommendedSize ? `Recommended: ${field.recommendedSize}.` : '']
        .filter(Boolean)
        .join(' ')}
      required={field.required}
      shared={!field.localized}
      contentPath={contentPath}
    >
      <Controller
        name={`${name}.mediaId`}
        render={({ field: control }) => {
          const mediaId = (control.value as string | null) ?? null;
          return (
            <MediaPicker
              id={id}
              label={label}
              mediaId={mediaId}
              preview={mediaId ? media[mediaId] : undefined}
              onChange={(next) => control.onChange(next)}
              onUploaded={addMedia}
              readOnly={readOnly}
            />
          );
        }}
      />
      <label htmlFor={altId} className="text-xs text-muted-foreground">
        Alt text (this language): describe the image for screen readers
      </label>
      <Input id={altId} readOnly={readOnly} {...register(`${name}.alt`)} />
    </FieldShell>
  );
}
