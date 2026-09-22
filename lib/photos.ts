import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { mimeFromUri } from './photo-storage';
import type { PhotoKind } from './types';

export type CapturedPhoto = {
  localUri: string;
  mimeType: string | null;
  lat: number | null;
  lng: number | null;
  kind: PhotoKind;
  caption: string | null;
  pairId: string | null;
};

function capturedFromAsset(
  asset: ImagePicker.ImagePickerAsset,
  opts: { kind?: PhotoKind; pairId?: string | null; caption?: string | null } | undefined,
  gps: { lat: number | null; lng: number | null }
): CapturedPhoto {
  return {
    localUri: asset.uri,
    mimeType: asset.mimeType ?? mimeFromUri(asset.uri),
    lat: gps.lat,
    lng: gps.lng,
    kind: opts?.kind ?? 'general',
    caption: opts?.caption ?? null,
    pairId: opts?.pairId ?? null,
  };
}

async function readGps(): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { lat: null, lng: null };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { lat: null, lng: null };
  }
}

type CaptureOpts = {
  kind?: PhotoKind;
  pairId?: string | null;
  caption?: string | null;
};

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  exif: true,
};

async function launchCapture(
  source: 'camera' | 'library',
  opts?: CaptureOpts
): Promise<CapturedPhoto | null> {
  if (source === 'camera') {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      throw new Error('Camera permission is required to add a photo.');
    }
  } else {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) {
      throw new Error('Photo library permission is required.');
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (result.canceled || !result.assets?.[0]) return null;

  const gps = await readGps();
  return capturedFromAsset(result.assets[0], opts, gps);
}

/**
 * Fast Capture — camera first.
 * On web, camera launch uses a file input and can fail in desktop browsers.
 * A cancel stays a cancel. A thrown camera error falls back to the image file picker.
 */
export async function captureFromCamera(opts?: CaptureOpts): Promise<CapturedPhoto | null> {
  try {
    return await launchCapture('camera', opts);
  } catch (error) {
    if (Platform.OS !== 'web') throw error;
    try {
      return await launchCapture('library', opts);
    } catch (fallbackError) {
      const first = error instanceof Error ? error.message : 'Camera unavailable on web.';
      const second =
        fallbackError instanceof Error ? fallbackError.message : 'File picker unavailable.';
      throw new Error(`${first} ${second}`);
    }
  }
}

/** Library picker for attaching existing site photos. On web this is the file dialog. */
export async function pickFromLibrary(opts?: CaptureOpts): Promise<CapturedPhoto | null> {
  return launchCapture('library', opts);
}

/** Group before/after photos that share a pair_id. */
export function buildBeforeAfterPairs(
  photos: { id: string; kind: PhotoKind; pair_id: string | null; created_at: string }[]
) {
  const map = new Map<
    string,
    {
      pair_id: string;
      before: (typeof photos)[0] | null;
      after: (typeof photos)[0] | null;
    }
  >();

  for (const p of photos) {
    if (!p.pair_id || (p.kind !== 'before' && p.kind !== 'after')) continue;
    const entry = map.get(p.pair_id) ?? {
      pair_id: p.pair_id,
      before: null,
      after: null,
    };
    if (p.kind === 'before') entry.before = p;
    if (p.kind === 'after') entry.after = p;
    map.set(p.pair_id, entry);
  }

  return Array.from(map.values());
}

export function newPairId(): string {
  // Prefer crypto.randomUUID when available (web + modern RN).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pair-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
