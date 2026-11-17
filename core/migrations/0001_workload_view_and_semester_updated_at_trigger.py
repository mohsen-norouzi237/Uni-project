from django.db import migrations


class PostgreSQLRunSQL(migrations.RunSQL):
    """Run PostgreSQL-only database objects without breaking SQLite development."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor == "postgresql":
            super().database_forwards(app_label, schema_editor, from_state, to_state)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor == "postgresql":
            super().database_backwards(app_label, schema_editor, from_state, to_state)


CREATE_WORKLOAD_VIEW = """
CREATE OR REPLACE VIEW v_ta_workload AS
SELECT
    ta.user_id,
    ta.semester_id,
    COUNT(ta.id) AS assigned_courses,
    semester.max_ta_courses_limit,
    GREATEST(semester.max_ta_courses_limit - COUNT(ta.id), 0) AS remaining_courses,
    CASE
        WHEN COUNT(ta.id) >= semester.max_ta_courses_limit THEN 'AT_CAPACITY'
        ELSE 'AVAILABLE'
    END AS workload_status
FROM assignments_taassignment AS ta
INNER JOIN semesters AS semester ON semester.id = ta.semester_id
GROUP BY ta.user_id, ta.semester_id, semester.max_ta_courses_limit;
"""

DROP_WORKLOAD_VIEW = "DROP VIEW IF EXISTS v_ta_workload;"

CREATE_UPDATED_AT_TRIGGER = """
CREATE OR REPLACE FUNCTION tams_set_semester_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS semesters_set_updated_at ON semesters;
CREATE TRIGGER semesters_set_updated_at
BEFORE UPDATE ON semesters
FOR EACH ROW
EXECUTE FUNCTION tams_set_semester_updated_at();
"""

DROP_UPDATED_AT_TRIGGER = """
DROP TRIGGER IF EXISTS semesters_set_updated_at ON semesters;
DROP FUNCTION IF EXISTS tams_set_semester_updated_at();
"""


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("assignments", "0003_taassignment_unique_head_ta_per_course_semester"),
        ("semesters", "0002_alter_semester_name"),
    ]

    operations = [
        PostgreSQLRunSQL(CREATE_WORKLOAD_VIEW, DROP_WORKLOAD_VIEW),
        PostgreSQLRunSQL(CREATE_UPDATED_AT_TRIGGER, DROP_UPDATED_AT_TRIGGER),
    ]
