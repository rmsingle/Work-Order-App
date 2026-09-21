import { Platform } from 'react-native';
import {
  JOB_PHOTOS_BUCKET,
  buildObjectPath,
  contentTypeForMime,
  newObjectId,
} from './photo-storage';
import { getSupabase } from './supabase';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function bodyFromLocalUri(
  localUri: string,
  contentType: string
): Promise<ArrayBuffer | FormData> {
  const response = await fetch(localUri).catch(() => null);
  if (response?.ok) {
    const body = await response.arrayBuffer();
    if (body.byteLength > 0) return body;
  }

  if (Platform.OS !== 'web') {
    const form = new FormData();
    form.append('file', {
      uri: localUri,
      name: `photo.${contentType.split('/')[1] || 'jpg'}`,
      type: contentType,
    } as unknown as Blob);
    return form;
  }

  throw new Error('Could not read the captured photo for upload.');
}

/** Upload into the private job-photos bucket. Returns the object key stored in job_photos.storage_path. */
export async function uploadJobPhoto(opts: {
  jobId: string;
  localUri: string;
  mimeType: string | null;
}): Promise<string> {
  const contentType = contentTypeForMime(opts.mimeType);
  const path = buildObjectPath(opts.jobId, opts.mimeType, newObjectId());
  const body = await bodyFromLocalUri(opts.localUri, contentType);

  const { error } = await getSupabase().storage.from(JOB_PHOTOS_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeJobPhoto(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(JOB_PHOTOS_BUCKET).remove([path]);
  if (error) throw error;
}

/** Signed read URLs for a private bucket. Requires the storage select policy from 002. */
export async function signedUrlsForPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  if (unique.length === 0) return {};

  const { data, error } = await getSupabase()
    .storage.from(JOB_PHOTOS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const signed: Record<string, string> = {};
  for (const row of data ?? []) {
    const url = row.signedUrl || row.signedURL;
    if (row.path && url && !row.error) {
      signed[row.path] = url;
    }
  }
  return signed;
}
