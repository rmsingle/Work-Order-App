import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { JobFinishedButton } from '@/components/JobFinishedButton';
import { colors, spacing } from '@/constants/theme';
import { photoDisplayUri } from '@/lib/photo-storage';
import type { JobPhoto } from '@/lib/types';

function uriFor(photo: JobPhoto | null, signedByPath: Readonly<Record<string, string>>): string | null {
  if (!photo) return null;
  return photoDisplayUri(photo, signedByPath);
}

function FittedPhoto({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  function onLoad(event: ImageLoadEventData) {
    const { width, height } = event.source;
    if (width > 0 && height > 0) setAspectRatio(width / height);
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { aspectRatio: aspectRatio ?? 4 / 3 }]}
      contentFit="contain"
      onLoad={onLoad}
    />
  );
}

export function BeforeAfterPairCard({
  before,
  after,
  signedByPath,
  onJobFinished,
  finishDisabled,
}: {
  before: JobPhoto | null;
  after: JobPhoto | null;
  signedByPath: Readonly<Record<string, string>>;
  onJobFinished?: (photo: JobPhoto) => void;
  finishDisabled?: boolean;
}) {
  const beforeUri = uriFor(before, signedByPath);
  const afterUri = uriFor(after, signedByPath);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.slot}>
          <Text style={[styles.label, { color: colors.before }]}>Original</Text>
          {beforeUri ? (
            <FittedPhoto uri={beforeUri} />
          ) : (
            <View style={[styles.image, styles.pendingSlot]}>
              <Text style={styles.placeholderText}>No original</Text>
            </View>
          )}
          {before?.caption ? <Text style={styles.caption}>{before.caption}</Text> : null}
        </View>

        <View style={styles.slot}>
          <Text style={[styles.label, { color: colors.after }]}>Completion</Text>
          {after ? (
            afterUri ? (
              <>
                <FittedPhoto uri={afterUri} />
                {after.caption ? <Text style={styles.caption}>{after.caption}</Text> : null}
              </>
            ) : (
              <View style={[styles.image, styles.pendingSlot]}>
                <Text style={styles.placeholderText}>Completion photo unavailable</Text>
              </View>
            )
          ) : before && onJobFinished ? (
            <View style={[styles.image, styles.pendingSlot]}>
              <JobFinishedButton
                onPress={() => onJobFinished(before)}
                disabled={finishDisabled}
                hint="Marks this job complete"
              />
            </View>
          ) : (
            <View style={[styles.image, styles.pendingSlot]}>
              <Text style={styles.placeholderText}>Awaiting completion</Text>
            </View>
          )}
        </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  slot: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  image: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.offWhite,
  },
  pendingSlot: {
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    padding: spacing.sm,
  },
  placeholderText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  caption: { marginTop: 6, fontSize: 13, lineHeight: 18, color: colors.navy },
});
