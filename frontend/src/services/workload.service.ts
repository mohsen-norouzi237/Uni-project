import { apiClient } from '@/api/client';
import { MOCK_WORKLOAD_DATA } from '@/mocks/workload.mock';
import type { Paginated } from '@/types/api';
import { paginate } from '@/types/api';
import { isOverloaded } from '@/types/workload';
import type { WorkloadFilterState, WorkloadQuery, WorkloadUser } from '@/types/workload';
import { USE_MOCKS, delay } from './http';

/**
 * Correct base path: the workload endpoint lives under the dashboards router
 * (config/urls.py mounts it at /api/dashboards/, dashboards/urls.py names it
 * "workload/"). It used to point at '/workload/' under /api/v1/, which 404ed
 * in live mode.
 */
const BASE_PATH = '/dashboards/workload/';

/** Wire shape of one row from dashboards/serializers.py::WorkloadSerializer. */
interface WorkloadRow {
  id: number;
  name: string;
  role: string;
  assigned_courses: string[];
  current_courses: number;
  max_courses: number;
  remaining: number;
  status: 'AVAILABLE' | 'AT_CAP' | 'OVER_LIMIT';
}

/** Maps the snake_case API payload onto the client contract (types/workload.ts). */
const toWorkloadUser = (row: WorkloadRow): WorkloadUser => ({
  id: row.id,
  name: row.name,
  assignedCourses: row.assigned_courses ?? [],
  semesterLimit: row.max_courses,
});

const applyFilters = (users: WorkloadUser[], filters: WorkloadFilterState): WorkloadUser[] => {
  const search = filters.search.trim().toLowerCase();

  return users.filter((user) => {
    const matchesSearch =
      search === '' ||
      user.name.toLowerCase().includes(search) ||
      user.assignedCourses.some((code) => code.toLowerCase().includes(search));
    // Shared with <CapacityBar> through `isAtCapacity`, so the filter and the
    // FULL badge always agree on what "at capacity" means.
    const matchesOverloaded = filters.onlyOverloaded ? isOverloaded(user) : true;

    return matchesSearch && matchesOverloaded;
  });
};

const toParams = (query: WorkloadQuery): Record<string, string | number | boolean> => {
  const params: Record<string, string | number | boolean> = {
    page: query.page,
    page_size: query.pageSize,
  };
  if (query.semesterId !== undefined) params.semester_id = query.semesterId;
  if (query.search.trim() !== '') params['search'] = query.search.trim();
  if (query.onlyOverloaded) params['overloaded'] = true;
  return params;
};

export interface WorkloadDistribution {
  zero: number;
  one: number;
  two: number;
  three_or_more: number;
  total: number;
}

export const workloadService = {
  /** Returns ONE page of TAs; `count` is the full filtered total. */
  async list(query: WorkloadQuery): Promise<Paginated<WorkloadUser>> {
    if (USE_MOCKS) {
      await delay();
      return paginate(applyFilters(MOCK_WORKLOAD_DATA, query), query);
    }

    const { data } = await apiClient.get<Paginated<WorkloadRow>>(BASE_PATH, {
      params: toParams(query),
    });
    return { ...data, results: data.results.map(toWorkloadUser) };
  },

  async summary(semesterId?: number): Promise<WorkloadDistribution> {
    if (USE_MOCKS) {
      await delay(200);
      const result = { zero: 0, one: 0, two: 0, three_or_more: 0, total: MOCK_WORKLOAD_DATA.length };
      for (const user of MOCK_WORKLOAD_DATA) {
        const count = user.assignedCourses.length;
        if (count === 0) result.zero += 1;
        else if (count === 1) result.one += 1;
        else if (count === 2) result.two += 1;
        else result.three_or_more += 1;
      }
      return result;
    }

    const { data } = await apiClient.get<{ distribution: WorkloadDistribution }>(BASE_PATH, {
      params: { page_size: 1, include_distribution: 1, semester_id: semesterId },
    });
    return data.distribution;
  },
};

export const workloadKeys = {
  all: ['workload'] as const,
  lists: () => ['workload', 'list'] as const,
  list: (query: WorkloadQuery) => ['workload', 'list', query] as const,
  summary: (semesterId?: number) => ['workload', 'summary', semesterId] as const,
};
