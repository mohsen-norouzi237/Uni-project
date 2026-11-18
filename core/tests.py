from datetime import date
from io import StringIO
from unittest import skipUnless

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, models
from django.test import TestCase

from accounts.models import User
from assignments.models import TAAssignment
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester


class SmokeTests(TestCase):
    def test_settings_loaded(self):
        self.assertTrue(True)


class SeedDataCommandTests(TestCase):
    def test_command_creates_repeatable_valid_data(self):
        output = StringIO()

        call_command("seed_data", password="test-password", stdout=output)

        self.assertEqual(User.objects.count(), 18)
        self.assertEqual(Semester.objects.count(), 2)
        self.assertEqual(Course.objects.count(), 9)
        self.assertEqual(CourseProfessorMapping.objects.count(), 9)
        self.assertEqual(TAAssignment.objects.count(), 18)
        self.assertTrue(User.objects.get(username="superadmin").check_password("test-password"))
        self.assertEqual(
            TAAssignment.objects.filter(role=TAAssignment.Role.HEAD_TA).count(),
            6,
        )
        self.assertIn("users=18", output.getvalue())

        call_command("seed_data", password="different-password")

        self.assertEqual(User.objects.count(), 18)
        self.assertEqual(Semester.objects.count(), 2)
        self.assertEqual(Course.objects.count(), 9)
        self.assertEqual(CourseProfessorMapping.objects.count(), 9)
        self.assertEqual(TAAssignment.objects.count(), 18)
        self.assertTrue(User.objects.get(username="superadmin").check_password("test-password"))


class GenerateLoadDataCommandTests(TestCase):
    def test_command_creates_valid_batched_load_data(self):
        output = StringIO()

        call_command(
            "generate_load_data",
            users=20,
            courses=5,
            batch_size=2,
            prefix="benchmark",
            confirm=True,
            stdout=output,
        )

        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(Semester.objects.count(), 1)
        self.assertEqual(Course.objects.count(), 5)
        self.assertEqual(CourseProfessorMapping.objects.count(), 5)
        self.assertEqual(TAAssignment.objects.count(), 15)
        self.assertEqual(TAAssignment.objects.filter(role=TAAssignment.Role.HEAD_TA).count(), 5)
        self.assertFalse(User.objects.get(username="benchmark-ta-00001").has_usable_password())
        workload_counts = TAAssignment.objects.values("user_id").annotate(count=models.Count("id"))
        self.assertTrue(all(row["count"] <= 3 for row in workload_counts))
        self.assertIn("assignments=15", output.getvalue())

    def test_command_requires_explicit_confirmation(self):
        with self.assertRaisesMessage(CommandError, "Pass --confirm"):
            call_command("generate_load_data", users=20, courses=5)


@skipUnless(connection.vendor == "postgresql", "PostgreSQL database objects are required")
class PostgreSQLDatabaseObjectsTests(TestCase):
    def setUp(self):
        self.semester = Semester.objects.create(
            name="4051",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 1, 31),
            max_ta_courses_limit=3,
        )
        self.user = User.objects.create_user(username="workload_ta", role=User.Role.TA)
        self.professor = User.objects.create_user(
            username="workload_prof", role=User.Role.PROFESSOR
        )
        first_course = Course.objects.create(
            course_code="WORKLOAD-101",
            course_name="Workload Test One",
        )
        second_course = Course.objects.create(
            course_code="WORKLOAD-102",
            course_name="Workload Test Two",
        )
        TAAssignment.objects.create(
            user=self.user,
            course=first_course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
        )
        TAAssignment.objects.create(
            user=self.user,
            course=second_course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
        )

    def test_workload_view_aggregates_assignment_count_and_capacity(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT assigned_courses, max_ta_courses_limit, remaining_courses, workload_status
                FROM v_ta_workload
                WHERE user_id = %s AND semester_id = %s
                """,
                [self.user.pk, self.semester.pk],
            )
            result = cursor.fetchone()

        self.assertEqual(result, (2, 3, 1, "AVAILABLE"))

    def test_updated_at_trigger_handles_raw_sql_updates(self):
        previous_updated_at = self.semester.updated_at

        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE semesters SET max_ta_courses_limit = %s WHERE id = %s",
                [2, self.semester.pk],
            )

        self.semester.refresh_from_db()
        self.assertGreater(self.semester.updated_at, previous_updated_at)
