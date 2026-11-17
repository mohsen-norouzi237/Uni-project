from django.contrib import admin

from .models import Course, CourseProfessorMapping


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("course_code", "course_name")
    search_fields = ("course_code", "course_name")


@admin.register(CourseProfessorMapping)
class CourseProfessorMappingAdmin(admin.ModelAdmin):
    list_display = ("course", "group", "professor", "semester")
    list_filter = ("semester", "professor")
    search_fields = ("course__course_name", "course__course_code", "professor__username", "group")
