import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_professor(apps, schema_editor):
    """Copy each row's professor from its (course, semester, group) mapping.

    Halts loudly on orphan rows instead of guessing: there is no correct
    professor for an assignment nobody teaches.
    """
    TAAssignment = apps.get_model("assignments", "TAAssignment")
    CourseProfessorMapping = apps.get_model("courses", "CourseProfessorMapping")
    resolved = []
    orphans = []
    rows = TAAssignment.objects.all().only(
        "id", "user_id", "course_id", "semester_id", "group", "role"
    )
    for row in rows:
        mapping = (
            CourseProfessorMapping.objects.filter(
                course_id=row.course_id,
                semester_id=row.semester_id,
                group=row.group,
            )
            .only("professor_id")
            .first()
        )
        if mapping is None:
            orphans.append(row.id)
        else:
            resolved.append(
                (
                    row.pk,
                    row.user_id,
                    row.course_id,
                    row.semester_id,
                    mapping.professor_id,
                    row.role,
                )
            )
    if orphans:
        raise RuntimeError(
            f"Refusing to migrate: {len(orphans)} assignment(s) without a mapping: "
            f"{orphans[:20]}. Fix the data, then re-run migrate."
        )
    # Shared staff across one professor's groups collapses to a single row
    # per professor slot. Detect the collisions the new uniqueness would
    # reject instead of letting AddConstraint explode mid-migration.
    seen_rows, seen_heads, collisions = set(), set(), []
    for pk, user_id, course_id, semester_id, professor_id, role in resolved:
        row_key = (user_id, course_id, semester_id, professor_id)
        head_key = (course_id, semester_id, professor_id) if role == "HEAD_TA" else None
        if row_key in seen_rows or (head_key and head_key in seen_heads):
            collisions.append(pk)
        seen_rows.add(row_key)
        if head_key:
            seen_heads.add(head_key)
    if collisions:
        raise RuntimeError(
            f"Refusing to migrate: {len(collisions)} assignment(s) would collide "
            f"under professor-scoped uniqueness (shared staff across one "
            f"professor's groups): {collisions[:20]}. Keep one row per "
            f"professor slot, delete the superseded ones, then re-run migrate."
        )
    for pk, _, _, _, professor_id, _ in resolved:
        TAAssignment.objects.filter(pk=pk).update(professor_id=professor_id)


def unbackfill(apps, schema_editor):
    # One-way data step by design: reverse migration restores the schema
    # (professor becomes nullable again) but cannot resurrect dropped groups.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("assignments", "0008_alter_taassignment_options"),
        # Backfill reads mapping.group: the column must exist first.
        # Without this edge the runner may apply 0009 before courses 0007.
        (
            "courses",
            "0007_remove_courseprofessormapping_unique_course_semester_mapping_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="taassignment",
            name="professor",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="supervised_assignments",
                limit_choices_to={"role": "PROFESSOR"},
                help_text="استادی که این دستیار به او تخصیص داده شده است.",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_professor, unbackfill),
        migrations.AlterField(
            model_name="taassignment",
            name="professor",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="supervised_assignments",
                limit_choices_to={"role": "PROFESSOR"},
                help_text="استادی که این دستیار به او تخصیص داده شده است.",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # NOTE (sqlite): each constraint/index/field removal rebuilds the
        # whole table, replaying every object still in state. The group
        # constraints and index must go BEFORE RemoveField(group), or the
        # rebuild fails resolving the already-dropped column. (Postgres
        # applies them independently and would not care.)
        migrations.RemoveConstraint(
            model_name="taassignment",
            name="unique_head_ta_per_course_semester",
        ),
        migrations.RemoveConstraint(
            model_name="taassignment",
            name="unique_ta_assignment_per_user_course_semester_group",
        ),
        migrations.RemoveIndex(
            model_name="taassignment",
            name="ta_assign_course_sem_grp_idx",
        ),
        migrations.RemoveField(
            model_name="taassignment",
            name="group",
        ),
        migrations.AddIndex(
            model_name="taassignment",
            index=models.Index(
                fields=["course", "semester", "professor"],
                name="ta_assign_course_sem_prof_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="taassignment",
            constraint=models.UniqueConstraint(
                fields=["user", "course", "semester", "professor"],
                name="unique_ta_assignment_per_user_course_semester_professor",
            ),
        ),
        migrations.AddConstraint(
            model_name="taassignment",
            constraint=models.UniqueConstraint(
                fields=["course", "semester", "professor"],
                condition=models.Q(role="HEAD_TA"),
                name="unique_head_ta_per_course_semester_professor",
            ),
        ),
    ]
