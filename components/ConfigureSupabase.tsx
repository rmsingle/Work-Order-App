import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { envHints } from '@/lib/supabase';

export function ConfigureSupabase() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.badge}>Setup required</Text>
        <Text style={styles.title}>Configure Supabase</Text>
        <Text style={styles.body}>
          PSG Job Tracker needs your Supabase project credentials before login or jobs will work.
          Create a file named <Text style={styles.mono}>.env</Text> in the project root (copy from{' '}
          <Text style={styles.mono}>.env.example</Text>) with:
        </Text>

        <View style={styles.card}>
          <Text style={styles.mono}>
            {envHints.url}={envHints.exampleUrl}
          </Text>
          <Text style={[styles.mono, { marginTop: spacing.sm }]}>
            {envHints.anonKey}=YOUR_SUPABASE_ANON_KEY
          </Text>
        </View>

        <Text style={styles.section}>Where to find them</Text>
        <Text style={styles.body}>
          Supabase Dashboard → Project Settings → API → Project URL and anon/public key.
        </Text>

        <Text style={styles.section}>Database</Text>
        <Text style={styles.body}>
          Paste <Text style={styles.mono}>supabase/migrations/001_init.sql</Text> into the Supabase
          SQL Editor and run it (profiles, jobs, job_notes, job_photos, RLS, seed).
        </Text>

        <Text style={styles.section}>Then</Text>
        <Text style={styles.body}>
          Restart Metro with <Text style={styles.mono}>npx expo start</Text> so env vars reload.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    color: colors.navy,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.navyMid },
  mono: {
    fontFamily: 'monospace',
    color: colors.navy,
    fontWeight: '600',
  },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
});
