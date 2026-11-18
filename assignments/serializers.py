import re

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester

from .models import TAAssignment

User = get_user_model()


class TAAssignmentCreateSerializer(serializers.ModelSerializer):
    """سریالایزر دریافت داده‌های ورودی برای ایجاد تخصیص جدید"""

    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), source="course", write_only=True
    )
    semester_id = serializers.PrimaryKeyRelatedField(
        queryset=Semester.objects.all(), source="semester", write_only=True
    )
    professor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="professor", write_only=True
    )

    class Meta:
        model = TAAssignment
        fields = ["id", "user_id", "course_id", "semester_id", "professor_id", "role"]
        validators = []

    def validate(self, attrs):
        request = self.context.get("request")
        role = attrs.get("role")
        course = attrs.get("course")
        semester = attrs.get("semester")

        if role not in TAAssignment.Role.values:
            raise serializers.ValidationError({"role": "نقش انتخاب شده معتبر نیست."})

        if request and request.user and request.user.is_authenticated:
            if request.user.role == "HEAD_TA" and role == TAAssignment.Role.HEAD_TA:
                raise PermissionDenied("هد تی‌ای نمی‌تواند هد تی‌ای جدیدی تعیین کند.")

        if role == TAAssignment.Role.HEAD_TA:
            existing_head = TAAssignment.objects.filter(
                course=course, semester=semester, role=TAAssignment.Role.HEAD_TA
            ).exists()
            if existing_head:
                raise serializers.ValidationError(
                    {"role": "این درس در این ترم از قبل دارای Head TA است."}
                )

        return attrs


class TAAssignmentUpdateSerializer(serializers.ModelSerializer):
    """سریالایزر برای به‌روزرسانی نقش تخصیص موجود (تغییر نقش بین TA و HEAD_TA)"""

    class Meta:
        model = TAAssignment
        fields = ["role"]

    def validate_role(self, value):
        if value not in TAAssignment.Role.values:
            raise serializers.ValidationError("نقش انتخاب شده معتبر نیست.")
        return value


class TABulkAssignSerializer(serializers.Serializer):
    """سریالایزر اعتبارسنجی ورودی‌ های تخصیص دسته‌ جمعی (Bulk)"""

    user_id = serializers.IntegerField()
    course_id = serializers.IntegerField()
    semester_id = serializers.IntegerField()
    professor_id = serializers.IntegerField()
    role = serializers.CharField()

    def validate(self, attrs):
        role = attrs.get("role")
        if role not in TAAssignment.Role.values:
            raise serializers.ValidationError({"role": "نقش انتخاب شده معتبر نیست."})

        try:
            attrs["user"] = User.objects.get(pk=attrs["user_id"])
        except User.DoesNotExist:
            raise serializers.ValidationError({"user_id": "کاربر مورد نظر یافت نشد."})

        try:
            attrs["course"] = Course.objects.get(pk=attrs["course_id"])
        except Course.DoesNotExist:
            raise serializers.ValidationError({"course_id": "درس مورد نظر یافت نشد."})

        try:
            attrs["semester"] = Semester.objects.get(pk=attrs["semester_id"])
        except Semester.DoesNotExist:
            raise serializers.ValidationError({"semester_id": "ترم مورد نظر یافت نشد."})

        try:
            attrs["professor"] = User.objects.get(pk=attrs["professor_id"])
        except User.DoesNotExist:
            raise serializers.ValidationError({"professor_id": "استاد مورد نظر یافت نشد."})

        return attrs


class TAAssignmentDetailSerializer(serializers.ModelSerializer):
    """سریالایزر نمایش خروجی پس از ثبت موفق تخصیص"""

    user_name = serializers.SerializerMethodField()
    course_code = serializers.ReadOnlyField(source="course.course_code")
    course_name = serializers.ReadOnlyField(source="course.course_name")
    semester_name = serializers.ReadOnlyField(source="semester.name")
    professor_name = serializers.SerializerMethodField()

    class Meta:
        model = TAAssignment
        fields = [
            "id",
            "user",
            "user_name",
            "course",
            "course_code",
            "course_name",
            "semester",
            "semester_name",
            "professor",
            "professor_name",
            "role",
        ]

    def get_user_name(self, obj) -> str:
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username

    def get_professor_name(self, obj) -> str:
        full_name = f"{obj.professor.first_name} {obj.professor.last_name}".strip()
        return full_name or obj.professor.username


