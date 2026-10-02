import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { JobStatus } from '@/lib/types';

const labels: Record<JobStatus, string> = {
  open: 'Pending',
  in_progress: 'In progress',
  done: 'Completed',
  cancelled: 'Cancelled',
};

const tones: Record<JobStatus, { bg: string; fg: string }> = {
  open: { bg: '#E8EEF7', fg: colors.navy },
  in_progress: { bg: '#FFF4D6', fg: '#8A6A00' },
  done: { bg: '#E3F6EC', fg: colors.success },
  cancelled: { bg: '#FDECEC', fg: colors.danger },
};

export function StatusBadge({ status, compact }: { status: JobStatus; compact?: boolean }) {
  const tone = tones[status] ?? tones.open;
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, compact && styles.textCompact, { color: tone.fg }]}>
        {labels[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeCompact: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '700' },
  textCompact: { fontSize: 11 },
});
