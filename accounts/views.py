from django.db.models import Prefetch
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from assignments.models import TAAssignment
from assignments.serializers import ProfessorScheduleSerializer, UserScheduleSerializer
from core.permissions import IsManagement, IsOwnerOrManagement, IsSuperAdmin
from courses.models import CourseProfessorMapping

from .models import User
from .serializers import CustomTokenObtainPairSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsSuperAdmin()]
        if self.action == "list":
            return [IsManagement()]
        if self.action in ["retrieve", "partial_update", "update", "schedule"]:
            return [IsOwnerOrManagement()]
        if self.action == "destroy":
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_update(self, serializer):
        # Role changes are SUPER_ADMIN only. Validate through the SERIALIZER
        # (serializer.validated_data), not raw request.data — a role sent in
        # an unsupported format or silently dropped by the serializer must not
        # be treated as "no role change".
        if "role" in serializer.validated_data and self.request.user.role != "SUPER_ADMIN":
            raise PermissionDenied("تغییر نقش کاربری فقط توسط مدیر ارشد امکان‌پذیر است.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        """دریافت برنامه ترم ها، لیست دروس و نقش‌ها برای داشبورد کاربر"""
        user = self.get_object()

        ta_prefetch = Prefetch(
            "course__ta_assignments",
            queryset=TAAssignment.objects.select_related("user"),
            to_attr="prefetched_ta_assignments",
        )

        if user.role == "PROFESSOR":
            mappings = (
                CourseProfessorMapping.objects.filter(professor=user)
                .select_related("course", "semester")
                .order_by("semester", "course", "group")
                .prefetch_related(ta_prefetch)
            )

            serializer = ProfessorScheduleSerializer(mappings, many=True)
            return Response(serializer.data)

        else:
            assignments = (
                TAAssignment.objects.filter(user=user)
                .select_related("course", "semester")
                .prefetch_related("course__professor_mappings__professor", ta_prefetch)
            )

            serializer = UserScheduleSerializer(assignments, many=True)
            return Response(serializer.data)
