import datetime

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from semesters.models import Semester

User = get_user_model()


class SemesterAPITests(APITestCase):
    def setUp(self):
        # 1. Setup test users with different roles
        self.super_admin = User.objects.create_user(
            username="super_admin",
            email="admin@university.edu",
            password="Password123!",
            role=User.Role.SUPER_ADMIN,
        )
        self.ta_user = User.objects.create_user(
            username="ta_user",
            email="ta@university.edu",
            password="Password123!",
            role=User.Role.TA,
        )
        self.professor = User.objects.create_user(
            username="professor",
            email="prof@university.edu",
            password="Password123!",
            role=User.Role.PROFESSOR,
        )

        # 2. Setup baseline semester
        self.today = datetime.date.today()
        self.semester = Semester.objects.create(
            name="4051",
            start_date=self.today,
            end_date=self.today + datetime.timedelta(days=120),
            max_ta_courses_limit=3,
        )

        # URLs
        self.list_create_url = reverse("semester-list-create")
        self.detail_url = reverse("semester-detail", kwargs={"pk": self.semester.pk})

    # ==========================================
    # POSITIVE TEST CASES (Happy Paths)
    # ==========================================

    def test_list_semesters_authenticated(self):
        """Any authenticated user can list semesters."""
        self.client.force_authenticate(user=self.ta_user)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify paginated response contains our semester
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "4051")

    def test_retrieve_semester_detail_authenticated(self):
        """Any authenticated user can retrieve semester details."""
        self.client.force_authenticate(user=self.professor)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "4051")
        self.assertEqual(response.data["max_ta_courses_limit"], 3)

    def test_super_admin_can_create_semester(self):
        """Super Admin can successfully create a new semester (FR1 & FR2)."""
        self.client.force_authenticate(user=self.super_admin)
        payload = {
            "name": "4042",
            "start_date": str(self.today + datetime.timedelta(days=150)),
            "end_date": str(self.today + datetime.timedelta(days=270)),
            "max_ta_courses_limit": 2,
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "4042")
        self.assertEqual(response.data["max_ta_courses_limit"], 2)
        self.assertTrue(Semester.objects.filter(name="4042").exists())

    def test_super_admin_can_patch_workload_limit(self):
        """Super Admin can update max_ta_courses_limit via PATCH (BE-13)."""
        self.client.force_authenticate(user=self.super_admin)
        payload = {"max_ta_courses_limit": 4}
        response = self.client.patch(self.detail_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["max_ta_courses_limit"], 4)
        self.semester.refresh_from_db()
        self.assertEqual(self.semester.max_ta_courses_limit, 4)

    def test_super_admin_can_delete_semester(self):
        """Super Admin can delete a semester."""
        self.client.force_authenticate(user=self.super_admin)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Semester.objects.filter(pk=self.semester.pk).exists())

    # ==========================================
    # NEGATIVE TEST CASES (RBAC & Permissions)
    # ==========================================

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests are rejected with 401."""
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.list_create_url, {"name": "Test"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_admin_cannot_create_semester(self):
        """Regular users (TA, Professor) cannot create a semester (403 Forbidden)."""
        self.client.force_authenticate(user=self.ta_user)
        payload = {
            "name": "4055",
            "start_date": str(self.today),
            "end_date": str(self.today + datetime.timedelta(days=90)),
            "max_ta_courses_limit": 2,
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_patch_semester(self):
        """Regular users cannot update a semester (403 Forbidden)."""
        self.client.force_authenticate(user=self.professor)
        response = self.client.patch(self.detail_url, {"max_ta_courses_limit": 5}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ==========================================
    # NEGATIVE EDGE CASES (Serializer Validation - BE-14)
    # ==========================================

    def test_reverse_dates_validation_error(self):
        """Creating a semester where end_date < start_date raises 400 Bad Request."""
        self.client.force_authenticate(user=self.super_admin)
        payload = {
            "name": "4052",
            "start_date": str(self.today + datetime.timedelta(days=100)),
            "end_date": str(self.today),  # end_date before start_date!
            "max_ta_courses_limit": 2,
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

    def test_equal_dates_validation_error(self):
        """Creating a semester where start_date == end_date raises 400 Bad Request."""
        self.client.force_authenticate(user=self.super_admin)
        payload = {
            "name": "4053",
            "start_date": str(self.today),
            "end_date": str(self.today),
            "max_ta_courses_limit": 2,
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

    def test_zero_or_negative_workload_limit_validation_error(self):
        """Workload limit < 1 raises 400 Bad Request."""
        self.client.force_authenticate(user=self.super_admin)

        # Test limit = 0
        response = self.client.post(
            self.list_create_url,
            {
                "name": "4054",
                "start_date": str(self.today),
                "end_date": str(self.today + datetime.timedelta(days=60)),
                "max_ta_courses_limit": 0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_ta_courses_limit", response.data)

        # Test limit = -1
        response = self.client.patch(
            self.detail_url,
            {"max_ta_courses_limit": -1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_ta_courses_limit", response.data)

    def test_patch_partial_date_validation_error(self):
        """Partial update of end_date to prior to existing start_date raises 400."""
        self.client.force_authenticate(user=self.super_admin)
        # Try updating end_date to yesterday (which is before start_date = today)
        payload = {"end_date": str(self.today - datetime.timedelta(days=1))}
        response = self.client.patch(self.detail_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", response.data)

    def test_duplicate_name_collision_error(self):
        """Attempting to create a semester with an existing name raises 400."""
        self.client.force_authenticate(user=self.super_admin)
        payload = {
            "name": "4051",  # Already exists!
            "start_date": str(self.today + datetime.timedelta(days=200)),
            "end_date": str(self.today + datetime.timedelta(days=300)),
            "max_ta_courses_limit": 2,
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)
