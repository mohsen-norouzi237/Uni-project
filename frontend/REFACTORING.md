# Refactoring pass (A–K)

Applied on top of the earlier critical-issue fixes. Nothing here was type-checked:
the sandbox has no network, so `npm install` / `tsc -b` could not run.
**Run `npm install` first** — `@tanstack/react-query` is a new dependency.

## A. Service layer
- `src/types/api.ts` — `Paginated<T>`, `toPaginated()`.
- `src/types/course.ts`, `src/types/workload.ts`, `src/types/task.ts` — one shared shape each
  (the page-local `CourseItem` / duplicate `Task` declarations are gone).
- `src/mocks/courses.mock.ts`, `src/mocks/workload.mock.ts` — mock data moved out of pages.
- `src/services/http.ts` (`USE_MOCKS`, `delay`), `courses.service.ts`, `workload.service.ts`.
  Pages call `coursesService.list(filters)` and never know whether the data is mocked;
  flipping `VITE_USE_MOCKS=false` switches to `apiClient.get('/courses/')`.

## B. TanStack Query
- `src/app/queryClient.ts` + `QueryClientProvider` in `src/App.tsx`; the cache is cleared
  on the `auth:session-expired` event.
- `CourseDirectoryPage` and `WorkloadMonitoringPage` use `useQuery` with
  `isPending` → `LoadingState`, `isError` → `ErrorState onRetry={refetch}`,
  empty → `EmptyState` (and its real `actionLabel` / `onAction` props).
- The fake `setTimeout(() => setLoading(false), 500)` blocks were removed from the
  dashboards as well.

## C. Single source of truth in dashboards
- `ProfessorDashboard`: `selectedCourseId` + `useMemo` derivation; both manual
  `setSelectedCourse(updatedCourse)` patches deleted.
- `HeadTADashboard`: same with `selectedTAId`; the duplicate `setSelectedTA(prev => ...)`
  update after adding a task is gone.

## D. authStore
- `MOCK_USER` is annotated `: User` (no double assertion) and its role comes from
  `VITE_MOCK_ROLE`, validated against `UserRole`, defaulting to `super_admin`,
  so every role path is reachable without a backend.

## E. DataTable
- `sortKey?: keyof T` makes function-accessor columns sortable.
- No more `as React.ReactNode`; primitives are formatted explicitly.
- Headers are real `<button>`s with `aria-sort`.
- `currentPage` resets when `data` or `pageSize` changes.

## F. Modal
- `role="dialog"`, `aria-modal`, `aria-labelledby` (via `useId`), focus trap,
  focus restore, Esc handling, and body-overflow restored to its **previous** value
  so a second open modal is not clobbered.

## G. Sidebar
- Zustand selectors instead of subscribing to the whole store.

## H. Dead / duplicated code
- Deleted `components/layout/DashboardLayout.tsx`, `components/FE08Page.tsx`.
- `components/FE05Page.tsx` → `pages/previews/UiKitPreviewPage.tsx` (DEV-only route).
- Routes import the real `FacultyManagement` / `StudentCourses` components.
- `@rolldown/binding-win32-x64-msvc` removed from dependencies.
- `LoginPage` uses zod + react-hook-form via `zodResolver(loginSchema)`, and
  `rememberMe` now persists the identifier.

## I. Typed errors
- `catch (err: unknown)` + `isAxiosError<{ detail?: string }>` in LoginPage;
  `toApiError()` in the api client/store. No `: any` remains in `src/`.

## J. Responsive
- `AppLayout`: desktop rail + mobile drawer with hamburger, backdrop, Esc and
  route-change close; `h-[100svh]`.
- `ManageAssignmentsPage` table wrapped in `overflow-x-auto`.
- LoginPage `min-h-[100svh]`.
- Filter grids go `grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-4`.

## K. Accessibility
- `htmlFor` / `id` on every filter control (and `sr-only` labels where the visual
  label is omitted).
- `aria-hidden="true"` on emoji and decorative icons.
- `aria-label="بستن"` on ✕ buttons (Modal, Alert, ManageAssignments).
- Status badges carry Persian `title` / `aria-label`; capacity bars expose `role="meter"`.
- `main.tsx` guards the root element instead of `getElementById('root')!`.
- Forgot-password `alert()` replaced by a real `<Modal>`.
