from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import (
    AssignmentNotFoundError,
    AssignmentPermissionDeniedError,
    CourseProfessorAccessDeniedError,
    HeadTACannotAssignHeadTAError,
    HeadTACannotDeleteHeadTAError,
    InvalidAssignmentRoleError,
)
from core.pagination import StandardResultsSetPagination
from core.permissions import IsHeadTA, IsManagement, IsProfessor

from .models import TAAssignment
from .serializers import (
    ErrorResponseSerializer,
    TAAssignmentCreateSerializer,
    TAAssignmentDetailSerializer,
    TAAssignmentListSerializer,
    TAAssignmentUpdateSerializer,
    TABulkAssignSerializer,
)
from .services import assign_ta, bulk_assign_ta, remove_ta_assignment, update_ta_assignment


@extend_schema_view(
    get=extend_schema(
        summary="لیست تخصیص‌های تی‌ای (مدیریت)",
        description=(
            "GET /api/v1/assignments/list/ -> صفحه‌بندی‌شده، مخصوص مدیران. "
            "فیلترها: semester_id، role (TA/HEAD_TA)، search (نام کاربر/کد درس)."
        ),
        parameters=[
            OpenApiParameter("semester_id", type=OpenApiTypes.INT, location=OpenApiParameter.QUERY),
            OpenApiParameter("role", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY),
            OpenApiParameter("search", type=OpenApiTypes.STR, location=OpenApiParameter.QUERY),
        ],
        responses={
            200: TAAssignmentListSerializer(many=True),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(response=ErrorResponseSerializer, description="عدم دسترسی"),
        },
    )
)
class AssignmentListView(generics.ListAPIView):
    """لیست کامل تخصیص‌ها با فیلتر ترم/نقش/جستجو - فقط مدیریت."""

    serializer_class = TAAssignmentListSerializer
    permission_classes = [IsManagement]
    pagination_class = StandardResultsSetPagination

    #: Base manager query used when no filters are supplied, so the view
    #: behaves like a plain ListAPIView with sane ordering.
    base_queryset = TAAssignment.objects.select_related("user", "course", "semester").order_by(
        "-semester__start_date", "course__course_code", "role"
    )

    def filter_queryset(self, queryset):
        # Skip DRF's global DEFAULT_FILTER_BACKENDS (django-filter requires an
        # explicit filterset_class here); filtering is done in get_queryset.
        return queryset

    def get_queryset(self):
        queryset = self.base_queryset

        params = self.request.query_params
        semester_id = params.get("semester_id")
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)

        role = params.get("role")
        if role:
            queryset = queryset.filter(role=role.upper())

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(course__course_code__icontains=search)
                | Q(course__course_name__icontains=search)
            )

        return queryset


