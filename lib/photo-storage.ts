/** Blank notes stay null so job_photos.caption is only set when the user typed one. */
export function captionFromNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Private Supabase Storage bucket. Created by supabase/migrations/002_storage_job_photos.sql. */
export const JOB_PHOTOS_BUCKET = 'job-photos';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function normalizeMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const base = mime.split(';')[0]?.trim().toLowerCase();
  return base || null;
}

export function contentTypeForMime(mime: string | null | undefined): string {
  const normalized = normalizeMime(mime);
  if (!normalized || normalized === 'image/jpg') return 'image/jpeg';
  if (normalized in MIME_EXT) return normalized;
  return 'image/jpeg';
}

export function extensionForMime(mime: string | null | undefined): string {
  return MIME_EXT[contentTypeForMime(mime)] ?? 'jpg';
}

export function mimeFromUri(uri: string): string | null {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.heic')) return 'image/heic';
  if (clean.endsWith('.heif')) return 'image/heif';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

export function newObjectId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** `{jobId}/{objectId}.{ext}` inside the job-photos bucket. */
export function buildObjectPath(jobId: string, mime: string | null | undefined, objectId: string): string {
  return `${jobId}/${objectId}.${extensionForMime(mime)}`;
}

type PhotoUriSource = {
  storage_path: string | null;
  local_uri: string | null;
};

/**
 * Cross-device display URL.
 * storage_path is an object key, not a URL. Prefer a signed URL.
 * local_uri is only used for legacy rows that were never uploaded.
 */
export function photoDisplayUri(
  photo: PhotoUriSource,
  signedByPath: Readonly<Record<string, string>>
): string | null {
  if (photo.storage_path) {
    return signedByPath[photo.storage_path] ?? null;
  }
  return photo.local_uri;
}
