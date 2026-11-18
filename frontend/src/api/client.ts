import axios, {
    AxiosHeaders,
    type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStorage } from '@/utils/token';
import type { TokenRefreshResponse } from '@/types/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Path of the SimpleJWT refresh endpoint, relative to BASE_URL (accounts/urls.py). */
const REFRESH_PATH = '/auth/refresh/';

/** Requests we retry after a refresh are tagged so they can never loop. */
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean; _session?: number; _access?: string };

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
});

/**
 * The dashboards router is mounted at /api/dashboards/ — NOT under /api/v1.
 * Requests addressed with a leading `/dashboards/...` are therefore rewritten
 * to resolve against the bare `/api` root before they leave the client.
 */
const DASHBOARDS_PREFIX = '/dashboards/';
const API_ROOT = BASE_URL.replace(/\/v1\/?$/, '');

apiClient.interceptors.request.use((config) => {
    if (typeof config.url === 'string' && config.url.startsWith(DASHBOARDS_PREFIX)) {
        config.baseURL = API_ROOT;
    }
    return config;
});

/**
 * Bare client used for the refresh call itself.
 * Using `apiClient` here would re-enter the response interceptor and recurse.
 */
const refreshClient = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
});

let pendingRefresh: { session: number; promise: Promise<void> } | undefined;

async function refreshSession(session: number, refresh: string) {
    const { data } = await refreshClient.post<TokenRefreshResponse>(REFRESH_PATH, { refresh });
    if (session !== tokenStorage.getSessionVersion()) return;
    tokenStorage.setAccessToken(data.access);
    if (data.refresh) tokenStorage.setRefreshToken(data.refresh);
}

// --- Session expiry ----------------------------------------------------------

/**
 * Emitted when the session cannot be recovered.
 *
 * We deliberately do NOT call `window.location.href = '/login'` here:
 * a hard navigation destroys router state, loses the `from` location, and —
 * when several requests fail at once — causes redirect storms. The app
 * subscribes to this event once and performs a client-side redirect instead.
 */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

let sessionExpiryNotified = false;

const notifySessionExpired = () => {
    tokenStorage.clearTokens();
    if (sessionExpiryNotified) return; // one event per expiry, not one per request
    sessionExpiryNotified = true;
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
    // Allow a future session to expire again.
    window.setTimeout(() => {
        sessionExpiryNotified = false;
    }, 0);
};

const setAuthHeader = (config: InternalAxiosRequestConfig, token: string) => {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
};

// --- Interceptors ------------------------------------------------------------

const AUTH_PATHS = new Set(['/auth/login/', '/auth/logout/', REFRESH_PATH]);

apiClient.interceptors.request.use((config: RetriableRequestConfig) => {
    if (AUTH_PATHS.has(config.url ?? '')) return config;
    const session = tokenStorage.getSessionVersion();
    if (config._session !== undefined && config._session !== session) {
        throw new axios.CanceledError('Session changed');
    }
    config._session = session;
    const token = tokenStorage.getAccessToken();
    if (token) {
        config._access = token;
        setAuthHeader(config, token);
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;

        const request = error.config as RetriableRequestConfig | undefined;
        const session = tokenStorage.getSessionVersion();
        if (!request || request._session !== session) throw error;
        if (request._retry) {
            notifySessionExpired();
            throw error;
        }

        const refresh = tokenStorage.getRefreshToken();
        if (!refresh) {
            notifySessionExpired();
            throw error;
        }

        request._retry = true;
        if (request._access === tokenStorage.getAccessToken()) {
            if (pendingRefresh?.session !== session) {
                const promise = refreshSession(session, refresh).finally(() => {
                    if (pendingRefresh?.session === session) pendingRefresh = undefined;
                });
                pendingRefresh = { session, promise };
            }

            try {
                await pendingRefresh.promise;
            } catch (refreshError) {
                if (session === tokenStorage.getSessionVersion()) notifySessionExpired();
                throw refreshError;
            }
        }

        // The retry goes through the request interceptor and uses the latest access token.
        return apiClient(request);
    },
);

/** Normalized error shape so components never touch `err.response.data`. */
export interface ApiError {
    status: number;
    message: string;
    fieldErrors?: Record<string, string[]>;
}

export const toApiError = (error: unknown, fallbackMessage = 'خطای غیرمنتظره‌ای رخ داد.'): ApiError => {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        const data = error.response?.data as
            | { detail?: string; message?: string; error?: string; [key: string]: unknown }
            | undefined;

        const fieldErrors: Record<string, string[]> = {};
        if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                if (key === 'detail' || key === 'message' || key === 'error') continue;
                if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
                    fieldErrors[key] = value;
                }
            }
        }

        const result: ApiError = {
            status,
            message: data?.error ?? data?.detail ?? data?.message ?? fallbackMessage,
        };
        if (Object.keys(fieldErrors).length > 0) result.fieldErrors = fieldErrors;
        return result;
    }

    return { status: 0, message: fallbackMessage };
};

export default apiClient;
