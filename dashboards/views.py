from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from assignments.models import TAAssignment
from assignments.serializers import ErrorResponseSerializer
from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagement, IsProfessor
from courses.models import CourseProfessorMapping
from semesters.models import Semester

from .serializers import AdminStatsSerializer, UserDashboardSerializer, WorkloadSerializer


class AdminStatsAPIView(APIView):
    permission_classes = [IsManagement]

    @extend_schema(
        summary="دریافت آمارهای کلی داشبورد ادمین",
        parameters=[
            OpenApiParameter(
                name="semester_id",
                description="فیلتر بر اساس ID ترم (در صورت عدم ارسال، آخرین ترم انتخاب می‌شود)",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={
            200: AdminStatsSerializer,
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی مدیریت"),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="ترمی یافت نشد"),
        },
    )
    def get(self, request):
        semester_id = request.query_params.get("semester_id")
        if semester_id:
            semester = get_object_or_404(Semester, id=semester_id)
        else:
            semester = Semester.objects.order_by("-start_date").first()
            if not semester:
                return Response({"error": "ترمی یافت نشد"}, status=status.HTTP_404_NOT_FOUND)

        total_courses = CourseProfessorMapping.objects.filter(semester=semester).count()

        active_assignments = TAAssignment.objects.filter(semester=semester)
        total_ta = active_assignments.filter(role="TA").values("user").distinct().count()
        total_head_ta = active_assignments.filter(role="HEAD_TA").values("user").distinct().count()

        unassigned_ta = (
            User.objects.filter(role="TA").exclude(ta_assignments__semester=semester).count()
        )

        limit = semester.max_ta_courses_limit
        at_cap_ta = (
            User.objects.filter(role__in=["TA", "HEAD_TA"])
            .annotate(
                course_count=Count("ta_assignments", filter=Q(ta_assignments__semester=semester))
            )
            .filter(course_count__gte=limit)
            .count()
        )

        data = {
            "total_courses": total_courses,
            "total_ta": total_ta,
            "total_head_ta": total_head_ta,
            "unassigned_ta": unassigned_ta,
            "at_cap_ta": at_cap_ta,
        }
        serializer = AdminStatsSerializer(data)
        return Response(serializer.data)


class WorkloadAPIView(APIView):
    permission_classes = [IsManagement | IsProfessor]
    # The SPA paginates this list server-side (page/page_size params).
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        summary="پایش حجم کاری دستیاران",
        parameters=[
            OpenApiParameter(
                name="semester_id",
                description="فیلتر بر اساس ID ترم",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="search",
                description="جستجو در نام کاربر یا کد درس‌های تخصیص‌یافته",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="overloaded",
                description="فقط دستیارانی که به سقف مجاز ترم رسیده‌اند",
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={
            200: WorkloadSerializer(many=True),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="ترمی یافت نشد"),
        },
    )
    def get(self, request):
        semester_id = request.query_params.get("semester_id")
        semester = (
            get_object_or_404(Semester, id=semester_id)
            if semester_id
            else Semester.objects.order_by("-start_date").first()
        )

        if not semester:
            return Response({"error": "ترمی یافت نشد"}, status=status.HTTP_404_NOT_FOUND)

        user_filter = Q(role__in=[User.Role.TA, User.Role.HEAD_TA])

        if request.user.role == "PROFESSOR":
            user_filter &= Q(ta_assignments__course__professor_mappings__professor=request.user)

        users = (
            User.objects.filter(user_filter)
            .distinct()
            .annotate(
                current_courses=Count("ta_assignments", filter=Q(ta_assignments__semester=semester))
            )
        )

        # --- Filters the frontend sends (previously ignored) -----------------
        search = (request.query_params.get("search") or "").strip()
        if search:
            users = users.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(ta_assignments__course__course_code__icontains=search)
            ).distinct()

        overloaded = (request.query_params.get("overloaded") or "").lower() in ("1", "true", "yes")
        limit = semester.max_ta_courses_limit
        if overloaded:
            users = users.filter(current_courses__gte=limit)

        workload_data = []
        for user in users:
            remaining = max(limit - user.current_courses, 0)
            if user.current_courses < limit:
                status_val = "AVAILABLE"
            elif user.current_courses == limit:
                status_val = "AT_CAP"
            else:
                status_val = "OVER_LIMIT"

            assigned_courses = list(
                TAAssignment.objects.filter(user=user, semester=semester)
                .select_related("course")
                .values_list("course__course_code", flat=True)
            )

            workload_data.append(
                {
                    # Frontend contract (types/workload.ts): `id`, `name`,
                    # `assignedCourses`, `semesterLimit`. The serializer maps
                    # these onto the API field names.
                    "id": user.id,
                    "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "role": user.role,
                    "assigned_courses": assigned_courses,
                    "current_courses": user.current_courses,
                    "max_courses": limit,
                    "remaining": remaining,
                    "status": status_val,
                }
            )

        # Manual pagination so the filters above apply to the WHOLE set while
        # `count` stays the full filtered total (the SPA renders its pager from it).
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(workload_data, request, view=self)
        serializer = WorkloadSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class UserDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]  # همه کاربران لاگین شده دسترسی دارند

    @extend_schema(
        summary="داشبورد شخصی کاربر",
        responses={200: UserDashboardSerializer(many=True)},
        description="دریافت لیست دروس، نقش‌ها و مشخصات استاد/سرتیم برای کاربر لاگین شده.",
    )
    def get(self, request):
        user = request.user
        semester = Semester.objects.order_by("-start_date").first()

        if not semester:
            return Response([], status=200)

        # دریافت انتساب‌های کاربر در ترم جاری
        assignments = TAAssignment.objects.filter(user=user, semester=semester).select_related(
            "course", "semester"
        )

        data = []
        for a in assignments:
            # پیدا کردن نام استاد درس
            prof_mapping = CourseProfessorMapping.objects.filter(
                course=a.course, semester=semester
            ).first()
            prof_name = ""
            if prof_mapping:
                prof_name = (
                    f"{prof_mapping.professor.first_name} {prof_mapping.professor.last_name}"
                ).strip() or prof_mapping.professor.username

            # پیدا کردن نام سرتیم (Head TA) درس
            head_ta = TAAssignment.objects.filter(
                course=a.course, semester=semester, role="HEAD_TA"
            ).first()
            h_name = ""
            if head_ta:
                h_name = (
                    f"{head_ta.user.first_name} {head_ta.user.last_name}".strip()
                    or head_ta.user.username
                )

            data.append(
                {
                    "course_name": a.course.course_name,
                    "course_code": a.course.course_code,
                    "role": a.get_role_display(),
                    "professor_name": prof_name,
                    "head_ta_name": h_name,
                    "semester": semester.name,
                }
            )

        return Response(data)
