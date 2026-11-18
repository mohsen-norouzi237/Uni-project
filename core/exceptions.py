from django.db.models.deletion import ProtectedError
from rest_framework.response import Response
from rest_framework.views import exception_handler

from core.error_codes import ErrorCode


class TAMSException(Exception):
    status_code = 400
    code = None
    default_message = "An error occurred."

    def __init__(self, message=None):
        self.message = message or self.default_message
        super().__init__(self.message)


# Assignment validation errors


class InvalidAssignmentRoleError(TAMSException):
    code = ErrorCode.INVALID_ASSIGNMENT_ROLE
    status_code = 400
    default_message = "نقش تخصیص داده شده معتبر نیست."


class CourseSemesterMismatchError(TAMSException):
    code = ErrorCode.COURSE_SEMESTER_MISMATCH
    status_code = 400
    default_message = "درس و ترم انتخاب شده با یکدیگر مطابقت ندارند."


class CourseGroupMismatchError(TAMSException):
    code = ErrorCode.COURSE_GROUP_MISMATCH
    status_code = 400
    default_message = "گروه انتخاب شده متعلق به این درس و ترم نمی‌باشد."


class CourseProfessorMismatchError(TAMSException):
    code = ErrorCode.COURSE_PROFESSOR_MISMATCH
    status_code = 400
    default_message = "استاد انتخاب شده این درس را در این ترم تدریس نمی‌کند."


class DuplicateAssignmentError(TAMSException):
    code = ErrorCode.DUPLICATE_ASSIGNMENT
    status_code = 409
    default_message = "این کاربر قبلاً به این درس اختصاص داده شده است."


class MaxCourseLimitReachedError(TAMSException):
    code = ErrorCode.MAX_COURSE_LIMIT_REACHED
    status_code = 400
    default_message = "کاربر به حداکثر تعداد درس مجاز رسیده است."


class HeadTAAlreadyExistsError(TAMSException):
    code = ErrorCode.HEAD_TA_ALREADY_EXISTS
    status_code = 409
    default_message = "این درس قبلاً یک Head TA دارد."


# Assignment permission errors


class CourseProfessorAccessDeniedError(TAMSException):
    code = ErrorCode.COURSE_PROFESSOR_ACCESS_DENIED
    status_code = 403
    default_message = "شما استاد این درس نیستید و به آن دسترسی ندارید."


class HeadTACourseAccessDeniedError(TAMSException):
    code = ErrorCode.HEAD_TA_COURSE_ACCESS_DENIED
    status_code = 403
    default_message = "شما Head TA این درس نیستید و به آن دسترسی ندارید."


class HeadTACannotAssignHeadTAError(TAMSException):
    code = ErrorCode.HEAD_TA_CANNOT_ASSIGN_HEAD_TA
    status_code = 403
    default_message = "Head TA نمی‌تواند Head TA دیگری تعیین کند."


class HeadTACannotDeleteHeadTAError(TAMSException):
    code = ErrorCode.HEAD_TA_CANNOT_DELETE_HEAD_TA
    status_code = 403
    default_message = "Head TA نمی‌تواند تخصیص Head TA را حذف کند."


class AssignmentPermissionDeniedError(TAMSException):
    code = ErrorCode.ASSIGNMENT_PERMISSION_DENIED
    status_code = 403
    default_message = "شما دسترسی لازم برای مدیریت این تخصیص را ندارید."


# Assignment resource errors


class AssignmentNotFoundError(TAMSException):
    code = ErrorCode.ASSIGNMENT_NOT_FOUND
    status_code = 404
    default_message = "تخصیص مورد نظر یافت نشد."


def custom_exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response(
            {"status_code": 409, "error": "این مورد به رکوردهای دیگری وابسته است و قابل حذف نیست."},
            status=409,
        )

    if isinstance(exc, TAMSException):
        return Response(
            {
                "status_code": exc.status_code,
                "code": exc.code,
                "error": exc.message,
            },
            status=exc.status_code,
        )

    response = exception_handler(exc, context)

    if response is not None:
        response.data["status_code"] = response.status_code
        if "detail" in response.data:
            response.data["error"] = response.data.pop("detail")

    return response
