import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../engine/config';

// ─── Supabase Client ─────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// ─── User Type ───────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  favorites: string[];
  settings: {
    defaultPage: string;
    compactMode: boolean;
    dataSource: 'live';
    notifications: {
      weeklyCot: boolean;
      biasChanges: boolean;
      macroEvents: boolean;
    };
  };
}

// ─── Auth Context Type ───────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithProvider: (provider: 'google' | 'discord') => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearPasswordRecovery: () => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  toggleFavorite: (asset: string) => void;
  isFavorite: (asset: string) => boolean;
}

const noopAsync = async () => ({ success: false as const, error: 'No AuthProvider' });
const noop = () => {};

const defaultContext: AuthContextType = {
  user: null, isLoading: true, isPasswordRecovery: false,
  login: noopAsync, register: noopAsync, loginWithProvider: noopAsync,
  forgotPassword: noopAsync, clearPasswordRecovery: noop,
  logout: noop, updateUser: noop, toggleFavorite: noop, isFavorite: () => false,
};

const AuthContext = createContext<AuthContextType>(defaultContext);

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Local prefs storage (non-auth data stored in localStorage) ───────────────
const PREFS_KEY = 'tp_user_prefs';

function loadPrefs(userId: string): Partial<User> {
  try {
    const raw = localStorage.getItem(`${PREFS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePrefs(userId: string, prefs: Partial<User>) {
  try {
    localStorage.setItem(`${PREFS_KEY}_${userId}`, JSON.stringify(prefs));
  } catch {}
}

// ─── Build TradePilot User from Supabase session ──────────────────────────────
function buildUser(sbUser: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }, prefs: Partial<User> = {}): User {
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name: prefs.name || sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'Trader',
    avatarUrl: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture,
    plan: prefs.plan || 'pro',
    createdAt: sbUser.created_at,
    favorites: prefs.favorites || ['XAU/USD', 'SPX500', 'EUR/USD'],
    settings: {
      defaultPage: prefs.settings?.defaultPage ?? 'overview',
      compactMode: prefs.settings?.compactMode ?? false,
      dataSource: prefs.settings?.dataSource ?? 'live',
      notifications: {
        weeklyCot: prefs.settings?.notifications?.weeklyCot ?? true,
        biasChanges: prefs.settings?.notifications?.biasChanges ?? true,
        macroEvents: prefs.settings?.notifications?.macroEvents ?? false,
      },
    },
  };
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Initialize: restore session from Supabase
  useEffect(() => {
    let mounted = true;

    // Rely solely on onAuthStateChange for the loading state.
    // Supabase v2 always fires INITIAL_SESSION after full initialization
    // (including PKCE code exchange), so this is race-condition-free.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      // Password recovery: user clicked reset link in email
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        if (session?.user) {
          const prefs = loadPrefs(session.user.id);
          setUser(buildUser(session.user, prefs));
        }
        setIsLoading(false);
        return;
      }

      if (session?.user) {
        const prefs = loadPrefs(session.user.id);
        setUser(buildUser(session.user, prefs));
      } else {
        setUser(null);
        setIsPasswordRecovery(false);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Persist local prefs when user changes
  useEffect(() => {
    if (user) {
      savePrefs(user.id, {
        name: user.name,
        plan: user.plan,
        favorites: user.favorites,
        settings: user.settings,
      });
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { success: false, error: error.message };

    // Auto-confirm: if session returned immediately (email confirm disabled)
    if (data.session) return { success: true };

    // Email confirmation required
    return { success: true, error: 'Check your email to confirm your account.' };
  }, []);

  const loginWithProvider = useCallback(async (provider: 'google' | 'discord') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) return { success: false, error: error.message };
    return { success: true }; // Redirect will happen
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsPasswordRecovery(false);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const toggleFavorite = useCallback((asset: string) => {
    setUser(prev => {
      if (!prev) return null;
      const favs = prev.favorites.includes(asset)
        ? prev.favorites.filter(f => f !== asset)
        : [...prev.favorites, asset];
      return { ...prev, favorites: favs };
    });
  }, []);

  const isFavorite = useCallback((asset: string) => {
    return user?.favorites.includes(asset) ?? false;
  }, [user?.favorites]);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isPasswordRecovery,
      login, register, loginWithProvider, forgotPassword, clearPasswordRecovery,
      logout, updateUser, toggleFavorite, isFavorite,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
