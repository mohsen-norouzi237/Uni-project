from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=10, choices=Action.choices)

    # generic reference, not tied to a specific app/model
    entity_type = models.CharField(max_length=100)  # e.g. "TAAssignment"
    entity_id = models.PositiveIntegerField()

    # state before/after the change
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.action} on {self.entity_type}#{self.entity_id} by {self.actor}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Audit logs are immutable and cannot be modified.")
        super().save(*args, **kwargs)
