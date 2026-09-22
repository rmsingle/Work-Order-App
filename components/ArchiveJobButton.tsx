import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';

export function ArchiveJobButton({
  onPress,
  disabled,
  busy,
}: {
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.btn, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel="Archive job"
      >
        {busy ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <Text style={styles.text}>Archive job</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>Archived jobs stay off the Jobs list.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: { color: colors.gold, fontWeight: '900', fontSize: 16, textAlign: 'center' },
  hint: { marginTop: 6, fontSize: 12, color: colors.muted, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
