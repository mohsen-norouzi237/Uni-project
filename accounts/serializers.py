from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


def _normalize_role(role: str | None) -> str | None:
    """Map DB choices (``SUPER_ADMIN``) onto the frontend's lowercase contract.

    The React app types ``UserRole`` as ``'super_admin' | 'dept_admin' | ...``
    and compares it in ProtectedRoute/Sidebar, so the API is the single place
    that normalizes; the frontend never has to know about DB casing.
    """
    return role.lower() if isinstance(role, str) else role


def _denormalize_role(role: str | None) -> str | None:
    """Inverse of :func:`_normalize_role` for incoming writes."""
    return role.upper() if isinstance(role, str) else role


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "student_id",
            "is_active",
            "password",
        )
        read_only_fields = ("is_active",)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["role"] = _normalize_role(data.get("role"))
        return data

    def to_internal_value(self, data):
        # Accept both `super_admin` and `SUPER_ADMIN` on create/update.
        if "role" in data:
            role = data.get("role")
            if isinstance(role, list):
                role = role[-1] if role else None
            data = data.copy() if hasattr(data, "copy") else dict(data)
            data["role"] = _denormalize_role(role)
        return super().to_internal_value(data)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        else:
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with either the username or the student ID.

    The SPA sends ``{"username": "<نام کاربری / شماره دانشجویی>", "password": ...}``.
    If no user matches the username we look up the student_id and authenticate
    with the real username instead, so both identifiers work transparently.
    """

    username_field = "username"  # inherited from TokenObtainPairSerializer, explicit for clarity

    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["role"] = _normalize_role(user.role)
        # The SPA falls back to `user.role` when the JWT is not decoded client-side.
        token["username"] = user.username
        return token

    def validate(self, attrs):
        identifier = attrs.get(self.username_field)
        password = attrs.get("password")

        # Allow the form field to arrive as `identifier` too (defensive).
        if not identifier and "identifier" in self.initial_data:
            identifier = self.initial_data["identifier"]

        user = User.objects.filter(username=identifier).first()
        if user is None and identifier:
            user = User.objects.filter(student_id=identifier).first()

        if user is not None:
            request = self.context.get("request")
            credentials = {"request": request, "username": user.username, "password": password}
            authenticated = authenticate(**credentials)
            if authenticated is None:
                raise AuthenticationFailed("نام کاربری یا رمز عبور نادرست است.")
            attrs[self.username_field] = user.username
            attrs["password"] = password
            data = super().validate(attrs)
        else:
            # Unknown identifier — delegate to SimpleJWT for a standard 401.
            try:
                data = super().validate({**attrs, self.username_field: identifier})
            except Exception:
                raise AuthenticationFailed("نام کاربری یا رمز عبور نادرست است.")

        # Embed the profile so the SPA needs one round trip to log in.
        data["user"] = UserSerializer(self.user).data
        return data
