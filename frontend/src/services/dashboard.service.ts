import { apiClient } from '@/api/client';

/** dashboards/serializers.py::AdminStatsSerializer */
export interface AdminStats {
  total_courses: number;
  total_ta: number;
  total_head_ta: number;
  unassigned_ta: number;
  at_cap_ta: number;
}

/** dashboards/serializers.py::UserDashboardSerializer (GET /api/dashboards/me/) */
export interface MyCourseRow {
  course_name: string;
  course_code: string;
  /** get_role_display() of the assignment role, e.g. "Head TA". */
  role: string;
  professor_name: string;
  head_ta_name: string | null;
  semester: string;
}

/**
 * Both endpoints live under the dashboards router (/api/dashboards/, see
 * config/urls.py). The leading '/dashboards/' prefix is what the request
 * interceptor in api/client.ts uses to escape the default /api/v1 baseURL.
 */
export const dashboardService = {
  async adminStats(semesterId?: number | string): Promise<AdminStats> {
    const { data } = await apiClient.get<AdminStats>('/dashboards/admin-stats/', {
      params: semesterId ? { semester_id: semesterId } : {},
    });
    return data;
  },

  async myCourses(): Promise<MyCourseRow[]> {
    // The endpoint returns a bare array (no pagination envelope).
    const { data } = await apiClient.get<MyCourseRow[]>('/dashboards/me/');
    return data;
  },
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  adminStats: (semesterId?: number | string) => ['dashboard', 'admin-stats', semesterId ?? 'latest'] as const,
  myCourses: () => ['dashboard', 'me'] as const,
};
