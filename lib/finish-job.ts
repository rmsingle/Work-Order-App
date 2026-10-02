import type { PhotoKind } from './types';

export type SourceLinkPatch = {
  pair_id: string;
  kind?: 'before';
};

export type FinishTarget = {
  photoId: string;
  pairId: string;
  /** Null when the source photo already shares this pair and should not be rewritten. */
  link: SourceLinkPatch | null;
};

/**
 * Completion shots are `kind = after` and share `pair_id` with the photo Rob tapped.
 * A general photo becomes the before side so the existing before/after card can show the pair.
 * An existing after photo is left as-is; the new shot still uses the same pair id.
 */
export function completionTarget(
  photo: { id: string; kind: PhotoKind; pair_id: string | null },
  pairId: string
): FinishTarget {
  return {
    photoId: photo.id,
    pairId,
    link: sourceLinkPatch(photo.kind, photo.pair_id, pairId),
  };
}

export function sourceLinkPatch(
  kind: PhotoKind,
  existingPairId: string | null,
  pairId: string
): SourceLinkPatch | null {
  if (kind === 'after') {
    return existingPairId ? null : { pair_id: pairId };
  }
  if (kind === 'before' && existingPairId) return null;
  if (kind === 'general') return { pair_id: pairId, kind: 'before' };
  return { pair_id: pairId };
}
