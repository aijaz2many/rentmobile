import { Redirect } from 'expo-router';
import React from 'react';
import { Loading } from '../components/AppUi';
import { useAuth } from '../auth/AuthProvider';

export default function IndexRoute() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading message="Restoring your session..." />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.roles.includes('TENANT') ? '/(tenant)/dashboard' : '/(owner)/dashboard'} />;
}
