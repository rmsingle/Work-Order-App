import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';

export function JobFinishedButton({
  onPress,
  disabled,
  hint,
}: {
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.btn, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Mark complete. Marks this job complete after a completion photo."
      >
        <Text style={styles.text}>Mark complete</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  text: { color: colors.gold, fontWeight: '900', fontSize: 13, textAlign: 'center' },
  hint: { marginTop: 4, fontSize: 11, color: colors.muted, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
