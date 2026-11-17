from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import Count, Prefetch, Q

from accounts.models import User
from assignments.models import TAAssignment
from audit.models import AuditLog
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester


class Command(BaseCommand):
    help = "Print PostgreSQL EXPLAIN ANALYZE plans for TAMS hot read queries."

    def add_arguments(self, parser):
        parser.add_argument(
            "--semester-id",
            type=int,
            help="Semester to benchmark. Defaults to the semester with the most courses.",
        )

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("analyze_query_plans requires PostgreSQL.")

        semester_id = options["semester_id"] or self._busiest_semester_id()
        if semester_id is None:
            raise CommandError("No course-professor mappings exist. Generate or create data first.")

        sample_user = User.objects.order_by("id").first()
        sample_professor_id = self._busiest_professor_id(semester_id)
        sample_course_id = self._sample_course_id(semester_id)
        sample_ta_user_id = self._busiest_ta_user_id(semester_id)

        if sample_user:
            self._print_queryset_plan(
                "Accounts: login lookup by username",
                User.objects.filter(username=sample_user.username),
            )
        self._print_queryset_plan(
            "Semesters: lookup by primary key",
            Semester.objects.filter(pk=semester_id),
        )
        self._print_queryset_plan(
            f"Courses: course directory (semester_id={semester_id})",
            self._course_directory_queryset(semester_id),
        )
        if sample_professor_id:
            self._print_queryset_plan(
                "Courses: professor courses in semester",
                CourseProfessorMapping.objects.filter(
                    professor_id=sample_professor_id,
                    semester_id=semester_id,
                ),
            )
        if sample_course_id:
            self._print_queryset_plan(
                "Assignments: course staffing in semester",
                TAAssignment.objects.filter(
                    course_id=sample_course_id,
                    semester_id=semester_id,
                ).select_related("user"),
            )
        if sample_ta_user_id:
            self._print_queryset_plan(
                "Assignments: TA workload in semester",
                TAAssignment.objects.filter(
                    user_id=sample_ta_user_id,
                    semester_id=semester_id,
                ),
            )

        self.stdout.write(self.style.MIGRATE_HEADING("TA workload view"))
        with connection.cursor() as cursor:
            cursor.execute(
                """
                EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
                SELECT user_id, assigned_courses, max_ta_courses_limit,
                       remaining_courses, workload_status
                FROM v_ta_workload
                WHERE semester_id = %s
                ORDER BY assigned_courses DESC, user_id
                """,
                [semester_id],
            )
            self.stdout.write("\n".join(row[0] for row in cursor.fetchall()))

        audit_log = AuditLog.objects.order_by("id").first()
        if audit_log:
            self._print_queryset_plan(
                "Audit: entity history lookup",
                AuditLog.objects.filter(
                    entity_type=audit_log.entity_type,
                    entity_id=audit_log.entity_id,
                ),
            )
        else:
            self.stdout.write(self.style.WARNING("Audit: skipped (no audit rows exist)."))

    @staticmethod
    def _busiest_semester_id():
        row = (
            CourseProfessorMapping.objects.values("semester_id")
            .annotate(course_count=Count("course_id"))
            .order_by("-course_count", "semester_id")
            .first()
        )
        return row["semester_id"] if row else None

    @staticmethod
    def _busiest_professor_id(semester_id):
        row = (
            CourseProfessorMapping.objects.filter(semester_id=semester_id)
            .values("professor_id")
            .annotate(course_count=Count("course_id"))
            .order_by("-course_count", "professor_id")
            .first()
        )
        return row["professor_id"] if row else None

    @staticmethod
    def _sample_course_id(semester_id):
        return (
            CourseProfessorMapping.objects.filter(semester_id=semester_id)
            .order_by("course_id")
            .values_list("course_id", flat=True)
            .first()
        )

    @staticmethod
    def _busiest_ta_user_id(semester_id):
        row = (
            TAAssignment.objects.filter(semester_id=semester_id)
            .values("user_id")
            .annotate(assignment_count=Count("id"))
            .order_by("-assignment_count", "user_id")
            .first()
        )
        return row["user_id"] if row else None

    def _print_queryset_plan(self, heading, queryset):
        self.stdout.write(self.style.MIGRATE_HEADING(heading))
        self.stdout.write(queryset.explain(analyze=True, buffers=True, verbose=True))

    @staticmethod
    def _course_directory_queryset(semester_id):
        mapping_queryset = CourseProfessorMapping.objects.filter(
            semester_id=semester_id
        ).select_related("professor")
        assignment_filter = Q(ta_assignments__semester_id=semester_id)

        return Course.objects.prefetch_related(
            Prefetch(
                "professor_mappings",
                queryset=mapping_queryset,
                to_attr="filtered_mappings",
            )
        ).annotate(
            annotated_ta_count=Count(
                "ta_assignments",
                filter=assignment_filter,
                distinct=True,
            ),
            annotated_head_ta_count=Count(
                "ta_assignments",
                filter=assignment_filter & Q(ta_assignments__role=TAAssignment.Role.HEAD_TA),
                distinct=True,
            ),
        )
