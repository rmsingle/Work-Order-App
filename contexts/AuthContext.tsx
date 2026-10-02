import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { phoneToLoginEmail } from '@/lib/phoneAuth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPhonePassword: (phone: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('profile load', error.message);
      setProfile(null);
      return;
    }
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithPhonePassword = useCallback(
    async (phone: string, password: string) => {
      await signInWithEmail(phoneToLoginEmail(phone), password);
    },
    [signInWithEmail]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
    },
    []
  );

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({ phone });
    if (error) throw error;
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await getSupabase().auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [loadProfile, session?.user]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithEmail,
      signInWithPhonePassword,
      signUpWithEmail,
      signInWithPhone,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signInWithEmail,
      signInWithPhonePassword,
      signUpWithEmail,
      signInWithPhone,
      verifyPhoneOtp,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
