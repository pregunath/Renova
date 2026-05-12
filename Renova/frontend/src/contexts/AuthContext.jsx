// app/contexts/AuthContext.jsx
"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '../utils/auth';
import { usePathname, useRouter } from "next/navigation";

const AuthContext = createContext(undefined);

// src/contexts/AuthContext.jsx (only inside the hook)
export function useRequireAuth(loginPath = "/auth?mode=login") {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`${loginPath}&next=${next}`);
    }
  }, [router, pathname]);

  useEffect(() => {
    if (!isLoading && !user) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`${loginPath}&next=${next}`);
    }
  }, [user, isLoading, router, pathname, loginPath]);

  return { user, isLoading };
}
// Helper to show an initial as avatar
export function getAvatarInitial(user) {
  const source = (user?.name || user?.email || "").trim();
  return source ? source[0].toUpperCase() : "U";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  // Navigation logging: log route changes and history mutations with token state
  const pathname = usePathname();

  // Functions to show/clear access denied state
  const showAccessDenied = () => setAccessDenied(true);
  const clearAccessDenied = () => setAccessDenied(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Navigation logging: log route changes and history mutations with token state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const logNav = (reason, to) => {
      const access = localStorage.getItem('accessToken');
      const refresh = localStorage.getItem('refreshToken');
      console.group(`[nav] ${reason} -> ${to}`);
      authAPI._logToken('accessToken', access);
      authAPI._logToken('refreshToken', refresh);
      console.groupEnd();
    };

    // Log initial load
    logNav('initial-load', window.location.pathname + window.location.search);

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      const url = args[2];
      logNav('pushState', url);
      return origPush.apply(this, args);
    };
    window.history.replaceState = function (...args) {
      const url = args[2];
      logNav('replaceState', url);
      return origReplace.apply(this, args);
    };
    const onPop = () => logNav('popstate', window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // Log whenever pathname changes (Next.js routing) and refresh access token when signed in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const full = pathname + window.location.search;
    console.group(`[nav] routeChange -> ${full}`);
    authAPI._logToken('accessToken', localStorage.getItem('accessToken'));
    authAPI._logToken('refreshToken', localStorage.getItem('refreshToken'));
    console.groupEnd();
  }, [pathname, user]);

  // Listen for auth events from other tabs (logout/login) and update state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e) => {
      try {
        if (!e?.key) return;
        if (e.key === 'auth_event') {
          const val = e.newValue || '';
          if (val.startsWith('logout')) {
            // Another tab logged out — clear local state
            setUser(null);
            // If it's an expired logout, redirect immediately
            if (val.includes('expired')) {
              window.location.href = '/auth?mode=login&expired=true&message=' + encodeURIComponent('Please sign in again.');
            }
          } else if (val.startsWith('login')) {
            // Another tab logged in — re-check user
            checkAuth();
          }
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Ensure automatic refresh is scheduled based on current token expiry
        try { authAPI._scheduleAccessRefresh(); } catch {}
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const result = await authAPI.login(credentials);
      localStorage.setItem('accessToken', result.accessToken);
      
      const userData = await authAPI.getCurrentUser();
      setUser(userData);

  // Broadcast login to other tabs
  try { localStorage.setItem('auth_event', `login:${Date.now()}`); } catch (e) {}
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

const register = async (userData) => {
  try {
    const result = await authAPI.register(userData);
    localStorage.setItem('accessToken', result.accessToken);
    
    const userInfo = await authAPI.getCurrentUser();
    setUser(userInfo);

    // Broadcast login/registration to other tabs
    try { localStorage.setItem('auth_event', `login:${Date.now()}`); } catch (e) {}
    
    return userInfo;
  } catch (error) {
    if (error.message === 'SESSION_EXPIRED') {
      logout();
      throw new Error('Please log in again to continue.');
    }
    throw error;
  }
};

  const googleAuth = async (idToken) => {
    try {
      const result = await authAPI.googleSignIn(idToken);
      localStorage.setItem('accessToken', result.accessToken);
      
      const userData = await authAPI.getCurrentUser();
      setUser(userData);

      // Broadcast login to other tabs
      try { localStorage.setItem('auth_event', `login:${Date.now()}`); } catch (e) {}
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logout = async (reason = null) => {
    try {
      // Call backend logout endpoint
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Dynamic API URL: works for IPv4, IPv6, and domain names
        const getApiUrl = () => {
          return process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin;

          // const protocol = window.location.protocol;
          // const hostname = window.location.hostname;
          // // Handle IPv6: window.location.hostname strips brackets, add them back
          // const host = hostname.includes(':')
          //   ? (hostname.startsWith('[') ? hostname : `[${hostname}]`)
          //   : hostname;
          // return process.env.NEXT_PUBLIC_API_BASE_URL || `${protocol}//${host}:8080`;
        };
        const API_BASE_URL = getApiUrl();
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        }).catch(err => {
          // Log error but don't throw - we still want to logout client-side
          console.error('Backend logout failed:', err);
        });
      }
    } finally {
      // Clear tokens and user state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      // Broadcast logout to other tabs
      try { localStorage.setItem('auth_event', `logout:${Date.now()}`); } catch (e) {}
      
      // Handle expired token scenario
      if (reason === 'expired' && typeof window !== 'undefined') {
        // Redirect to login page with message in URL
        window.location.href = '/auth?mode=login&expired=true&message=' + encodeURIComponent('Please sign in again.');
      }
    }
  };

  const updateUser = async (userData) => {
    try {
      const updatedUser = await authAPI.updateUser(userData);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    googleAuth,
    logout,
    updateUser,
    showAccessDenied,
    clearAccessDenied
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};