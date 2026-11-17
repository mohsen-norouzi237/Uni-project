import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import Button from '@/components/Button';

/**
 * Per-route error boundary.
 *
 * With the old `<BrowserRouter><Routes>` API there was no `errorElement`, so a
 * render error in one page unmounted the whole application. Now only the failed
 * route is replaced and the shell stays interactive.
 */
export const RouteErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const title = isRouteErrorResponse(error) ? `خطای ${error.status}` : 'خطایی رخ داد';
  const detail = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'خطای ناشناخته‌ای در بارگذاری این صفحه رخ داد.';

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{detail}</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          بازگشت
        </Button>
        <Button onClick={() => window.location.reload()}>تلاش دوباره</Button>
      </div>
    </div>
  );
};

export default RouteErrorPage;
