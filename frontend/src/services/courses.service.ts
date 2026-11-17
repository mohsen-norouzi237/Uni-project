import { apiClient } from '@/api/client';
import { MOCK_COURSES } from '@/mocks/courses.mock';
import type { Paginated } from '@/types/api';
import { paginate } from '@/types/api';
import type { Course, CourseFilterState, CourseQuery } from '@/types/course';
import { ANY, deriveStaffingStatus } from '@/types/course';
import { USE_MOCKS, delay } from './http';

/** Resolves against VITE_API_BASE_URL (default '/api/v1') -> /api/v1/courses/. */
const BASE_PATH = '/courses/';

/**
 * Client-side equivalent of the DRF filters, used only while mocking.
 * `status` is DERIVED (deriveStaffingStatus) exactly like in live mode, so
 * mock and server behaviour stay identical.
 */
const applyFilters = (courses: Course[], filters: CourseFilterState): Course[] => {
  const search = filters.search.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesSearch =
      search === '' ||
      course.course_name.toLowerCase().includes(search) ||
      course.course_code.toLowerCase().includes(search);
    const matchesStatus =
      filters.status === ANY || deriveStaffingStatus(course) === filters.status;

    return matchesSearch && matchesStatus;
  });
};

/**
 * Maps the UI query onto DRF query params.
 *
 * `page` / `page_size` are what `PageNumberPagination` reads. The `all`
 * sentinel is stripped rather than sent, because django-filter would treat the
 * literal string "all" as a value to match against.
 */
const toParams = (query: CourseQuery): Record<string, string | number> => {
  const params: Record<string, string | number> = {
    page: query.page,
    page_size: query.pageSize,
  };
  if (query.search.trim() !== '') params['search'] = query.search.trim();
  return params;
};

export const coursesService = {
  /**
   * Returns ONE page of courses.
   *
   * The mock branch paginates the fixture exactly like the server does, so
   * `count` is the size of the whole filtered set while `results` holds only
   * the requested window. That keeps mock and live behaviour identical.
   */
  async list(query: CourseQuery): Promise<Paginated<Course>> {
    if (USE_MOCKS) {
      await delay();
      return paginate(applyFilters(MOCK_COURSES, query), query);
    }

    const { data } = await apiClient.get<Paginated<Course>>(BASE_PATH, { params: toParams(query) });
    return data;
  },

  async retrieve(id: number): Promise<Course> {
    if (USE_MOCKS) {
      await delay(250);
      const course = MOCK_COURSES.find((item) => item.id === id);
      if (!course) throw new Error(`Course ${id} not found`);
      return course;
    }

    const { data } = await apiClient.get<Course>(`${BASE_PATH}${id}/`);
    return data;
  },

  /**
   * Distinct instructors, for the filter dropdown.
   *
   * Backend contract (courses/views.py::CourseViewSet.instructors):
   * GET /api/v1/courses/instructors/ -> { "results": ["دکتر رضایی", ...] }
   * This used to be typed as a bare string[] and 404ed because the endpoint
   * did not exist yet; both problems are now fixed.
   */
  async instructors(): Promise<string[]> {
    if (USE_MOCKS) {
      await delay(120);
      return Array.from(new Set(MOCK_COURSES.map((course) => course.professor_name)));
    }

    const { data } = await apiClient.get<{ results: string[] }>(`${BASE_PATH}instructors/`);
    return data.results ?? [];
  },
};

/**
 * Query keys are colocated with the service so invalidation stays consistent.
 * `page` is part of the key, which is what makes server-side pagination work:
 * each page is cached separately and refetched when it changes.
 */
export const coursesKeys = {
  all: ['courses'] as const,
  lists: () => ['courses', 'list'] as const,
  list: (query: CourseQuery) => ['courses', 'list', query] as const,
  detail: (id: number) => ['courses', 'detail', id] as const,
  instructors: () => ['courses', 'instructors'] as const,
};
