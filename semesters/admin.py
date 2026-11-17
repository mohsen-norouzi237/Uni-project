from django.contrib import admin

from .models import Semester


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "max_ta_courses_limit", "created_at")
    search_fields = ("name",)
    list_filter = ("start_date", "end_date")
