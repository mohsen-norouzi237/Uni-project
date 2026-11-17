import type { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  /** Rendered on the opposite side of the title, e.g. a primary action. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Standard page shell.
 *
 * Solves three consistency problems at once:
 *  - **Padding ownership.** `AppLayout`'s <main> already applies `p-4 sm:p-6`.
 *    Pages used to add `p-8` / `px-4 py-8` on top, doubling the gutter. Pages
 *    add none; the layout owns padding.
 *  - **Max width.** Five pages used max-w-7xl / 6xl / 5xl / [1126px].
 *    One value now, defined here.
 *  - **Direction.** `dir="rtl"` is set once on <html>; no page re-declares it.
 */
export const PageContainer = ({ title, description, actions, children }: PageContainerProps) => (
  <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>

    {children}
  </div>
);

export default PageContainer;
