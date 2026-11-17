from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

from semesters.models import Semester


class Course(models.Model):
    course_code = models.CharField(max_length=50, unique=True)
    course_name = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.course_code} - {self.course_name}"


class CourseProfessorMapping(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="professor_mappings",
    )
    # Prevent accidental deletion of semester when mappings exist (Protects DB integrity)
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        related_name="course_mappings",
    )

    group = models.CharField(
        max_length=2,
        validators=[
            RegexValidator(
                regex=r"^\d{2}$", message="شماره گروه باید دقیقا دو رقم باشد (مثلا 01 یا 02)."
            )
        ],
        help_text="شماره گروه درس (مثلا 01)",
    )

    professor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_courses",
        limit_choices_to={"role": "PROFESSOR"},
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course", "semester", "group"],
                name="unique_course_semester_group_mapping",
            )
        ]
        indexes = [
            # Optimize querying professors by semester and course
            models.Index(fields=["semester", "course"], name="course_prof_sem_course_idx"),
        ]

    def __str__(self):
        return (
            "Prof: "
            f"{self.professor.username} -> {self.course.course_name} "
            f"- Group {self.group} ({self.semester.name})"
        )
