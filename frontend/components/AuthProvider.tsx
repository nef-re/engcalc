"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearAuth,
  fetchMe,
  getStoredUser,
  loginUser,
  registerUser,
  setAuth,
  type AuthUser,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    fetchMe().then((u) => {
      if (u) setUser(u);
      else if (!stored) setUser(null);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: u } = await loginUser(username, password);
    setAuth(token, u);
    setUser(u);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { token, user: u } = await registerUser(username, email, password);
    setAuth(token, u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
