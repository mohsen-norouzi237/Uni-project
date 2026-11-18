from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from assignments.models import TAAssignment
from assignments.services import assign_ta
from courses.models import Course, CourseProfessorMapping
from semesters.models import Semester

# Predictable local test accounts (Task 2). Password for ALL of them is
# TEST_PASSWORD so the app can be exercised role-by-role without guessing.
TEST_PASSWORD = "password123"

TEST_USERS = (
    # username, email, role, first_name, last_name, is_superuser, is_staff
    ("admin", "admin@test.com", "DEPT_ADMIN", "Admin", "Test", True, True),
    ("professor", "professor@test.com", "PROFESSOR", "Professor", "Test", False, False),
    ("headta", "headta@test.com", "HEAD_TA", "HeadTA", "Test", False, False),
    ("ta", "ta@test.com", "TA", "TA", "Test", False, False),
)

USERS = (
    ("superadmin", "SUPER_ADMIN", "مدیر", "سیستم", "superadmin@tams.local", None),
    ("deptadmin", "DEPT_ADMIN", "مدیر", "گروه", "deptadmin@tams.local", None),
    ("prof.alavi", "PROFESSOR", "علی", "علوی", "alavi@tams.local", None),
    ("prof.karimi", "PROFESSOR", "نگار", "کریمی", "karimi@tams.local", None),
    ("prof.moradi", "PROFESSOR", "رضا", "مرادی", "moradi@tams.local", None),
    ("headta.ahmadi", "HEAD_TA", "سارا", "احمدی", "ahmadi@tams.local", "40110001"),
    ("headta.rahimi", "HEAD_TA", "مهدی", "رحیمی", "rahimi@tams.local", "40110002"),
    ("headta.niknejad", "HEAD_TA", "نازنین", "نیک‌نژاد", "niknejad@tams.local", "40110003"),
    ("ta.ariayi", "TA", "آرمان", "آریایی", "ariayi@tams.local", "40120001"),
    ("ta.bahrami", "TA", "مینا", "بهرامی", "bahrami@tams.local", "40120002"),
    ("ta.chamani", "TA", "پویا", "چمانی", "chamani@tams.local", "40120003"),
    ("ta.davari", "TA", "هانیه", "داوری", "davari@tams.local", "40120004"),
    ("ta.esfandiari", "TA", "کیانا", "اسفندیاری", "esfandiari@tams.local", "40120005"),
    ("ta.farhadi", "TA", "امیر", "فرهادی", "farhadi@tams.local", "40120006"),
)

SEMESTERS = (
    ("4051", date(2026, 9, 1), date(2027, 1, 31), 3),
    ("4052", date(2027, 2, 15), date(2027, 6, 30), 3),
)

COURSES = (
    ("CE101-4051", "برنامه‌نویسی پیشرفته", "4051", "prof.alavi"),
    ("CE102-4051", "ساختمان داده", "4051", "prof.karimi"),
    ("CE103-4051", "پایگاه داده", "4051", "prof.moradi"),
    ("CE104-4051", "مهندسی نرم‌افزار", "4051", "prof.alavi"),
    ("CE105-4051", "شبکه‌های کامپیوتری", "4051", "prof.karimi"),
    ("CE106-4051", "هوش مصنوعی", "4051", "prof.moradi"),
    ("CE201-4052", "سیستم‌عامل", "4052", "prof.alavi"),
    ("CE202-4052", "امنیت اطلاعات", "4052", "prof.karimi"),
    ("CE203-4052", "یادگیری ماشین", "4052", "prof.moradi"),
)

ASSIGNMENTS = (
    ("headta.ahmadi", "CE101-4051", "HEAD_TA"),
    ("ta.ariayi", "CE101-4051", "TA"),
    ("ta.bahrami", "CE101-4051", "TA"),
    ("headta.rahimi", "CE102-4051", "HEAD_TA"),
    ("ta.ariayi", "CE102-4051", "TA"),
    ("ta.chamani", "CE102-4051", "TA"),
    ("headta.niknejad", "CE103-4051", "HEAD_TA"),
    ("ta.bahrami", "CE103-4051", "TA"),
    ("ta.davari", "CE103-4051", "TA"),
    ("headta.ahmadi", "CE104-4051", "HEAD_TA"),
    ("ta.chamani", "CE104-4051", "TA"),
    ("ta.esfandiari", "CE104-4051", "TA"),
    ("headta.rahimi", "CE105-4051", "HEAD_TA"),
    ("ta.davari", "CE105-4051", "TA"),
    ("ta.farhadi", "CE105-4051", "TA"),
    ("headta.niknejad", "CE106-4051", "HEAD_TA"),
    ("ta.esfandiari", "CE106-4051", "TA"),
    ("ta.farhadi", "CE106-4051", "TA"),
)


