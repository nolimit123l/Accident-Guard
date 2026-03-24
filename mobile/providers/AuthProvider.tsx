import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Config } from '@/constants/Config';
import api, { extractApiError, setApiToken } from '@/lib/api';

type AuthUser = {
  id: number;
  username: string;
  email: string;
};

type AuthProfile = {
  username: string;
  email: string;
  full_name: string;
  phone_number: string;
  emergency_message_name: string;
  default_risk_threshold: number;
  created_at: string;
  updated_at: string;
};

type SignInInput = {
  username: string;
  password: string;
};

type SignUpInput = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phoneNumber: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  profile: AuthProfile | null;
  isReady: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = '@reflex/auth-session';

function normalizeAuthPayload(payload: any) {
  return {
    token: typeof payload?.token === 'string' ? payload.token : null,
    user: payload?.user ?? null,
    profile: payload?.profile ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored);
        const auth = normalizeAuthPayload(parsed);
        if (!auth.token) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }

        setApiToken(auth.token);
        if (!isMounted) {
          return;
        }

        setToken(auth.token);
        setUser(auth.user);
        setProfile(auth.profile);

        try {
          const response = await api.get(Config.PROFILE_URL);
          if (!isMounted) {
            return;
          }

          const refreshedProfile = response.data?.profile ?? auth.profile;
          setProfile(refreshedProfile);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              token: auth.token,
              user: auth.user,
              profile: refreshedProfile,
            })
          );
        } catch {
          setApiToken(null);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          if (isMounted) {
            setToken(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    hydrateAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setApiToken(token);
  }, [token]);

  const applyAuthPayload = async (payload: any) => {
    const auth = normalizeAuthPayload(payload);
    setToken(auth.token);
    setUser(auth.user);
    setProfile(auth.profile);
    if (auth.token) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      return;
    }
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const signIn = async (input: SignInInput) => {
    try {
      const response = await api.post(Config.LOGIN_URL, {
        username: input.username.trim(),
        password: input.password,
      });
      await applyAuthPayload(response.data);
    } catch (error) {
      throw new Error(extractApiError(error, 'Unable to sign in.'));
    }
  };

  const signUp = async (input: SignUpInput) => {
    try {
      const response = await api.post(Config.REGISTER_URL, {
        username: input.username.trim(),
        email: input.email.trim(),
        password: input.password,
        confirm_password: input.confirmPassword,
        full_name: input.fullName.trim(),
        phone_number: input.phoneNumber.trim(),
      });
      await applyAuthPayload(response.data);
    } catch (error) {
      throw new Error(extractApiError(error, 'Unable to create account.'));
    }
  };

  const signOut = async () => {
    try {
      if (token) {
        await api.post(Config.LOGOUT_URL);
      }
    } catch {
      // Clear local auth state even if the logout request fails.
    } finally {
      setApiToken(null);
      setToken(null);
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const refreshProfile = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.get(Config.PROFILE_URL);
      const refreshedProfile = response.data?.profile ?? null;
      setProfile(refreshedProfile);
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          token,
          user,
          profile: refreshedProfile,
        })
      );
    } catch (error) {
      throw new Error(extractApiError(error, 'Unable to refresh profile.'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        profile,
        isReady,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
