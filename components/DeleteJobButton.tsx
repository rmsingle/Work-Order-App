import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';

export function DeleteJobButton({
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
        accessibilityLabel="Delete job"
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.text}>Delete job</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>Permanently removes the job, its photos, and its notes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  btn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: { color: colors.white, fontWeight: '900', fontSize: 16, textAlign: 'center' },
  hint: { marginTop: 6, fontSize: 12, color: colors.muted, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
