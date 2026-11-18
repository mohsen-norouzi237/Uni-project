import { apiClient } from '@/api/client';
import type { Paginated } from '@/types/api';

/**
 * Wire shape of assignments/serializers.py::TAAssignmentListSerializer
 * (GET /api/v1/assignments/list/). snake_case exactly as DRF sends it.
 */
export interface AssignmentRow {
  id: number;
  user: number;
  user_name: string;
  /** `get_role_display()` output, e.g. "Head TA" / "Teaching Assistant". */
  user_role: string;
  course: number;
  course_code: string;
  course_name: string;
  semester: number;
  semester_name: string;
  professor: number;
  professor_name: string;
  /** Raw choice value: 'TA' | 'HEAD_TA'. */
  role: 'TA' | 'HEAD_TA';
}

export interface AssignmentListParams {
  page?: number;
  pageSize?: number;
  semesterId?: number | string;
  role?: 'TA' | 'HEAD_TA' | '';
  search?: string;
}

/** Resolves against VITE_API_BASE_URL -> /api/v1/assignments/list/ (assignments/urls.py). */
const BASE_PATH = '/assignments/';

export const assignmentsService = {
  async list(params: AssignmentListParams = {}): Promise<Paginated<AssignmentRow>> {
    const { data } = await apiClient.get<Paginated<AssignmentRow>>(`${BASE_PATH}list/`, {
      params: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
        ...(params.semesterId ? { semester_id: params.semesterId } : {}),
        ...(params.role ? { role: params.role } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      },
    });
    return data;
  },

  /** PATCH /api/v1/assignments/:id/update/ — role change (TA <-> HEAD_TA). */
  async update(id: number, role: 'TA' | 'HEAD_TA'): Promise<AssignmentRow> {
    const { data } = await apiClient.patch<AssignmentRow>(`${BASE_PATH}${id}/update/`, { role });
    return data;
  },

  /** DELETE /api/v1/assignments/:id/ */
  async remove(id: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}${id}/`);
  },
};

export const assignmentsKeys = {
  all: ['assignments'] as const,
  lists: () => ['assignments', 'list'] as const,
  list: (params: AssignmentListParams) => ['assignments', 'list', params] as const,
};
