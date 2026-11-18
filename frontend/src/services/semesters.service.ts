import { apiClient } from '@/api/client';
import type { Paginated } from '@/types/api';

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
  async list(): Promise<Semester[]> {
    const semesters: Semester[] = [];
    for (let page = 1; ; page += 1) {
      const { data } = await apiClient.get<Paginated<Semester>>(BASE_PATH, {
        params: { page, page_size: 100 },
      });
      semesters.push(...data.results);
      if (!data.next) return semesters;
    }
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

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const semesterToday = () => dayFormat.format(new Date());

export function currentSemester(semesters: Semester[]) {
  const today = semesterToday();
  return semesters.find(({ start_date, end_date }) => start_date <= today && today <= end_date);
}
