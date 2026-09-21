import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { BeforeAfterPairCard } from '@/components/BeforeAfterPair';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing } from '@/constants/theme';
import { captureFromCamera, newPairId, pickFromLibrary } from '@/lib/photos';
import { getSupabase } from '@/lib/supabase';
import { buildTimeline } from '@/lib/timeline';
import type { Job, JobNote, JobPhoto, PhotoKind } from '@/lib/types';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function photoUri(p: JobPhoto) {
  return p.local_uri || p.storage_path || null;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { user, profile } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPairId, setPendingPairId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const supabase = getSupabase();
      const [jobRes, photoRes, noteRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, property_address, status, created_by, created_at, updated_at')
          .eq('id', id)
          .single(),
        supabase
          .from('job_photos')
          .select(
            'id, job_id, storage_path, local_uri, lat, lng, caption, kind, pair_id, created_by, created_at, author:profiles!job_photos_created_by_fkey(id, full_name)'
          )
          .eq('job_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('job_notes')
          .select(
            'id, job_id, author_id, body, created_at, author:profiles!job_notes_author_id_fkey(id, full_name)'
          )
          .eq('job_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (jobRes.error) throw jobRes.error;
      if (photoRes.error) throw photoRes.error;
      if (noteRes.error) throw noteRes.error;

      setJob(jobRes.data as Job);
      setPhotos((photoRes.data as unknown as JobPhoto[]) ?? []);
      setNotes((noteRes.data as unknown as JobNote[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: job?.title ?? 'Job' });
  }, [navigation, job?.title]);

  const timeline = useMemo(() => buildTimeline(photos, notes), [photos, notes]);

  const pairs = useMemo(() => {
    const map = new Map<string, { pair_id: string; before: JobPhoto | null; after: JobPhoto | null }>();
    for (const p of photos) {
      if (!p.pair_id || (p.kind !== 'before' && p.kind !== 'after')) continue;
      const entry = map.get(p.pair_id) ?? { pair_id: p.pair_id, before: null, after: null };
      if (p.kind === 'before') entry.before = p;
      if (p.kind === 'after') entry.after = p;
      map.set(p.pair_id, entry);
    }
    return Array.from(map.values()).filter((x) => x.before || x.after);
  }, [photos]);

  async function insertPhoto(opts: {
    localUri: string;
    lat: number | null;
    lng: number | null;
    kind: PhotoKind;
    pairId: string | null;
    caption: string | null;
  }) {
    if (!id || !user) return;
    // Storage stub: persist local_uri now; storage_path filled when bucket upload is wired.
    const { error: insErr } = await getSupabase().from('job_photos').insert({
      job_id: id,
      local_uri: opts.localUri,
      storage_path: null,
      lat: opts.lat,
      lng: opts.lng,
      caption: opts.caption,
      kind: opts.kind,
      pair_id: opts.pairId,
      created_by: user.id,
    });
    if (insErr) throw insErr;
    await getSupabase().from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  }

  async function runCapture(kind: PhotoKind, pairId: string | null, source: 'camera' | 'library') {
    setSheetOpen(false);
    setCapturing(true);
    try {
      const captured =
        source === 'camera'
          ? await captureFromCamera({ kind, pairId })
          : await pickFromLibrary({ kind, pairId });
      if (!captured) return;
      await insertPhoto({
        localUri: captured.localUri,
        lat: captured.lat,
        lng: captured.lng,
        kind: captured.kind,
        pairId: captured.pairId,
        caption: captured.caption,
      });
      if (kind === 'before' && captured.pairId) {
        setPendingPairId(captured.pairId);
      }
      if (kind === 'after') setPendingPairId(null);
    } catch (e) {
      Alert.alert('Capture failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCapturing(false);
    }
  }

  async function addNote() {
    if (!noteBody.trim() || !id || !user) return;
    setSavingNote(true);
    try {
      const { error: insErr } = await getSupabase().from('job_notes').insert({
        job_id: id,
        author_id: user.id,
        body: noteBody.trim(),
      });
      if (insErr) throw insErr;
      setNoteBody('');
      await getSupabase().from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', id);
      await load();
    } catch (e) {
      Alert.alert('Note failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Job not found'}</Text>
        <Pressable onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{job.title}</Text>
            <StatusBadge status={job.status} />
          </View>
          <Text style={styles.address}>{job.property_address || 'No address'}</Text>
          <Text style={styles.meta}>Updated {formatWhen(job.updated_at)}</Text>
        </View>

        {/* Photo gallery strip — primary artifact */}
        <Text style={styles.section}>Photos ({photos.length})</Text>
        {photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <Text style={styles.emptyPhotosText}>
              No photos yet. Tap Capture to shoot on-site (GPS + timestamp saved).
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            {photos.map((p) => {
              const uri = photoUri(p);
              return (
                <View key={p.id} style={styles.thumbWrap}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={styles.thumbPhText}>No URI</Text>
                    </View>
                  )}
                  <Text style={styles.kindBadge}>{p.kind}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Before / After pairs side-by-side */}
        {pairs.length > 0 ? (
          <>
            <Text style={styles.section}>Before / After</Text>
            {pairs.map((pair) => (
              <BeforeAfterPairCard key={pair.pair_id} before={pair.before} after={pair.after} />
            ))}
          </>
        ) : null}

        {/* Chronological timeline: photos + notes */}
        <Text style={styles.section}>Timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>Photos and notes will appear here in order.</Text>
        ) : (
          timeline.map((item) => {
            if (item.type === 'photo') {
              const p = item.photo;
              const uri = photoUri(p);
              return (
                <View key={`photo-${p.id}`} style={styles.timelineCard}>
                  <Text style={styles.timelineLabel}>
                    PHOTO · {p.kind.toUpperCase()} · {formatWhen(p.created_at)}
                  </Text>
                  {uri ? (
                    <Image source={{ uri }} style={styles.timelineImage} contentFit="cover" />
                  ) : null}
                  {p.caption ? <Text style={styles.caption}>{p.caption}</Text> : null}
                  <Text style={styles.meta}>
                    {p.author?.full_name || 'Unknown'}
                    {p.lat != null && p.lng != null
                      ? ` · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
                      : ' · GPS unavailable'}
                  </Text>
                </View>
              );
            }
            const n = item.note;
            return (
              <View key={`note-${n.id}`} style={styles.timelineCard}>
                <Text style={styles.timelineLabel}>NOTE · {formatWhen(n.created_at)}</Text>
                <Text style={styles.noteBody}>{n.body}</Text>
                <Text style={styles.meta}>{n.author?.full_name || profile?.full_name || 'Unknown'}</Text>
              </View>
            );
          })
        )}

        {/* Add note */}
        <Text style={styles.section}>Add note</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Field note…"
          placeholderTextColor={colors.muted}
          value={noteBody}
          onChangeText={setNoteBody}
          multiline
        />
        <Pressable
          style={[styles.secondaryBtn, (!noteBody.trim() || savingNote) && styles.disabled]}
          onPress={addNote}
          disabled={!noteBody.trim() || savingNote}
        >
          {savingNote ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Text style={styles.secondaryBtnText}>Save note</Text>
          )}
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fast Capture FAB — main action */}
      <Pressable
        style={styles.fab}
        onPress={() => setSheetOpen(true)}
        disabled={capturing}
      >
        {capturing ? (
          <ActivityIndicator color={colors.navy} />
        ) : (
          <Text style={styles.fabText}>Capture</Text>
        )}
      </Pressable>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>Fast Capture</Text>
            <Text style={styles.sheetSub}>GPS tagged when permission allows. Storage upload stubbed (local URI).</Text>

            <Pressable style={styles.sheetBtn} onPress={() => runCapture('general', null, 'camera')}>
              <Text style={styles.sheetBtnText}>Camera · general</Text>
            </Pressable>
            <Pressable style={styles.sheetBtn} onPress={() => runCapture('general', null, 'library')}>
              <Text style={styles.sheetBtnText}>Library · general</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetBtn, styles.sheetBefore]}
              onPress={() => runCapture('before', newPairId(), 'camera')}
            >
              <Text style={styles.sheetBtnText}>Camera · BEFORE (start pair)</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetBtn, styles.sheetAfter]}
              onPress={() => {
                const pair = pendingPairId || pairs.find((p) => p.before && !p.after)?.pair_id;
                if (!pair) {
                  Alert.alert('No open before', 'Capture a BEFORE photo first to start a pair.');
                  return;
                }
                runCapture('after', pair, 'camera');
              }}
            >
              <Text style={styles.sheetBtnText}>Camera · AFTER (complete pair)</Text>
            </Pressable>
            <Pressable onPress={() => setSheetOpen(false)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.navy },
  address: { marginTop: spacing.sm, color: colors.navyMid },
  meta: { marginTop: 4, fontSize: 12, color: colors.muted },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  emptyPhotos: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPhotosText: { color: colors.muted, lineHeight: 20 },
  strip: { marginBottom: spacing.sm },
  thumbWrap: { marginRight: spacing.sm, width: 110 },
  thumb: { width: 110, height: 110, borderRadius: 10, backgroundColor: colors.border },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPhText: { fontSize: 11, color: colors.muted },
  kindBadge: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: colors.navy,
    textTransform: 'uppercase',
  },
  timelineCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  timelineLabel: { fontSize: 11, fontWeight: '800', color: colors.gold, marginBottom: 6 },
  timelineImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: colors.border },
  caption: { marginTop: 8, color: colors.navy },
  noteBody: { color: colors.navy, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.white,
    color: colors.navy,
    textAlignVertical: 'top',
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    backgroundColor: colors.gold,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 999,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    minWidth: 120,
    alignItems: 'center',
  },
  fabText: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: colors.navy },
  sheetSub: { color: colors.muted, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  sheetBtn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sheetBefore: { backgroundColor: colors.before },
  sheetAfter: { backgroundColor: colors.after },
  sheetBtnText: { color: colors.white, fontWeight: '800' },
  sheetCancel: { paddingVertical: 12, alignItems: 'center' },
  sheetCancelText: { color: colors.muted, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, padding: spacing.md },
  retryText: { color: colors.navy, fontWeight: '800' },
});
