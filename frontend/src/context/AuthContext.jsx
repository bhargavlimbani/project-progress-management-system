import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, STORAGE, clearSession } from "../services/index.js";
import { closeSocket } from "../hooks/useSocket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Restore the session on boot. The cached user renders immediately so the
   * app doesn't flash the login screen, then /auth/me revalidates the token
   * against the server — a stale or revoked token logs the user out.
   */
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE.user);
    const token = localStorage.getItem(STORAGE.token);

    if (!stored || !token) {
      setLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(stored));
    } catch {
      clearSession();
      setLoading(false);
      return;
    }

    let active = true;
    authApi
      .me()
      .then(({ data }) => {
        if (!active) return;
        setUser(data);
        localStorage.setItem(STORAGE.user, JSON.stringify(data));
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setUser(null);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback((userData, accessToken, refreshToken) => {
    localStorage.setItem(STORAGE.token, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE.refresh, refreshToken);
    localStorage.setItem(STORAGE.user, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    closeSocket(); // drop the authenticated socket so the next login re-handshakes
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE.user, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const hasRole = useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
