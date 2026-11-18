import type { PageQuery } from './api';

/**
 * Single source of truth for course-shaped data.
 *
 * These fields MIRROR the Django `CourseSerializer` output
 * (courses/serializers.py) exactly — snake_case as it arrives on the wire:
 *   id, course_code, course_name, professor_name, has_head_ta,
 *   head_ta_name (nullable), ta_count.
 *
 * The old client-only fields (`code`, `title`, `department`, `instructor`,
 * `headTa`, `taCount`, `status`, `semester`, `capacity`) described a shape the
 * backend never sent, which is why live mode rendered empty tables. The
 * staffing `status` is now DERIVED client-side from `has_head_ta` / `ta_count`
 * via `deriveStaffingStatus()` below — one derivation, used by every consumer.
 */

export type StaffingStatus = 'fully_staffed' | 'missing_head_ta' | 'missing_tas';

/** Raw DRF payload shape (see courses/serializers.py::CourseSerializer). */
export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  professor_name: string;
  /** True when at least one HEAD_TA assignment exists in the filtered semester. */
  has_head_ta: boolean;
  /** Name of the Head TA, or null when none is assigned. */
  head_ta_name: string | null;
  ta_count: number;
}

/** Minimum input needed to derive the staffing badge. */
export const deriveStaffingStatus = (course: Pick<Course, 'has_head_ta' | 'ta_count'>): StaffingStatus => {
  if (!course.has_head_ta) return 'missing_head_ta';
  // A healthy team needs the head TA plus at least one assistant.
  if (course.ta_count < 2) return 'missing_tas';
  return 'fully_staffed';
};

/** Sentinel for "no filter applied" — stripped before hitting DRF. */
export const ANY = 'all' as const;
export type AnyOption = typeof ANY;

export interface CourseFilterState {
  search: string;
  instructor: string;
  /** Narrowed: a typo like 'fully-staffed' is now a compile error. */
  status: StaffingStatus | AnyOption;
}

/**
 * What the list endpoint actually receives: the filters plus the page window.
 * Pagination is part of the query (and therefore part of the React Query key),
 * so the server owns paging and the UI never slices a page it already holds.
 */
export type CourseQuery = CourseFilterState & PageQuery & { semesterId?: number };

export const DEFAULT_COURSE_FILTERS: CourseFilterState = {
  search: '',
  instructor: ANY,
  status: ANY,
};

/** Persian labels for the staffing status, so badges are not English-only. */
export const STAFFING_STATUS_LABELS: Record<StaffingStatus, string> = {
  fully_staffed: 'تیم دستیاری کامل است',
  missing_head_ta: 'سر دستیار تعیین نشده است',
  missing_tas: 'کمبود دستیار آموزشی',
};
