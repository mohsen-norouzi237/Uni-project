import concurrent.futures
from unittest.mock import patch

from django.db import IntegrityError, OperationalError, close_old_connections, connections
from django.test import TestCase, TransactionTestCase

from accounts.models import User
from assignments.models import TAAssignment
from assignments.services import assign_ta, remove_ta_assignment
from audit.models import AuditLog
from core.exceptions import (
    AssignmentNotFoundError,
    CourseProfessorMismatchError,
    DuplicateAssignmentError,
    HeadTAAlreadyExistsError,
    InvalidAssignmentRoleError,
    MaxCourseLimitReachedError,
)
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester


class AssignTAServiceTests(TestCase):
    """
    تست‌های استاندارد سرویس تخصیص تی ای (Positive & Negative Cases)
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="test_ta",
            password="test123",
            role=User.Role.TA,
        )

        self.actor = User.objects.create_user(
            username="test_actor",
            password="test123",
            role=User.Role.DEPT_ADMIN,
        )

        self.semester = Semester.objects.create(
            name="4031",
            start_date="2024-09-01",
            end_date="2025-01-30",
            max_ta_courses_limit=3,
        )

        self.course = Course.objects.create(
            course_code="CS101",
            course_name="Introduction to Programming",
        )

        self.professor = User.objects.create_user(
            username="test_prof",
            password="test123",
            role=User.Role.PROFESSOR,
        )

        CourseProfessorMapping.objects.create(
            course=self.course,
            semester=self.semester,
            group="01",
            professor=self.professor,
        )

    # Positive Cases

    def test_assign_ta_creates_assignment(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        self.assertEqual(assignment.user, self.user)
        self.assertEqual(assignment.role, TAAssignment.Role.TA)
        self.assertEqual(assignment.professor, self.professor)
        self.assertTrue(TAAssignment.objects.filter(id=assignment.id).exists())

    def test_assign_ta_creates_audit_log(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        audit_log = AuditLog.objects.get(
            action=AuditLog.Action.CREATE,
            entity_type="TAAssignment",
            entity_id=assignment.id,
        )

        self.assertEqual(audit_log.actor, self.actor)
        self.assertIsNone(audit_log.old_values)
        self.assertEqual(
            audit_log.new_values,
            {
                "user_id": assignment.user_id,
                "course_id": assignment.course_id,
                "semester_id": assignment.semester_id,
                "professor_id": assignment.professor_id,
                "role": assignment.role,
            },
        )

    def test_assign_ta_rolls_back_assignment_when_audit_log_fails(self):
        with patch(
            "assignments.services.create_audit_log",
            side_effect=RuntimeError("Audit log failed"),
        ):
            with self.assertRaises(RuntimeError):
                assign_ta(
                    user=self.user,
                    course=self.course,
                    semester=self.semester,
                    professor=self.professor,
                    role=TAAssignment.Role.TA,
                    actor=self.actor,
                )

        self.assertFalse(
            TAAssignment.objects.filter(
                user=self.user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
            ).exists()
        )

    def test_remove_ta_assignment_keeps_assignment_when_audit_log_fails(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        with patch(
            "assignments.services.create_audit_log",
            side_effect=RuntimeError("Audit log failed"),
        ):
            with self.assertRaises(RuntimeError):
                remove_ta_assignment(
                    assignment.id,
                    actor=self.actor,
                )

        self.assertTrue(TAAssignment.objects.filter(id=assignment.id).exists())

    def test_remove_ta_assignment_rolls_back_when_delete_fails(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        assignment_id = assignment.id

        original_delete = TAAssignment.delete

        def delete_then_fail(instance, *args, **kwargs):
            original_delete(instance, *args, **kwargs)
            raise RuntimeError("Delete failed")

        with patch.object(TAAssignment, "delete", delete_then_fail):
            with self.assertRaises(RuntimeError):
                remove_ta_assignment(
                    assignment_id,
                    actor=self.actor,
                )

        self.assertTrue(TAAssignment.objects.filter(id=assignment_id).exists())
        self.assertFalse(
            AuditLog.objects.filter(
                action=AuditLog.Action.DELETE,
                entity_type="TAAssignment",
                entity_id=assignment_id,
            ).exists()
        )

    def test_assign_head_ta_creates_assignment(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.HEAD_TA,
            actor=self.actor,
        )

        self.assertEqual(assignment.role, TAAssignment.Role.HEAD_TA)
        self.assertTrue(TAAssignment.objects.filter(id=assignment.id).exists())

    def test_remove_ta_assignment_deletes_record(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )
        self.assertEqual(TAAssignment.objects.count(), 1)

        result = remove_ta_assignment(
            assignment.id,
            actor=self.actor,
        )

        self.assertTrue(result)
        self.assertEqual(TAAssignment.objects.count(), 0)

    def test_remove_ta_assignment_creates_audit_log(self):
        assignment = assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        assignment_id = assignment.id

        result = remove_ta_assignment(
            assignment_id,
            actor=self.actor,
        )

        self.assertTrue(result)

        audit_log = AuditLog.objects.get(
            action=AuditLog.Action.DELETE,
            entity_type="TAAssignment",
            entity_id=assignment_id,
        )

        self.assertEqual(audit_log.actor, self.actor)
        self.assertEqual(
            audit_log.old_values,
            {
                "user_id": self.user.id,
                "course_id": self.course.id,
                "semester_id": self.semester.id,
                "professor_id": self.professor.id,
                "role": TAAssignment.Role.TA,
            },
        )
        self.assertIsNone(audit_log.new_values)

    # Negative Cases

    def test_assign_ta_rejects_invalid_role(self):
        # Reject an assignment with an unsupported role.
        with self.assertRaises(InvalidAssignmentRoleError):
            assign_ta(
                user=self.user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role="INVALID_ROLE",
                actor=self.actor,
            )

        # Verify that no assignment was created.
        self.assertEqual(TAAssignment.objects.count(), 0)

    def test_assign_ta_rejects_mismatched_course_and_semester(self):
        # Create a different semester that does not belong to the course.
        another_semester = Semester.objects.create(
            name="4032",
            start_date="2025-02-01",
            end_date="2025-06-30",
            max_ta_courses_limit=3,
        )

        # Reject an assignment when the professor does not teach the course
        # in the requested semester.
        with self.assertRaises(CourseProfessorMismatchError):
            assign_ta(
                user=self.user,
                course=self.course,
                semester=another_semester,
                professor=self.professor,
                role=TAAssignment.Role.TA,
                actor=self.actor,
            )

        # Verify that no assignment was created.
        self.assertEqual(TAAssignment.objects.count(), 0)

    def test_assign_ta_rejects_duplicate_assignment(self):
        # Create the initial assignment.
        assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
            actor=self.actor,
        )

        # Reject assigning the same user to the same professor slot again.
        with self.assertRaises(DuplicateAssignmentError):
            assign_ta(
                user=self.user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.TA,
                actor=self.actor,
            )

        self.assertEqual(TAAssignment.objects.count(), 1)

    def test_assign_ta_rejects_when_workload_limit_is_reached(self):
        # پر کردن ظرفیت دانشجو
        for i in range(self.semester.max_ta_courses_limit):
            temp_course = Course.objects.create(
                course_code=f"CS{102 + i}",
                course_name=f"Course {i}",
            )
            CourseProfessorMapping.objects.create(
                course=temp_course,
                semester=self.semester,
                group="01",
                professor=self.professor,
            )
            assign_ta(
                user=self.user,
                course=temp_course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.TA,
                actor=self.actor,
            )

        new_course = Course.objects.create(
            course_code="CS999",
            course_name="Overload Course",
        )
        CourseProfessorMapping.objects.create(
            course=new_course,
            semester=self.semester,
            group="01",
            professor=self.professor,
        )

        with self.assertRaises(MaxCourseLimitReachedError):
            assign_ta(
                user=self.user,
                course=new_course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.TA,
                actor=self.actor,
            )

    def test_assign_head_ta_rejects_duplicate_head_ta(self):
        assign_ta(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.HEAD_TA,
            actor=self.actor,
        )

        second_user = User.objects.create_user(username="second_ta", password="123")

        with self.assertRaises(HeadTAAlreadyExistsError):
            assign_ta(
                user=second_user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.HEAD_TA,
                actor=self.actor,
            )

    def test_remove_ta_assignment_raises_error_for_invalid_id(self):
        with self.assertRaises(AssignmentNotFoundError):
            remove_ta_assignment(
                99999,
                actor=self.actor,
            )


class AssignTAServiceConcurrencyTests(TransactionTestCase):
    """
    تست‌های هم‌روندی (Race Condition).
    """

    def setUp(self):
        self.semester = Semester.objects.create(
            name="4041",
            start_date="2026-09-01",
            end_date="2027-01-30",
            max_ta_courses_limit=3,
        )
        self.course = Course.objects.create(
            course_code="CS-CONCURRENT",
            course_name="Concurrency DB Test",
        )
        self.professor = User.objects.create_user(
            username="concur_prof",
            password="123",
            role=User.Role.PROFESSOR,
        )
        CourseProfessorMapping.objects.create(
            course=self.course,
            semester=self.semester,
            group="01",
            professor=self.professor,
        )
        self.user = User.objects.create_user(username="race_ta", password="123")
        self.actor = User.objects.create_user(
            username="concurrency_actor",
            password="123",
            role=User.Role.DEPT_ADMIN,
        )

    def test_concurrent_duplicate_assignments_race_condition(self):
        def attempt_assignment(_):
            try:
                assign_ta(
                    user=self.user,
                    course=self.course,
                    semester=self.semester,
                    professor=self.professor,
                    role=TAAssignment.Role.TA,
                    actor=self.actor,
                )
                return "SUCCESS"
            except DuplicateAssignmentError:
                return "EXPECTED_ERROR"
            except (IntegrityError, OperationalError):
                return "EXPECTED_ERROR"
            except Exception as e:
                return f"UNEXPECTED: {type(e).__name__} - {str(e)}"
            finally:
                # بستن کامل کانکشن‌های این ترد برای جلوگیری از قفل شدن دیتابیس
                connections.close_all()

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(attempt_assignment, range(5)))

        self.assertEqual(results.count("SUCCESS"), 1, f"Expected exactly 1 SUCCESS, got: {results}")
        self.assertEqual(
            results.count("EXPECTED_ERROR"),
            4,
            f"Expected exactly 4 EXPECTED_ERRORs, got: {results}",
        )

    def test_concurrent_head_ta_race_condition(self):
        users = [
            User.objects.create_user(username=f"head_ta_{i}", password="123") for i in range(5)
        ]

        def attempt_head_ta_assignment(user):
            try:
                assign_ta(
                    user=user,
                    course=self.course,
                    semester=self.semester,
                    professor=self.professor,
                    role=TAAssignment.Role.HEAD_TA,
                    actor=self.actor,
                )
                return "SUCCESS"
            except HeadTAAlreadyExistsError:
                return "EXPECTED_ERROR"
            except (IntegrityError, OperationalError):
                return "EXPECTED_ERROR"
            except Exception as e:
                return f"UNEXPECTED: {type(e).__name__} - {str(e)}"
            finally:
                # بستن کامل کانکشن‌های این ترد برای جلوگیری از قفل شدن دیتابیس
                connections.close_all()

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(attempt_head_ta_assignment, users))

        self.assertEqual(results.count("SUCCESS"), 1, f"Expected exactly 1 SUCCESS, got: {results}")
        self.assertEqual(
            results.count("EXPECTED_ERROR"),
            4,
            f"Expected exactly 4 EXPECTED_ERRORs, got: {results}",
        )
