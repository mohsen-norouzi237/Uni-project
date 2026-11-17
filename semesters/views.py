from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, permissions

from core.permissions import IsSuperAdmin

from .models import Semester
from .serializers import SemesterSerializer


@extend_schema_view(
    get=extend_schema(
        summary="لیست تمام ترم‌های تحصیلی",
        description=(
            "دریافت لیست تمام ترم‌ها به ترتیب تاریخ شروع (برای تمامی کاربران احراز هویت شده)."
        ),
        responses={
            200: SemesterSerializer(many=True),
            401: OpenApiResponse(description="عدم احراز هویت"),
        },
    ),
    post=extend_schema(
        summary="ایجاد ترم تحصیلی جدید",
        description="ثبت ترم جدید تنها توسط Super Admin امکان‌پذیر است.",
        responses={
            201: SemesterSerializer,
            400: OpenApiResponse(
                description="خطا در دیتای ورودی (مانند تداخل تاریخ یا نام تکراری)"
            ),
            401: OpenApiResponse(description="عدم احراز هویت"),
            403: OpenApiResponse(description="عدم دسترسی (فقط Super Admin)"),
        },
    ),
)
class SemesterListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/semesters/  -> Authenticated list of all semesters (ordered by -start_date).
    POST /api/v1/semesters/ -> Create a new semester (Super Admin only).
    """

    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]


@extend_schema_view(
    get=extend_schema(
        summary="مشاهده جزئیات ترم تحصیلی",
        responses={
            200: SemesterSerializer,
            401: OpenApiResponse(description="عدم احراز هویت"),
            404: OpenApiResponse(description="ترم یافت نشد"),
        },
    ),
    put=extend_schema(
        summary="به‌روزرسانی کامل ترم تحصیلی",
        responses={
            200: SemesterSerializer,
            400: OpenApiResponse(description="دیتای ورودی نامعتبر"),
            401: OpenApiResponse(description="عدم احراز هویت"),
            403: OpenApiResponse(description="عدم دسترسی (فقط Super Admin)"),
            404: OpenApiResponse(description="ترم یافت نشد"),
        },
    ),
    patch=extend_schema(
        summary="به‌روزرسانی جزئی ترم (مثلاً حد نصاب تی‌ای)",
        responses={
            200: SemesterSerializer,
            400: OpenApiResponse(description="دیتای ورودی نامعتبر"),
            401: OpenApiResponse(description="عدم احراز هویت"),
            403: OpenApiResponse(description="عدم دسترسی (فقط Super Admin)"),
            404: OpenApiResponse(description="ترم یافت نشد"),
        },
    ),
    delete=extend_schema(
        summary="حذف ترم تحصیلی",
        responses={
            204: OpenApiResponse(description="حذف با موفقیت انجام شد"),
            401: OpenApiResponse(description="عدم احراز هویت"),
            403: OpenApiResponse(description="عدم دسترسی (فقط Super Admin)"),
            404: OpenApiResponse(description="ترم یافت نشد"),
        },
    ),
)
class SemesterDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/semesters// -> Retrieve semester details (Authenticated users).
    PATCH  /api/v1/semesters// -> Partial update, e.g. workload limit (Super Admin only).
    PUT    /api/v1/semesters// -> Full update (Super Admin only).
    DELETE /api/v1/semesters// -> Delete semester (Super Admin only).
    """

    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsSuperAdmin()]
