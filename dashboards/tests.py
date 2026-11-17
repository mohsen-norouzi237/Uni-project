import pytest
from rest_framework.test import APIClient

from accounts.models import User
from assignments.models import TAAssignment
from courses.models import Course, CourseProfessorMapping
from dashboards.serializers import WorkloadStatus
from dashboards.services import get_workload_data
from semesters.models import Semester


@pytest.fixture
def semester(db):
    return Semester.objects.create(
        name="4051",
        start_date="2026-09-01",
        end_date="2027-01-31",
        max_ta_courses_limit=3,
    )


@pytest.fixture
def create_user(db):
    def _create_user(username, role):
        return User.objects.create_user(
            username=username,
            password="password123",
            role=role,
        )

    return _create_user


@pytest.fixture
def create_course(db, create_user):
    def _create_course(semester, code):
        course = Course.objects.create(
            course_code=code,
            course_name=f"Course {code}",
        )

        professor = create_user(
            username=f"professor_{code}",
            role=User.Role.PROFESSOR,
        )

        CourseProfessorMapping.objects.create(
            course=course,
            professor=professor,
            semester=semester,
        )

        return course

    return _create_course


@pytest.fixture
def api_client():
    return APIClient()


def _assign(user, course, semester, role=TAAssignment.Role.TA):
    professor = (
        CourseProfessorMapping.objects.filter(course=course, semester=semester).first().professor
    )
    return TAAssignment.objects.create(
        user=user, course=course, semester=semester, professor=professor, role=role
    )


@pytest.mark.django_db
def test_workload_data_for_available_user(
    semester,
    create_user,
    create_course,
):
    # Verify workload status when a user hasn't reached the semester limit.
    user = create_user("available_ta", User.Role.TA)
    course = create_course(semester, "CS101")

    _assign(user, course, semester)

    workload = get_workload_data(semester)

    user_data = next(item for item in workload if item["user_id"] == user.id)

    assert user_data["current_courses"] == 1
    assert user_data["max_courses"] == 3
    assert user_data["remaining"] == 2
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_data_for_user_at_capacity(
    semester,
    create_user,
    create_course,
):
    # Verify workload status when a user reaches the semester limit.
    user = create_user("at_cap_ta", User.Role.TA)

    for index in range(3):
        course = create_course(semester, f"CS10{index}")

        _assign(user, course, semester)

    workload = get_workload_data(semester)

    user_data = next(item for item in workload if item["user_id"] == user.id)

    assert user_data["current_courses"] == 3
    assert user_data["max_courses"] == 3
    assert user_data["remaining"] == 0
    assert user_data["status"] == WorkloadStatus.AT_CAP


@pytest.mark.django_db
def test_workload_data_for_user_over_limit(
    semester,
    create_user,
    create_course,
):
    # Verify workload status when a user exceeds the semester limit.
    user = create_user("over_limit_ta", User.Role.TA)

    for index in range(4):
        course = create_course(semester, f"CS20{index}")

        _assign(user, course, semester)

    workload = get_workload_data(semester)

    user_data = next(item for item in workload if item["user_id"] == user.id)

    assert user_data["current_courses"] == 4
    assert user_data["max_courses"] == 3
    assert user_data["remaining"] == 0
    assert user_data["status"] == WorkloadStatus.OVER_LIMIT


@pytest.mark.django_db
def test_workload_data_includes_head_ta(
    semester,
    create_user,
    create_course,
):
    # Verify that Head TAs are included in workload monitoring.
    user = create_user("head_ta", User.Role.HEAD_TA)
    course = create_course(semester, "CS301")

    _assign(user, course, semester, role=TAAssignment.Role.HEAD_TA)

    workload = get_workload_data(semester)

    user_data = next(item for item in workload if item["user_id"] == user.id)

    assert user_data["role"] == User.Role.HEAD_TA
    assert user_data["current_courses"] == 1
    assert user_data["remaining"] == 2
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_data_excludes_other_user_roles(
    semester,
    create_user,
):
    # Verify that only TA and Head TA users are included.
    create_user("professor", User.Role.PROFESSOR)
    create_user("dept_admin", User.Role.DEPT_ADMIN)
    create_user("super_admin", User.Role.SUPER_ADMIN)

    workload = get_workload_data(semester)

    returned_roles = {item["role"] for item in workload}

    assert User.Role.PROFESSOR not in returned_roles
    assert User.Role.DEPT_ADMIN not in returned_roles
    assert User.Role.SUPER_ADMIN not in returned_roles