class Command(BaseCommand):
    help = "Create idempotent sample data for local TAMS development."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="tams-dev-password",
            help="Password for newly created seed users (default: tams-dev-password).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        created_counts = {"users": 0, "semesters": 0, "courses": 0, "mappings": 0, "assignments": 0}
        users = self._seed_users(options["password"], created_counts)
        semesters = self._seed_semesters(created_counts)
        courses = self._seed_courses(users, semesters, created_counts)
        self._seed_assignments(users, courses, semesters, created_counts)

        # Task 2: predictable test accounts for every role (password123).
        self._seed_test_accounts(created_counts)

        self.stdout.write(
            self.style.SUCCESS(
                "Seed data complete: "
                + ", ".join(f"{name}={count}" for name, count in created_counts.items())
                + " created."
            )
        )

    def _seed_users(self, password, created_counts):
        users = {}
        for username, role, first_name, last_name, email, student_id in USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "role": role,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "student_id": student_id,
                },
            )
            if not created and user.role != role:
                raise CommandError(
                    f"Seed user '{username}' already exists with role '{user.role}', "
                    f"expected '{role}'."
                )
            if created:
                user.set_password(password)
                user.save(update_fields=["password"])
                created_counts["users"] += 1
            users[username] = user
        return users

    def _seed_test_accounts(self, created_counts):
        """Create predictable role-test accounts (all with password `password123`).

        Idempotent: matched by username OR email so re-running never raises
        IntegrityError. Passwords are only hashed on creation; an existing
        account's password is left untouched.
        """
        for username, email, role, first_name, last_name, is_superuser, is_staff in TEST_USERS:
            existing = (
                User.objects.filter(username=username).first()
                or User.objects.filter(email=email).first()
            )
            if existing:
                # Heal the role if a previous run / manual edit drifted it.
                if existing.role != role:
                    existing.role = role
                    existing.save(update_fields=["role"])
                continue

            if is_superuser:
                user = User.objects.create_superuser(
                    username=username, email=email, password=TEST_PASSWORD, role=role
                )
            else:
                user = User.objects.create_user(
                    username=username, email=email, password=TEST_PASSWORD, role=role
                )
                user.is_staff = is_staff
                user.save(update_fields=["is_staff"])
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])
            created_counts["users"] += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Test accounts ready (password '{TEST_PASSWORD}'): admin / professor / headta / ta"
            )
        )

    def _seed_semesters(self, created_counts):
        semesters = {}
        for name, start_date, end_date, max_limit in SEMESTERS:
            semester, created = Semester.objects.get_or_create(
                name=name,
                defaults={
                    "start_date": start_date,
                    "end_date": end_date,
                    "max_ta_courses_limit": max_limit,
                },
            )
            if not created and (
                semester.start_date != start_date
                or semester.end_date != end_date
                or semester.max_ta_courses_limit != max_limit
            ):
                raise CommandError(
                    f"Seed semester '{name}' already exists with different settings."
                )
            if created:
                created_counts["semesters"] += 1
            semesters[name] = semester
        return semesters

    def _seed_courses(self, users, semesters, created_counts):
        courses = {}
        for code, name, semester_name, professor_username in COURSES:
            course, created = Course.objects.get_or_create(
                course_code=code,
                defaults={"course_name": name},
            )
            if not created and (course.course_name != name):
                raise CommandError(f"Seed course '{code}' already exists with different details.")
            if created:
                created_counts["courses"] += 1

            semester = semesters[semester_name]
            mapping, mapping_created = CourseProfessorMapping.objects.get_or_create(
                course=course,
                semester=semester,
                group="01",
                defaults={"professor": users[professor_username]},
            )
            if not mapping_created and mapping.professor_id != users[professor_username].id:
                raise CommandError(f"Seed course '{code}' already has a different professor.")
            if mapping_created:
                created_counts["mappings"] += 1
            courses[code] = course
        return courses

    def _seed_assignments(self, users, courses, semesters, created_counts):
        for username, course_code, role in ASSIGNMENTS:
            course = courses[course_code]
            course_row = next(c for c in COURSES if c[0] == course_code)
            semester = semesters[course_row[2]]
            professor = users[course_row[3]]

            assignment = TAAssignment.objects.filter(
                user=users[username], course=course, semester=semester, professor=professor
            ).first()
            if assignment:
                if assignment.role != role:
                    raise CommandError(
                        f"Seed assignment for '{username}' in '{course_code}' "
                        f"has role '{assignment.role}', "
                        f"expected '{role}'."
                    )
                continue

            assign_ta(
                user=users[username],
                course=course,
                semester=semester,
                professor=professor,
                role=role,
                actor=users["superadmin"],
            )

            created_counts["assignments"] += 1
