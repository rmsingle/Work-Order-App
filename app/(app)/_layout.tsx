import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ConfigureSupabase } from '@/components/ConfigureSupabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/constants/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (!isSupabaseConfigured) return <ConfigureSupabase />;
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Stack.Screen name="jobs/index" options={{ title: 'Jobs' }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Job' }} />
    </Stack>
  );
}
