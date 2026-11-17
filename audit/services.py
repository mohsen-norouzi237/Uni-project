from audit.models import AuditLog


def create_audit_log(
    *,
    actor,
    action,
    entity,
    old_values=None,
    new_values=None,
):
    # Create a generic audit record for an entity change.
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity.__class__.__name__,
        entity_id=entity.pk,
        old_values=old_values,
        new_values=new_values,
    )
