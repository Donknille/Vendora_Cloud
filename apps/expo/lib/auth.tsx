import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";
import { AppState } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

const syncUser = async (session: Session | null) => {
    if (!session?.user) return;
    try {
        await fetch(`${API_BASE_URL}/users/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': session.user.id,
            },
            body: JSON.stringify({ email: session.user.email }),
        });
    } catch (e) {
        console.error("Failed to sync user", e);
    }
};

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
        // Handle background state to refresh token if needed, supabase handles this mostly
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                supabase.auth.startAutoRefresh();
            } else {
                supabase.auth.stopAutoRefresh();
            }
        });

        // Initialize session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                syncUser(session);
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (session) {
                    syncUser(session);
                }
                setIsLoading(false);
            }
        );

        return () => {
            sub.remove();
            subscription.unsubscribe();
        };
    }, []);

    const logout = async () => {
        setIsLoading(true);
        await supabase.auth.signOut();
        setIsLoading(false);
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
