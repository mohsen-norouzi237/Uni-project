import type { Course } from '@/types/course';

/**
 * Mock fixtures live here, never inside a page.
 * When Django is ready you delete this folder and flip VITE_USE_MOCKS=false;
 * no component changes are required.
 *
 * Shapes mirror the real CourseSerializer payload (snake_case wire format).
 */
export const MOCK_COURSES: Course[] = [
  {
    id: 1,
    course_code: 'CS101',
    course_name: 'مبانی برنامه‌نویسی',
    professor_name: 'دکتر علی اکبری',
    has_head_ta: true,
    head_ta_name: 'امیرحسین رضایی',
    ta_count: 4,
  },
  {
    id: 2,
    course_code: 'CS202',
    course_name: 'ساختمان داده‌ها',
    professor_name: 'دکتر صمدی',
    has_head_ta: false,
    head_ta_name: null,
    ta_count: 3,
  },
  {
    id: 3,
    course_code: 'CE101',
    course_name: 'مدارهای منطقی',
    professor_name: 'دکتر مهدیانی',
    has_head_ta: true,
    head_ta_name: 'سارا محمدی',
    ta_count: 1,
  },
];
