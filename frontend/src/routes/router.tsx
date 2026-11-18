import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import AppLayout from '@/layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import LoadingState from '@/components/LoadingState';
import RouteErrorPage from '@/pages/RouteErrorPage';
import { USE_MOCKS } from '@/services/http';

import {
  ADMIN_ROLES,
  DIRECTORY_ROLES,
  ROLES,
  TA_ROLES,
} from '@/constants/roles';

/*
 * Every page is code-split.
 *
 * The app previously used the v5-era <BrowserRouter><Routes> API, so the whole
 * UI shipped in a single bundle and there was no errorElement: a render error
 * anywhere unmounted the entire tree. `createBrowserRouter` gives us per-route
 * error boundaries and lazy loading, and it lives outside any component, which
 * makes the routes testable with createMemoryRouter.
 */
const HomePage = lazy(() => import('@/pages/HomePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const Unauthorized = lazy(() => import('@/pages/Unauthorized'));

const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const CourseDirectoryPage = lazy(() => import('@/pages/CourseDirectoryPage'));
const LiveCourseDetails = lazy(() => import('@/pages/LiveCoursePages').then((module) => ({ default: module.LiveCourseDetails })));
const LiveProfessorDashboard = lazy(() => import('@/pages/LiveCoursePages').then((module) => ({ default: module.LiveProfessorDashboard })));
const LiveTADashboard = lazy(() => import('@/pages/LiveCoursePages').then(({ LiveAssignmentDashboard }) => ({ default: () => <LiveAssignmentDashboard head={false} /> })));
const LiveHeadTADashboard = lazy(() => import('@/pages/LiveCoursePages').then(({ LiveAssignmentDashboard }) => ({ default: () => <LiveAssignmentDashboard head /> })));
const FacultyManagement = lazy(() => import('@/pages/FacultyManagement'));
const ManageAssignmentsPage = lazy(() => import('@/pages/ManageAssignmentsPage'));
const MyTACourses = lazy(() => import('@/pages/MyTaCourses'));
const SemesterManagement = lazy(() => import('@/pages/admin/SemesterManagement'));
const WorkloadMonitoringPage = lazy(() => import('@/pages/WorkloadMonitoringPage'));

const demos = import.meta.env.DEV ? {
  CourseDetailsPage: lazy(() => import('@/pages/CoursesDetails')),
  ProfessorDashboard: lazy(() => import('@/pages/ProfessorDashboard')),
  HeadTADashboard: lazy(() => import('@/pages/HeadTADashboard')),
  TADashboard: lazy(() => import('@/pages/TADashboard')),
  UiKitPreviewPage: lazy(() => import('@/pages/previews/UiKitPreviewPage')),
} : null;

const PREVIEW_ENABLED = import.meta.env.VITE_ENABLE_PREVIEW === 'true';

/** Wraps a lazy page in the shared suspense fallback. */
const page = (Component: ComponentType): ReactElement => (
  <Suspense fallback={<LoadingState message="در حال بارگذاری صفحه..." />}>
    <Component />
  </Suspense>
);

const previewRoutes = PREVIEW_ENABLED && demos
  ? [
      {
        element: <ProtectedRoute allowedRoles={DIRECTORY_ROLES} />,
        children: [
          {
            path: '/preview',
            element: <AppLayout />,
            children: [
              { path: 'ui-kit', element: page(demos.UiKitPreviewPage) },
              { path: 'admin-dashboard', element: page(AdminDashboard) },
              { path: 'courses', element: page(CourseDirectoryPage) },
              { path: 'courses/:courseId', element: page(demos.CourseDetailsPage) },
              { path: 'workload', element: page(WorkloadMonitoringPage) },
              { path: 'assignments', element: page(ManageAssignmentsPage) },
              { path: 'semester', element: page(SemesterManagement) },
              { path: 'professor-dashboard', element: page(demos.ProfessorDashboard) },
              { path: 'my-ta-courses', element: page(MyTACourses) },
              { path: 'head-ta-dashboard/:courseId', element: page(demos.HeadTADashboard) },
              { path: 'ta-dashboard/:courseId', element: page(demos.TADashboard) },
            ],
          },
        ],
      },
    ]
  : [];

export const router = createBrowserRouter([
  // --- Public routes ---
  { path: '/login', element: page(LoginPage), errorElement: <RouteErrorPage /> },
  { path: '/unauthorized', element: page(Unauthorized) },
  { path: '/404', element: page(NotFoundPage) },

  // --- Authenticated routes ---
  // Every application route lives inside this single tree. There is
  // intentionally no second, unguarded copy of these paths: duplicate path
  // definitions would shadow the guarded ones and disable authorization.
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: page(HomePage) },

          {
            element: <ProtectedRoute allowedRoles={ADMIN_ROLES} />,
            children: [
              { path: 'admin-dashboard', element: page(AdminDashboard) },
              { path: 'admin-semester', element: page(SemesterManagement) },
              { path: 'faculty-management', element: page(FacultyManagement) },
              { path: 'workload', element: page(WorkloadMonitoringPage) },
              { path: 'assignments', element: page(ManageAssignmentsPage) },
            ],
          },

          // The course catalog is readable by every authenticated role.
          {
            element: <ProtectedRoute allowedRoles={DIRECTORY_ROLES} />,
            children: [
              { path: 'courses', element: page(CourseDirectoryPage) },
              { path: 'courses/:courseId', element: page(USE_MOCKS && demos ? demos.CourseDetailsPage : LiveCourseDetails) },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={[ROLES.PROFESSOR]} />,
            children: [{ path: 'professor-dashboard', element: page(USE_MOCKS && demos ? demos.ProfessorDashboard : LiveProfessorDashboard) }],
          },

          {
            element: <ProtectedRoute allowedRoles={TA_ROLES} />,
            children: [
              { path: 'my-ta-courses', element: page(MyTACourses) },
              { path: 'ta-dashboard/:courseId', element: page(USE_MOCKS && demos ? demos.TADashboard : LiveTADashboard) },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={TA_ROLES} />,
            children: [{ path: 'head-ta-dashboard/:courseId', element: page(USE_MOCKS && demos ? demos.HeadTADashboard : LiveHeadTADashboard) }],
          },
        ],
      },
    ],
  },

  ...previewRoutes,

  { path: '*', element: <Navigate to="/404" replace /> },
]);

// FACULTY_ROLES and friends are exported from @/constants/roles.
export default router;
