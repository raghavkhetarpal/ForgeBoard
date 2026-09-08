"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import { UserDto } from '@forgeboard/types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserDto }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => {
      setIsLoading(false);
    });
  }, [refreshUser]);

  // Sync Socket.IO connection state with Auth state
  useEffect(() => {
    if (user) {
      const socket = getSocket();
      socket.connect();
    } else {
      disconnectSocket();
    }
  }, [user]);

  const login = async (credentials: LoginCredentials) => {
    const data = await apiFetch<{ user: UserDto }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(data.user);
    router.push('/dashboard');
  };

  const register = async (userData: RegisterCredentials) => {
    const data = await apiFetch<{ user: UserDto }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    setUser(data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    } finally {
      setUser(null);
      disconnectSocket();
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
