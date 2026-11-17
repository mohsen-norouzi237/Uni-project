from datetime import date
from hashlib import sha1

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from assignments.models import TAAssignment
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester


class Command(BaseCommand):
    help = "Generate bulk local data for PostgreSQL load testing and query benchmarks."
    default_users = 50_000
    default_courses = 5_000
    default_batch_size = 1_000
    max_ta_courses_limit = 3

    def add_arguments(self, parser):
        parser.add_argument("--users", type=int, default=self.default_users)
        parser.add_argument("--courses", type=int, default=self.default_courses)
        parser.add_argument("--batch-size", type=int, default=self.default_batch_size)
        parser.add_argument("--tas-per-course", type=int, default=2)
        parser.add_argument("--prefix", default="load")
        parser.add_argument("--confirm", action="store_true")

    def handle(self, *args, **options):
        config = self._validate_options(options)
        self._ensure_prefix_is_unused(config["prefix"], config["semester_name"])
        self.stdout.write(
            "Generating load data: "
            f"users={config['user_count']:,}, courses={config['course_count']:,}, "
            f"assignments={config['assignment_count']:,}, prefix={config['prefix']!r}."
        )
        with transaction.atomic():
            semester = self._create_semester(config)
            users = self._create_users(config)
            courses = self._create_courses(config)
            self._create_course_mappings(courses, users["professors"], semester, config)
            self._create_assignments(courses, users, users["professors"], semester, config)
        self.stdout.write(
            self.style.SUCCESS(
                "Load data complete: "
                f"users={config['user_count']:,}, semesters=1, courses={config['course_count']:,}, "
                f"mappings={config['course_count']:,}, assignments={config['assignment_count']:,}."
            )
        )

    def _validate_options(self, options):
        if not options["confirm"]:
            raise CommandError("Pass --confirm before generating load data.")
        user_count = options["users"]
        course_count = options["courses"]
        batch_size = options["batch_size"]
        tas_per_course = options["tas_per_course"]
        prefix = options["prefix"].strip().lower()
        if user_count < 1 or course_count < 1 or batch_size < 1 or tas_per_course < 0:
            raise CommandError(
                "--users, --courses, and --batch-size must be positive; "
                "--tas-per-course cannot be negative."
            )
        if not prefix or not prefix.replace("-", "").replace("_", "").isalnum():
            raise CommandError(
                "--prefix may contain only letters, numbers, hyphens, and underscores."
            )
        professor_count = max(1, (course_count + 9) // 10)
        head_ta_count = course_count
        minimum_ta_count = max(
            tas_per_course,
            (course_count * tas_per_course + self.max_ta_courses_limit - 1)
            // self.max_ta_courses_limit,
        )
        minimum_user_count = 2 + professor_count + head_ta_count + minimum_ta_count
        if user_count < minimum_user_count:
            raise CommandError(
                f"{course_count:,} courses with {tas_per_course} TAs each require at least "
                f"{minimum_user_count:,} users to keep every TA at or below "
                f"{self.max_ta_courses_limit} courses."
            )
        return {
            "user_count": user_count,
            "course_count": course_count,
            "batch_size": batch_size,
            "tas_per_course": tas_per_course,
            "prefix": prefix,
            "professor_count": professor_count,
            "head_ta_count": head_ta_count,
            "assignment_count": course_count * (1 + tas_per_course),
            "semester_name": f"L{sha1(prefix.encode()).hexdigest()[:4].upper()}",
        }

    def _ensure_prefix_is_unused(self, prefix, semester_name):
        if User.objects.filter(username__startswith=f"{prefix}-").exists():
            raise CommandError(
                f"Generated users with prefix '{prefix}-' already exist. Choose another --prefix."
            )
        if Course.objects.filter(course_code__startswith=f"{prefix.upper()}-").exists():
            raise CommandError(
                f"Generated courses with prefix '{prefix.upper()}-' already exist. "
                "Choose another --prefix."
            )
        if Semester.objects.filter(name=semester_name).exists():
            raise CommandError(
                f"Generated semester '{semester_name}' already exists. Choose another --prefix."
            )

    def _create_semester(self, config):
        return Semester.objects.create(
            name=config["semester_name"],
            start_date=date(2026, 9, 1),
            end_date=date(2027, 1, 31),
            max_ta_courses_limit=self.max_ta_courses_limit,
        )

    def _create_users(self, config):
        prefix = config["prefix"]
        users = [
            User(
                username=f"{prefix}-super-admin",
                email=f"{prefix}-super-admin@load.tams.local",
                first_name="Load",
                last_name="Super Admin",
                role=User.Role.SUPER_ADMIN,
                password="!",
            ),
            User(
                username=f"{prefix}-dept-admin",
                email=f"{prefix}-dept-admin@load.tams.local",
                first_name="Load",
                last_name="Department Admin",
                role=User.Role.DEPT_ADMIN,
                password="!",
            ),
        ]
        users.extend(
            self._users_for_role(prefix, "prof", User.Role.PROFESSOR, config["professor_count"])
        )
        users.extend(
            self._users_for_role(prefix, "head-ta", User.Role.HEAD_TA, config["head_ta_count"])
        )
        users.extend(
            self._users_for_role(prefix, "ta", User.Role.TA, config["user_count"] - len(users))
        )
        User.objects.bulk_create(users, batch_size=config["batch_size"])
        professor_start = 2
        head_ta_start = professor_start + config["professor_count"]
        return {
            "professors": users[professor_start:head_ta_start],
            "head_tas": users[head_ta_start : head_ta_start + config["head_ta_count"]],
            "tas": users[head_ta_start + config["head_ta_count"] :],
        }

    @staticmethod
    def _users_for_role(prefix, label, role, count):
        return [
            User(
                username=f"{prefix}-{label}-{number:05d}",
                email=f"{prefix}-{label}-{number:05d}@load.tams.local",
                first_name="Load",
                last_name=f"{label} {number}",
                role=role,
                student_id=f"{prefix.upper()}-{label.upper()}-{number:05d}",
                password="!",
            )
            for number in range(1, count + 1)
        ]

    def _create_courses(self, config):
        courses = [
            Course(
                course_code=f"{config['prefix'].upper()}-{number:05d}",
                course_name=f"Load Test Course {number:05d}",
            )
            for number in range(1, config["course_count"] + 1)
        ]
        Course.objects.bulk_create(courses, batch_size=config["batch_size"])
        return courses

    def _create_course_mappings(self, courses, professors, semester, config):
        mappings = [
            CourseProfessorMapping(
                course=course,
                semester=semester,
                professor=professors[index % len(professors)],
            )
            for index, course in enumerate(courses)
        ]
        CourseProfessorMapping.objects.bulk_create(mappings, batch_size=config["batch_size"])

    def _create_assignments(self, courses, users, professors, semester, config):
        assignments = []
        for course_index, course in enumerate(courses):
            professor = professors[course_index % len(professors)]
            assignments.append(
                TAAssignment(
                    user=users["head_tas"][course_index],
                    course=course,
                    semester=semester,
                    professor=professor,
                    role=TAAssignment.Role.HEAD_TA,
                )
            )
            for ta_index in range(config["tas_per_course"]):
                user = users["tas"][
                    (course_index * config["tas_per_course"] + ta_index) % len(users["tas"])
                ]
                assignments.append(
                    TAAssignment(
                        user=user,
                        course=course,
                        semester=semester,
                        professor=professor,
                        role=TAAssignment.Role.TA,
                    )
                )
        TAAssignment.objects.bulk_create(assignments, batch_size=config["batch_size"])
