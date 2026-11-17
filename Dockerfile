FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.prod
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Dummy values for build-time collectstatic only
# Runtime uses real .env via compose env_file (overrides these)
ARG SECRET_KEY=build-only-dummy-secret-key-for-collectstatic
ARG ALLOWED_HOSTS=localhost,127.0.0.1
ENV SECRET_KEY=$SECRET_KEY ALLOWED_HOSTS=$ALLOWED_HOSTS
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]