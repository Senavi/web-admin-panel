'use client';

import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/admin/ui/button';
import type { MediaPreview } from '@/core/content/editor-types';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
export const MEDIA_UPLOAD_URL = '/api/media';

export async function uploadImage(
  file: File,
  url: string = MEDIA_UPLOAD_URL,
): Promise<MediaPreview> {
  const body = new FormData();
  body.set('file', file);
  const response = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
  const json = (await response.json().catch(() => ({}))) as Partial<MediaPreview> & {
    error?: string;
  };
  if (!response.ok || !json.id) throw new Error(json.error ?? 'Upload failed.');
  return { id: json.id, src: json.src ?? '', width: json.width ?? 0, height: json.height ?? 0 };
}

/**
 * Upload / preview / replace / remove one image. Value is a media id; the
 * caller provides previews for ids it already knows.
 */
export function MediaPicker({
  id,
  label,
  mediaId,
  preview,
  onChange,
  onUploaded,
  readOnly = false,
  accept = ACCEPT,
  uploadUrl,
}: {
  id: string;
  label: string;
  mediaId: string | null;
  preview: MediaPreview | undefined;
  onChange: (mediaId: string | null) => void;
  onUploaded?: (preview: MediaPreview) => void;
  readOnly?: boolean;
  accept?: string;
  uploadUrl?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(file, uploadUrl);
      onUploaded?.(uploaded);
      onChange(uploaded.id);
      toast.success('Image uploaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="bg-muted flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        {mediaId && preview ? (
          <Image
            src={preview.src}
            alt=""
            width={preview.width || 128}
            height={preview.height || 128}
            className="size-full object-cover"
            sizes="128px"
          />
        ) : (
          <ImageIcon aria-hidden className="size-8 text-muted-foreground" />
        )}
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            className="sr-only"
            aria-label={`${label}: upload image`}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {mediaId ? 'Replace' : 'Upload'}
          </Button>
          {mediaId ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2Icon />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
