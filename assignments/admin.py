from django.contrib import admin

from .models import TAAssignment


@admin.register(TAAssignment)
class TAAssignmentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "semester", "professor", "role")
    list_filter = ("semester", "role", "professor")
    search_fields = ("user__username", "course__course_code", "course__course_name")
    autocomplete_fields = ("user", "course", "semester", "professor")
