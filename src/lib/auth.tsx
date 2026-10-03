import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { clearLocalData, purgeOtherUsers } from '@/lib/db';
import { invalidateProfile } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/db';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  /** Id of the most recent signed-in user; survives the render after sign-out. */
  lastUserId: string;
  profile: Profile | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, username: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: (opts?: { keepLocal?: boolean }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [lastUserId, setLastUserId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // The profile is cached on device so an offline launch still has a name, home and settings.
  const loadProfile = useCallback(async (userId: string) => {
    const key = `profile:${userId}`;
    try {
      const cached = await Storage.getItemAsync(key);
      if (cached) setProfile(JSON.parse(cached) as Profile);
    } catch {
      // ignore a corrupt cache
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      Storage.setItemAsync(key, JSON.stringify(data)).catch(() => {});
    }
  }, []);

  // Retry the profile fetch when connectivity returns.
  useEffect(() => {
    if (!session || profile) return;
    const sub = Network.addNetworkStateListener((s) => {
      if (s.isConnected) loadProfile(session.user.id);
    });
    return () => sub.remove();
  }, [session, profile, loadProfile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        if (data.session) {
          setLastUserId(data.session.user.id);
          await loadProfile(data.session.user.id);
        }
      } catch {
        // A broken session store must not strand the user on the splash screen.
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        setLastUserId(next.user.id);
        purgeOtherUsers(next.user.id);
        loadProfile(next.user.id);
      } else setProfile(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim().toLowerCase() } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') throw new Error('Sign in with Apple is only available on iOS.');
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) throw error;
    // Apple only sends the name on the first sign-in; keep it.
    const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName) : '';
    if (name) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
        await loadProfile(data.user.id);
      }
    }
  }, [loadProfile]);

  // Google via Supabase's hosted OAuth flow in a system browser, returning on the app scheme.
  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const params = parseAuthParams(result.url);
    if (params.code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
      if (exErr) throw exErr;
    } else if (params.error_description) {
      throw new Error(params.error_description);
    }
  }, []);

  /** Sign out. Local data is wiped unless unsynced sightings would be lost (`keepLocal`). */
  const signOut = useCallback(
    async (opts: { keepLocal?: boolean } = {}) => {
      if (!opts.keepLocal) clearLocalData();
      if (session) Storage.removeItemAsync(`profile:${session.user.id}`).catch(() => {});
      await supabase.auth.signOut();
    },
    [session],
  );

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('auth/callback') });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!session) return;
      const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
      if (error) throw error;
      invalidateProfile(session.user.id);
      await loadProfile(session.user.id);
    },
    [session, loadProfile],
  );

  const value = useMemo(
    () => ({ session, lastUserId, profile, loading, signInWithPassword, signUpWithPassword, signInWithApple, signInWithGoogle, signOut, resetPassword, refreshProfile, updateProfile }),
    [session, lastUserId, profile, loading, signInWithPassword, signUpWithPassword, signInWithApple, signInWithGoogle, signOut, resetPassword, refreshProfile, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * The current user id. Screens behind the auth gate can call this freely: during the render right
 * after sign-out (before the gate redirects) it returns the previous id instead of throwing.
 */
export function useUserId() {
  const { session, lastUserId } = useAuth();
  return session?.user.id ?? lastUserId;
}

function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.split('#')[1] ?? url.split('?')[1] ?? '';
  for (const part of q.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

export function friendlyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/already registered/i.test(msg)) return 'That email already has an account.';
  if (/canceled|cancelled|ERR_REQUEST_CANCELED/i.test(msg)) return '';
  if (/network request failed|failed to fetch|network/i.test(msg)) return 'You appear to be offline.';
  return msg;
}
