import axios, {
    AxiosError,
    AxiosHeaders,
    type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStorage } from '@/utils/token';
import type { TokenRefreshResponse } from '@/types/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Path of the SimpleJWT refresh endpoint, relative to BASE_URL (accounts/urls.py). */
const REFRESH_PATH = '/auth/refresh/';

/** Requests we retry after a refresh are tagged so they can never loop. */
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

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

// --- Refresh queue -----------------------------------------------------------

type QueueEntry = {
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

const flushQueue = (error: unknown, token: string | null) => {
    const queue = failedQueue;
    failedQueue = [];
    for (const entry of queue) {
        if (token) entry.resolve(token);
        else entry.reject(error);
    }
};

const enqueue = () =>
    new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
    });

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

apiClient.interceptors.request.use((config) => {
    const token = tokenStorage.getAccessToken();
    if (token) setAuthHeader(config, token);
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        if (!axios.isAxiosError(error)) return Promise.reject(error);

        const axiosError = error as AxiosError;
        const originalRequest = axiosError.config as RetriableRequestConfig | undefined;

        const isUnauthorized = axiosError.response?.status === 401;

        // Not a recoverable 401 -> surface it to the caller.
        if (!isUnauthorized || !originalRequest || originalRequest._retry) {
            if (isUnauthorized && originalRequest?._retry) notifySessionExpired();
            return Promise.reject(axiosError);
        }

        // The refresh endpoint itself returned 401 -> the session is gone.
        if (originalRequest.url?.includes(REFRESH_PATH)) {
            notifySessionExpired();
            return Promise.reject(axiosError);
        }

        // Mark BEFORE any retry path (queued or not) so a request can be
        // replayed at most once. This is what prevents the refresh loop.
        originalRequest._retry = true;

        // A refresh is already in flight: wait for it instead of starting another.
        if (isRefreshing) {
            try {
                const token = await enqueue();
                setAuthHeader(originalRequest, token);
                return await apiClient(originalRequest);
            } catch (queueError) {
                return Promise.reject(queueError);
            }
        }

        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) {
            notifySessionExpired();
            return Promise.reject(axiosError);
        }

        isRefreshing = true;
        try {
            const { data } = await refreshClient.post<TokenRefreshResponse>(REFRESH_PATH, {
                refresh: refreshToken,
            });

            tokenStorage.setAccessToken(data.access);
            // SimpleJWT with ROTATE_REFRESH_TOKENS=True also returns a new refresh token.
            if (data.refresh) tokenStorage.setRefreshToken(data.refresh);

            flushQueue(null, data.access);
            setAuthHeader(originalRequest, data.access);
            return await apiClient(originalRequest);
        } catch (refreshError) {
            flushQueue(refreshError, null);
            notifySessionExpired();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
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
            | { detail?: string; message?: string; [key: string]: unknown }
            | undefined;

        const fieldErrors: Record<string, string[]> = {};
        if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                if (key === 'detail' || key === 'message') continue;
                if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
                    fieldErrors[key] = value;
                }
            }
        }

        const result: ApiError = {
            status,
            message: data?.detail ?? data?.message ?? error.message ?? fallbackMessage,
        };
        if (Object.keys(fieldErrors).length > 0) result.fieldErrors = fieldErrors;
        return result;
    }

    return { status: 0, message: fallbackMessage };
};

export default apiClient;
