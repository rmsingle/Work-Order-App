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

type Mode = 'email' | 'phone';
type EmailMode = 'signin' | 'signup';

export default function LoginScreen() {
  const {
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithPhone,
    verifyPhoneOtp,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('email');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isSupabaseConfigured) return <ConfigureSupabase />;
  if (!loading && session) return <Redirect href="/(app)/jobs" />;

  async function onEmailSubmit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (emailMode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        if (!fullName.trim()) throw new Error('Full name is required to sign up.');
        await signUpWithEmail(email.trim(), password, fullName.trim());
        setInfo('Check your email to confirm (if enabled), then sign in.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSendOtp() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithPhone(phone.trim());
      setOtpSent(true);
      setInfo('SMS code sent. Enter the OTP below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp() {
    setError(null);
    setBusy(true);
    try {
      await verifyPhoneOtp(phone.trim(), otp.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
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

          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, mode === 'email' && styles.tabActive]}
              onPress={() => setMode('email')}
            >
              <Text style={[styles.tabText, mode === 'email' && styles.tabTextActive]}>Email</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'phone' && styles.tabActive]}
              onPress={() => setMode('phone')}
            >
              <Text style={[styles.tabText, mode === 'phone' && styles.tabTextActive]}>Phone</Text>
            </Pressable>
          </View>

          {mode === 'email' ? (
            <View style={styles.form}>
              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tabSmall, emailMode === 'signin' && styles.tabActive]}
                  onPress={() => setEmailMode('signin')}
                >
                  <Text style={[styles.tabText, emailMode === 'signin' && styles.tabTextActive]}>
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabSmall, emailMode === 'signup' && styles.tabActive]}
                  onPress={() => setEmailMode('signup')}
                >
                  <Text style={[styles.tabText, emailMode === 'signup' && styles.tabTextActive]}>
                    Sign up
                  </Text>
                </Pressable>
              </View>
              {emailMode === 'signup' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={colors.muted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.primary} onPress={onEmailSubmit} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={colors.navy} />
                ) : (
                  <Text style={styles.primaryText}>
                    {emailMode === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.hint}>
                E.164 format (e.g. +13365551234). Enable Phone auth in Supabase.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="+1 phone number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              {!otpSent ? (
                <Pressable style={styles.primary} onPress={onSendOtp} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={colors.navy} />
                  ) : (
                    <Text style={styles.primaryText}>Send code</Text>
                  )}
                </Pressable>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="SMS code"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                  />
                  <Pressable style={styles.primary} onPress={onVerifyOtp} disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color={colors.navy} />
                    ) : (
                      <Text style={styles.primaryText}>Verify & sign in</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
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
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.navyMid,
    alignItems: 'center',
  },
  tabSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.offWhite,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.gold },
  tabText: { color: colors.white, fontWeight: '700' },
  tabTextActive: { color: colors.navy },
  form: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.md },
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
  hint: { color: colors.muted, marginBottom: spacing.sm, fontSize: 13, lineHeight: 18 },
  error: { color: '#FFB4A8', marginTop: spacing.md },
  info: { color: colors.goldSoft, marginTop: spacing.md },
});
