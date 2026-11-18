from rest_framework import serializers
from rest_framework.exceptions import ValidationError


def semester_query_id(request):
    value = request.query_params.get("semester_id")
    if value in (None, "", "all"):
        return None
    field = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
    try:
        return field.run_validation(value)
    except ValidationError as exc:
        raise ValidationError({"semester_id": exc.detail}) from exc
