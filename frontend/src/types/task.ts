/**
 * Unified task/assignment model.
 *
 * `Task` used to be declared independently in CoursesDetails and
 * ProfessorDashboard with incompatible shapes. One definition now serves both.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Task {
  id: number;
  title: string;
  /** ISO date string (YYYY-MM-DD) or a Jalali display string during mocking. */
  deadline: string;
  status: TaskStatus;
  description?: string;
  /** Id of the TA the task belongs to, when the task is listed out of context. */
  assigneeId?: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'در انتظار شروع',
  in_progress: 'در حال انجام',
  completed: 'انجام شده',
  overdue: 'تأخیر خورده',
};
