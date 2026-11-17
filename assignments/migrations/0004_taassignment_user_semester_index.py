# Generated manually for BE-36.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assignments", "0003_taassignment_unique_head_ta_per_course_semester"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="taassignment",
            index=models.Index(fields=["user", "semester"], name="ta_assign_user_sem_idx"),
        ),
    ]
