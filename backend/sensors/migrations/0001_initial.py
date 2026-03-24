from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SensorReading",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("accel_x", models.FloatField(default=0.0)),
                ("accel_y", models.FloatField(default=0.0)),
                ("accel_z", models.FloatField(default=9.8)),
                ("gyro_x", models.FloatField(default=0.0)),
                ("gyro_y", models.FloatField(default=0.0)),
                ("gyro_z", models.FloatField(default=0.0)),
                ("speed_kmph", models.FloatField(default=0.0)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("risk_score", models.FloatField(default=0.0)),
                ("anomaly_score", models.FloatField(default=0.0)),
                (
                    "motion_state",
                    models.CharField(
                        choices=[
                            ("normal", "Normal"),
                            ("bump", "Bump"),
                            ("accident", "Accident"),
                        ],
                        default="normal",
                        max_length=20,
                    ),
                ),
                ("detected_events", models.JSONField(blank=True, default=list)),
                ("prediction_breakdown", models.JSONField(blank=True, default=dict)),
                ("raw_payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sensor_readings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(blank=True, max_length=120)),
                ("phone_number", models.CharField(blank=True, max_length=20)),
                ("emergency_message_name", models.CharField(blank=True, max_length=120)),
                ("default_risk_threshold", models.PositiveSmallIntegerField(default=70)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="EmergencyContact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("phone_number", models.CharField(max_length=20)),
                ("relation", models.CharField(blank=True, max_length=80)),
                ("is_primary", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="emergency_contacts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-is_primary", "name"],
            },
        ),
        migrations.CreateModel(
            name="AlertRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "trigger_source",
                    models.CharField(
                        choices=[("automatic", "Automatic"), ("manual", "Manual")],
                        default="automatic",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("sent", "Sent"),
                            ("partial", "Partially Sent"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("sender_name", models.CharField(blank=True, max_length=120)),
                ("risk_score", models.FloatField(default=0.0)),
                ("message_body", models.TextField(blank=True)),
                ("recipients", models.JSONField(blank=True, default=list)),
                ("success_count", models.PositiveIntegerField(default=0)),
                ("failure_count", models.PositiveIntegerField(default=0)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "sensor_reading",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alerts",
                        to="sensors.sensorreading",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alert_records",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="emergencycontact",
            constraint=models.UniqueConstraint(
                fields=("user", "phone_number"),
                name="unique_contact_per_user",
            ),
        ),
    ]
