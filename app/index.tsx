import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ConfigureSupabase } from '@/components/ConfigureSupabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/constants/theme';

export default function Index() {
  const { session, loading } = useAuth();

  if (!isSupabaseConfigured) return <ConfigureSupabase />;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  if (session) return <Redirect href="/(app)/jobs" />;
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
});
