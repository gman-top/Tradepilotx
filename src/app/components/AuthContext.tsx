import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
    dataSource: 'live' | 'mock';
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithProvider: (provider: 'google' | 'discord') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  toggleFavorite: (asset: string) => void;
  isFavorite: (asset: string) => boolean;
}

const noopAsync = async () => ({ success: false as const, error: 'No AuthProvider' });
const noop = () => {};

const defaultContext: AuthContextType = {
  user: null,
  isLoading: true,
  login: noopAsync,
  register: noopAsync,
  loginWithProvider: noopAsync,
  logout: noop,
  updateUser: noop,
  toggleFavorite: noop,
  isFavorite: () => false,
};

const AuthContext = createContext<AuthContextType>(defaultContext);

export function useAuth() {
  return useContext(AuthContext);
}

const STORAGE_KEY = 'tradepilot_auth';
const USERS_KEY = 'tradepilot_users';

function getStoredUsers(): Record<string, { password: string; user: User }> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStoredUsers(users: Record<string, { password: string; user: User }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  // Persist session changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      // Also update in users store
      const users = getStoredUsers();
      if (users[user.email]) {
        users[user.email].user = user;
        saveStoredUsers(users);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    await new Promise(r => setTimeout(r, 600)); // simulate network
    const users = getStoredUsers();
    const entry = users[email.toLowerCase()];
    if (!entry) return { success: false, error: 'No account found with this email' };
    if (entry.password !== password) return { success: false, error: 'Incorrect password' };
    setUser(entry.user);
    return { success: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await new Promise(r => setTimeout(r, 800)); // simulate network
    const users = getStoredUsers();
    const key = email.toLowerCase();
    if (users[key]) return { success: false, error: 'An account with this email already exists' };
    
    const newUser: User = {
      id: crypto.randomUUID(),
      email: key,
      name,
      plan: 'pro',
      createdAt: new Date().toISOString(),
      favorites: ['XAU/USD', 'SPX500', 'EUR/USD'],
      settings: {
        defaultPage: 'overview',
        compactMode: false,
        dataSource: 'live',
      },
    };
    users[key] = { password, user: newUser };
    saveStoredUsers(users);
    setUser(newUser);
    return { success: true };
  }, []);

  const loginWithProvider = useCallback(async (provider: 'google' | 'discord') => {
    // TODO: Replace with Supabase OAuth when connected
    // supabase.auth.signInWithOAuth({ provider })
    await new Promise(r => setTimeout(r, 1000)); // simulate OAuth redirect

    const providerData = {
      google: {
        name: 'Alex Trader',
        email: 'alex.trader@gmail.com',
        avatarUrl: `https://ui-avatars.com/api/?name=Alex+Trader&background=4285F4&color=fff&size=128`,
      },
      discord: {
        name: 'TraderAlex#1337',
        email: 'alex_trader@discord.user',
        avatarUrl: `https://ui-avatars.com/api/?name=Trader+Alex&background=5865F2&color=fff&size=128`,
      },
    };

    const data = providerData[provider];
    const users = getStoredUsers();
    const key = data.email.toLowerCase();

    // Auto-login or auto-register
    if (users[key]) {
      setUser(users[key].user);
    } else {
      const newUser: User = {
        id: crypto.randomUUID(),
        email: key,
        name: data.name,
        avatarUrl: data.avatarUrl,
        plan: 'pro',
        createdAt: new Date().toISOString(),
        favorites: ['XAU/USD', 'SPX500', 'EUR/USD'],
        settings: {
          defaultPage: 'overview',
          compactMode: false,
          dataSource: 'live',
        },
      };
      users[key] = { password: '', user: newUser };
      saveStoredUsers(users);
      setUser(newUser);
    }

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
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
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithProvider, logout, updateUser, toggleFavorite, isFavorite }}>
      {children}
    </AuthContext.Provider>
  );
}