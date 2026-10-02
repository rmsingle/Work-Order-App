import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { envHints, getSupabaseConfigError } from '@/lib/supabase';

export function ConfigureSupabase() {
  const configError = getSupabaseConfigError();
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

        {configError === 'privileged' ? (
          <Text style={styles.warn}>
            That value is a secret or service_role key. Replace it with the publishable key
            (sb_publishable_…) or the legacy anon key. Never put a secret key in this app.
          </Text>
        ) : null}

        <Text style={styles.section}>Where to find them</Text>
        <Text style={styles.body}>
          Supabase Dashboard → Connect, or Settings → API Keys. Copy the project URL and the
          publishable key (or legacy anon key) into .env. Do not copy the secret or service_role key.
        </Text>

        <Text style={styles.section}>Database and photos</Text>
        <Text style={styles.body}>
          SQL Editor: run <Text style={styles.mono}>supabase/migrations/001_init.sql</Text>, then{' '}
          <Text style={styles.mono}>002_storage_job_photos.sql</Text>. The second file creates the
          private job-photos bucket. Enable Email and Phone under Authentication → Providers. Phone
          also needs an SMS provider on that screen.
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
  warn: {
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.danger,
    fontWeight: '700',
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
