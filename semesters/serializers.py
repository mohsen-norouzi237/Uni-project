from rest_framework import serializers

from .models import Semester


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = [
            "id",
            "name",
            "start_date",
            "end_date",
            "max_ta_courses_limit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_max_ta_courses_limit(self, value):
        if value < 1:
            raise serializers.ValidationError("Maximum TA courses limit must be at least 1.")
        return value

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)

        if start_date and end_date and end_date <= start_date:
            raise serializers.ValidationError(
                {"end_date": "End date must be strictly after start date."}
            )

        return attrs
