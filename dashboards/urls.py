from django.urls import path

from .views import AdminStatsAPIView, UserDashboardAPIView, WorkloadAPIView

app_name = "dashboards"

urlpatterns = [
    path("admin-stats/", AdminStatsAPIView.as_view(), name="admin-stats"),
    path("workload/", WorkloadAPIView.as_view(), name="workload"),
    path("me/", UserDashboardAPIView.as_view(), name="user-dashboard"),
]
