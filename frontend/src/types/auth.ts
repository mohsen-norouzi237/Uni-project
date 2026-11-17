/**
 * Roles are declared once in `@/constants/roles` (single source of truth,
 * mirrored from User.Role in accounts/models.py). Re-exported here so every
 * existing `import { UserRole } from '@/types/auth'` keeps working.
 * The former `'student'` member was removed: the backend has no STUDENT role.
 */
import type { UserRole } from '@/constants/roles';
export type { UserRole };

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  /**
   * Optional on purpose: SimpleJWT's default token endpoint returns tokens
   * only. The store already falls back to `GET /auth/users/me/`, so typing
   * this as required was a lie the compiler could not catch.
   */
  user?: User;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
