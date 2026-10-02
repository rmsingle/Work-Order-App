import type { JobNote, JobPhoto, TimelineItem } from './types';

export function buildTimeline(photos: JobPhoto[], notes: JobNote[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...photos.map((photo) => ({
      type: 'photo' as const,
      created_at: photo.created_at,
      photo,
    })),
    ...notes.map((note) => ({
      type: 'note' as const,
      created_at: note.created_at,
      note,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
