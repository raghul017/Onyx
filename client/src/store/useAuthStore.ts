import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
    id: string;
    email: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    setAuth: (token: string, user: User) => void;
    setToken: (token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            setAuth: (token, user) =>
                set({ token, user, isAuthenticated: true }),
            setToken: (token) => set({ token, isAuthenticated: !!token }),
            logout: () =>
                set({ token: null, user: null, isAuthenticated: false }),
        }),
        {
            name: "onyx-auth-storage", // stores in localStorage
        },
    ),
);
