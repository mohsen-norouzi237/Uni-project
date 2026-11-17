import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';

/**
 * Responsive shell: the sidebar is a permanent rail from `lg` upwards and an
 * overlay drawer below it. Previously a fixed `w-64` rail left almost no room
 * for content on phones.
 */
const AppLayout = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    // Move focus into the drawer so keyboard users are not left behind it.
    drawerRef.current?.focus();
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDrawerOpen]);

  return (
    <div className="flex h-[100svh] overflow-hidden">
      {/* Desktop rail */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setIsDrawerOpen(false)}
          />
          {/* The drawer is modal: it is announced as a dialog and takes focus,
              matching the Escape handler above. Previously it had the Escape
              behaviour of a dialog but none of the semantics. */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 animate-slide-in-top shadow-xl"
          >
            <Sidebar onNavigate={() => setIsDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="text-base font-bold text-slate-900">TAMS</span>
          <button
            type="button"
            onClick={() => setIsDrawerOpen((open) => !open)}
            aria-label={isDrawerOpen ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={isDrawerOpen}
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
          >
            {isDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* The layout is the single owner of page padding. Pages used to add
            their own p-8 / on top of this, doubling the gutter. */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
