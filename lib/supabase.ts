import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Reject secret / service_role keys so they are never used from the app. */
function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(globalThis.atob(padded)) as { role?: string };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

export type SupabaseConfigError = 'missing' | 'placeholder' | 'privileged' | null;

export function getSupabaseConfigError(): SupabaseConfigError {
  if (!supabaseUrl || !supabaseAnonKey) return 'missing';
  if (supabaseUrl.includes('YOUR_PROJECT') || supabaseAnonKey.includes('YOUR_SUPABASE')) {
    return 'placeholder';
  }
  if (isPrivilegedKey(supabaseAnonKey)) return 'privileged';
  return null;
}

export const isSupabaseConfigured = getSupabaseConfigError() === null;

/** Web uses localStorage; native uses AsyncStorage for session persistence. */
const storage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve(null);
          return Promise.resolve(localStorage.getItem(key));
        },
        setItem: (key: string, value: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve();
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve();
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : AsyncStorage;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const envHints = {
  url: 'EXPO_PUBLIC_SUPABASE_URL',
  anonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  exampleUrl: 'https://YOUR_PROJECT_REF.supabase.co',
};
