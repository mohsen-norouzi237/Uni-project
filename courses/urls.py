from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssignProfessorView, CourseViewSet

router = DefaultRouter()

router.register(r"courses", CourseViewSet, basename="course")

urlpatterns = [
    path("courses/assign-professor/", AssignProfessorView.as_view(), name="assign-professor"),
    path("", include(router.urls)),
]
