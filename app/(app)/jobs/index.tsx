import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { captureFromCamera, pickManyFromLibrary } from '@/lib/photos';
import { captionFromNote } from '@/lib/photo-storage';
import { removeJobPhoto, uploadJobPhoto } from '@/lib/storage';
import { showMessage } from '@/lib/dialog';
import { formatJobNumber, isMissingJobNumberColumn } from '@/lib/job-number';
import { getSupabase } from '@/lib/supabase';
import type { Job } from '@/lib/types';
import { colors, spacing } from '@/constants/theme';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const HEADER_SIDE = 104;

type DraftJobPhoto = {
  id: string;
  localUri: string;
  mimeType: string | null;
  lat: number | null;
  lng: number | null;
};

function draftFromCapture(photo: {
  localUri: string;
  mimeType: string | null;
  lat: number | null;
  lng: number | null;
}): DraftJobPhoto {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    localUri: photo.localUri,
    mimeType: photo.mimeType,
    lat: photo.lat,
    lng: photo.lng,
  };
}

export function JobListCard({
  jobNumber,
  title,
  address,
  updatedLabel,
  status,
  onOpen,
}: {
  jobNumber: number | null | undefined;
  title: string;
  address: string | null;
  updatedLabel: string;
  status: Job['status'];
  onOpen: () => void;
}) {
  const numberLabel = formatJobNumber(jobNumber);
  return (
    <Pressable
      style={styles.card}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={numberLabel ? `Open job ${numberLabel} ${title}` : `Open ${title}`}
    >
      <View style={styles.cardTop}>
        {numberLabel ? (
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{numberLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
        <StatusBadge status={status} />
      </View>
      <Text style={styles.address} numberOfLines={2}>
        {address || 'No address'}
      </Text>
      <Text style={styles.meta}>Updated {updatedLabel}</Text>
    </Pressable>
  );
}

export default function JobsListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { signOut, profile, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [archivedJobs, setArchivedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<DraftJobPhoto[]>([]);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const web = Platform.OS === 'web';

  const load = useCallback(async () => {
    setError(null);
    try {
      const supabase = getSupabase();
      const active = await supabase
        .from('jobs')
        .select('id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false });
      const archived = await supabase
        .from('jobs')
        .select('id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at')
        .not('archived_at', 'is', null)
        .order('job_number', { ascending: false });

      const missingNumber =
        isMissingJobNumberColumn(active.error?.message ?? '') ||
        isMissingJobNumberColumn(archived.error?.message ?? '');

      if (missingNumber) {
        const activeLegacy = await supabase
          .from('jobs')
          .select('id, title, property_address, status, created_by, created_at, updated_at, archived_at')
          .is('archived_at', null)
          .order('updated_at', { ascending: false });
        const archivedLegacy = await supabase
          .from('jobs')
          .select('id, title, property_address, status, created_by, created_at, updated_at, archived_at')
          .not('archived_at', 'is', null)
          .order('updated_at', { ascending: false });
        if (activeLegacy.error) throw activeLegacy.error;
        if (archivedLegacy.error) throw archivedLegacy.error;
        setJobs((activeLegacy.data as Job[]) ?? []);
        setArchivedJobs((archivedLegacy.data as Job[]) ?? []);
      } else {
        if (active.error) throw active.error;
        if (archived.error) throw archived.error;
        setJobs((active.data as Job[]) ?? []);
        setArchivedJobs((archived.data as Job[]) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Jobs',
      headerTitleAlign: 'center',
      headerLeft: () => <View style={{ width: HEADER_SIDE }} />,
      headerRight: () => (
        <View style={{ width: HEADER_SIDE, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Pressable
            onPress={() => signOut().catch(() => undefined)}
            style={styles.signOutBtn}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, signOut]);

  async function addLibraryPhotos() {
    try {
      const picked = await pickManyFromLibrary({ kind: 'general' });
      if (picked.length === 0) return;
      setDraftPhotos((current) => [...current, ...picked.map(draftFromCapture)]);
    } catch (e) {
      showMessage('Could not add photos', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function addCameraPhoto() {
    try {
      const captured = await captureFromCamera({ kind: 'general' });
      if (!captured) return;
      setDraftPhotos((current) => [...current, draftFromCapture(captured)]);
    } catch (e) {
      showMessage('Could not add photos', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function closeNewJob() {
    if (saving) return;
    setNewOpen(false);
  }

  async function createJob() {
    const title = newTitle.trim();
    if (!title) {
      showMessage('Title required', 'Enter a job title.');
      return;
    }
    if (!user) return;
    setSaving(true);
    setCreateStatus('Creating job…');
    let createdJobId: string | null = null;
    const pending = draftPhotos;
    try {
      const { data, error: insErr } = await getSupabase()
        .from('jobs')
        .insert({
          title,
          property_address: newAddress.trim() || null,
          status: 'open',
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      if (!data?.id) throw new Error('Job was not created.');
      const jobId = data.id;
      createdJobId = jobId;

      const failures: string[] = [];
      for (let index = 0; index < pending.length; index += 1) {
        const photo = pending[index];
        setCreateStatus(`Uploading photo ${index + 1} of ${pending.length}…`);
        try {
          const storagePath = await uploadJobPhoto({
            jobId,
            localUri: photo.localUri,
            mimeType: photo.mimeType,
          });
          const { error: photoErr } = await getSupabase().from('job_photos').insert({
            job_id: jobId,
            local_uri: null,
            storage_path: storagePath,
            lat: photo.lat,
            lng: photo.lng,
            caption: captionFromNote(null),
            kind: 'general',
            pair_id: null,
            created_by: user.id,
          });
          if (photoErr) {
            await removeJobPhoto(storagePath).catch(() => undefined);
            throw photoErr;
          }
        } catch (e) {
          failures.push(e instanceof Error ? e.message : 'Upload failed');
        }
      }

      setNewOpen(false);
      setNewTitle('');
      setNewAddress('');
      setDraftPhotos([]);
      await load();
      if (failures.length > 0) {
        const saved = pending.length - failures.length;
        showMessage(
          'Job created, photos incomplete',
          `The job was created. ${saved} of ${pending.length} photos uploaded. ${failures.length} could not be uploaded. ${failures[0]}`
        );
      }
      router.push(`/(app)/jobs/${createdJobId}`);
    } catch (e) {
      if (createdJobId) {
        setNewOpen(false);
        setNewTitle('');
        setNewAddress('');
        setDraftPhotos([]);
        await load();
        showMessage(
          'Job created, photos incomplete',
          `The job was created, but the photos could not be finished. ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        router.push(`/(app)/jobs/${createdJobId}`);
      } else {
        showMessage('Could not create job', e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setSaving(false);
      setCreateStatus(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Pressable
        style={styles.newJobBtn}
        onPress={() => setNewOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="New job"
      >
        <Text style={styles.newJobBtnText}>New Job</Text>
      </Pressable>
      <View style={styles.hello}>
        <Text style={styles.helloText}>
          {profile?.full_name ? `Hi, ${profile.full_name}` : 'PSG jobs'}
        </Text>
        <Text style={styles.helloSub}>
          Open a job to add photos and notes. Archived jobs are hidden from this list and shown
          below.
        </Text>
      </View>

      {error ? (
        <Pressable onPress={load} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.navy}
          />
        }
        contentContainerStyle={jobs.length === 0 ? styles.emptyWrap : styles.list}
        ListEmptyComponent={
          archivedJobs.length > 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No active jobs</Text>
              <Text style={styles.emptyBody}>Archived jobs are hidden from this list and shown below.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptyBody}>
                Tap New Job above to create a job with a title, address, and photos, or run the SQL
                seed. Pull to refresh.
              </Text>
              <Pressable style={styles.newBtn} onPress={() => setNewOpen(true)}>
                <Text style={styles.newBtnText}>New Job</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          archivedJobs.length > 0 ? (
            <View style={styles.archivedBlock}>
              <Text style={styles.archivedTitle}>Archived</Text>
              <Text style={styles.archivedHint}>
                These jobs are off the active list. Open one to delete it.
              </Text>
              {archivedJobs.map((item) => (
                <JobListCard
                  key={item.id}
                  jobNumber={item.job_number}
                  title={item.title}
                  address={item.property_address}
                  updatedLabel={formatWhen(item.updated_at)}
                  status={item.status}
                  onOpen={() => router.push(`/(app)/jobs/${item.id}`)}
                />
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <JobListCard
            jobNumber={item.job_number}
            title={item.title}
            address={item.property_address}
            updatedLabel={formatWhen(item.updated_at)}
            status={item.status}
            onOpen={() => router.push(`/(app)/jobs/${item.id}`)}
          />
        )}
      />

      <Modal visible={newOpen} transparent animationType="slide" onRequestClose={closeNewJob}>
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.dismissLayer}
            onPress={closeNewJob}
            accessibilityLabel="Dismiss new job"
          />
          <View style={styles.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={{ maxHeight: Math.round(windowHeight * 0.8) }}
            >
              <Text style={styles.sheetTitle}>New Job</Text>
              <Text style={styles.sheetSub}>
                Title and property address for this site. You can dump several photos now. They
                upload after the job is created. A note on each photo can wait until you are in the job.
              </Text>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. HVAC filter — Gilmer"
                placeholderTextColor={colors.muted}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
                editable={!saving}
              />
              <Text style={styles.fieldLabel}>Property address</Text>
              <TextInput
                style={styles.input}
                placeholder="Street, city, state"
                placeholderTextColor={colors.muted}
                value={newAddress}
                onChangeText={setNewAddress}
                editable={!saving}
              />
              <Text style={styles.fieldLabel}>Photos</Text>
              <View style={styles.photoActions}>
                <Pressable
                  style={[styles.photoPickBtn, saving && styles.disabled]}
                  onPress={addLibraryPhotos}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Choose photos"
                >
                  <Text style={styles.photoPickBtnText}>Choose photos</Text>
                </Pressable>
                <Pressable
                  style={[styles.photoPickBtn, saving && styles.disabled]}
                  onPress={addCameraPhoto}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={web ? 'Camera or choose file' : 'Camera'}
                >
                  <Text style={styles.photoPickBtnText}>{web ? 'Camera or file' : 'Camera'}</Text>
                </Pressable>
              </View>
              {draftPhotos.length > 0 ? (
                <>
                  <Text style={styles.photoCount}>
                    {draftPhotos.length} photo{draftPhotos.length === 1 ? '' : 's'} ready
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                    {draftPhotos.map((photo) => (
                      <View key={photo.id} style={styles.photoChip}>
                        <Image
                          source={{ uri: photo.localUri }}
                          style={styles.photoThumb}
                          contentFit="contain"
                        />
                        <Pressable
                          onPress={() =>
                            setDraftPhotos((current) => current.filter((item) => item.id !== photo.id))
                          }
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityLabel="Remove photo"
                        >
                          <Text style={styles.removePhoto}>Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <Text style={styles.photoHint}>No photos yet. Choose several from your library, or take one.</Text>
              )}
              <Pressable
                style={[styles.primaryBtn, (saving || !newTitle.trim()) && styles.disabled]}
                onPress={createJob}
                disabled={saving || !newTitle.trim()}
              >
                {saving ? (
                  <ActivityIndicator color={colors.navy} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {draftPhotos.length > 0 ? 'Create job and upload photos' : 'Create job'}
                  </Text>
                )}
              </Pressable>
              {createStatus ? <Text style={styles.progress}>{createStatus}</Text> : null}
              <Pressable onPress={closeNewJob} style={styles.sheetCancel} disabled={saving}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hello: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  helloText: { fontSize: 18, fontWeight: '800', color: colors.navy },
  helloSub: { color: colors.muted, marginTop: 2 },
  newJobBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  newJobBtnText: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  signOutText: { color: colors.gold, fontWeight: '700' },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  empty: { alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.navy },
  emptyBody: { marginTop: spacing.sm, textAlign: 'center', color: colors.muted, lineHeight: 20 },
  newBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  newBtnText: { color: colors.navy, fontWeight: '900' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  numberBadge: {
    backgroundColor: colors.navy,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  numberText: { color: colors.gold, fontWeight: '900', fontSize: 16 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.navy },
  archivedBlock: { marginTop: spacing.lg },
  archivedTitle: { fontSize: 16, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  archivedHint: { color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
  address: { marginTop: spacing.sm, color: colors.navyMid },
  meta: { marginTop: spacing.xs, fontSize: 12, color: colors.muted },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
  },
  errorText: { color: colors.danger },
  retry: { marginTop: 6, fontWeight: '700', color: colors.navy },
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
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    zIndex: 2,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: colors.navy },
  sheetSub: { color: colors.muted, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  fieldLabel: { fontWeight: '700', color: colors.navy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.offWhite,
    color: colors.navy,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.navy, fontWeight: '900' },
  photoActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  photoPickBtn: {
    flex: 1,
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoPickBtnText: { color: colors.gold, fontWeight: '800' },
  photoCount: { color: colors.navy, fontWeight: '700', marginBottom: spacing.sm },
  photoHint: { color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  photoStrip: { marginBottom: spacing.md },
  photoChip: { marginRight: spacing.sm, width: 84 },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removePhoto: { marginTop: 4, color: colors.danger, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  progress: { marginTop: spacing.sm, color: colors.navy, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  sheetCancel: { paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm },
  sheetCancelText: { color: colors.muted, fontWeight: '700' },
});
