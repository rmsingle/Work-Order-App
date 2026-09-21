import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import type { JobPhoto } from './types';

const BUCKET = 'job-photos';
const SIGNED_URL_SECONDS = 60 * 60; // 1 hour

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  }
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Build a File/Blob (or RN FormData-compatible body) from a local image URI.
 * Works on web (blob) and React Native (fetch → blob / ArrayBuffer).
 */
async function bodyFromLocalUri(localUri: string): Promise<Blob | ArrayBuffer | FormData> {
  // Prefer fetch+blob — works on web and modern RN / Expo.
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    if (blob && blob.size > 0) return blob;
  } catch {
    // fall through to FormData for older RN file:// URIs
  }

  if (Platform.OS !== 'web') {
    const form = new FormData();
    form.append('file', {
      uri: localUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    return form;
  }

  throw new Error('Could not read photo file for upload.');
}

/**
 * Upload a job photo to the private `job-photos` bucket.
 * Path: `${jobId}/${Date.now()}-{random}.jpg`
 * Returns the storage object path (not a public URL).
 */
export async function uploadJobPhoto(opts: {
  jobId: string;
  localUri: string;
}): Promise<string> {
  const path = `${opts.jobId}/${Date.now()}-${randomSuffix()}.jpg`;
  const body = await bodyFromLocalUri(opts.localUri);

  const { error } = await getSupabase().storage.from(BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** Signed URL for displaying a private storage object (default 1 hour). */
export async function getSignedPhotoUrl(
  storagePath: string,
  expiresInSeconds: number = SIGNED_URL_SECONDS
): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned for photo.');
  return data.signedUrl;
}

/**
 * Prefer a signed URL from storage_path; fall back to local_uri.
 * Use for gallery / timeline / before-after display.
 */
export async function resolvePhotoDisplayUri(
  photo: Pick<JobPhoto, 'storage_path' | 'local_uri'>
): Promise<string | null> {
  if (photo.storage_path) {
    try {
      return await getSignedPhotoUrl(photo.storage_path);
    } catch {
      // fall through to local URI
    }
  }
  return photo.local_uri;
}