@extend_schema_view(
    post=extend_schema(
        summary="ثبت تخصیص جدید تی‌ ای",
        responses={
            201: TAAssignmentDetailSerializer,
            400: OpenApiResponse(
                response=ErrorResponseSerializer, description="دیتای نامعتبر یا خطای نقش"
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(
                response=ErrorResponseSerializer, description="عدم دسترسی (استاد یا هد تی‌ای)"
            ),
        },
    )
)
class CreateAssignmentView(generics.CreateAPIView):
    """ثبت تخصیص جدید تی ای یا هد تی ای با رعایت RBAC"""

    queryset = TAAssignment.objects.all()
    serializer_class = TAAssignmentCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        course = serializer.validated_data["course"]
        semester = serializer.validated_data["semester"]
        professor = serializer.validated_data["professor"]
        target_role = serializer.validated_data["role"]

        is_actually_head_ta = TAAssignment.objects.filter(
            user=user,
            course=course,
            semester=semester,
            professor=professor,
            role=TAAssignment.Role.HEAD_TA,
        ).exists()

        if user.role in ["SUPER_ADMIN", "DEPT_ADMIN"]:
            pass
        elif user.role == "PROFESSOR":
            if professor.pk != user.pk or not IsProfessor().has_object_permission(
                self.request, self, course
            ):
                raise CourseProfessorAccessDeniedError()
        elif is_actually_head_ta:
            if target_role == TAAssignment.Role.HEAD_TA:
                raise HeadTACannotAssignHeadTAError()
        else:
            raise AssignmentPermissionDeniedError()

        assign_ta(
            user=serializer.validated_data["user"],
            course=course,
            semester=semester,
            professor=professor,
            role=target_role,
            actor=self.request.user,
        )

    def create(self, request, *args, **kwargs):
        role = request.data.get("role")

        if role is not None and role not in TAAssignment.Role.values:
            raise InvalidAssignmentRoleError()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        assignment = TAAssignment.objects.filter(
            user=serializer.validated_data["user"],
            course=serializer.validated_data["course"],
            semester=serializer.validated_data["semester"],
            professor=serializer.validated_data["professor"],
        ).last()

        response_serializer = TAAssignmentDetailSerializer(assignment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    delete=extend_schema(
        summary="حذف تخصیص تی‌ ای",
        responses={
            204: OpenApiResponse(description="حذف با موفقیت انجام شد"),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(
                response=ErrorResponseSerializer, description="عدم دسترسی برای حذف"
            ),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="تخصیص یافت نشد"),
        },
    )
)
class DeleteAssignmentView(generics.DestroyAPIView):
    """حذف تخصیص تی ای یا هد تی ای با رعایت منطق امنیتی"""

    queryset = TAAssignment.objects.all()
    serializer_class = TAAssignmentDetailSerializer
    permission_classes = [IsManagement | IsProfessor | IsHeadTA]

    def get_object(self):
        try:
            return super().get_object()
        except Http404:
            raise AssignmentNotFoundError()

    def check_object_permissions(self, request, obj):
        user = request.user

        # Management can delete any assignment.
        if user.role in ["SUPER_ADMIN", "DEPT_ADMIN"]:
            return

        # Professor access is checked here so we can return a typed error.
        if user.role == "PROFESSOR":
            if not IsProfessor().has_object_permission(request, self, obj):
                raise CourseProfessorAccessDeniedError()
            return

        # Head TA access is checked here so the existing typed errors
        # in perform_destroy() can handle the specific restrictions.
        if user.role in ["HEAD_TA", "TA"]:
            if not IsHeadTA().has_object_permission(request, self, obj):
                raise AssignmentPermissionDeniedError()
            return

        raise AssignmentPermissionDeniedError()

    def perform_destroy(self, instance):
        user = self.request.user
        is_actually_head_ta = TAAssignment.objects.filter(
            user=user,
            course=instance.course,
            semester=instance.semester,
            professor=instance.professor,
            role=TAAssignment.Role.HEAD_TA,
        ).exists()

        if user.role in ["SUPER_ADMIN", "DEPT_ADMIN"]:
            pass
        elif user.role == "PROFESSOR":
            if not IsProfessor().has_object_permission(self.request, self, instance):
                raise CourseProfessorAccessDeniedError()
        elif is_actually_head_ta:
            if instance.role == TAAssignment.Role.HEAD_TA:
                raise HeadTACannotDeleteHeadTAError()
        else:
            raise AssignmentPermissionDeniedError()

        remove_ta_assignment(
            instance.id,
            actor=self.request.user,
        )


@extend_schema_view(
    patch=extend_schema(
        summary="به‌روزرسانی نقش تخصیص تی‌ ای",
        responses={
            200: TAAssignmentDetailSerializer,
            400: OpenApiResponse(
                response=ErrorResponseSerializer, description="دیتای ورودی یا نقش غیرمجاز"
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(
                response=ErrorResponseSerializer,
                description="عدم دسترسی (فقط مدیریت یا استاد مربوطه)",
            ),
            404: OpenApiResponse(response=ErrorResponseSerializer, description="تخصیص یافت نشد"),
        },
    )
)
class UpdateAssignmentView(generics.UpdateAPIView):
    """آپدیت نقش تخصیص (مثلا تغییر از TA به HEAD_TA)"""

    queryset = TAAssignment.objects.all()
    serializer_class = TAAssignmentUpdateSerializer
    permission_classes = [IsManagement | IsProfessor]

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        if user.role == "PROFESSOR" and (
            instance.professor_id != user.pk
            or not IsProfessor().has_object_permission(self.request, self, instance)
        ):
            raise CourseProfessorAccessDeniedError()

        assignment = update_ta_assignment(
            assignment_id=instance.id, role=serializer.validated_data["role"], actor=user
        )
        serializer.instance = assignment


@extend_schema_view(
    post=extend_schema(
        summary="تخصیص همزمان و انبوه تی‌ ای",
        request=TABulkAssignSerializer(many=True),
        responses={
            201: TAAssignmentDetailSerializer(many=True),
            400: OpenApiResponse(
                response=ErrorResponseSerializer,
                description="دیتای ورودی نامعتبر یا خطا در تخصیص‌ها",
            ),
            401: OpenApiResponse(response=ErrorResponseSerializer, description="عدم احراز هویت"),
            403: OpenApiResponse(
                response=ErrorResponseSerializer, description="عدم دسترسی (فقط مدیران آموزش)"
            ),
        },
    )
)
class BulkCreateAssignmentView(APIView):
    """تخصیص همزمان چندین کاربر به دروس مختلف"""

    serializer_class = TABulkAssignSerializer

    permission_classes = [IsManagement]

    def post(self, request, *args, **kwargs):
        serializer = TABulkAssignSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)

        assignments = bulk_assign_ta(assignments_data=serializer.validated_data, actor=request.user)

        response_serializer = TAAssignmentDetailSerializer(assignments, many=True)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
