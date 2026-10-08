import { Permission } from '@/core/auth/permissions';
import { assertPermission, AuthorizationError } from '@/core/auth/server/session';
import { getDb } from '@/core/db/client';
import {
  IMAGE_LIMITS,
  ingestFavicon,
  ingestImage,
  ingestLogo,
  UploadError,
} from '@/core/media/ingest';
import { AuditAction, writeAudit } from '@/core/security/audit';
import { assertSameOrigin } from '@/core/security/origin';
import { getClientIp, hashIp } from '@/core/security/request';
import { readSiteSettings } from '@/core/settings/repository';
import { getStorage } from '@/core/storage';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const UploadKind = { Image: 'image', Logo: 'logo', Favicon: 'favicon' } as const;
type UploadKind = (typeof UploadKind)[keyof typeof UploadKind];

function parseKind(value: string | null): UploadKind | null {
  if (value === null) return UploadKind.Image;
  return (Object.values(UploadKind) as string[]).includes(value) ? (value as UploadKind) : null;
}

/**
 * Image upload (multipart/form-data, field `file`). `?kind=logo|favicon` are
 * branding uploads (admins only): logos may be sanitized SVG, favicons
 * generate the icon set.
 * Same-origin + permission checked; the file is validated and re-encoded by
 * the ingest pipeline. Returns the media record used by the editor.
 */
export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;

  const kind = parseKind(new URL(request.url).searchParams.get('kind'));
  if (!kind) return json({ error: 'Unknown upload kind.' }, 400);

  let user;
  try {
    user = await assertPermission(
      kind === UploadKind.Image ? Permission.MediaUpload : Permission.SettingsManage,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ error: error.message }, 403);
    throw error;
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > IMAGE_LIMITS.maxBytes + 64 * 1024) {
    return json(
      { error: `Images must be smaller than ${IMAGE_LIMITS.maxBytes / 1024 / 1024} MB.` },
      413,
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return json({ error: 'Invalid upload.' }, 400);
  }
  if (!(file instanceof File)) return json({ error: 'No file received.' }, 400);

  const db = await getDb();
  const storage = getStorage();
  try {
    const input = {
      bytes: new Uint8Array(await file.arrayBuffer()),
      originalName: file.name,
      uploadedBy: user.id,
    };
    const row =
      kind === UploadKind.Logo
        ? await ingestLogo(db, storage, input)
        : kind === UploadKind.Favicon
          ? await ingestFavicon(
              db,
              storage,
              input,
              (await readSiteSettings(db)).branding.themeColor,
            )
          : await ingestImage(db, storage, input);
    await writeAudit(db, {
      action: AuditAction.MediaUpload,
      actor: { id: user.id, email: user.email },
      target: `media:${row.id}`,
      summary: { kind, size: row.size, width: row.width, height: row.height },
      ipHash: await hashIp(getClientIp(request.headers)),
    });
    return json({
      id: row.id,
      src: storage.publicUrl(row.storageKey),
      width: row.width ?? 0,
      height: row.height ?? 0,
    });
  } catch (error) {
    if (error instanceof UploadError) return json({ error: error.message }, 422);
    console.error('[media] upload failed', error);
    return json({ error: 'Upload failed. Please try again.' }, 500);
  }
}
