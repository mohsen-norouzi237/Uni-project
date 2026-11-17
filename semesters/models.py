from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class Semester(models.Model):
    name = models.CharField(
        max_length=5, unique=True, help_text="Name of the academic semester (e.g : 4041, 4042)"
    )
    start_date = models.DateField(help_text="Semester start date")
    end_date = models.DateField(help_text="Semester end date")
    max_ta_courses_limit = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(1)],
        help_text="Maximum number of active courses a TA/Head TA can take in this semester",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "semesters"
        ordering = ["-start_date"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gt=models.F("start_date")),
                name="semester_end_date_after_start_date",
            ),
            models.CheckConstraint(
                condition=models.Q(max_ta_courses_limit__gte=1), name="semester_max_ta_limit_gte_1"
            ),
        ]
        indexes = [
            models.Index(fields=["start_date", "end_date"], name="semester_dates_idx"),
        ]

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValidationError({"end_date": "End date must be after start date."})

    def __str__(self):
        return self.name
