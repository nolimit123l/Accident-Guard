from django.contrib import admin

from .models import AlertRecord, EmergencyContact, SensorReading, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "full_name",
        "phone_number",
        "default_risk_threshold",
        "updated_at",
    )
    search_fields = ("user__username", "full_name", "phone_number")


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("name", "phone_number", "relation", "user", "is_primary")
    list_filter = ("is_primary", "relation")
    search_fields = ("name", "phone_number", "user__username")


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "risk_score",
        "anomaly_score",
        "motion_state",
        "speed_kmph",
        "created_at",
    )
    list_filter = ("motion_state", "created_at")
    search_fields = ("user__username",)
    readonly_fields = ("detected_events", "prediction_breakdown", "raw_payload")


@admin.register(AlertRecord)
class AlertRecordAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "trigger_source",
        "status",
        "risk_score",
        "success_count",
        "failure_count",
        "created_at",
    )
    list_filter = ("trigger_source", "status", "created_at")
    search_fields = ("user__username", "sender_name")
    readonly_fields = ("recipients",)
