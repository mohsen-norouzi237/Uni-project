from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from assignments.models import TAAssignment
from semesters.models import Semester

from .models import Course, CourseProfessorMapping

User = get_user_model()


class CourseAndMappingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        settings.CACHES = {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            }
        }

    def setUp(self):
        self.dept_admin = User.objects.create_user(
            username="admin_dept", password="123", role="DEPT_ADMIN"
        )
        self.professor = User.objects.create_user(
            username="prof_ahmadi", password="123", role="PROFESSOR"
        )
        self.ta_user = User.objects.create_user(username="ta_student", password="123", role="TA")

        self.semester = Semester.objects.create(
            name="4031", start_date="2024-09-01", end_date="2025-01-31", max_ta_courses_limit=3
        )

        self.course = Course.objects.create(course_code="CE101", course_name="برنامه نویسی پیشرفته")

        cache.clear()

    # دسترسی ساخت درس فقط برای مدیر گروه
    def test_create_course_by_dept_admin(self):
        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("course-list")
        data = {"course_code": "CE102", "course_name": "ساختمان داده"}

        cache.set("courses_list_semester_all", ["dummy_data"])
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Course.objects.count(), 2)
        self.assertIsNone(cache.get("courses_list_semester_all"))

    # خطای دسترسی برای کاربر غیرمجاز هنگام ساخت درس
    def test_create_course_forbidden_for_professor(self):
        self.client.force_authenticate(user=self.professor)
        url = reverse("course-list")
        data = {"course_code": "CE103", "course_name": "مدار منطقی"}

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # تخصیص موفقیت‌آمیز استاد به درس و ابطال کش
    def test_assign_professor_success_and_cache_invalidation(self):
        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("assign-professor")
        data = {
            "course": self.course.id,
            "professor": self.professor.id,
            "semester": self.semester.id,
            "group": "01",
        }

        cache.set("courses_list_semester_all", ["cached_professor_data"])
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CourseProfessorMapping.objects.count(), 1)
        self.assertIsNone(cache.get("courses_list_semester_all"))

    # جلوگیری از تخصیص کاربری که نقش استاد ندارد
    def test_assign_non_professor_fails(self):
        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("assign-professor")
        data = {
            "course": self.course.id,
            "professor": self.ta_user.id,
            "semester": self.semester.id,
            "group": "01",
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # جلوگیری از تخصیص چند استاد به یک درس، ترم و گروه یکسان
    def test_unique_professor_per_course_semester_group(self):
        CourseProfessorMapping.objects.create(
            course=self.course, semester=self.semester, professor=self.professor, group="01"
        )

        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("assign-professor")

        prof2 = User.objects.create_user(username="prof2", role="PROFESSOR")
        data = {
            "course": self.course.id,
            "semester": self.semester.id,
            "professor": prof2.id,
            "group": "01",
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # تست امکان ثبت چند گروه متفاوت برای یک درس در یک ترم
    def test_multiple_groups_per_course_semester_allowed(self):
        CourseProfessorMapping.objects.create(
            course=self.course, semester=self.semester, professor=self.professor, group="01"
        )

        self.client.force_authenticate(user=self.dept_admin)
        url = reverse("assign-professor")

        prof2 = User.objects.create_user(username="prof2", role="PROFESSOR")
        data = {
            "course": self.course.id,
            "semester": self.semester.id,
            "professor": prof2.id,
            "group": "02",
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # تست اکشن دریافت لیست دستیاران درس (get_tas)
    def test_get_tas_action_and_serializer_fields(self):
        head_ta = User.objects.create_user(username="head_ta_user", password="123", role="TA")
        normal_ta = User.objects.create_user(username="normal_ta_user", password="123", role="TA")

        TAAssignment.objects.create(
            user=head_ta,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.HEAD_TA,
        )
        TAAssignment.objects.create(
            user=normal_ta,
            course=self.course,
            semester=self.semester,
            professor=self.professor,
            role=TAAssignment.Role.TA,
        )

        self.client.force_authenticate(user=self.dept_admin)

        # ۱. بررسی فیلدهای CourseSerializer
        detail_url = reverse("course-detail", kwargs={"pk": self.course.id})
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertTrue(res_detail.data["has_head_ta"])
        self.assertEqual(res_detail.data["ta_count"], 2)

        # ۲. بررسی پاسخ اکشن get_tas (اصلاح نام URL)
        tas_url = reverse("course-get-tas", kwargs={"pk": self.course.id})
        res_tas = self.client.get(tas_url)
        self.assertEqual(res_tas.status_code, status.HTTP_200_OK)
        self.assertEqual(res_tas.data["head_ta"]["id"], head_ta.id)
        self.assertEqual(len(res_tas.data["tas"]), 1)
        self.assertEqual(res_tas.data["tas"][0]["id"], normal_ta.id)
