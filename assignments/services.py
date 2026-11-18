from django.db import transaction

from accounts.models import User
from assignments.models import TAAssignment
from audit.models import AuditLog
from audit.services import create_audit_log
from core.exceptions import (
    AssignmentNotFoundError,
    CourseProfessorMismatchError,
    DuplicateAssignmentError,
    HeadTAAlreadyExistsError,
    InvalidAssignmentRoleError,
    MaxCourseLimitReachedError,
)
from courses.models import Course, CourseProfessorMapping


@transaction.atomic
def assign_ta(user, course, semester, professor, role, actor):
    # Lock user and course to prevent concurrent assignment conflicts.
    user = User.objects.select_for_update().get(pk=user.pk)
    course = Course.objects.select_for_update().get(pk=course.pk)

    # Validate assignment role.
    if role not in TAAssignment.Role.values:
        raise InvalidAssignmentRoleError()

    # The professor must teach this course in this semester (in any group).
    if (
        professor.role != User.Role.PROFESSOR
        or not CourseProfessorMapping.objects.filter(
            course=course, semester=semester, professor=professor
        ).exists()
    ):
        raise CourseProfessorMismatchError()

    if TAAssignment.objects.filter(
        user=user, course=course, semester=semester, professor=professor
    ).exists():
        raise DuplicateAssignmentError()

    current_assignments = TAAssignment.objects.filter(user=user, semester=semester).count()
    max_limit = semester.max_ta_courses_limit

    # Prevent assignment when the user's semester limit is reached.
    if current_assignments >= max_limit:
        raise MaxCourseLimitReachedError()

    # A professor slot can have only one Head TA per course and semester.
    if role == TAAssignment.Role.HEAD_TA:
        has_head_ta = TAAssignment.objects.filter(
            course=course,
            semester=semester,
            professor=professor,
            role=TAAssignment.Role.HEAD_TA,
        ).exists()
        if has_head_ta:
            raise HeadTAAlreadyExistsError()

    # Create the assignment after all validation rules pass.
    assignment = TAAssignment.objects.create(
        user=user,
        course=course,
        semester=semester,
        professor=professor,
        role=role,
    )

    # Record the assignment creation in the audit log.
    create_audit_log(
        actor=actor,
        action=AuditLog.Action.CREATE,
        entity=assignment,
        new_values={
            "user_id": assignment.user_id,
            "course_id": assignment.course_id,
            "semester_id": assignment.semester_id,
            "professor_id": assignment.professor_id,
            "role": assignment.role,
        },
    )

    return assignment


@transaction.atomic
def update_ta_assignment(assignment_id, role, actor):
    """
    آپدیت نقش تی‌ای با قفل‌گذاری و رعایت قوانین
    """
    try:
        course_id = TAAssignment.objects.values_list("course_id", flat=True).get(pk=assignment_id)
        Course.objects.select_for_update().get(pk=course_id)
        assignment = TAAssignment.objects.select_for_update().get(pk=assignment_id)
    except (TAAssignment.DoesNotExist, Course.DoesNotExist):
        raise AssignmentNotFoundError()

    if role not in TAAssignment.Role.values:
        raise InvalidAssignmentRoleError()

    old_role = assignment.role
    if old_role != role:
        if role == TAAssignment.Role.HEAD_TA:
            if (
                TAAssignment.objects.filter(
                    course=assignment.course,
                    semester=assignment.semester,
                    professor=assignment.professor,
                    role=TAAssignment.Role.HEAD_TA,
                )
                .exclude(pk=assignment.id)
                .exists()
            ):
                raise HeadTAAlreadyExistsError()

        assignment.role = role
        assignment.save()

        create_audit_log(
            actor=actor,
            action=AuditLog.Action.UPDATE,
            entity=assignment,
            old_values={"role": old_role},
            new_values={"role": role},
        )

    return assignment


@transaction.atomic
def bulk_assign_ta(assignments_data, actor):
    """
    تخصیص انبوه تی‌ای‌ها به صورت اتمیک
    """
    results = []
    for data in assignments_data:
        assignment = assign_ta(
            user=data["user"],
            course=data["course"],
            semester=data["semester"],
            professor=data["professor"],
            role=data["role"],
            actor=actor,
        )
        results.append(assignment)
    return results


@transaction.atomic
def remove_ta_assignment(assignment_id, actor):
    try:
        assignment = TAAssignment.objects.select_for_update().get(pk=assignment_id)
    except TAAssignment.DoesNotExist:
        raise AssignmentNotFoundError()

    old_values = {
        "user_id": assignment.user_id,
        "course_id": assignment.course_id,
        "semester_id": assignment.semester_id,
        "professor_id": assignment.professor_id,
        "role": assignment.role,
    }

    # Record the assignment deletion in the audit log.
    create_audit_log(
        actor=actor,
        action=AuditLog.Action.DELETE,
        entity=assignment,
        old_values=old_values,
    )

    assignment.delete()

    return True
