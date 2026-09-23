import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { ArchiveJobButton } from '@/components/ArchiveJobButton';
import { BeforeAfterPairCard } from '@/components/BeforeAfterPair';
import { DeleteJobButton } from '@/components/DeleteJobButton';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing } from '@/constants/theme';
import { confirmArchiveJob } from '@/lib/archive-job';
import { confirmDeleteJob, deleteJobPermanently } from '@/lib/delete-job';
import { showMessage } from '@/lib/dialog';
import { formatJobNumber, isMissingJobNumberColumn } from '@/lib/job-number';
import { completionTarget, type FinishTarget } from '@/lib/finish-job';
import { captureFromCamera, newPairId, pickFromLibrary } from '@/lib/photos';
import { captionFromNote } from '@/lib/photo-storage';
import { removeJobPhoto, signedUrlsForPaths, uploadJobPhoto } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase';
import type { Job, JobNote, JobPhoto, PhotoKind } from '@/lib/types';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
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
  const [finishTarget, setFinishTarget] = useState<FinishTarget | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handledAddPhoto = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const supabase = getSupabase();
      const jobWithNumber = await supabase
        .from('jobs')
        .select('id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at')
        .eq('id', id)
        .single();
      const jobRes =
        jobWithNumber.error && isMissingJobNumberColumn(jobWithNumber.error.message)
          ? await supabase
              .from('jobs')
              .select('id, title, property_address, status, created_by, created_at, updated_at, archived_at')
              .eq('id', id)
              .single()
          : jobWithNumber;
      const [photoRes, noteRes] = await Promise.all([
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
    setFinishTarget(null);
    setPhotoNote('');
    setPendingUpload(null);
    setSheetStep('source');
    setSheetOpen(true);
  }, []);

  const openJobFinished = useCallback((photo: JobPhoto) => {
    const pairId = photo.pair_id ?? newPairId();
    setFinishTarget(completionTarget(photo, pairId));
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
    setFinishTarget(null);
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

  const goToJobs = useCallback(() => {
    router.dismissTo('/(app)/jobs');
  }, [router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: formatJobNumber(job?.job_number) ?? job?.title ?? 'Job',
      headerTitleAlign: 'center',
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={goToJobs}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to jobs"
        >
          <Text style={styles.headerBackText}>‹ Back</Text>
        </Pressable>
      ),
      headerRight: () => <View style={{ width: 72 }} />,
    });
  }, [navigation, job, goToJobs]);

  const pairs = useMemo(() => {
    const map = new Map<string, { pair_id: string; before: JobPhoto | null; after: JobPhoto | null }>();
    for (const p of photos) {
      if (!p.pair_id || (p.kind !== 'before' && p.kind !== 'after')) continue;
      const entry = map.get(p.pair_id) ?? { pair_id: p.pair_id, before: null, after: null };
      // Photos are newest first, so the first before/after in a pair is the latest one.
      if (p.kind === 'before' && !entry.before) entry.before = p;
      if (p.kind === 'after' && !entry.after) entry.after = p;
      map.set(p.pair_id, entry);
    }
    return Array.from(map.values()).filter((x) => x.before || x.after);
  }, [photos]);

  const workRows = useMemo(() => {
    const consumed = new Set<string>();
    const rows: { key: string; before: JobPhoto | null; after: JobPhoto | null }[] = [];
    for (const photo of photos) {
      if (consumed.has(photo.id)) continue;
      if (photo.pair_id && (photo.kind === 'before' || photo.kind === 'after')) {
        const pair = pairs.find((entry) => entry.pair_id === photo.pair_id);
        for (const other of photos) {
          if (
            other.pair_id === photo.pair_id &&
            (other.kind === 'before' || other.kind === 'after')
          ) {
            consumed.add(other.id);
          }
        }
        rows.push({
          key: photo.pair_id,
          before: pair?.before ?? null,
          after: pair?.after ?? null,
        });
        continue;
      }
      consumed.add(photo.id);
      rows.push({ key: photo.id, before: photo, after: null });
    }
    return rows;
  }, [photos, pairs]);

  async function insertPhoto(opts: {
    localUri: string;
    mimeType: string | null;
    lat: number | null;
    lng: number | null;
    kind: PhotoKind;
    pairId: string | null;
    caption: string | null;
    finish: FinishTarget | null;
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
    if (opts.finish?.link) {
      const { error: linkErr } = await getSupabase()
        .from('job_photos')
        .update(opts.finish.link)
        .eq('id', opts.finish.photoId);
      if (linkErr) {
        await load();
        throw new Error(`Completion photo saved, but it could not be linked. ${linkErr.message}`);
      }
    }
    if (opts.finish) {
      const { error: doneErr } = await getSupabase()
        .from('jobs')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (doneErr) {
        await load();
        throw new Error(`Completion photo saved, but the job could not be marked complete. ${doneErr.message}`);
      }
    } else {
      await getSupabase().from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', id);
    }
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
      showMessage('Capture failed', e instanceof Error ? e.message : 'Unknown error');
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
        finish: finishTarget,
      });
      setPendingUpload(null);
      setPhotoNote('');
      setFinishTarget(null);
      setSheetStep('source');
      setSheetOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showMessage('Upload failed', message);
      if (message.startsWith('Completion photo saved')) {
        setPendingUpload(null);
        setPhotoNote('');
        setFinishTarget(null);
        setSheetStep('source');
        setSheetOpen(false);
      }
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
      showMessage('Note failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingNote(false);
    }
  }

  async function archiveJob() {
    if (!id || !job || archiving || deleting) return;
    try {
      const confirmed = await confirmArchiveJob(job.title);
      if (!confirmed) return;
      setArchiving(true);
      const { data, error: upErr } = await getSupabase()
        .from('jobs')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (upErr) throw upErr;
      if (!data?.id) {
        throw new Error('Archive did not save. The job is still on the active list.');
      }
      router.replace('/(app)/jobs');
    } catch (e) {
      showMessage('Could not archive', e instanceof Error ? e.message : 'Unknown error');
      setArchiving(false);
    }
  }

  async function deleteJob() {
    if (!id || !job || deleting || archiving) return;
    try {
      const confirmed = await confirmDeleteJob(job.title, job.job_number);
      if (!confirmed) return;
      setDeleting(true);
      await deleteJobPermanently(id);
      router.replace('/(app)/jobs');
    } catch (e) {
      showMessage('Could not delete', e instanceof Error ? e.message : 'Unknown error');
      setDeleting(false);
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
  const address = job.property_address?.trim() ?? '';

  async function openInMaps() {
    if (!address) return;
    try {
      await Linking.openURL(mapsSearchUrl(address));
    } catch (e) {
      showMessage('Could not open Maps', e instanceof Error ? e.message : 'Google Maps did not open.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          {formatJobNumber(job.job_number) ? (
            <Text style={styles.jobNumber}>{formatJobNumber(job.job_number)}</Text>
          ) : null}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{job.title}</Text>
            <StatusBadge status={job.status} />
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.address}>{address || 'No address'}</Text>
            {address ? (
              <Pressable
                style={styles.mapsBtn}
                onPress={openInMaps}
                accessibilityRole="button"
                accessibilityLabel="Open in Google Maps"
              >
                <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
              </Pressable>
            ) : null}
          </View>
          {address ? null : (
            <Text style={styles.mapsHint}>Add an address to open this job in Google Maps.</Text>
          )}
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
          {job.archived_at ? (
            <Text style={styles.archivedNote}>Archived. It is off the active Jobs list.</Text>
          ) : (
            <ArchiveJobButton
              onPress={archiveJob}
              disabled={capturing || sheetOpen || deleting}
              busy={archiving}
            />
          )}
          <DeleteJobButton
            onPress={deleteJob}
            disabled={capturing || sheetOpen || archiving}
            busy={deleting}
          />
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
          workRows.map((row) => (
            <BeforeAfterPairCard
              key={row.key}
              before={row.before}
              after={row.after}
              signedByPath={signedByPath}
              onJobFinished={openJobFinished}
              finishDisabled={capturing || sheetOpen}
            />
          ))
        )}

        {notes.length > 0 ? (
          <>
            <Text style={styles.section}>Notes</Text>
            {notes.map((n) => (
              <View key={n.id} style={styles.photoCard}>
                <Text style={styles.photoLabel}>NOTE · {formatWhen(n.created_at)}</Text>
                <Text style={styles.noteBody}>{n.body}</Text>
                <Text style={styles.meta}>{n.author?.full_name || profile?.full_name || 'Unknown'}</Text>
              </View>
            ))}
          </>
        ) : null}

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
                    <Text style={styles.sheetTitle}>
                      {finishTarget ? 'Upload completion photo' : 'Upload photo'}
                    </Text>
                    <Text style={styles.sheetSub}>
                      {finishTarget
                        ? 'Add or edit the note, then upload. This photo is the completion shot, and the job is marked complete.'
                        : 'Add or edit the note, then upload. It is saved on this photo as the caption.'}
                    </Text>
                    <Image
                      source={{ uri: pendingUpload.localUri }}
                      style={styles.preview}
                      contentFit="contain"
                    />
                    <Text style={styles.fieldLabel}>Note</Text>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder={finishTarget ? 'Note for the completion photo…' : 'Note for this photo…'}
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
                        <Text style={styles.uploadBtnText}>
                          {finishTarget ? 'Upload and mark complete' : 'Upload photo'}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable onPress={closeSheet} style={styles.sheetCancel} disabled={capturing}>
                      <Text style={styles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : finishTarget ? (
                  <>
                    <Text style={styles.sheetTitle}>Mark complete</Text>
                    <Text style={styles.sheetSub}>
                      Take or upload a completion photo of the finished work. A note is optional.
                      This job is marked complete when the photo uploads. Cancel leaves the job unchanged.
                      {web ? ' On web, choose an image file if the camera is unavailable.' : ''}
                    </Text>
                    <Text style={styles.fieldLabel}>Note</Text>
                    <TextInput
                      style={styles.sheetInput}
                      placeholder="Note for the completion photo…"
                      placeholderTextColor={colors.muted}
                      value={photoNote}
                      onChangeText={setPhotoNote}
                      multiline
                    />
                    {web ? (
                      <Pressable
                        style={styles.sheetBtn}
                        onPress={() => runCapture('after', finishTarget.pairId, 'library')}
                      >
                        <Text style={styles.sheetBtnText}>Choose completion photo</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={styles.sheetBtn}
                      onPress={() => runCapture('after', finishTarget.pairId, 'camera')}
                    >
                      <Text style={styles.sheetBtnText}>
                        {web ? 'Camera or choose file' : 'Camera · completion'}
                      </Text>
                    </Pressable>
                    {web ? null : (
                      <Pressable
                        style={styles.sheetBtn}
                        onPress={() => runCapture('after', finishTarget.pairId, 'library')}
                      >
                        <Text style={styles.sheetBtnText}>Photo library · completion</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={closeSheet} style={styles.sheetCancel}>
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
                    <Pressable
                      style={styles.sheetBtn}
                      onPress={() => runCapture('general', null, 'camera')}
                      accessibilityRole="button"
                      accessibilityLabel="Use camera"
                    >
                      <Text style={styles.sheetBtnText}>Use camera</Text>
                    </Pressable>
                    <Pressable
                      style={styles.sheetBtn}
                      onPress={() => runCapture('general', null, 'library')}
                      accessibilityRole="button"
                      accessibilityLabel={web ? 'Choose from photos or files' : 'Choose from library'}
                    >
                      <Text style={styles.sheetBtnText}>
                        {web ? 'Choose from photos or files' : 'Choose from library'}
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
  jobNumber: {
    alignSelf: 'flex-start',
    backgroundColor: colors.navy,
    color: colors.gold,
    fontWeight: '900',
    fontSize: 22,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.navy },
  archivedNote: { marginTop: spacing.md, color: colors.muted, fontWeight: '700', textAlign: 'center' },
  addressRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  address: { flex: 1, color: colors.navyMid },
  mapsBtn: {
    flexShrink: 0,
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapsBtnText: { color: colors.gold, fontWeight: '800' },
  mapsHint: { marginTop: spacing.sm, color: colors.muted, fontSize: 13 },
  meta: { marginTop: 4, fontSize: 12, color: colors.muted },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerBackText: { color: colors.white, fontWeight: '700', fontSize: 16 },
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
  photoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  photoLabel: { fontSize: 11, fontWeight: '800', color: colors.gold, marginBottom: 6 },
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
