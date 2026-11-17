from django.urls import path

from .views import SemesterDetailView, SemesterListCreateView

urlpatterns = [
    path("semesters/", SemesterListCreateView.as_view(), name="semester-list-create"),
    path("semesters/<int:pk>/", SemesterDetailView.as_view(), name="semester-detail"),
]
