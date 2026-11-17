from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "student_id", "is_staff")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("username", "email", "student_id")
    fieldsets = UserAdmin.fieldsets + (("Additional Info", {"fields": ("role", "student_id")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Additional Info", {"fields": ("role", "student_id")}),
    )
