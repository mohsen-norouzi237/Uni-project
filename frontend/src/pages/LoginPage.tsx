import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2, GraduationCap } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuthStore } from '@/store/authStore';
import { loginSchema } from '@/schemas';
import type { LoginData, LoginInput } from '@/schemas';

interface LocationState {
  from?: { pathname?: string };
}

const REMEMBER_ME_KEY = 'tams_remembered_identifier';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const rememberedIdentifier = localStorage.getItem(REMEMBER_ME_KEY) ?? '';

  // Validation is the zod schema in src/schemas, not a hand-rolled validateForm().
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: rememberedIdentifier,
      password: '',
      rememberMe: rememberedIdentifier !== '',
    },
  });

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? '/';

  if (isLoading) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" aria-hidden="true" />
        <span className="sr-only">در حال بررسی نشست کاربری</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: LoginData) => {
    setServerError(null);

    // rememberMe is actually used now: it persists the identifier only.
    if (values.rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, values.identifier);
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }

    try {
      await login({ username: values.identifier, password: values.password });
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const message = isAxiosError<{ detail?: string; message?: string }>(error)
        ? (error.response?.data?.detail ??
          error.response?.data?.message ??
          'نام کاربری یا کلمه عبور اشتباه است.')
        : error instanceof Error
          ? error.message
          : 'خطای غیرمنتظره‌ای رخ داد.';
      setServerError(message);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border bg-gray-50/50 py-2.5 pr-10 text-sm outline-none transition duration-150 focus:bg-white focus:ring-2 ${
      hasError
        ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-red-100'
        : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-100'
    } disabled:bg-gray-100 disabled:text-gray-400`;

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 p-4 antialiased">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-700 px-8 py-10 text-center text-white">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/20 backdrop-blur-md">
            <GraduationCap className="h-8 w-8 text-blue-100" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">سامانه مدیریت TAMS</h1>
          <p className="mt-1.5 text-sm font-medium text-blue-100/90">
            سامانه جامع مدیریت دستیاران آموزشی و حل تمرین
          </p>
        </div>

        <div className="px-8 py-7">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-gray-800">ورود به حساب کاربری</h2>
            <p className="mt-1 text-sm text-gray-500">مشخصات حساب دانشگاهی خود را وارد نمایید</p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex animate-slide-in-top items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
              <span className="text-sm leading-relaxed sm:text-sm">{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-semibold text-gray-700">
                نام کاربری / شماره دانشجویی
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                  placeholder="مثال: 401123456"
                  className={`${inputClass(Boolean(errors.identifier))} pl-3.5`}
                  {...register('identifier')}
                />
              </div>
              {errors.identifier && (
                <p id="identifier-error" className="mt-1.5 text-sm font-medium text-red-600">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-gray-700">
                کلمه عبور
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  placeholder="••••••••"
                  className={`${inputClass(Boolean(errors.password))} pl-10`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'پنهان کردن کلمه عبور' : 'نمایش کلمه عبور'}
                  className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 transition hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-sm font-medium text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label htmlFor="rememberMe" className="flex cursor-pointer select-none items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-blue-500"
                  {...register('rememberMe')}
                />
                <span className="text-sm text-gray-600">مرا به خاطر بسپار</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                فراموشی رمز عبور
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition duration-150 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>در حال بررسی مشخصات...</span>
                </>
              ) : (
                <span>ورود به سامانه</span>
              )}
            </button>
          </form>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/70 px-8 py-3.5 text-center">
          <p className="text-sm text-gray-400">دانشکده مهندسی کامپیوتر • تمامی حقوق محفوظ است</p>
        </div>
      </div>

      {/* alert() replaced by a real dialog */}
      <Modal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        title="بازیابی کلمه عبور"
        footer={
          <button
            type="button"
            onClick={() => setIsForgotOpen(false)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            متوجه شدم
          </button>
        }
      >
        <p className="leading-relaxed">
          جهت بازیابی کلمه عبور، با پشتیبانی آموزش دانشکده تماس بگیرید یا به مدیر سیستم مراجعه
          نمایید. پس از آماده‌شدن سرویس بک‌اند، این بخش به مسیر اختصاصی بازیابی رمز متصل خواهد شد.
        </p>
      </Modal>
    </div>
  );
};

export default LoginPage;
