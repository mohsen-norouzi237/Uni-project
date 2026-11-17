from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from courses.models import Course
from semesters.models import Semester


class TAAssignment(models.Model):
    # Assignment role within a course
    class Role(models.TextChoices):
        TA = "TA", "Teaching Assistant"
        HEAD_TA = "HEAD_TA", "Head TA"

    # User assigned to the course
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ta_assignments",
    )

    # Course the user is assigned to
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="ta_assignments",
    )

    # Semester in which the assignment is active
    # Prevent accidental deletion of semester when assignments exist (Protects DB integrity)
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        related_name="ta_assignments",
    )

    # Professor whose section this assignment belongs to. Staffing is keyed
    # by (professor, course, semester): groups only subdivide a professor's
    # own sections on the mapping side and carry no staffing meaning here.
    professor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervised_assignments",
        limit_choices_to={"role": "PROFESSOR"},
        help_text="استادی که این دستیار به او تخصیص داده شده است.",
    )

    # Role of the user in this assignment
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
    )

    class Meta:
        verbose_name = "TA Assignment"
        verbose_name_plural = "TA Assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course", "semester", "professor"],
                name="unique_ta_assignment_per_user_course_semester_professor",
            ),
            models.UniqueConstraint(
                fields=["course", "semester", "professor"],
                condition=models.Q(role="HEAD_TA"),
                name="unique_head_ta_per_course_semester_professor",
            ),
        ]
        indexes = [
            # Workload checks and monitoring aggregate assignments by user and semester.
            models.Index(fields=["user", "semester"], name="ta_assign_user_sem_idx"),
            # Optimized index for fetching TA lists by course, semester, and professor
            models.Index(
                fields=["course", "semester", "professor"],
                name="ta_assign_course_sem_prof_idx",
            ),
        ]

    # Model-level validation fallback for HEAD_TA uniqueness (ensures SQLite & ORM safety)
    def clean(self):
        super().clean()
        if self.role == self.Role.HEAD_TA:
            qs = TAAssignment.objects.filter(
                course=self.course,
                semester=self.semester,
                professor=self.professor,
                role=self.Role.HEAD_TA,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    {"role": "این درس در این ترم برای این استاد از قبل دارای Head TA است."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.user.username} -> {self.course.course_name} "
            f"({self.professor.username}, {self.role})"
        )


TA_ROLE_CHOICES = TAAssignment.Role.choices
