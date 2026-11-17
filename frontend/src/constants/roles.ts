/**
 * Single source of truth for role-based access control on the frontend.
 *
 * Values mirror `User.Role` in accounts/models.py EXACTLY
 * (SUPER_ADMIN / DEPT_ADMIN / PROFESSOR / HEAD_TA / TA). The backend has no
 * STUDENT role, so none exists here either — student routes/types were
 * removed together (audit finding: "Orphaned Student Role").
 *
 * Sidebar.tsx, router.tsx and authStore.ts all import from this file, so a
 * permission granted in one place can never be denied in another.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPT_ADMIN: 'dept_admin',
  PROFESSOR: 'professor',
  HEAD_TA: 'head_ta',
  TA: 'ta',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly UserRole[] = Object.values(ROLES);

/** Administrators (full management surface). */
export const ADMIN_ROLES: readonly UserRole[] = [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN];

/** Anyone who teaches or assists in teaching. */
export const FACULTY_ROLES: readonly UserRole[] = [
  ROLES.PROFESSOR,
  ROLES.HEAD_TA,
  ROLES.TA,
];

/** Teaching assistants only. */
export const TA_ROLES: readonly UserRole[] = [ROLES.HEAD_TA, ROLES.TA];

/** Every authenticated role may read the catalog. */
export const DIRECTORY_ROLES: readonly UserRole[] = [...ADMIN_ROLES, ...FACULTY_ROLES];

/** Persian labels for each role (sidebar badge, user chips). */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'مدیر کل سامانه',
  dept_admin: 'مدیر گروه',
  professor: 'استاد',
  head_ta: 'سردستیار آموزشی',
  ta: 'دستیار آموزشی',
};
