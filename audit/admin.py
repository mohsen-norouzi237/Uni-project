from django.contrib import admin

from accounts.models import User

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "actor", "action", "entity_type", "entity_id")
    list_filter = ("action", "entity_type")
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False  # audit entries must be created from code only

    def has_delete_permission(self, request, obj=None):
        return request.user.role == User.Role.SUPER_ADMIN
