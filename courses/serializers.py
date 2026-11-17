from rest_framework import serializers

from assignments.models import TAAssignment

from .models import Course, CourseProfessorMapping


class CourseSerializer(serializers.ModelSerializer):
    professor_name = serializers.SerializerMethodField()
    has_head_ta = serializers.SerializerMethodField()
    ta_count = serializers.SerializerMethodField()
    head_ta_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "course_code",
            "course_name",
            "professor_name",
            "has_head_ta",
            "head_ta_name",
            "ta_count",
        ]

    def get_professor_name(self, obj) -> str:
        mappings = getattr(obj, "filtered_mappings", obj.professor_mappings.all())
        if mappings:
            mapping = mappings[0]
            if mapping.professor:
                full_name = f"{mapping.professor.first_name} {mapping.professor.last_name}".strip()
                return full_name or mapping.professor.username
        return "نامشخص"

    def get_head_ta_name(self, obj) -> str | None:
        """Name of the current Head TA, or None (frontend derives staffing status)."""
        assignments = getattr(obj, "filtered_ta_assignments", obj.ta_assignments.all())
        for assignment in assignments:
            if assignment.role == TAAssignment.Role.HEAD_TA:
                user = assignment.user
                return f"{user.first_name} {user.last_name}".strip() or user.username
        return None

    def get_has_head_ta(self, obj) -> bool:
        if hasattr(obj, "annotated_head_ta_count"):
            return obj.annotated_head_ta_count > 0
        return any(
            assignment.role == TAAssignment.Role.HEAD_TA for assignment in obj.ta_assignments.all()
        )

    def get_ta_count(self, obj) -> int:
        if hasattr(obj, "annotated_ta_count"):
            return obj.annotated_ta_count
        return len(obj.ta_assignments.all())


class CourseProfessorMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseProfessorMapping
        fields = ["id", "course", "semester", "group", "professor", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, data):
        if data["professor"].role != "PROFESSOR":
            raise serializers.ValidationError(
                {"professor": "کاربر انتخاب شده باید نقش استاد داشته باشد."}
            )

        if CourseProfessorMapping.objects.filter(
            course=data["course"], semester=data["semester"], group=data["group"]
        ).exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": (
                        "برای این درس در این ترم و این گروه قبلاً یک استاد تخصیص داده شده است."
                    )
                }
            )

        return data
