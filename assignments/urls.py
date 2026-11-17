from django.urls import path

from .views import (
    AssignmentListView,
    BulkCreateAssignmentView,
    CreateAssignmentView,
    DeleteAssignmentView,
    UpdateAssignmentView,
)

urlpatterns = [
    path("assignments/", CreateAssignmentView.as_view(), name="assignment-create"),
    path("assignments/list/", AssignmentListView.as_view(), name="assignment-list"),
    path("assignments/<int:pk>/", DeleteAssignmentView.as_view(), name="assignment-delete"),
    path("assignments/<int:pk>/update/", UpdateAssignmentView.as_view(), name="assignment-update"),
    path("assignments/bulk/", BulkCreateAssignmentView.as_view(), name="assignment-bulk-create"),
]
