import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '../lib/auth';

/** Renders children when signed in; otherwise opens the instant sign-up screen. */
export function SessionGate({ children, reason = 'post' }: { children: React.ReactNode; reason?: string }) {
  const { userId, ready } = useAuth();
  if (userId) return <>{children}</>;
  if (!ready) return null;
  return <Redirect href={{ pathname: '/auth/sign-up', params: { reason } }} />;
}
