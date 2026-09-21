import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { PhotoKind } from './types';

export type CapturedPhoto = {
  localUri: string;
  lat: number | null;
  lng: number | null;
  kind: PhotoKind;
  caption: string | null;
  pairId: string | null;
};

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

/** Fast Capture — camera first (CompanyCam-style). Falls back gracefully if cancelled. */
export async function captureFromCamera(opts?: {
  kind?: PhotoKind;
  pairId?: string | null;
  caption?: string | null;
}): Promise<CapturedPhoto | null> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (!cam.granted) {
    throw new Error('Camera permission is required for Fast Capture.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    exif: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const gps = await readGps();
  return {
    localUri: result.assets[0].uri,
    lat: gps.lat,
    lng: gps.lng,
    kind: opts?.kind ?? 'general',
    caption: opts?.caption ?? null,
    pairId: opts?.pairId ?? null,
  };
}

/** Library picker for attaching existing site photos. */
export async function pickFromLibrary(opts?: {
  kind?: PhotoKind;
  pairId?: string | null;
  caption?: string | null;
}): Promise<CapturedPhoto | null> {
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) {
    throw new Error('Photo library permission is required.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    exif: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const gps = await readGps();
  return {
    localUri: result.assets[0].uri,
    lat: gps.lat,
    lng: gps.lng,
    kind: opts?.kind ?? 'general',
    caption: opts?.caption ?? null,
    pairId: opts?.pairId ?? null,
  };
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