class TAAssignmentListSerializer(serializers.ModelSerializer):
    """سریالایزر نمایش لیست تخصیص‌ها برای صفحه «مدیریت تخصیص‌ها» (ادمین)"""

    user_name = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    course_code = serializers.ReadOnlyField(source="course.course_code")
    course_name = serializers.ReadOnlyField(source="course.course_name")
    semester_name = serializers.ReadOnlyField(source="semester.name")
    professor_name = serializers.SerializerMethodField()

    class Meta:
        model = TAAssignment
        fields = [
            "id",
            "user",
            "user_name",
            "user_role",
            "course",
            "course_code",
            "course_name",
            "semester",
            "semester_name",
            "professor",
            "professor_name",
            "role",
        ]

    def get_user_name(self, obj) -> str:
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username

    def get_professor_name(self, obj) -> str:
        full_name = f"{obj.professor.first_name} {obj.professor.last_name}".strip()
        return full_name or obj.professor.username

    def get_user_role(self, obj) -> str:
        # Normalized to the frontend's lowercase contract (see accounts serializer).
        return obj.user.role.lower() if isinstance(obj.user.role, str) else obj.user.role


def _scheduled_head_ta(obj) -> str | None:
    heads = getattr(obj.course, "prefetched_ta_assignments", None)
    if heads is None:
        heads = obj.course.ta_assignments.filter(
            semester_id=obj.semester_id,
            professor_id=obj.professor_id,
            role=TAAssignment.Role.HEAD_TA,
        ).select_related("user")
    for assignment in heads:
        if (assignment.semester_id, assignment.professor_id) == (
            obj.semester_id, obj.professor_id
        ):
            return assignment.user.get_full_name() or assignment.user.username
    return None


class UserScheduleSerializer(serializers.ModelSerializer):
    """سریالایزر دریافت برنامه اساینمنت‌های یک تی‌ای یا هد تی‌ای"""

    course_code = serializers.ReadOnlyField(source="course.course_code")
    course_name = serializers.ReadOnlyField(source="course.course_name")
    semester_name = serializers.ReadOnlyField(source="semester.name")
    professor_name = serializers.SerializerMethodField()
    head_ta_name = serializers.SerializerMethodField()

    class Meta:
        model = TAAssignment
        fields = [
            "id",
            "course_id",
            "course_code",
            "course_name",
            "semester_id",
            "semester_name",
            "professor",
            "role",
            "professor_name",
            "head_ta_name",
        ]

    def get_professor_name(self, obj) -> str:
        return obj.professor.get_full_name() or obj.professor.username

    def get_head_ta_name(self, obj) -> str | None:
        return _scheduled_head_ta(obj)


class ProfessorScheduleSerializer(serializers.ModelSerializer):
    """سریالایزر دریافت لیست دروس تحت تدریس یک استاد"""

    course_code = serializers.ReadOnlyField(source="course.course_code")
    course_name = serializers.ReadOnlyField(source="course.course_name")
    semester_name = serializers.ReadOnlyField(source="semester.name")
    head_ta_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = CourseProfessorMapping
        fields = [
            "id",
            "course_id",
            "course_code",
            "course_name",
            "semester_id",
            "semester_name",
            "group",
            "role",
            "head_ta_name",
        ]

    def get_role(self, obj) -> str:
        return "PROFESSOR"

    def get_head_ta_name(self, obj) -> str | None:
        return _scheduled_head_ta(obj)


class ErrorResponseSerializer(serializers.Serializer):
    """سریالایزر پایه برای نمایش ساختار ارورها در Swagger"""

    detail = serializers.CharField(help_text="پیام خطای سیستم")
