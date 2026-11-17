from django.apps import apps
from rest_framework import permissions


class BaseRolePermission(permissions.BasePermission):
    required_role = None

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == self.required_role
        )


class IsSuperAdmin(BaseRolePermission):
    required_role = "SUPER_ADMIN"


class IsDeptAdmin(BaseRolePermission):
    required_role = "DEPT_ADMIN"


class IsProfessor(BaseRolePermission):
    required_role = "PROFESSOR"

    def has_object_permission(self, request, view, obj):
        # Super Admin همیشه دسترسی دارد
        if request.user.role == "SUPER_ADMIN":
            return True

        CourseProfessorMapping = apps.get_model("courses", "CourseProfessorMapping")

        # اگر خود آبجکت مستقیما مپینگ باشد
        if obj.__class__.__name__ == "CourseProfessorMapping":
            return obj.professor == request.user

        course = obj if obj.__class__.__name__ == "Course" else getattr(obj, "course", None)

        if course:
            filters = {"course": course, "professor": request.user}

            # بررسی ترم در صورت وجود روی آبجکت (برای جلوگیری از دسترسی به ترم‌های دیگر)
            semester = getattr(obj, "semester", None)
            if semester:
                filters["semester"] = semester

            obj_professor_id = getattr(obj, "professor_id", None)
            if obj_professor_id is not None and obj_professor_id != request.user.pk:
                return False

            return CourseProfessorMapping.objects.filter(**filters).exists()
        return False


class IsHeadTA(permissions.BasePermission):
    """Strict Head-TA gate.

    Plain TAs are blocked at BOTH levels:
      * has_permission — the authenticated user's global role must be HEAD_TA.
      * has_object_permission — the user must hold a HEAD_TA assignment for
        the course (and semester/group when the object carries them).
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "HEAD_TA"
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == "SUPER_ADMIN":
            return True

        TAAssignment = apps.get_model("assignments", "TAAssignment")
        course = obj if obj.__class__.__name__ == "Course" else getattr(obj, "course", None)

        if course:
            filters = {"user": request.user, "course": course, "role": "HEAD_TA"}

            semester = getattr(obj, "semester", None)
            if semester:
                filters["semester"] = semester

            obj_professor_id = getattr(obj, "professor_id", None)
            if obj_professor_id is not None:
                filters["professor_id"] = obj_professor_id

            return TAAssignment.objects.filter(**filters).exists()
        return False


class IsTA(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ["HEAD_TA", "TA"]
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == "SUPER_ADMIN":
            return True

        TAAssignment = apps.get_model("assignments", "TAAssignment")
        course = obj if obj.__class__.__name__ == "Course" else getattr(obj, "course", None)

        if course:
            filters = {"user": request.user, "course": course, "role": "TA"}

            semester = getattr(obj, "semester", None)
            if semester:
                filters["semester"] = semester

            obj_professor_id = getattr(obj, "professor_id", None)
            if obj_professor_id is not None:
                filters["professor_id"] = obj_professor_id

            return TAAssignment.objects.filter(**filters).exists()
        return False


class IsManagement(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ["SUPER_ADMIN", "DEPT_ADMIN"]
        )


class IsOwnerOrManagement(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(
            request.user.is_authenticated
            and (obj == request.user or request.user.role in ["SUPER_ADMIN", "DEPT_ADMIN"])
        )
