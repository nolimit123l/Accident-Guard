from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    full_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    emergency_message_name = models.CharField(max_length=120, blank=True)
    default_risk_threshold = models.PositiveSmallIntegerField(default=70)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name or self.user.get_username()


class EmergencyContact(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="emergency_contacts",
    )
    name = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=20)
    relation = models.CharField(max_length=80, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_primary", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "phone_number"],
                name="unique_contact_per_user",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.phone_number})"


class SensorReading(models.Model):
    MOTION_STATE_NORMAL = "normal"
    MOTION_STATE_BUMP = "bump"
    MOTION_STATE_ACCIDENT = "accident"
    MOTION_STATE_CHOICES = [
        (MOTION_STATE_NORMAL, "Normal"),
        (MOTION_STATE_BUMP, "Bump"),
        (MOTION_STATE_ACCIDENT, "Accident"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sensor_readings",
        null=True,
        blank=True,
    )
    accel_x = models.FloatField(default=0.0)
    accel_y = models.FloatField(default=0.0)
    accel_z = models.FloatField(default=9.8)
    gyro_x = models.FloatField(default=0.0)
    gyro_y = models.FloatField(default=0.0)
    gyro_z = models.FloatField(default=0.0)
    speed_kmph = models.FloatField(default=0.0)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    risk_score = models.FloatField(default=0.0)
    anomaly_score = models.FloatField(default=0.0)
    motion_state = models.CharField(
        max_length=20,
        choices=MOTION_STATE_CHOICES,
        default=MOTION_STATE_NORMAL,
    )
    detected_events = models.JSONField(default=list, blank=True)
    prediction_breakdown = models.JSONField(default=dict, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        username = self.user.get_username() if self.user else "anonymous"
        return f"{username} reading @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class AlertRecord(models.Model):
    TRIGGER_AUTOMATIC = "automatic"
    TRIGGER_MANUAL = "manual"
    TRIGGER_CHOICES = [
        (TRIGGER_AUTOMATIC, "Automatic"),
        (TRIGGER_MANUAL, "Manual"),
    ]

    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_PARTIAL = "partial"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SENT, "Sent"),
        (STATUS_PARTIAL, "Partially Sent"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="alert_records",
        null=True,
        blank=True,
    )
    sensor_reading = models.ForeignKey(
        SensorReading,
        on_delete=models.SET_NULL,
        related_name="alerts",
        null=True,
        blank=True,
    )
    trigger_source = models.CharField(
        max_length=20,
        choices=TRIGGER_CHOICES,
        default=TRIGGER_AUTOMATIC,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    sender_name = models.CharField(max_length=120, blank=True)
    risk_score = models.FloatField(default=0.0)
    message_body = models.TextField(blank=True)
    recipients = models.JSONField(default=list, blank=True)
    success_count = models.PositiveIntegerField(default=0)
    failure_count = models.PositiveIntegerField(default=0)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        username = self.user.get_username() if self.user else "anonymous"
        return f"{username} alert ({self.status}) @ {self.created_at:%Y-%m-%d %H:%M:%S}"


User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, **kwargs):
    profile, _ = UserProfile.objects.get_or_create(
        user=instance,
        defaults={"full_name": instance.get_full_name()},
    )

    full_name = instance.get_full_name()
    if full_name and not profile.full_name:
        profile.full_name = full_name
        profile.save()

