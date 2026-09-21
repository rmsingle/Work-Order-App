import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing } from '@/constants/theme';
import { resolvePhotoDisplayUri } from '@/lib/storage';
import type { JobPhoto } from '@/lib/types';

function Slot({
  label,
  photo,
  accent,
}: {
  label: string;
  photo: JobPhoto | null;
  accent: string;
}) {
  const [uri, setUri] = useState<string | null>(photo?.local_uri ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!photo) {
      setUri(null);
      return;
    }
    // Prefer local immediately for snappy UI, then upgrade to signed storage URL.
    setUri(photo.local_uri);
    resolvePhotoDisplayUri(photo).then((resolved) => {
      if (!cancelled && resolved) setUri(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);

  return (
    <View style={styles.slot}>
      <Text style={[styles.label, { color: accent }]}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>No {label.toLowerCase()}</Text>
        </View>
      )}
      {photo?.caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {photo.caption}
        </Text>
      ) : null}
    </View>
  );
}

export function BeforeAfterPairCard({
  before,
  after,
}: {
  before: JobPhoto | null;
  after: JobPhoto | null;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Before / After</Text>
      <View style={styles.row}>
        <Slot label="Before" photo={before} accent={colors.before} />
        <Slot label="After" photo={after} accent={colors.after} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.offWhite,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.muted, fontSize: 12 },
  caption: { marginTop: 6, fontSize: 12, color: colors.muted },
});
