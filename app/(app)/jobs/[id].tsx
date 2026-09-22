import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { BeforeAfterPairCard } from '@/components/BeforeAfterPair';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing } from '@/constants/theme';
import { captureFromCamera, newPairId, pickFromLibrary } from '@/lib/photos';
import { captionFromNote, photoDisplayUri } from '@/lib/photo-storage';
import { removeJobPhoto, signedUrlsForPaths, uploadJobPhoto } from '@/lib/storage';
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

function photoUri(photo: JobPhoto, signedByPath: Readonly<Record<string, string>>) {
  return photoDisplayUri(photo, signedByPath);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type PendingUpload = {
  localUri: string;
  mimeType: string | null;
  lat: number | null;
  lng: number | null;
  kind: PhotoKind;
  pairId: string | null;
};

export default function JobDetailScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; addPhoto?: string | string[] }>();
  const id = firstParam(params.id);
  const addPhotoFlag = firstParam(params.addPhoto);
  const navigation = useNavigation();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [signedByPath, setSignedByPath] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState<'source' | 'confirm'>('source');
  const [photoNote, setPhotoNote] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [pendingPairId, setPendingPairId] = useState<string | null>(null);
  const handledAddPhoto = useRef(false);

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

      const nextPhotos = (photoRes.data as unknown as JobPhoto[]) ?? [];
      const storagePaths = nextPhotos
        .map((photo) => photo.storage_path)
        .filter((path): path is string => Boolean(path));
      const signed = await signedUrlsForPaths(storagePaths);
      const unsigned = storagePaths.filter((path) => !signed[path]);
      if (storagePaths.length > 0 && unsigned.length === storagePaths.length) {
        throw new Error(
          'Could not sign job photo URLs. Run supabase/migrations/002_storage_job_photos.sql and confirm the job-photos bucket is private.'
        );
      }

      setJob(jobRes.data as Job);
      setPhotos(nextPhotos);
      setSignedByPath(signed);
      setNotes((noteRes.data as unknown as JobNote[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openAddPhoto = useCallback(() => {
    setPhotoNote('');
    setPendingUpload(null);
    setSheetStep('source');
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (capturing) return;
    setSheetOpen(false);
    setSheetStep('source');
    setPendingUpload(null);
  }, [capturing]);

  useEffect(() => {
    handledAddPhoto.current = false;
  }, [id]);

  useEffect(() => {
    if (!job || addPhotoFlag !== '1' || handledAddPhoto.current) return;
    handledAddPhoto.current = true;
    openAddPhoto();
    router.setParams({ addPhoto: '' });
  }, [job, addPhotoFlag, openAddPhoto, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: job?.title ?? 'Job',
      headerRight: job
        ? () => (
            <Pressable
              onPress={openAddPhoto}
              disabled={capturing || sheetOpen}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
            >
              <Text style={styles.headerBtnText}>Add photo</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, job, capturing, sheetOpen, openAddPhoto]);

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
    mimeType: string | null;
    lat: number | null;
    lng: number | null;
    kind: PhotoKind;
    pairId: string | null;
    caption: string | null;
  }) {
    if (!id || !user) return;
    const storagePath = await uploadJobPhoto({
      jobId: id,
      localUri: opts.localUri,
      mimeType: opts.mimeType,
    });
    const caption = captionFromNote(opts.caption);
    const { error: insErr } = await getSupabase().from('job_photos').insert({
      job_id: id,
      local_uri: null,
      storage_path: storagePath,
      lat: opts.lat,
      lng: opts.lng,
      caption: caption,
      kind: opts.kind,
      pair_id: opts.pairId,
      created_by: user.id,
    });
    if (insErr) {
      await removeJobPhoto(storagePath).catch(() => undefined);
      throw insErr;
    }
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
      if (!captured) {
        setSheetStep('source');
        setSheetOpen(true);
        return;
      }
      setPendingUpload({
        localUri: captured.localUri,
        mimeType: captured.mimeType,
        lat: captured.lat,
        lng: captured.lng,
        kind: captured.kind,
        pairId: captured.pairId,
      });
      setSheetStep('confirm');
      setSheetOpen(true);
    } catch (e) {
      Alert.alert('Capture failed', e instanceof Error ? e.message : 'Unknown error');
      setSheetStep('source');
      setSheetOpen(true);
    } finally {
      setCapturing(false);
    }
  }

  async function confirmUpload() {
    if (!pendingUpload) return;
    setCapturing(true);
    try {
      await insertPhoto({
        localUri: pendingUpload.localUri,
        mimeType: pendingUpload.mimeType,
        lat: pendingUpload.lat,
        lng: pendingUpload.lng,
        kind: pendingUpload.kind,
        pairId: pendingUpload.pairId,
        caption: photoNote,
      });
      if (pendingUpload.kind === 'before' && pendingUpload.pairId) {
        setPendingPairId(pendingUpload.pairId);
      }
      if (pendingUpload.kind === 'after') setPendingPairId(null);
      setPendingUpload(null);
      setPhotoNote('');
      setSheetStep('source');
      setSheetOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error');
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

  const web = Platform.OS === 'web';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{job.title}</Text>
            <StatusBadge status={job.status} />
          </View>
          <Text style={styles.address}>{job.property_address || 'No address'}</Text>
          <Text style={styles.meta}>Updated {formatWhen(job.updated_at)}</Text>
          <Pressable
            style={[styles.addPhotoBtn, (capturing || sheetOpen) && styles.disabled]}
            onPress={openAddPhoto}
            disabled={capturing || sheetOpen}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            {capturing ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <Text style={styles.addPhotoBtnText}>Add photo</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.section}>Photos ({photos.length})</Text>
        {photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <Text style={styles.emptyPhotosText}>
              No photos yet. Use Add photo above to shoot on-site (GPS + timestamp saved). You can
              write a note before the photo uploads.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            {photos.map((p) => {
              const uri = photoUri(p, signedByPath);
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
                  {p.caption ? (
                    <Text style={styles.thumbCaption} numberOfLines={2}>
                      {p.caption}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}

        {pairs.length > 0 ? (
          <>
            <Text style={styles.section}>Before / After</Text>
            {pairs.map((pair) => (
              <BeforeAfterPairCard
                key={pair.pair_id}
                before={pair.before}
                after={pair.after}
                signedByPath={signedByPath}
              />
            ))}
          </>
        ) : null}

        <Text style={styles.section}>Timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>Photos and notes will appear here in order.</Text>
        ) : (
          timeline.map((item) => {
            if (item.type === 'photo') {
              const p = item.photo;
              const uri = photoUri(p, signedByPath);
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
      </ScrollView>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.dismissLayer}
            onPress={closeSheet}
            accessibilityLabel="Dismiss add photo"
          />
          <View style={styles.sheet}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                bounces={false}
                style={{ maxHeight: Math.round(windowHeight * 0.8) }}
              >
                {sheetStep === 'confirm' && pendingUpload ? (
                  <>
                    <Text style={styles.sheetTitle}>Upload photo</Text>
                    <Text style={styles.sheetSub}>
                      Add or edit the note, then upload. It is saved on this photo as the caption.
                    </Text>
                    <Image
                      source={{ uri: pendingUpload.localUri }}
                      style={styles.preview}
                      contentFit="cover"
                    />
                    <Text style={styles.fieldLabel}>Note</Text>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder="Note for this photo…"
                      placeholderTextColor={colors.muted}
                      value={photoNote}
                      onChangeText={setPhotoNote}
                      multiline
                      autoFocus
                    />
                    <Pressable
                      style={[styles.uploadBtn, capturing && styles.disabled]}
                      onPress={confirmUpload}
                      disabled={capturing}
                    >
                      {capturing ? (
                        <ActivityIndicator color={colors.navy} />
                      ) : (
                        <Text style={styles.uploadBtnText}>Upload photo</Text>
                      )}
                    </Pressable>
                    <Pressable onPress={closeSheet} style={styles.sheetCancel} disabled={capturing}>
                      <Text style={styles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.sheetTitle}>Add photo</Text>
                    <Text style={styles.sheetSub}>
                      Write a note for this photo, then take or choose the picture. The note is
                      saved with the upload.
                      {web ? ' On web, choose an image file if the camera is unavailable.' : ''}
                    </Text>
                    <Text style={styles.fieldLabel}>Note</Text>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder="Note for this photo…"
                      placeholderTextColor={colors.muted}
                      value={photoNote}
                      onChangeText={setPhotoNote}
                      multiline
                    />

                    {web ? (
                      <Pressable
                        style={styles.sheetBtn}
                        onPress={() => runCapture('general', null, 'library')}
                      >
                        <Text style={styles.sheetBtnText}>Choose image file</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.sheetBtn} onPress={() => runCapture('general', null, 'camera')}>
                      <Text style={styles.sheetBtnText}>
                        {web ? 'Camera or choose file' : 'Camera · general'}
                      </Text>
                    </Pressable>
                    {web ? null : (
                      <Pressable
                        style={styles.sheetBtn}
                        onPress={() => runCapture('general', null, 'library')}
                      >
                        <Text style={styles.sheetBtnText}>Photo library · general</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.sheetBtn, styles.sheetBefore]}
                      onPress={() => runCapture('before', newPairId(), web ? 'library' : 'camera')}
                    >
                      <Text style={styles.sheetBtnText}>
                        {web ? 'Before photo (start pair)' : 'Camera · BEFORE (start pair)'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.sheetBtn, styles.sheetAfter]}
                      onPress={() => {
                        const pair = pendingPairId || pairs.find((p) => p.before && !p.after)?.pair_id;
                        if (!pair) {
                          Alert.alert('No open before', 'Capture a BEFORE photo first to start a pair.');
                          return;
                        }
                        runCapture('after', pair, web ? 'library' : 'camera');
                      }}
                    >
                      <Text style={styles.sheetBtnText}>
                        {web ? 'After photo (complete pair)' : 'Camera · AFTER (complete pair)'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={closeSheet} style={styles.sheetCancel}>
                      <Text style={styles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  headerBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnText: { color: colors.gold, fontWeight: '800' },
  addPhotoBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addPhotoBtnText: { color: colors.navy, fontWeight: '900', fontSize: 16 },
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
  thumbCaption: { marginTop: 2, fontSize: 11, color: colors.muted },
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.45)',
    justifyContent: 'flex-end',
  },
  dismissLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '92%',
    zIndex: 2,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: colors.navy },
  sheetSub: { color: colors.muted, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  fieldLabel: { fontWeight: '700', color: colors.navy, marginBottom: 6 },
  sheetInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.offWhite,
    color: colors.navy,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
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
  uploadBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadBtnText: { color: colors.navy, fontWeight: '900' },
  sheetCancel: { paddingVertical: 12, alignItems: 'center' },
  sheetCancelText: { color: colors.muted, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, padding: spacing.md },
  retryText: { color: colors.navy, fontWeight: '800' },
});
