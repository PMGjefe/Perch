import { Redirect } from 'expo-router';
import React from 'react';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Landing route for OAuth and password-reset links; the auth gate takes over once the session exists. */
export default function AuthCallback() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={session ? '/(tabs)/feed' : '/(auth)/sign-in'} />;
}
