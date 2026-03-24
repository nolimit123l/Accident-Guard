from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AlertRecord, EmergencyContact, SensorReading, UserProfile

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "").strip()
        phone_number = validated_data.pop("phone_number", "").strip()
        validated_data.pop("confirm_password", None)

        user = User.objects.create_user(**validated_data)
        profile = user.profile
        if full_name:
            profile.full_name = full_name
            profile.emergency_message_name = full_name
        if phone_number:
            profile.phone_number = phone_number
        profile.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = (
            "username",
            "email",
            "full_name",
            "phone_number",
            "emergency_message_name",
            "default_risk_threshold",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = (
            "id",
            "name",
            "phone_number",
            "relation",
            "is_primary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SensorReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorReading
        fields = (
            "id",
            "accel_x",
            "accel_y",
            "accel_z",
            "gyro_x",
            "gyro_y",
            "gyro_z",
            "speed_kmph",
            "latitude",
            "longitude",
            "risk_score",
            "anomaly_score",
            "motion_state",
            "detected_events",
            "prediction_breakdown",
            "raw_payload",
            "created_at",
        )
        read_only_fields = fields


class AlertRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRecord
        fields = (
            "id",
            "trigger_source",
            "status",
            "sender_name",
            "risk_score",
            "message_body",
            "recipients",
            "success_count",
            "failure_count",
            "latitude",
            "longitude",
            "created_at",
            "sensor_reading",
        )
        read_only_fields = fields
