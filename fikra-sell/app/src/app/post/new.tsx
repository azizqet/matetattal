import { Redirect } from 'expo-router';
import React from 'react';
import { AdForm } from '../../components/AdForm';
import { useAuth } from '../../lib/auth';

export default function NewAd() {
  const { userId } = useAuth();
  if (!userId) return <Redirect href={{ pathname: '/auth/sign-in', params: { reason: 'post' } }} />;
  return <AdForm />;
}
