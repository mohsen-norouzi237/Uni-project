import { apiClient } from '@/api/client';

/**
 * Wire shape of semesters/serializers.py::SemesterSerializer.
 * NOTE: the backend field is `max_ta_courses_limit` — the per-TERM allowance
 * each TA may use. The old mock called it `taLimit` ("capacity in seats"),
 * which was semantically wrong; the UI label now says "سقف واحد دستیار".
 */
export interface Semester {
  id: number;
  name: string;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;
  max_ta_courses_limit: number;
  created_at?: string;
  updated_at?: string;
}

export type SemesterPayload = Omit<Semester, 'id' | 'created_at' | 'updated_at'>;

/** Resolves against VITE_API_BASE_URL -> /api/v1/semesters/ (semesters/urls.py). */
const BASE_PATH = '/semesters/';

export const semesterService = {
  /** GET /api/v1/semesters/ — plain list (the viewset is NOT paginated). */
  async list(): Promise<Semester[]> {
    const { data } = await apiClient.get<Semester[]>(BASE_PATH);
    return data;
  },

  /** POST /api/v1/semesters/ — Super Admin only (403 otherwise). */
  async create(payload: SemesterPayload): Promise<Semester> {
    const { data } = await apiClient.post<Semester>(BASE_PATH, payload);
    return data;
  },

  /** PUT /api/v1/semesters/:id/ — full update. */
  async update(id: number, payload: SemesterPayload): Promise<Semester> {
    const { data } = await apiClient.put<Semester>(`${BASE_PATH}${id}/`, payload);
    return data;
  },

  /** DELETE /api/v1/semesters/:id/ */
  async remove(id: number): Promise<void> {
    await apiClient.delete(`${BASE_PATH}${id}/`);
  },
};

export const semesterKeys = {
  all: ['semesters'] as const,
  lists: () => ['semesters', 'list'] as const,
};
