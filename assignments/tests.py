from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from core.error_codes import ErrorCode
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester

from .models import TAAssignment


class TAAssignmentConstraintTests(TestCase):
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username="test_ta",
            password="test123",
            role=User.Role.TA,
        )

        # Create test semester
        self.semester = Semester.objects.create(
            name="9999",
            start_date="2099-01-01",
            end_date="2099-06-01",
        )

        # Create test course
        self.course = Course.objects.create(
            course_code="TEST101",
            course_name="Test Course",
        )

        # Create test professors (one slot each for the same course+semester)
        self.professor = User.objects.create_user(
            username="test_prof",
            password="test123",
            role=User.Role.PROFESSOR,
        )
        self.other_professor = User.objects.create_user(
            username="other_test_prof",
            password="test123",
            role=User.Role.PROFESSOR,
        )

    def test_duplicate_assignment_is_rejected(self):
        # Create the first assignment
        TAAssignment.objects.create(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
        )

        # The same user cannot be assigned to the same professor slot twice
        with self.assertRaises((ValidationError, IntegrityError)):
            TAAssignment.objects.create(
                user=self.user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.HEAD_TA,
            )

        # ... but the same user may staff another professor's slot.
        TAAssignment.objects.create(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.other_professor,
            role=TAAssignment.Role.TA,
        )
        self.assertEqual(TAAssignment.objects.filter(user=self.user).count(), 2)

    def test_only_one_head_ta_per_professor_slot(self):
        # Create the first Head TA assignment
        TAAssignment.objects.create(
            user=self.user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.HEAD_TA,
        )

        # Create another user for the second Head TA
        second_user = User.objects.create_user(
            username="second_test_ta",
            password="test123",
            role=User.Role.TA,
        )

        # A professor slot can have only one Head TA
        with self.assertRaises((ValidationError, IntegrityError)):
            TAAssignment.objects.create(
                user=second_user,
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role=TAAssignment.Role.HEAD_TA,
            )

        # ... but another professor's slot gets its own Head TA.
        third_user = User.objects.create_user(
            username="third_test_ta",
            password="test123",
            role=User.Role.TA,
        )
        TAAssignment.objects.create(
            user=third_user,
            course=self.course,
            semester=self.semester,
            professor=self.other_professor,
            role=TAAssignment.Role.HEAD_TA,
        )
        self.assertEqual(TAAssignment.objects.filter(role=TAAssignment.Role.HEAD_TA).count(), 2)


class DeleteAssignmentAPITests(APITestCase):
    """تست‌های اندپوینت حذف تخصیص و قوانین دسترسی RBAC"""

    def setUp(self):
        self.semester = Semester.objects.create(
            name="4031",
            start_date="2024-09-01",
            end_date="2025-01-20",
            max_ta_courses_limit=3,
        )
        self.course = Course.objects.create(
            course_code="CS101",
            course_name="اصول برنامه‌نویسی",
        )
        self.dept_admin = User.objects.create_user(
            username="admin_user", password="123", role="DEPT_ADMIN"
        )
        self.professor = User.objects.create_user(
            username="prof_user", password="123", role="PROFESSOR"
        )
        self.other_professor = User.objects.create_user(
            username="other_prof_user",
            password="123",
            role="PROFESSOR",
        )
        CourseProfessorMapping.objects.create(
            course=self.course,
            professor=self.professor,
            semester=self.semester,
            group="01",
        )

        self.head_ta_user = User.objects.create_user(
            username="head_ta_user", password="123", role="TA"
        )
        self.ta_user = User.objects.create_user(username="ta_user", password="123", role="TA")

        self.head_ta_assignment = TAAssignment.objects.create(
            user=self.head_ta_user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.HEAD_TA,
        )
        self.ta_assignment = TAAssignment.objects.create(
            user=self.ta_user,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
        )

    def test_dept_admin_can_delete_any_assignment(self):
        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("assignment-delete", kwargs={"pk": self.ta_assignment.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_professor_can_delete_ta_of_their_course(self):
        self.client.force_authenticate(user=self.professor)
        url = reverse("assignment-delete", kwargs={"pk": self.ta_assignment.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_head_ta_can_delete_regular_ta(self):
        self.client.force_authenticate(user=self.head_ta_user)
        url = reverse("assignment-delete", kwargs={"pk": self.ta_assignment.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_professor_cannot_delete_ta_of_another_professors_course(self):
        self.client.force_authenticate(user=self.other_professor)

        url = reverse("assignment-delete", kwargs={"pk": self.ta_assignment.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["status_code"], status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data["code"],
            ErrorCode.COURSE_PROFESSOR_ACCESS_DENIED,
        )
        self.assertIn("error", response.data)

    def test_head_ta_cannot_delete_head_ta(self):
        self.client.force_authenticate(user=self.head_ta_user)
        url = reverse("assignment-delete", kwargs={"pk": self.head_ta_assignment.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["status_code"], status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data["code"],
            ErrorCode.HEAD_TA_CANNOT_DELETE_HEAD_TA,
        )
        self.assertIn("error", response.data)

    def test_create_assignment_with_invalid_role_returns_typed_error(self):
        self.client.force_authenticate(user=self.professor)

        data = {
            "user_id": self.ta_user.id,
            "course_id": self.course.id,
            "semester_id": self.semester.id,
            "professor_id": self.professor.id,
            "role": "INVALID_ROLE",
        }

        response = self.client.post(
            reverse("assignment-create"),
            data,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["code"],
            ErrorCode.INVALID_ASSIGNMENT_ROLE,
        )

    def test_delete_nonexistent_assignment_returns_typed_error(self):
        self.client.force_authenticate(user=self.dept_admin)

        url = reverse("assignment-delete", kwargs={"pk": 999999})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            response.data["code"],
            ErrorCode.ASSIGNMENT_NOT_FOUND,
        )
