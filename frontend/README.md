# TAMS — سامانه مدیریت دستیاران آموزشی

Frontend for the Teaching Assistant Management System. Persian / RTL.

**Stack:** React 19 · TypeScript (strict) · Vite · Tailwind v4 · React Router 7 · TanStack Query · Zustand · Zod + React Hook Form · axios

---

## Getting started

Requires **Node 20+** (Node 22 recommended).

```bash
git clone <REPO_URL>
cd frontend
npm ci
cp .env.example .env     # Windows: copy .env.example .env
npm run dev
```

Open the URL Vite prints (usually http://localhost:18765).

The frontend uses Django by default. For local Vite, start Django on port 8000 or set
`VITE_PROXY_TARGET`. With Docker Compose, the frontend is on port 5173 and uses the
backend container. Fill the root `.env` before starting Compose, including a random
`SECRET_KEY` (for example, generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`).
Log in with an account provisioned on that Django instance.

---

## Environment variables

`.env` is git-ignored. Copy `.env.example` and adjust locally.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Django API base. Default `/api/v1` through the Vite proxy |
| `VITE_USE_MOCKS` | `true` enables fixture login and selected demo pages in Vite dev mode |
| `VITE_MOCK_ROLE` | Which role you log in as (see below) |
| `VITE_ENABLE_PREVIEW` | `true` mounts the dev-only `/preview/ui-kit` route |

### Switching roles

In mock mode the credentials are always `admin` / `123456`; the **role comes from the env file**, not the login form.

```
VITE_MOCK_ROLE=professor
```

Valid values: `super_admin`, `dept_admin`, `professor`, `head_ta`, `ta`.
Anything else falls back to `super_admin`.

After changing it: **restart the dev server** (Vite reads `.env` only at startup), then **log out and log back in** — a cached session keeps the old role.

The sidebar and every route guard read `user.role`, so the whole navigation changes with it.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build locally |

Run `npm run typecheck && npm run lint` before pushing — `npm run build` fails on type errors.

---

## Project structure

```
src/
  api/client.ts        axios instance + JWT refresh interceptor
  app/queryClient.ts   TanStack Query defaults
  components/          shared UI kit (DataTable, Modal, Badge, ...)
    layout/Sidebar.tsx role-aware navigation
    ui-forms/          RHF-aware form controls
  hooks/               useDebouncedValue, usePagination
  layouts/AppLayout    desktop rail + mobile drawer
  mocks/               fixture data used while VITE_USE_MOCKS=true
  pages/               one file per screen
  routes/router.tsx    all routes + role guards (single source of truth)
  schemas/             zod validation schemas
  services/            data access — pages never call axios directly
  store/authStore.ts   auth state (Zustand)
  types/               shared domain types
```

### Conventions

- **Never call axios from a page.** Add a method to a service in `src/services/`; keep the API payload type and query key with the service.
- **Routes and role groups live only in `src/routes/router.tsx`.** Don't redeclare role arrays elsewhere.
- **Use the shared components** in `src/components/` rather than hand-rolling tables, modals or badges.
- Imports use the `@/` alias for `src/` (e.g. `@/components/DataTable`).

---

## Working together

```bash
git checkout -b feature/faculty-management
# ...work...
npm run typecheck && npm run lint
git commit -m "feat: faculty management table"
git push -u origin feature/faculty-management
```

Then open a Pull Request on GitHub. Keep `main` deployable; don't commit directly to it.

**Do not commit `.env`** — it's git-ignored on purpose. If you add a new variable, document it in `.env.example` and in `src/vite-env.d.ts`.

---

## Current status

Live pages read the course catalog, scoped rosters, professor schedules, personal
assignments, workload, faculty, and semesters from Django. Assignment Management
can change roles and revoke assignments. Semester Management supports creation,
editing, and deletion.

Task tracking and application review are available as fixture demonstrations in
development. They need persisted backend workflows before they can be offered in
live mode. Frontend CI runs lint, type-check, and the production build.

See `FIXES.md` and `REFACTORING.md` for previous frontend changes.
