import { create } from 'zustand';
import type { LoginCredentials, LoginResponse, User } from '@/types/auth';
import apiClient, { toApiError } from '@/api/client';
import { queryClient } from '@/app/queryClient';
import { tokenStorage } from '@/utils/token';
import { ALL_ROLES, ROLES, type UserRole } from '@/constants/roles';

import { USE_MOCKS } from '@/services/http';

/**
 * The mock role is switchable through `VITE_MOCK_ROLE`, so every guarded route
 * can be exercised without a backend. Unknown values fall back to `super_admin`.
 */
const resolveMockRole = (): UserRole => {
    const raw = import.meta.env.VITE_MOCK_ROLE;
    return (ALL_ROLES as readonly string[]).includes(raw ?? '')
        ? (raw as UserRole)
        : ROLES.SUPER_ADMIN;
};

/** Typed on purpose: no `as unknown as User` escape hatch. */
const MOCK_USER: User = {
    id: 1,
    username: 'admin',
    email: 'admin@tams.local',
    first_name: 'مدیر',
    last_name: 'سیستم',
    role: resolveMockRole(),
};

const MOCK_TOKENS = {
    access: 'mock.access.token',
    refresh: 'mock.refresh.token',
} as const;

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    /** True only while the initial session check is running. */
    isLoading: boolean;
    error: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

/** Single source of truth for the profile endpoint (accounts/urls.py). */
const ME_ENDPOINT = '/auth/me/';
const LOGIN_ENDPOINT = '/auth/login/';
const LOGOUT_ENDPOINT = '/auth/logout/';


export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    login: async (credentials) => {
        const initialSession = tokenStorage.getSessionVersion();
        set({ error: null });

        if (USE_MOCKS) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (initialSession !== tokenStorage.getSessionVersion()) return;
            if (credentials.username !== 'admin' || credentials.password !== '123456') {
                const message = 'نام کاربری یا رمز عبور اشتباه است.';
                set({ error: message });
                throw new Error(message);
            }
            tokenStorage.setTokens(MOCK_TOKENS.access, MOCK_TOKENS.refresh);
            set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
            return;
        }

        let session = initialSession;
        try {
            const { data } = await apiClient.post<LoginResponse>(LOGIN_ENDPOINT, credentials);
            if (session !== tokenStorage.getSessionVersion()) return;
            tokenStorage.setTokens(data.access, data.refresh);
            session = tokenStorage.getSessionVersion();

            // SimpleJWT's default token endpoint returns tokens only, so the
            // profile is fetched separately when it is not embedded.
            const user = data.user ?? (await apiClient.get<User>(ME_ENDPOINT)).data;
            if (session !== tokenStorage.getSessionVersion()) return;
            set({ user, isAuthenticated: true, isLoading: false, error: null });
        } catch (error) {
            if (session !== tokenStorage.getSessionVersion()) throw error;
            const apiError = toApiError(error, 'ورود ناموفق بود.');
            tokenStorage.clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false, error: apiError.message });
            throw error;
        }
    },

    logout: () => {
        const refreshToken = tokenStorage.getRefreshToken();
        // Best-effort server-side invalidation (SimpleJWT blacklist). The
        // local session is torn down regardless of the network outcome.
        if (!USE_MOCKS && refreshToken) {
            void apiClient.post(LOGOUT_ENDPOINT, { refresh: refreshToken }).catch(() => undefined);
        }
        tokenStorage.clearTokens();
        queryClient.clear();
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    },

    checkAuth: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        if (USE_MOCKS) {
            set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
            return;
        }

        const session = tokenStorage.getSessionVersion();
        set({ isLoading: true });
        try {
            const { data } = await apiClient.get<User>(ME_ENDPOINT);
            if (session !== tokenStorage.getSessionVersion()) return;
            set({ user: data, isAuthenticated: true, isLoading: false, error: null });
        } catch {
            if (session !== tokenStorage.getSessionVersion()) return;
            tokenStorage.clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));

// NOTE: no side effect at module scope. `checkAuth()` is started from <App />
// so it runs inside React's lifecycle, inside the error boundary, and never
// during tests/Storybook imports.
