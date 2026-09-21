import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
  const { signOut, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Pressable onPress={() => signOut().catch(() => undefined)} style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: colors.gold, fontWeight: '700' }}>Sign out</Text>
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

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
              Run the SQL migration seed, or insert jobs in Supabase. Pull to refresh.
            </Text>
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
});
