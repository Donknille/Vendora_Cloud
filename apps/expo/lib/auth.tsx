import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Session, User } from "@supabase/supabase-js";

import { getApiBaseUrl } from "./api-config";
import { resetAppQueryCache } from "./query-client";
import { secureApiFetch } from "./integrity";
import { supabase } from "./supabase";

const API_BASE_URL = getApiBaseUrl();

async function syncUser(session: Session | null) {
  if (!session?.user || !session.access_token) {
    return;
  }

  try {
    const response = await secureApiFetch(`${API_BASE_URL}/users/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: session.user.email }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to sync user", error);
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession) {
        syncUser(currentSession);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession) {
        syncUser(currentSession);
      }

      setIsLoading(false);
    });

    return () => {
      sub.remove();
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      await resetAppQueryCache();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        user,
        session,
        isLoading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
