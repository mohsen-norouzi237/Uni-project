import { isAtCapacity } from '@/utils/capacity';
import type { PageQuery } from './api';

/**
 * Mirrors the Django WorkloadSerializer output (dashboards/serializers.py),
 * mapped snake_case -> camelCase at the service boundary:
 *   id, name, assigned_courses -> assignedCourses, max_courses -> semesterLimit.
 *
 * The old `id: string` and `department` fields did not exist on the wire —
 * they are exactly the mismatch that broke live-mode rendering.
 */
export interface WorkloadUser {
  /** Django primary key. Numeric, as serialized by DRF. */
  id: number;
  name: string;
  assignedCourses: string[];
  /**
   * Maximum courses this TA may be assigned this semester
   * (`Semester.max_ta_courses_limit`). Treat as untrusted: the backend may
   * legitimately send 0 ("no allowance"), so every consumer must guard
   * against division by zero.
   */
  semesterLimit: number;
}

/**
 * Single source of truth for "this TA is at/over their allowance".
 *
 * Shares `isAtCapacity` with <CapacityBar>, so the table filter and the FULL
 * badge can no longer disagree. A `semesterLimit` of 0 means "no allowance",
 * which is only exceeded once a course is actually assigned.
 */
export const isOverloaded = (user: WorkloadUser): boolean =>
  isAtCapacity(user.assignedCourses.length, user.semesterLimit);

export interface WorkloadFilterState {
  search: string;
  onlyOverloaded: boolean;
}

export type WorkloadQuery = WorkloadFilterState & PageQuery;

export const DEFAULT_WORKLOAD_FILTERS: WorkloadFilterState = {
  search: '',
  onlyOverloaded: false,
};
