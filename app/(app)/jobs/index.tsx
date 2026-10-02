import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  addDays,
  addMonths,
  BOARD_SECTION_INSET,
  boardChrome,
  buildJobDayColumns,
  buildMonthCells,
  formatBoardRange,
  formatMonthTitle,
  jobCardFace,
  localDayKey,
  MONDAY_FIRST_LABELS,
  splitRowWidths,
  startOfDay,
  WEEK_COLUMN_GAP,
  type DayColumn,
  type MonthCell,
} from '@/lib/job-board';
import { formatJobNumber, isMissingJobNumberColumn } from '@/lib/job-number';
import { getSupabase } from '@/lib/supabase';
import type { Job, JobStatus } from '@/lib/types';
import { colors, spacing } from '@/constants/theme';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const HEADER_SIDE = 104;

type BoardMode = 'week' | 'month';

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

function stripeColor(status: JobStatus) {
  if (status === 'done') return colors.success;
  if (status === 'in_progress') return colors.gold;
  if (status === 'cancelled') return colors.danger;
  return colors.navyMid;
}

function missingBoardColumn(message: string) {
  return /scheduled_on|invoice_ref/i.test(message);
}

export function JobListCard({
  job,
  onOpen,
}: {
  job: Job;
  onOpen: () => void;
}) {
  const face = jobCardFace(job);
  const numberLabel = formatJobNumber(job.job_number);
  return (
    <Pressable
      style={[styles.jobCard, { borderLeftColor: stripeColor(job.status) }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        numberLabel
          ? `Open ${numberLabel} ${face.unit} ${face.task}`
          : `Open ${face.unit} ${face.task}`
      }
    >
      <View style={styles.jobCardTop}>
        <Text style={styles.task} numberOfLines={2}>
          {face.task}
        </Text>
        <StatusBadge status={job.status} compact />
      </View>
      <Text style={styles.unit} numberOfLines={1}>
        {face.unit}
      </Text>
      <View style={styles.jobMeta}>
        <Text style={styles.place} numberOfLines={1}>
          {face.place}
        </Text>
        {numberLabel ? <Text style={styles.jobNum}>{numberLabel}</Text> : null}
      </View>
      {job.invoice_ref ? <Text style={styles.invoiced}>Invoiced</Text> : null}
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
  const [mode, setMode] = useState<BoardMode>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const today = useMemo(() => startOfDay(new Date()), [jobs]);
  const weekColumns = useMemo(
    () => buildJobDayColumns(jobs, anchor, today),
    [jobs, anchor, today]
  );
  const monthCells = useMemo(() => buildMonthCells(jobs, anchor, today), [jobs, anchor, today]);
  const rangeLabel = mode === 'week' ? formatBoardRange(weekColumns) : formatMonthTitle(anchor);
  const chrome = useMemo(() => boardChrome(windowWidth), [windowWidth]);
  const [measuredFrame, setMeasuredFrame] = useState(0);
  const gridWidth = Math.max(0, (measuredFrame || chrome.frameWidth) - BOARD_SECTION_INSET * 2);
  const web = Platform.OS === 'web';

  const load = useCallback(async () => {
    setError(null);
    try {
      const supabase = getSupabase();
      const active = await supabase
        .from('jobs')
        .select(
          'id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at, scheduled_on, invoice_ref'
        )
        .is('archived_at', null)
        .order('updated_at', { ascending: false });
      const archived = await supabase
        .from('jobs')
        .select(
          'id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at, scheduled_on, invoice_ref'
        )
        .not('archived_at', 'is', null)
        .order('job_number', { ascending: false });

      const boardMissing =
        missingBoardColumn(active.error?.message ?? '') ||
        missingBoardColumn(archived.error?.message ?? '');
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
      } else if (boardMissing) {
        const activeLegacy = await supabase
          .from('jobs')
          .select(
            'id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at'
          )
          .is('archived_at', null)
          .order('updated_at', { ascending: false });
        const archivedLegacy = await supabase
          .from('jobs')
          .select(
            'id, job_number, title, property_address, status, created_by, created_at, updated_at, archived_at'
          )
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

  function shift(direction: -1 | 1) {
    setAnchor((current) =>
      mode === 'month' ? addMonths(current, direction) : addDays(current, direction * 7)
    );
  }

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
      const scheduledOn = localDayKey(new Date());
      const withSchedule = await getSupabase()
        .from('jobs')
        .insert({
          title,
          property_address: newAddress.trim() || null,
          status: 'open',
          created_by: user?.id ?? null,
          scheduled_on: scheduledOn,
        })
        .select('id')
        .single();
      const inserted =
        withSchedule.error && missingBoardColumn(withSchedule.error.message)
          ? await getSupabase()
              .from('jobs')
              .insert({
                title,
                property_address: newAddress.trim() || null,
                status: 'open',
                created_by: user?.id ?? null,
              })
              .select('id')
              .single()
          : withSchedule;
      if (inserted.error) throw inserted.error;
      if (!inserted.data?.id) throw new Error('Job was not created.');
      const jobId = inserted.data.id;
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
      setAnchor(startOfDay(new Date()));
      setMode('week');
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

  function openJob(id: string) {
    router.push(`/(app)/jobs/${id}`);
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
      <View
        style={[
          styles.boardFrame,
          chrome.fitWeek
            ? { width: chrome.frameWidth, maxWidth: '100%', alignSelf: 'center' }
            : styles.boardFrameFull,
        ]}
        onLayout={(event) => {
          const next = Math.floor(event.nativeEvent.layout.width);
          setMeasuredFrame((current) => (current === next ? current : next));
        }}
      >
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
          Week at a glance. Open a card to add photos. Archived jobs are hidden from this board and
          listed below.
        </Text>
      </View>

      {error ? (
        <Pressable onPress={load} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.boardScroll}
        contentContainerStyle={styles.boardScrollContent}
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
      >
        <View style={styles.toolbar}>
          <View style={styles.rangeRow}>
            <Pressable
              style={styles.arrowBtn}
              onPress={() => shift(-1)}
              accessibilityRole="button"
              accessibilityLabel={mode === 'week' ? 'Previous week' : 'Previous month'}
            >
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>
            <Text style={styles.boardRange}>{rangeLabel}</Text>
            <Pressable
              style={styles.arrowBtn}
              onPress={() => shift(1)}
              accessibilityRole="button"
              accessibilityLabel={mode === 'week' ? 'Next week' : 'Next month'}
            >
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
            <Pressable
              style={styles.todayBtn}
              onPress={() => setAnchor(startOfDay(new Date()))}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>
          </View>
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeBtn, mode === 'week' && styles.modeBtnOn]}
              onPress={() => setMode('week')}
              accessibilityRole="button"
              accessibilityLabel="Week view"
            >
              <Text style={[styles.modeText, mode === 'week' && styles.modeTextOn]}>Week</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'month' && styles.modeBtnOn]}
              onPress={() => setMode('month')}
              accessibilityRole="button"
              accessibilityLabel="Month view"
            >
              <Text style={[styles.modeText, mode === 'month' && styles.modeTextOn]}>Month</Text>
            </Pressable>
          </View>
        </View>

        {jobs.length === 0 ? (
          <Text style={styles.boardEmpty}>
            {archivedJobs.length > 0
              ? 'No active jobs. Archived jobs are hidden from this list and shown below.'
              : 'No jobs yet. Tap New Job above. Empty days stay on the week board.'}
          </Text>
        ) : null}

        {mode === 'week' ? (
          <WeekBoard
            columns={weekColumns}
            fitWeek={chrome.fitWeek}
            scrollColumnWidth={chrome.scrollColumnWidth}
            onOpen={openJob}
          />
        ) : (
          <MonthBoard cells={monthCells} gridWidth={gridWidth} borderBox={web} onOpen={openJob} />
        )}

        {archivedJobs.length > 0 ? (
          <View style={styles.archivedBlock}>
            <Text style={styles.archivedTitle}>Archived</Text>
            <Text style={styles.archivedHint}>
              These jobs are off the active list. Open one to delete it.
            </Text>
            {archivedJobs.map((item) => (
              <View key={item.id} style={styles.archivedCard}>
                <JobListCard job={item} onOpen={() => openJob(item.id)} />
                <Text style={styles.meta}>Updated {formatWhen(item.updated_at)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      </View>

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
                Title and property address for this site. It lands on today. You can dump several
                photos now. They upload after the job is created.
              </Text>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. NC Unit 1103 — paint + vinyl"
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

function WeekBoard({
  columns,
  fitWeek,
  scrollColumnWidth,
  onOpen,
}: {
  columns: DayColumn<Job>[];
  fitWeek: boolean;
  scrollColumnWidth: number;
  onOpen: (id: string) => void;
}) {
  const days = columns.map((column) => (
    <View
      key={column.key}
      style={[
        styles.column,
        fitWeek ? styles.columnFit : { width: scrollColumnWidth },
        column.isToday && styles.columnToday,
      ]}
    >
      <View style={styles.columnHeader}>
        <Text style={[styles.colWeekday, column.isToday && styles.colWeekdayToday]}>
          {column.weekday}
        </Text>
        <Text style={styles.colDay}>{column.dayNum}</Text>
        <Text style={[styles.colMonth, column.isToday && styles.todayPill]}>
          {column.isToday ? 'Today' : column.monthLabel}
        </Text>
      </View>
      {column.jobs.length === 0 ? (
        <Text style={styles.columnEmpty}>No jobs</Text>
      ) : (
        column.jobs.map((item) => (
          <JobListCard key={item.id} job={item} onOpen={() => onOpen(item.id)} />
        ))
      )}
    </View>
  ));

  if (fitWeek) {
    return <View style={[styles.boardContent, styles.boardContentFit]}>{days}</View>;
  }

  return (
    <View style={styles.dayScrollerClip}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        style={styles.dayScroller}
        contentContainerStyle={styles.boardContent}
      >
        {days}
      </ScrollView>
    </View>
  );
}

function MonthBoard({
  cells,
  gridWidth,
  borderBox,
  onOpen,
}: {
  cells: MonthCell<Job>[];
  gridWidth: number;
  borderBox: boolean;
  onOpen: (id: string) => void;
}) {
  const outset = borderBox ? 0 : 4;
  const widths = splitRowWidths(gridWidth, MONDAY_FIRST_LABELS.length, outset);
  return (
    <View style={styles.monthInset}>
      <View style={styles.monthWrap}>
        <View style={styles.monthHead}>
          {MONDAY_FIRST_LABELS.map((label, index) => (
            <Text key={label} style={[styles.monthHeadText, { width: (widths[index] ?? 0) + outset }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {cells.map((cell, index) => (
            <View
              key={cell.key}
              style={[
                styles.monthCell,
                { width: widths[index % widths.length] },
                !cell.inMonth && styles.monthCellOut,
                cell.isToday && styles.monthCellToday,
              ]}
            >
              <Text style={[styles.monthDay, cell.isToday && styles.monthDayToday]}>{cell.dayNum}</Text>
              {cell.jobs.map((job) => {
                const face = jobCardFace(job);
                return (
                  <Pressable
                    key={job.id}
                    style={[styles.monthChip, { borderLeftColor: stripeColor(job.status) }]}
                    onPress={() => onOpen(job.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${face.unit} ${face.task}`}
                  >
                    <Text style={styles.monthChipText} numberOfLines={2}>
                      {face.unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite, width: '100%', overflow: 'hidden' },
  boardFrame: { flex: 1, maxWidth: '100%' },
  boardFrameFull: { width: '100%', alignSelf: 'stretch' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hello: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  helloText: { fontSize: 18, fontWeight: '800', color: colors.navy },
  helloSub: { color: colors.muted, marginTop: 2, lineHeight: 18 },
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
  boardScroll: { flex: 1 },
  boardScrollContent: { paddingBottom: spacing.xl, width: '100%' },
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: colors.navy, fontSize: 22, fontWeight: '700', marginTop: -2 },
  boardRange: { flex: 1, color: colors.navy, fontWeight: '800', fontSize: 16 },
  todayBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  todayBtnText: { color: colors.navy, fontWeight: '800', fontSize: 13 },
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  modeBtnOn: { backgroundColor: colors.navy },
  modeText: { color: colors.navy, fontWeight: '800' },
  modeTextOn: { color: colors.gold },
  boardEmpty: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  dayScrollerClip: { width: '100%', overflow: 'hidden' },
  dayScroller: { flexGrow: 0, width: '100%' },
  boardContent: {
    flexDirection: 'row',
    gap: WEEK_COLUMN_GAP,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'flex-start',
  },
  boardContentFit: {
    width: '100%',
  },
  column: {
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
    borderRadius: 14,
    padding: 8,
    minHeight: 280,
  },
  columnFit: { flex: 1 },
  columnToday: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  columnHeader: { alignItems: 'center', marginBottom: spacing.sm, paddingBottom: spacing.xs },
  colWeekday: { color: colors.muted, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  colWeekdayToday: { color: colors.navy },
  colDay: { color: colors.navy, fontWeight: '900', fontSize: 28, lineHeight: 32 },
  colMonth: { color: colors.navyMid, fontWeight: '700', fontSize: 12 },
  todayPill: {
    color: colors.navy,
    backgroundColor: colors.gold,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: '800',
  },
  columnEmpty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  jobCardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  task: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', color: colors.navy, lineHeight: 18 },
  unit: { marginTop: 6, fontSize: 15, fontWeight: '800', color: colors.navy },
  jobMeta: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  place: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12, fontWeight: '700' },
  jobNum: { color: colors.navy, fontWeight: '900', fontSize: 12 },
  invoiced: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#E8EEF7',
    color: colors.navy,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  monthInset: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, width: '100%' },
  monthWrap: { width: '100%' },
  monthHead: { flexDirection: 'row' },
  monthHeadText: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    paddingBottom: 6,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: {
    minHeight: 92,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 4,
    overflow: 'hidden',
  },
  monthCellOut: { backgroundColor: '#EEF2F6' },
  monthCellToday: { borderColor: colors.gold },
  monthDay: { color: colors.navy, fontWeight: '800', fontSize: 12, marginBottom: 2 },
  monthDayToday: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  monthChip: {
    backgroundColor: colors.offWhite,
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 3,
  },
  monthChipText: { color: colors.navy, fontSize: 10, fontWeight: '800' },
  archivedBlock: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
  archivedTitle: { fontSize: 16, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  archivedHint: { color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
  archivedCard: { marginBottom: spacing.sm },
  meta: { marginTop: 2, fontSize: 12, color: colors.muted },
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
