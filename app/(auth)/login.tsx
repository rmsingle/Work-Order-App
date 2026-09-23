import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ConfigureSupabase } from '@/components/ConfigureSupabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing } from '@/constants/theme';

type Mode = 'phone' | 'email';

export default function LoginScreen() {
  const { session, loading, signInWithEmail, signInWithPhonePassword } = useAuth();

  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured) return <ConfigureSupabase />;
  if (!loading && session) return <Redirect href="/(app)/jobs" />;

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'phone') {
        await signInWithPhonePassword(phone, password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>PSG</Text>
          <Text style={styles.title}>Job Tracker</Text>
          <Text style={styles.sub}>Property Services Group LLC · Winston-Salem, NC</Text>

          <View style={styles.form}>
            {mode === 'phone' ? (
              <>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="336-546-2585"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  value={phone}
                  onChangeText={setPhone}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                />
              </>
            )}
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.primary} onPress={onSubmit} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <Text style={styles.primaryText}>Sign in</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.escape}
              onPress={() => {
                setError(null);
                setMode(mode === 'phone' ? 'email' : 'phone');
              }}
              accessibilityRole="button"
              accessibilityLabel={mode === 'phone' ? 'Sign in with email' : 'Sign in with phone'}
            >
              <Text style={styles.escapeText}>
                {mode === 'phone' ? 'Sign in with email' : 'Sign in with phone'}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  brand: { color: colors.gold, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.white, fontSize: 34, fontWeight: '800', marginTop: 4 },
  sub: { color: '#A8B7CC', marginTop: spacing.sm, marginBottom: spacing.lg },
  form: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.md },
  label: { color: colors.navy, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    color: colors.navy,
    backgroundColor: colors.offWhite,
  },
  primary: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  escape: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 6 },
  escapeText: { color: colors.navyMid, fontWeight: '700' },
  error: { color: '#FFB4A8', marginTop: spacing.md },
});
