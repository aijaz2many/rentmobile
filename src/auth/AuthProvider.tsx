import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ApiError, apiRequest, setToken } from '../services/api';
import { User } from '../types';

type AuthResponse = {
  token: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  error: string | null;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (input: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    password: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'rent-auth-token';

async function saveToken(token: string) {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(TOKEN_KEY, token);
  setToken(token);
}

async function removeToken() {
  setToken(null);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        if (Platform.OS !== 'web') {
          const token = await SecureStore.getItemAsync(TOKEN_KEY);
          if (token) {
            setToken(token);
            const profile = await apiRequest<User>('/auth/me');
            if (active) setUser(profile);
          }
        }
      } catch (restoreError) {
        if (restoreError instanceof ApiError && [401, 403, 404].includes(restoreError.status)) {
          try {
            await removeToken();
          } catch (storageError) {
            if (active) {
              setError(storageError instanceof Error ? storageError.message : 'Unable to clear the expired session.');
            }
          }
        } else if (active) {
          setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore your session.');
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(async (path: string, body: object) => {
    setError(null);
    const response = await apiRequest<AuthResponse>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await saveToken(response.token);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (emailOrPhone: string, password: string) =>
      authenticate('/auth/login', { emailOrPhone, password }),
    [authenticate]
  );

  const register = useCallback(
    async (input: {
      firstName: string;
      lastName?: string;
      email: string;
      phone?: string;
      password: string;
      organizationName: string;
    }) => authenticate('/auth/register', input),
    [authenticate]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setError(null);
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      error,
      login,
      register,
      logout,
      clearError: () => setError(null),
    }),
    [user, ready, error, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