@pytest.mark.django_db
def test_workload_data_is_isolated_by_semester(
    semester,
    create_user,
    create_course,
):
    # Verify that assignments from other semesters are not counted.
    other_semester = Semester.objects.create(
        name="4042",
        start_date="2026-02-01",
        end_date="2026-06-30",
    )

    user = create_user("semester_ta", User.Role.TA)

    current_course = create_course(semester, "CS401")
    other_course = create_course(other_semester, "CS402")

    _assign(user, current_course, semester)
    _assign(user, other_course, other_semester)

    workload = get_workload_data(semester)

    user_data = next(item for item in workload if item["user_id"] == user.id)

    assert user_data["current_courses"] == 1
    assert user_data["max_courses"] == semester.max_ta_courses_limit
    assert user_data["remaining"] == semester.max_ta_courses_limit - 1
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_api_allows_super_admin(
    api_client,
    semester,
    create_user,
):
    # Verify that Super Admin can access workload monitoring.
    admin = create_user("super_admin", User.Role.SUPER_ADMIN)
    api_client.force_authenticate(user=admin)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_workload_api_allows_department_admin(
    api_client,
    semester,
    create_user,
):
    # Verify that Department Admin can access workload monitoring.
    admin = create_user("dept_admin", User.Role.DEPT_ADMIN)
    api_client.force_authenticate(user=admin)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role",
    [
        User.Role.TA,
        User.Role.HEAD_TA,
    ],
)
def test_workload_api_denies_non_management_users(
    api_client,
    semester,
    create_user,
    role,
):
    # Verify that non-management users cannot access workload monitoring.
    user = create_user(f"user_{role}", role)
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_workload_api_allows_professor_scoped_access(
    api_client,
    semester,
    create_user,
):
    # BE-35 opened workload monitoring to professors (scoped to their courses).
    user = create_user("user_professor", User.Role.PROFESSOR)
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_workload_api_requires_authentication(
    api_client,
    semester,
):
    # Verify that unauthenticated users cannot access workload monitoring.
    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_workload_api_returns_correct_workload_data(
    api_client,
    semester,
    create_user,
    create_course,
):
    # Verify that the API returns the correct workload data.
    admin = create_user("workload_admin", User.Role.SUPER_ADMIN)
    user = create_user("workload_ta", User.Role.TA)

    course = create_course(semester, "CS501")

    _assign(user, course, semester)

    api_client.force_authenticate(user=admin)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 200
    assert len(response.data) == 1

    user_data = response.data[0]

    assert user_data["user_id"] == user.id
    assert user_data["username"] == user.username
    assert user_data["role"] == User.Role.TA
    assert user_data["current_courses"] == 1
    assert user_data["max_courses"] == 3
    assert user_data["remaining"] == 2
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_api_filters_by_semester(
    api_client,
    semester,
    create_user,
    create_course,
):
    # Verify that the API counts assignments only for the requested semester.
    other_semester = Semester.objects.create(
        name="4042",
        start_date="2026-02-01",
        end_date="2026-06-30",
        max_ta_courses_limit=2,
    )

    admin = create_user("semester_admin", User.Role.SUPER_ADMIN)
    user = create_user("semester_ta", User.Role.TA)

    current_course = create_course(semester, "CS601")
    other_course = create_course(other_semester, "CS602")

    _assign(user, current_course, semester)
    _assign(user, other_course, other_semester)

    api_client.force_authenticate(user=admin)

    response = api_client.get(f"/api/dashboards/workload/?semester_id={semester.id}")

    assert response.status_code == 200
    assert len(response.data) == 1

    user_data = response.data[0]

    assert user_data["current_courses"] == 1
    assert user_data["max_courses"] == semester.max_ta_courses_limit
    assert user_data["remaining"] == semester.max_ta_courses_limit - 1
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_api_uses_latest_semester(
    api_client,
    create_user,
    create_course,
):
    # Verify that the latest semester is used when no semester ID is provided.
    older_semester = Semester.objects.create(
        name="4042",
        start_date="2026-02-01",
        end_date="2026-06-30",
        max_ta_courses_limit=2,
    )

    latest_semester = Semester.objects.create(
        name="4051",
        start_date="2026-09-01",
        end_date="2027-01-31",
        max_ta_courses_limit=3,
    )

    admin = create_user("latest_admin", User.Role.SUPER_ADMIN)
    user = create_user("latest_ta", User.Role.TA)

    older_course = create_course(older_semester, "CS701")
    latest_course = create_course(latest_semester, "CS702")

    _assign(user, older_course, older_semester)
    _assign(user, latest_course, latest_semester)

    api_client.force_authenticate(user=admin)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 200
    assert len(response.data) == 1

    user_data = response.data[0]

    assert user_data["current_courses"] == 1
    assert user_data["max_courses"] == 3
    assert user_data["remaining"] == 2
    assert user_data["status"] == WorkloadStatus.AVAILABLE


@pytest.mark.django_db
def test_workload_api_returns_404_when_no_semester_exists(
    api_client,
    create_user,
):
    # Verify that the API returns 404 when no semester exists.
    admin = create_user("no_semester_admin", User.Role.SUPER_ADMIN)
    api_client.force_authenticate(user=admin)

    response = api_client.get("/api/dashboards/workload/")

    assert response.status_code == 404
    assert response.data["error"] == "ترمی یافت نشد"
