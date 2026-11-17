import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Top-level error boundary. Without this, any render-time throw (including the
 * ones that used to come from the module-scope `checkAuth()` call) unmounts the
 * whole React tree and leaves a blank white page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    override state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        // Replace with the real reporter (Sentry, etc.) when available.
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    override render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback) return this.props.fallback;

        return (
            <div
                role="alert"
                className="m-8 flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-8 text-center"
            >
                <h1 className="text-lg font-bold text-rose-900">خطایی غیرمنتظره رخ داد</h1>
                <p className="max-w-md text-sm leading-relaxed text-rose-700">
                    لطفاً صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
                </p>
                {import.meta.env.DEV && (
                    <pre
                        dir="ltr"
                        className="max-w-full overflow-x-auto rounded-lg bg-white p-3 text-left text-sm text-rose-800"
                    >
                        {error.message}
                    </pre>
                )}
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
                >
                    بارگذاری مجدد
                </button>
            </div>
        );
    }
}

export default ErrorBoundary;
