from django.db.models import Count, Exists, OuterRef, Prefetch, Q, Value
from django.db.models.functions import Concat, Trim
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from assignments.models import TAAssignment
from assignments.serializers import ErrorResponseSerializer
from core.permissions import IsDeptAdmin, IsManagement
from core.query_params import semester_query_id

from .models import Course, CourseProfessorMapping
from .serializers import (
    CourseProfessorMappingSerializer,
    CourseSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="دریافت لیست درس‌ها",
        parameters=[
            OpenApiParameter(
                name="semester_id",
                description="فیلتر بر اساس ID ترم",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={
            200: CourseSerializer(many=True),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
        },
    ),
    create=extend_schema(
        summary="ایجاد درس جدید",
        responses={
            201: CourseSerializer,
            400: OpenApiResponse(response=ErrorResponseSerializer, description="خطای ورودی"),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(
                response=ErrorResponseSerializer, description="نیاز به دسترسی Dept Admin"
            ),
        },
    ),
    destroy=extend_schema(
        summary="حذف درس",
        responses={
            204: OpenApiResponse(description="حذف موفق"),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="درس یافت نشد"),
        },
    ),
)
class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsDeptAdmin()]

        if self.action == "get_tas":
            return [IsAuthenticated()]

        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Course.objects.order_by("course_code")
        if self.action not in {"list", "retrieve"}:
            return queryset

        params = self.request.query_params
        semester_id = semester_query_id(self.request)
        search = (params.get("search") or "").strip()
        if self.action == "list" and search:
            queryset = queryset.filter(
                Q(course_code__icontains=search) | Q(course_name__icontains=search)
            )

        mapping_qs = CourseProfessorMapping.objects.select_related("professor").order_by(
            "-semester__start_date", "group", "pk"
        )
        ta_qs = TAAssignment.objects.all()
        ta_filter = Q()

        if semester_id is not None:
            mapping_qs = mapping_qs.filter(semester_id=semester_id)
            ta_qs = ta_qs.filter(semester_id=semester_id)
            ta_filter = Q(ta_assignments__semester_id=semester_id)
            if self.action == "list":
                queryset = queryset.filter(Exists(mapping_qs.filter(course_id=OuterRef("pk"))))

        instructor = params.get("instructor")
        if self.action == "list" and instructor:
            mapping_qs = mapping_qs.annotate(
                display_name=Trim(Concat(
                    "professor__first_name", Value(" "), "professor__last_name"
                ))
            ).filter(
                Q(display_name=instructor)
                | Q(display_name="", professor__username=instructor)
            )
            queryset = queryset.filter(Exists(mapping_qs.filter(course_id=OuterRef("pk"))))

        prefetch_mappings = Prefetch(
            "professor_mappings",
            queryset=mapping_qs,
            to_attr="filtered_mappings",
        )
        prefetch_tas = Prefetch(
            "ta_assignments",
            queryset=ta_qs.select_related("user"),
            to_attr="filtered_ta_assignments",
        )

        queryset = queryset.prefetch_related(prefetch_mappings, prefetch_tas).annotate(
            annotated_ta_count=Count("ta_assignments", filter=ta_filter, distinct=True),
            annotated_head_ta_count=Count(
                "ta_assignments",
                filter=ta_filter & Q(ta_assignments__role=TAAssignment.Role.HEAD_TA),
                distinct=True,
            ),
        )
        if self.action == "list":
            staffing_status = params.get("status")
            if staffing_status == "missing_head_ta":
                queryset = queryset.filter(annotated_head_ta_count=0)
            elif staffing_status == "missing_tas":
                queryset = queryset.filter(annotated_head_ta_count__gt=0, annotated_ta_count__lt=2)
            elif staffing_status == "fully_staffed":
                queryset = queryset.filter(annotated_head_ta_count__gt=0, annotated_ta_count__gte=2)
        return queryset

    @extend_schema(
        summary="دریافت لیست اساتید برای فیلتر دایرکتوری دروس",
        parameters=[
            OpenApiParameter(
                name="semester_id",
                description="فیلتر بر اساس ID ترم",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={
            200: inline_serializer(
                name="CourseInstructorsResponse",
                fields={"results": serializers.ListField(child=serializers.CharField())},
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
        },
    )
    @action(detail=False, methods=["get"], url_path="instructors")
    def instructors(self, request):
        """Distinct professor display names, for the directory filter dropdown.

        The SPA calls GET /api/v1/courses/instructors/ — this endpoint used to
        be missing entirely (404 in live mode).
        """
        mappings = CourseProfessorMapping.objects.select_related("professor")
        semester_id = semester_query_id(request)
        if semester_id is not None:
            mappings = mappings.filter(semester_id=semester_id)

        names = set()
        for mapping in mappings:
            professor = mapping.professor
            full_name = f"{professor.first_name} {professor.last_name}".strip()
            names.add(full_name or professor.username)

        return Response({"results": sorted(names)})

    @extend_schema(
        summary="دریافت لیست تی‌ای‌های یک درس",
        parameters=[
            OpenApiParameter(
                name="semester_id",
                description="فیلتر بر اساس ID ترم",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={
            200: inline_serializer(
                name="CourseTAsResponse",
                fields={
                    "course_id": serializers.IntegerField(),
                    "course_code": serializers.CharField(),
                    "head_ta": serializers.DictField(allow_null=True),
                    "head_tas": serializers.ListField(child=serializers.DictField()),
                    "tas": serializers.ListField(child=serializers.DictField()),
                },
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="درس یافت نشد"),
        },
    )
    @action(detail=True, methods=["get"], url_path="tas")
    def get_tas(self, request, pk=None):
        course = self.get_object()
        semester_id = semester_query_id(request)

        assignments = course.ta_assignments.select_related("user").order_by("pk")
        mappings = course.professor_mappings.all()
        if semester_id is not None:
            assignments = assignments.filter(semester_id=semester_id)
            mappings = mappings.filter(semester_id=semester_id)

        user = request.user
        if user.role == "PROFESSOR":
            mappings = mappings.filter(professor=user)
            if not mappings.exists():
                raise PermissionDenied()
            assignments = assignments.filter(
                professor=user, semester_id__in=mappings.values("semester_id")
            )
        elif user.role in {"HEAD_TA", "TA"}:
            head_slots = assignments.filter(user=user, role=TAAssignment.Role.HEAD_TA)
            if not head_slots.exists():
                raise PermissionDenied()
            assignments = assignments.filter(Exists(head_slots.filter(
                semester_id=OuterRef("semester_id"), professor_id=OuterRef("professor_id")
            )))
        elif not IsManagement().has_permission(request, self):
            raise PermissionDenied()

        head_tas = []
        tas_data = []

        for assignment in assignments:
            user = assignment.user
            full_name = f"{user.first_name} {user.last_name}".strip()
            user_info = {
                "id": user.id,
                "assignment_id": assignment.pk,
                "can_remove": (
                    request.user.role not in {"TA", "HEAD_TA"}
                    or assignment.role == TAAssignment.Role.TA
                ),
                "name": full_name or user.username,
                "email": user.email,
                "semester_id": assignment.semester_id,
                "professor_id": assignment.professor_id,
            }
            if assignment.role == TAAssignment.Role.HEAD_TA:
                head_tas.append(user_info)
            else:
                tas_data.append(user_info)

        return Response(
            {
                "course_id": course.id,
                "course_code": course.course_code,
                "head_ta": next(iter(head_tas), None),
                "head_tas": head_tas,
                "tas": tas_data,
            }
        )


@extend_schema_view(
    post=extend_schema(
        summary="تخصیص استاد به درس",
        responses={
            201: CourseProfessorMappingSerializer,
            400: OpenApiResponse(
                response=ErrorResponseSerializer,
                description="استاد قبلاً تخصیص داده شده یا نقش معتبر نیست",
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
        },
    )
)
class AssignProfessorView(generics.CreateAPIView):
    queryset = CourseProfessorMapping.objects.all()
    serializer_class = CourseProfessorMappingSerializer
    permission_classes = [IsDeptAdmin]
