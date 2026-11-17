import type { WorkloadUser } from '@/types/workload';

/** Mirrors the real /api/dashboards/workload/ payload (camelCase-mapped shape). */
export const MOCK_WORKLOAD_DATA: WorkloadUser[] = [
  { id: 1, name: 'امیرحسین رضایی', assignedCourses: ['CS101'], semesterLimit: 3 },
  { id: 2, name: 'سارا محمدی', assignedCourses: ['CS101', 'MATH200'], semesterLimit: 3 },
  { id: 3, name: 'علی عباسی', assignedCourses: ['CS101', 'MATH200', 'CS102'], semesterLimit: 3 },
  { id: 4, name: 'زهرا شریفی', assignedCourses: ['CS101', 'CS102'], semesterLimit: 3 },
];
