import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
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

export default function JobsListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { signOut, profile, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: qErr } = await getSupabase()
        .from('jobs')
        .select('id, title, property_address, status, created_by, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (qErr) throw qErr;
      setJobs((data as Job[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => setNewOpen(true)} style={{ paddingHorizontal: 10 }}>
            <Text style={{ color: colors.gold, fontWeight: '800' }}>New</Text>
          </Pressable>
          <Pressable onPress={() => signOut().catch(() => undefined)} style={{ paddingHorizontal: 12 }}>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>Sign out</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, signOut]);

  async function createJob() {
    const title = newTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Enter a job title.');
      return;
    }
    setSaving(true);
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
      setNewOpen(false);
      setNewTitle('');
      setNewAddress('');
      await load();
      if (data?.id) {
        router.push(`/(app)/jobs/${data.id}`);
      }
    } catch (e) {
      Alert.alert('Could not create job', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
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
      <View style={styles.hello}>
        <Text style={styles.helloText}>
          {profile?.full_name ? `Hi, ${profile.full_name}` : 'PSG jobs'}
        </Text>
        <Text style={styles.helloSub}>Photos + notes on each property job</Text>
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
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptyBody}>
              Tap New (top right) to create a job with a title and property address, or run the SQL
              seed. Pull to refresh.
            </Text>
            <Pressable style={styles.newBtn} onPress={() => setNewOpen(true)}>
              <Text style={styles.newBtnText}>New Job</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(app)/jobs/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.address} numberOfLines={2}>
              {item.property_address || 'No address'}
            </Text>
            <Text style={styles.meta}>Updated {formatWhen(item.updated_at)}</Text>
          </Pressable>
        )}
      />

      <Modal
        visible={newOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNewOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setNewOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>New Job</Text>
            <Text style={styles.sheetSub}>Title and property address for this site.</Text>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HVAC filter — Gilmer"
              placeholderTextColor={colors.muted}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Property address</Text>
            <TextInput
              style={styles.input}
              placeholder="Street, city, state"
              placeholderTextColor={colors.muted}
              value={newAddress}
              onChangeText={setNewAddress}
            />
            <Pressable
              style={[styles.primaryBtn, (saving || !newTitle.trim()) && styles.disabled]}
              onPress={createJob}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <Text style={styles.primaryBtnText}>Create job</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setNewOpen(false)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hello: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  helloText: { fontSize: 18, fontWeight: '800', color: colors.navy },
  helloSub: { color: colors.muted, marginTop: 2 },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.navy },
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
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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
  disabled: { opacity: 0.5 },
  sheetCancel: { paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm },
  sheetCancelText: { color: colors.muted, fontWeight: '700' },
});
