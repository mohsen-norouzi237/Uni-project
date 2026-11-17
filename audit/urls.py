from django.urls import path

from .views import AuditLogDeleteView, AuditLogListView

urlpatterns = [
    path("audit-logs/", AuditLogListView.as_view(), name="audit-log-list"),
    path("audit-logs/<int:pk>/", AuditLogDeleteView.as_view(), name="audit-log-delete"),
]
