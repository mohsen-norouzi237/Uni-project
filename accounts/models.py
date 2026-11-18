from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        DEPT_ADMIN = "DEPT_ADMIN", "Department Admin"
        ADMIN = "ADMIN", "Admin"
        PROFESSOR = "PROFESSOR", "Professor"
        HEAD_TA = "HEAD_TA", "Head TA"
        TA = "TA", "Teaching Assistant"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TA)
    student_id = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


USER_ROLE_CHOICES = User.Role.choices
