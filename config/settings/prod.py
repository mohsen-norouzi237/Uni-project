import os

from .base import *  # noqa: F403,F401

DEBUG = False

# Docker/prod (run via gunicorn) -> docs staff-only; runserver (dev) stays public via base.
SPECTACULAR_SETTINGS = {
    **SPECTACULAR_SETTINGS,  # noqa: F405
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
}

SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY env var is required in prod (config/settings/prod.py)")

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if not ALLOWED_HOSTS:
    raise RuntimeError("ALLOWED_HOSTS env var is required in prod (e.g. localhost)")

# Trust proxy header when behind nginx/compose.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# just for local docker now, after ssl this should be 1
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "1") == "1"
SECURE_HSTS_SECONDS = 31536000  # 1y
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True  # HTTPS cookie
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True  # MIME guessing
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"  # blocks clickjacking
REFERRER_POLICY = "same-origin"
