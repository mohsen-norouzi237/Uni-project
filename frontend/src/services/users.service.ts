import { apiClient } from '@/api/client';
import type { Paginated } from '@/types/api';

/** accounts/serializers.py user payload (subset used by the faculty pages). */
export interface FacultyUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'PROFESSOR' | 'HEAD_TA' | 'TA' | 'DEPT_ADMIN' | 'SUPER_ADMIN';
  is_active: boolean;
}

export const usersService = {
  /** GET /api/v1/users/?role=PROFESSOR — UserViewSet (accounts/urls.py router). */
  async listByRole(role: FacultyUser['role']): Promise<FacultyUser[]> {
    const { data } = await apiClient.get<Paginated<FacultyUser>>('/users/', {
      params: { role },
    });
    return data.results ?? [];
  },
};

export const usersKeys = {
  all: ['users'] as const,
  faculty: () => ['users', 'faculty'] as const,
};
