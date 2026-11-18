from django.db.models import Count, Exists, OuterRef, Prefetch, Q
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
from core.query_params import semester_query_id
from courses.models import CourseProfessorMapping
from semesters.models import Semester

from .serializers import (
    AdminStatsSerializer,
    UserDashboardSerializer,
    WorkloadPageSerializer,
    WorkloadSerializer,
    WorkloadStatus,
)


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
        semester_id = semester_query_id(request)
        if semester_id:
            semester = get_object_or_404(Semester, id=semester_id)
        else:
            semester = Semester.objects.order_by("-start_date").first()
            if not semester:
                return Response({"error": "ترمی یافت نشد"}, status=status.HTTP_404_NOT_FOUND)

        total_courses = (
            CourseProfessorMapping.objects.filter(semester=semester)
            .values("course_id")
            .distinct()
            .count()
        )

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
            OpenApiParameter(
                name="include_distribution",
                description="Set to 1 to include workload counts across all matching results.",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={
            200: WorkloadPageSerializer,
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="ترمی یافت نشد"),
        },
    )
    def get(self, request):
        semester_id = semester_query_id(request)
        semester = (
            get_object_or_404(Semester, id=semester_id)
            if semester_id
            else Semester.objects.order_by("-start_date").first()
        )

        if not semester:
            return Response({"error": "ترمی یافت نشد"}, status=status.HTTP_404_NOT_FOUND)

        assignments = TAAssignment.objects.filter(semester=semester)
        users = User.objects.filter(role__in=[User.Role.TA, User.Role.HEAD_TA]).order_by("pk")
        if request.user.role == User.Role.PROFESSOR:
            assignments = assignments.filter(professor=request.user)
            users = users.filter(Exists(assignments.filter(user_id=OuterRef("pk"))))

        users = users.annotate(current_courses=Count(
            "ta_assignments",
            filter=Q(ta_assignments__in=assignments),
        ))

        # --- Filters the frontend sends (previously ignored) -----------------
        search = (request.query_params.get("search") or "").strip()
        if search:
            users = users.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(Exists(assignments.filter(
                    user_id=OuterRef("pk"), course__course_code__icontains=search
                )))
            )

        overloaded = (request.query_params.get("overloaded") or "").lower() in ("1", "true", "yes")
        limit = semester.max_ta_courses_limit
        if overloaded:
            users = users.filter(current_courses__gte=limit)

        distribution = None
        if request.query_params.get("include_distribution") == "1":
            distribution = users.aggregate(
                zero=Count("pk", filter=Q(current_courses=0)),
                one=Count("pk", filter=Q(current_courses=1)),
                two=Count("pk", filter=Q(current_courses=2)),
                three_or_more=Count("pk", filter=Q(current_courses__gte=3)),
                total=Count("pk"),
            )

        paginator = self.pagination_class()
        users = users.prefetch_related(Prefetch(
            "ta_assignments",
            queryset=assignments.select_related("course").order_by("course__course_code", "pk"),
            to_attr="workload_assignments",
        ))
        page = paginator.paginate_queryset(users, request, view=self)
        workload_data = []
        for user in page:
            remaining = max(limit - user.current_courses, 0)
            if user.current_courses < limit:
                status_val = WorkloadStatus.AVAILABLE
            elif user.current_courses == limit:
                status_val = WorkloadStatus.AT_CAP
            else:
                status_val = WorkloadStatus.OVER_LIMIT

            workload_data.append(
                {
                    # Frontend contract (types/workload.ts): `id`, `name`,
                    # `assignedCourses`, `semesterLimit`. The serializer maps
                    # these onto the API field names.
                    "id": user.id,
                    "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "role": user.role,
                    "assigned_courses": [a.course.course_code for a in user.workload_assignments],
                    "current_courses": user.current_courses,
                    "max_courses": limit,
                    "remaining": remaining,
                    "status": status_val,
                }
            )

        serializer = WorkloadSerializer(workload_data, many=True)
        response = paginator.get_paginated_response(serializer.data)
        if distribution is not None:
            response.data["distribution"] = distribution
        return response


class UserDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]  # همه کاربران لاگین شده دسترسی دارند

    @extend_schema(
        summary="داشبورد شخصی کاربر",
        parameters=[OpenApiParameter(
            name="all_semesters", type=OpenApiTypes.BOOL, location=OpenApiParameter.QUERY
        )],
        responses={200: UserDashboardSerializer(many=True)},
        description="دریافت لیست دروس، نقش‌ها و مشخصات استاد/سرتیم برای کاربر لاگین شده.",
    )
    def get(self, request):
        assignments = TAAssignment.objects.filter(user=request.user)
        if request.query_params.get("all_semesters", "").lower() not in {"true", "1"}:
            latest = Semester.objects.order_by("-start_date").values("pk")[:1]
            assignments = assignments.filter(semester_id__in=latest)

        heads = TAAssignment.objects.filter(
            semester_id__in=assignments.values("semester_id"),
            role=TAAssignment.Role.HEAD_TA,
        ).select_related("user")
        assignments = (
            assignments.select_related("course", "professor", "semester")
            .order_by("-semester__start_date", "course__course_code", "pk")
            .prefetch_related(Prefetch(
                "course__ta_assignments", queryset=heads, to_attr="semester_heads",
            ))
        )

        data = []
        for a in assignments:
            professor = a.professor
            head = next(
                (
                    row.user for row in a.course.semester_heads
                    if row.semester_id == a.semester_id and row.professor_id == a.professor_id
                ),
                None,
            )
            data.append(
                {
                    "id": a.pk,
                    "assignment_role": a.role,
                    "course_id": a.course_id,
                    "semester_id": a.semester_id,
                    "professor_id": a.professor_id,
                    "course_name": a.course.course_name,
                    "course_code": a.course.course_code,
                    "role": a.get_role_display(),
                    "professor_name": professor.get_full_name() or professor.username,
                    "head_ta_name": (head.get_full_name() or head.username) if head else None,
                    "semester": a.semester.name,
                }
            )

        return Response(data)
