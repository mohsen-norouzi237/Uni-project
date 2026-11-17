import pytest
from django.contrib import admin
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User

from .models import AuditLog


@pytest.fixture
def api_client():
    return APIClient()


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
def audit_log(db, create_user):
    actor = create_user(
        username="audit_actor",
        role=User.Role.TA,
    )

    return AuditLog.objects.create(
        actor=actor,
        action=AuditLog.Action.CREATE,
        entity_type="TAAssignment",
        entity_id=1,
        new_values={"role": "TA"},
    )


@pytest.mark.django_db
class TestAuditLogAccess:
    # Super Admin should be allowed to view audit logs.
    def test_super_admin_can_view_audit_logs(self, api_client, create_user, audit_log):
        admin = create_user(
            username="super_admin",
            role=User.Role.SUPER_ADMIN,
        )
        api_client.force_authenticate(user=admin)

        response = api_client.get(reverse("audit-log-list"))

        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    # Department Admin should be allowed to view audit logs.
    def test_dept_admin_can_view_audit_logs(self, api_client, create_user, audit_log):
        admin = create_user(
            username="dept_admin",
            role=User.Role.DEPT_ADMIN,
        )
        api_client.force_authenticate(user=admin)

        response = api_client.get(reverse("audit-log-list"))

        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    # Non-management roles should be denied access to audit logs.
    @pytest.mark.parametrize(
        "role",
        [
            User.Role.PROFESSOR,
            User.Role.HEAD_TA,
            User.Role.TA,
        ],
    )
    def test_non_management_users_cannot_view_audit_logs(
        self,
        api_client,
        create_user,
        audit_log,
        role,
    ):
        user = create_user(
            username=f"user_{role.lower()}",
            role=role,
        )
        api_client.force_authenticate(user=user)

        response = api_client.get(reverse("audit-log-list"))

        assert response.status_code == 403

    # Unauthenticated users should not be allowed to view audit logs.
    def test_anonymous_user_cannot_view_audit_logs(self, api_client, audit_log):
        response = api_client.get(reverse("audit-log-list"))

        assert response.status_code == 401


@pytest.mark.django_db
def test_audit_log_data_is_returned(api_client, create_user, audit_log):
    # The API should return the expected audit log fields and values.
    admin = create_user(
        username="data_admin",
        role=User.Role.SUPER_ADMIN,
    )
    api_client.force_authenticate(user=admin)

    response = api_client.get(reverse("audit-log-list"))

    assert response.status_code == 200

    data = response.data["results"][0]

    assert data["actor"] == audit_log.actor_id
    assert data["action"] == AuditLog.Action.CREATE
    assert data["entity_type"] == "TAAssignment"
    assert data["entity_id"] == 1
    assert data["new_values"] == {"role": "TA"}


@pytest.mark.django_db
def test_audit_log_cannot_be_modified(audit_log):
    # Existing audit logs should not be editable.
    audit_log.action = AuditLog.Action.DELETE

    with pytest.raises(ValueError, match="Audit logs are immutable"):
        audit_log.save()


@pytest.mark.django_db
def test_super_admin_can_delete_audit_log(api_client, create_user, audit_log):
    # Super Admin should be allowed to delete an audit log.
    super_admin = create_user(
        username="super_admin",
        role=User.Role.SUPER_ADMIN,
    )
    api_client.force_authenticate(user=super_admin)

    response = api_client.delete(reverse("audit-log-delete", kwargs={"pk": audit_log.pk}))

    assert response.status_code == 204

    # The audit log should actually be removed from the database.
    assert not AuditLog.objects.filter(pk=audit_log.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role",
    [
        User.Role.DEPT_ADMIN,
        User.Role.PROFESSOR,
        User.Role.HEAD_TA,
        User.Role.TA,
    ],
)
def test_non_super_admin_cannot_delete_audit_log(
    api_client,
    create_user,
    audit_log,
    role,
):
    # Only Super Admin should be allowed to delete audit logs.
    user = create_user(
        username=f"user_{role.lower()}",
        role=role,
    )
    api_client.force_authenticate(user=user)

    response = api_client.delete(reverse("audit-log-delete", kwargs={"pk": audit_log.pk}))

    assert response.status_code == 403

    # Unauthorized users must not be able to delete the audit log.
    assert AuditLog.objects.filter(pk=audit_log.pk).exists()


@pytest.mark.django_db
def test_anonymous_user_cannot_delete_audit_log(api_client, audit_log):
    # Anonymous users should not be allowed to delete audit logs.
    response = api_client.delete(reverse("audit-log-delete", kwargs={"pk": audit_log.pk}))

    assert response.status_code == 401

    # The audit log should remain unchanged.
    assert AuditLog.objects.filter(pk=audit_log.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role, expected",
    [
        (User.Role.SUPER_ADMIN, True),
        (User.Role.DEPT_ADMIN, False),
        (User.Role.PROFESSOR, False),
        (User.Role.HEAD_TA, False),
        (User.Role.TA, False),
    ],
)
def test_audit_log_delete_permission_by_role(
    create_user,
    audit_log,
    role,
    expected,
):
    # Only Super Admin should be allowed to delete audit logs in Admin.
    user = create_user(
        username=f"admin_{role.lower()}",
        role=role,
    )
    audit_log_admin = admin.site._registry[AuditLog]

    assert (
        audit_log_admin.has_delete_permission(
            request=type("Request", (), {"user": user})(),
            obj=audit_log,
        )
        is expected
    )


@pytest.mark.django_db
def test_audit_log_add_permission_is_disabled(create_user):
    # Audit logs should not be manually created through Admin.
    user = create_user(
        username="admin_user",
        role=User.Role.SUPER_ADMIN,
    )
    audit_log_admin = admin.site._registry[AuditLog]

    request = type("Request", (), {"user": user})()

    assert audit_log_admin.has_add_permission(request) is False
