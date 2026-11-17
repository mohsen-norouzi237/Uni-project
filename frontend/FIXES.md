# Critical fixes applied

All 11 critical issues are fixed. Summary of what changed and why.

| # | Issue | Fix | Files |
|---|-------|-----|-------|
| 1 | Auth bypassable via duplicate unprotected routes | Router rewritten: one guarded tree, no duplicate paths. Previews namespaced under `/preview/*` and wrapped in `import.meta.env.DEV` so they are tree-shaken from production. `fe-05/09/11/14/15` aliases removed. Role groups are single-source constants. | `src/routes/AppRoutes.tsx` |
| 2 | Wrong route param -> always course #1 | `useParams<{ courseId: string }>()` replaces `useSearchParams`, invalid id -> `<Navigate to="/404" replace />`, header uses the resolved course. | `src/pages/CoursesDetails.tsx` |
| 3 | TS not strict | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns` enabled. `exactOptionalPropertyTypes` is left commented with a note: turn it on as a follow-up pass, it needs form-state refactors. | `tsconfig.app.json` |
| 4 | Material UI never installed | Dropped from the plan: the app stays on Tailwind + lucide-react. No `@mui/*` added, so there is no second design system. | `package.json` |
| 5 | Tailwind v4 with an ignored v3 config | `tailwind.config.js` deleted. Tokens moved to `@theme` (`--font-vazir`, brand colors). `tailwindcss-animate` removed and replaced with real `@keyframes` + `--animate-*` tokens (`animate-fade-in`, `animate-slide-in-top`, `animate-zoom-in`), plus a `prefers-reduced-motion` guard. Call sites updated. | `src/index.css`, `package.json`, `Modal.tsx`, `ConfirmDeleteModal.tsx`, `LoginPage.tsx`, `ProfessorDashboard.tsx` |
| 6 | `dir-rtl` / `dir-ltr` were no-op classes | Both are now real utilities via `@utility`. Direction is owned by `<html dir="rtl">`; redundant `dir-rtl` removed from the modal/detail wrappers. For inline LTR content (emails, codes, ISO dates) prefer the `dir="ltr"` attribute, which also fixes bidi ordering. | `src/index.css` |
| 7 | Global CSS beating Tailwind utilities | All base rules moved into `@layer base`; the 56px `h1`, 24px `h2` and `code` padding/background rules are gone, so `text-2xl` etc. now win. `color-scheme` forced to `light` (the app is light-only) and the dark-mode block removed, fixing white-on-white controls. Added a global `:focus-visible` ring. | `src/index.css` |
| 8 | Network call at module import | Module-scope `checkAuth()` removed; it now runs in `useEffect` inside `<App />`, under a new top-level `ErrorBoundary`. | `src/store/authStore.ts`, `src/App.tsx`, `src/components/ErrorBoundary.tsx` |
| 9 | Refresh queue could loop | Rewrote the interceptor: `_retry` is set **before** any retry path (queued or not), the refresh call uses a separate axios instance, 401 on the refresh endpoint ends the session immediately, the queue is typed `Promise<string>`, `error: any` is gone (`axios.isAxiosError` narrowing), and the hard `window.location.href` was replaced by an `auth:session-expired` event handled by React Router. Added a `toApiError` normalizer. | `src/api/client.ts`, `src/App.tsx` |
| 10 | Build failures on unused locals | `isLoading`/`isError` are now driven by a real `loadCourses()` / `loadWorkload()` callback (the future service call), retry buttons actually retry, and the unused `catch (error)` binding became a bare `catch`. | `CourseDirectoryPage.tsx`, `WorkloadMonitoringPage.tsx`, `ManageAssignmentsPage.tsx` |
| 11 | 6 `<th>` vs 7 `<td>` | Added the missing `جزئیات (Details)` header cell. | `CourseDirectoryPage.tsx` |

## Other fixes included

- `authStore`: typed `MOCK_USER` (no `as unknown as User`), mocks gated by `VITE_USE_MOCKS` instead of the `'mock-access-token'` sentinel, consolidated endpoints (`/auth/token/`, `/auth/users/me/`), and an `error` field for the login form.
- `ProtectedRoute`: `readonly UserRole[]`, real loading UI, redirect preserves the whole `location` (query + hash).
- `main.tsx`: no `document.getElementById('root')!` non-null assertion.
- `DataTable`: out-of-range column guard (required by `noUncheckedIndexedAccess`), keyboard-operable sorting with `aria-sort`.
- `Modal`: `role="dialog"`, `aria-modal`, labelled title, close button label, and body-scroll restored to its previous value instead of `'unset'`.
- `LoadingState` was called with a non-existent `text` prop in two pages; now `message`.
- `.env` had a UTF-8 BOM and `.env.example` was UTF-16LE (both can break Vite parsing) — rewritten as plain UTF-8, with `VITE_USE_MOCKS` documented.
- Removed `@rolldown/binding-win32-x64-msvc` from devDependencies: it is platform-locked and breaks installs on macOS/Linux/CI.

## Before you run it

```bash
npm install     # lockfile changed: tailwindcss-animate + rolldown binding removed
npm run build   # tsc -b will now enforce strict mode
```

I could not run `tsc` here (no network to install `node_modules`), so expect a handful of remaining strict-mode errors in the pages I did not touch — mostly `possibly undefined` on array indexing and optional props. They are mechanical; fix them before wiring Django.

## Recommended next steps (not applied)

1. Extract `src/services/` (`coursesService`, `assignmentsService`, ...) so pages never import axios directly.
2. Add MSW so mocks live at the network layer and disappear by deleting one import.
3. Add `Paginated<T>` for DRF's `{count, next, previous, results}` and settle `id: string` vs `number`.
4. Adopt TanStack Query for loading/error/caching instead of hand-rolled `isLoading`/`isError` pairs.
5. Turn on `exactOptionalPropertyTypes`.
