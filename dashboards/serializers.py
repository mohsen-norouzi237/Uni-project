from django.db import models
from rest_framework import serializers


class AdminStatsSerializer(serializers.Serializer):
    total_courses = serializers.IntegerField(help_text="تعداد دروس ترم")
    total_ta = serializers.IntegerField(help_text="تعداد TA")
    total_head_ta = serializers.IntegerField(help_text="تعداد Head TA")
    unassigned_ta = serializers.IntegerField(help_text="TA بدون تسک")
    at_cap_ta = serializers.IntegerField(help_text="TA تکمیل ظرفیت")


class WorkloadStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    AT_CAP = "AT_CAP", "At Capacity"
    OVER_LIMIT = "OVER_LIMIT", "Over Limit"


class WorkloadSerializer(serializers.Serializer):
    # Field names mirror the frontend contract (frontend/src/types/workload.ts):
    #   id / name / assignedCourses / semesterLimit are camelCased client-side.
    id = serializers.IntegerField()
    name = serializers.CharField()
    role = serializers.CharField()
    assigned_courses = serializers.ListField(child=serializers.CharField())
    current_courses = serializers.IntegerField()
    max_courses = serializers.IntegerField()
    remaining = serializers.IntegerField()
    status = serializers.ChoiceField(choices=WorkloadStatus.choices)


class WorkloadDistributionSerializer(serializers.Serializer):
    zero = serializers.IntegerField()
    one = serializers.IntegerField()
    two = serializers.IntegerField()
    three_or_more = serializers.IntegerField()
    total = serializers.IntegerField()


class WorkloadPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = WorkloadSerializer(many=True)
    distribution = WorkloadDistributionSerializer(required=False)


class UserDashboardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    assignment_role = serializers.CharField()
    course_id = serializers.IntegerField()
    professor_id = serializers.IntegerField()
    semester_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    role = serializers.CharField()
    professor_name = serializers.CharField(allow_null=True)
    head_ta_name = serializers.CharField(allow_null=True)
    semester = serializers.CharField()
