import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import TAAssignment
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def semester(db):
    return Semester.objects.create(name="4031", start_date="2024-09-01", end_date="2025-02-01")


@pytest.fixture
def create_user(db):
    def _create_user(username, role, password="password123"):
        return User.objects.create_user(username=username, password=password, role=role)

    return _create_user


@pytest.mark.django_db
class TestAuthentication:
    def test_login_success(self, api_client, create_user):
        create_user(username="test_user", role="TA")
        url = reverse("token_obtain_pair")
        response = api_client.post(url, {"username": "test_user", "password": "password123"})
        assert response.status_code == 200
        assert "access" in response.data

    def test_me_endpoint_returns_role(self, api_client, create_user):
        user = create_user(username="prof", role="PROFESSOR")
        api_client.force_authenticate(user=user)
        url = reverse("me")
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["role"] == "professor"


@pytest.mark.django_db
class TestUserManagement:
    def test_superadmin_can_create_user(self, api_client, create_user):
        admin = create_user(username="admin", role="SUPER_ADMIN")
        api_client.force_authenticate(user=admin)
        url = reverse("user-list")
        data = {"username": "new_ta", "role": "TA", "password": "pass"}
        response = api_client.post(url, data)
        assert response.status_code == 201

    def test_professor_cannot_change_his_own_role(self, api_client, create_user):
        prof = create_user(username="prof", role="PROFESSOR")
        api_client.force_authenticate(user=prof)
        url = reverse("user-detail", kwargs={"pk": prof.id})
        response = api_client.patch(url, {"role": "SUPER_ADMIN"})
        assert response.status_code == 403


@pytest.mark.django_db
class TestRBACAcrossApps:
    def test_professor_access_to_his_own_course_tas(self, api_client, create_user, semester):
        prof_a = create_user(username="prof_a", role="PROFESSOR")

        course_a = Course.objects.create(course_code="CS101", course_name="Math")
        course_b = Course.objects.create(course_code="CS102", course_name="Physics")

        CourseProfessorMapping.objects.create(
            course=course_a, professor=prof_a, semester=semester, group="01"
        )

        api_client.force_authenticate(user=prof_a)
        url_b = reverse("course-get-tas", kwargs={"pk": course_b.id})
        response = api_client.get(url_b)
        assert response.status_code == 403

        url_a = reverse("course-get-tas", kwargs={"pk": course_a.id})
        response = api_client.get(url_a)
        assert response.status_code == 200

    def test_head_ta_access_limits(self, api_client, create_user, semester):
        head_ta = create_user(username="head", role="HEAD_TA")
        another_user = create_user(username="another", role="TA")
        prof = create_user(username="prof", role="PROFESSOR")

        course = Course.objects.create(course_code="CS200", course_name="AI")

        # اختصاص کاربر اول به عنوان Head TA
        TAAssignment.objects.create(
            user=head_ta, course=course, semester=semester, professor=prof, role="HEAD_TA"
        )

        api_client.force_authenticate(user=head_ta)
        url = reverse("assignment-create")

        # تست: تلاش هد تی‌ای برای تخصیص یک هد تی‌ایِ "جدید" (این باید 403 بدهد)
        # نکته: نام فیلدها در سریالایزر شما user_id و course_id است
        data = {
            "user_id": another_user.id,
            "course_id": course.id,
            "semester_id": semester.id,
            "role": "HEAD_TA",
            "professor_id": prof.id,
        }
        response = api_client.post(url, data)
        assert response.status_code == 403
