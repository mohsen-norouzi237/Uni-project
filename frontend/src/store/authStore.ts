import { create } from 'zustand';
import type { LoginCredentials, LoginResponse, User } from '@/types/auth';
import apiClient, { toApiError } from '@/api/client';
import { tokenStorage } from '@/utils/token';
import { ALL_ROLES, ROLES, type UserRole } from '@/constants/roles';

/**
 * Mock mode is opt-in through the environment, never through a magic token
 * value. Set `VITE_USE_MOCKS=false` (or remove it) and the store talks to the
 * real Django endpoints with no code change.
 */
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/**
 * Role groups are NOT redeclared here. `@/constants/roles` is the single
 * source of truth shared with Sidebar.tsx and router.tsx; only the mock-role
 * validator below needs the flat list, and it derives it from ALL_ROLES.
 */

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
        set({ error: null });

        if (USE_MOCKS) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (credentials.username !== 'admin' || credentials.password !== '123456') {
                const message = 'نام کاربری یا رمز عبور اشتباه است.';
                set({ error: message });
                throw new Error(message);
            }
            tokenStorage.setTokens(MOCK_TOKENS.access, MOCK_TOKENS.refresh);
            set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
            return;
        }

        try {
            const { data } = await apiClient.post<LoginResponse>(LOGIN_ENDPOINT, credentials);
            tokenStorage.setTokens(data.access, data.refresh);

            // SimpleJWT's default token endpoint returns tokens only, so the
            // profile is fetched separately when it is not embedded.
            const user = data.user ?? (await apiClient.get<User>(ME_ENDPOINT)).data;
            set({ user, isAuthenticated: true, isLoading: false, error: null });
        } catch (error) {
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

        set({ isLoading: true });
        try {
            const { data } = await apiClient.get<User>(ME_ENDPOINT);
            set({ user: data, isAuthenticated: true, isLoading: false, error: null });
        } catch {
            tokenStorage.clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));

// NOTE: no side effect at module scope. `checkAuth()` is started from <App />
// so it runs inside React's lifecycle, inside the error boundary, and never
// during tests/Storybook imports.
