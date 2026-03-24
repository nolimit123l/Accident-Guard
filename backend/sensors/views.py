import logging
from datetime import datetime

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .ml_predictor import ANOMALY_LOADED, ANY_ML_LOADED, CNN_LOADED, MLP_LOADED, RF_LOADED, predict_risk
from .models import AlertRecord, EmergencyContact, SensorReading
from .serializers import (
    AlertRecordSerializer,
    EmergencyContactSerializer,
    RegisterSerializer,
    SensorReadingSerializer,
    UserProfileSerializer,
)
from .sms_service import sms_service

logger = logging.getLogger(__name__)

# Driving event detection thresholds (SI units: m/s²)
HARSH_BRAKING_THRESHOLD = -4.4
SUDDEN_ACCEL_THRESHOLD = 4.0
HARSH_TURN_THRESHOLD = 4.0
AGGRESSIVE_GYRO_THRESHOLD = 2.0
OVERSPEED_LIMIT = 80


def get_request_user(request):
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        return user
    return None


def normalize_phone_numbers(raw_phone_numbers):
    normalized = []
    for num in raw_phone_numbers:
        num_str = str(num).strip().replace(" ", "")
        if not num_str:
            continue
        if not num_str.startswith("+"):
            num_str = f"+91{num_str}"
        if num_str not in normalized:
            normalized.append(num_str)
    return normalized


def derive_motion_state(risk_score, detected_events):
    if risk_score >= 70:
        return SensorReading.MOTION_STATE_ACCIDENT
    if risk_score >= 30 or detected_events:
        return SensorReading.MOTION_STATE_BUMP
    return SensorReading.MOTION_STATE_NORMAL


def parse_limit(raw_limit, default=50):
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = default
    return max(1, min(limit, 200))


class RegisterAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "profile": UserProfileSerializer(user.profile).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {"status": "error", "message": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "profile": UserProfileSerializer(user.profile).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"status": "success", "message": "Logged out successfully."})


class ProfileAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "status": "success",
                "profile": UserProfileSerializer(request.user.profile).data,
                "contacts_count": request.user.emergency_contacts.count(),
            }
        )

    def put(self, request):
        serializer = UserProfileSerializer(request.user.profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"status": "success", "profile": serializer.data})

    patch = put


class EmergencyContactListCreateAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        contacts = request.user.emergency_contacts.all()
        return Response(
            {
                "status": "success",
                "contacts": EmergencyContactSerializer(contacts, many=True).data,
            }
        )

    def post(self, request):
        serializer = EmergencyContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save(user=request.user)
        return Response(
            {"status": "success", "contact": EmergencyContactSerializer(contact).data},
            status=status.HTTP_201_CREATED,
        )


class EmergencyContactDetailAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, contact_id):
        return get_object_or_404(EmergencyContact, id=contact_id, user=request.user)

    def put(self, request, contact_id):
        contact = self.get_object(request, contact_id)
        serializer = EmergencyContactSerializer(contact, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"status": "success", "contact": serializer.data})

    patch = put

    def delete(self, request, contact_id):
        contact = self.get_object(request, contact_id)
        contact.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SensorReadingListAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = parse_limit(request.query_params.get("limit", 50))
        readings = request.user.sensor_readings.all()[:limit]
        return Response(
            {
                "status": "success",
                "readings": SensorReadingSerializer(readings, many=True).data,
            }
        )


class AlertRecordListAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = parse_limit(request.query_params.get("limit", 50))
        alerts = request.user.alert_records.all()[:limit]
        return Response(
            {
                "status": "success",
                "alerts": AlertRecordSerializer(alerts, many=True).data,
            }
        )


class TriggerAPI(APIView):
    def post(self, request):
        data = request.data
        detected_events = []
        now = datetime.now()
        now_iso = now.isoformat()

        speed = float(data.get('speed_kmph', 0))
        accel_x = float(data.get('accel_x', 0))
        accel_y = float(data.get('accel_y', 0))
        accel_z = float(data.get('accel_z', 9.8))
        gyro_x = float(data.get('gyro_x', 0))
        gyro_y = float(data.get('gyro_y', 0))
        gyro_z = float(data.get('gyro_z', 0))

        risk_score = 0.0
        anomaly_score = 0.0
        model_breakdown = {}

        # AI/ML
        if ANY_ML_LOADED:
            try:
                sensor_sequence = data.get('sensor_sequence')  # Optional: list of 64 x {accel_x, ...}
                risk_score, anomaly_score, model_breakdown = predict_risk(data, now, sensor_sequence)
            except Exception as e:
                logger.warning(f"ML prediction failed, using rule-based fallback: {e}")

        # Rule backup
        if accel_y < HARSH_BRAKING_THRESHOLD:
            detected_events.append({"type": "Harsh Braking", "severity": "high", "timestamp": now_iso})
            risk_score += 30
        if accel_y > SUDDEN_ACCEL_THRESHOLD:
            detected_events.append({"type": "Sudden Acceleration", "severity": "medium", "timestamp": now_iso})
            risk_score += 20
        if abs(accel_x) > HARSH_TURN_THRESHOLD:
            detected_events.append({"type": "Harsh Turn", "severity": "high", "timestamp": now_iso})
            risk_score += 25
        if any(abs(g) > AGGRESSIVE_GYRO_THRESHOLD for g in [gyro_x, gyro_y, gyro_z]):
            detected_events.append({"type": "Aggressive Driving", "severity": "medium", "timestamp": now_iso})
            risk_score += 15
        if speed > OVERSPEED_LIMIT:
            severity = "high" if speed > OVERSPEED_LIMIT + 20 else "medium"
            detected_events.append({"type": "Overspeed", "severity": severity, "timestamp": now_iso})
            risk_score += 20

        motion_state = derive_motion_state(risk_score, detected_events)
        user = get_request_user(request)
        reading = SensorReading.objects.create(
            user=user,
            accel_x=accel_x,
            accel_y=accel_y,
            accel_z=accel_z,
            gyro_x=gyro_x,
            gyro_y=gyro_y,
            gyro_z=gyro_z,
            speed_kmph=speed,
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            risk_score=min(100, round(risk_score, 2)),
            anomaly_score=round(anomaly_score, 2),
            motion_state=motion_state,
            detected_events=detected_events,
            prediction_breakdown=model_breakdown,
            raw_payload=dict(data),
        )

        response_data = {
            "accident_rate": min(100, round(risk_score, 2)),
            "detected_events": detected_events,
            "status": "success",
            "motion_state": motion_state,
            "reading_id": reading.id,
        }

        # AI
        if model_breakdown:
            response_data["ai_models"] = {
                "random_forest": RF_LOADED,
                "neural_network": MLP_LOADED,
                "cnn_1d": CNN_LOADED,
                "anomaly_detection": ANOMALY_LOADED,
            }
            response_data["prediction_breakdown"] = model_breakdown
            if ANOMALY_LOADED:
                response_data["anomaly_score"] = round(anomaly_score, 2)

        return Response(response_data, status=status.HTTP_200_OK)


class SendSMSAlertAPI(APIView):
    def post(self, request):
        data = request.data
        user = get_request_user(request)
        raw_phone_numbers = data.get("phone_numbers", [])
        phone_numbers = normalize_phone_numbers(raw_phone_numbers)

        if not phone_numbers and user:
            phone_numbers = normalize_phone_numbers(
                user.emergency_contacts.values_list("phone_number", flat=True)
            )

        if not phone_numbers:
            return Response(
                {"status": "error", "message": "No valid phone numbers provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        risk_score = float(data.get('risk_score', 0))
        location = (
            {"latitude": data.get("latitude"), "longitude": data.get("longitude")}
            if data.get("latitude") and data.get("longitude")
            else None
        )

        results = sms_service.send_bulk_alerts(phone_numbers, risk_score, location)
        success_count = sum(1 for r in results if r["success"])
        failure_count = len(results) - success_count
        profile = getattr(user, "profile", None) if user else None
        sender_name = (
            data.get("sender_name")
            or (profile.emergency_message_name if profile and profile.emergency_message_name else "")
            or (profile.full_name if profile and profile.full_name else "")
            or (user.username if user else "Unknown User")
        )
        message_body = (
            f"REFLEX SOS from {sender_name}. "
            f"Risk {risk_score:.0f}%. "
            f"Location: https://maps.google.com/?q={location['latitude']},{location['longitude']}"
            if location
            else f"REFLEX SOS from {sender_name}. Risk {risk_score:.0f}%."
        )

        alert_record = AlertRecord.objects.create(
            user=user,
            trigger_source=data.get("trigger_source", AlertRecord.TRIGGER_AUTOMATIC),
            status=(
                AlertRecord.STATUS_SENT
                if success_count == len(results)
                else AlertRecord.STATUS_PARTIAL if success_count > 0 else AlertRecord.STATUS_FAILED
            ),
            sender_name=sender_name,
            risk_score=risk_score,
            message_body=message_body,
            recipients=results,
            success_count=success_count,
            failure_count=failure_count,
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            sensor_reading_id=data.get("reading_id"),
        )

        if success_count == 0:
            return Response(
                {
                    "status": "error",
                    "message": "All SMS attempts failed",
                    "results": results,
                    "alert_id": alert_record.id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "success",
                "message": f"Alerts sent to {success_count} contacts",
                "results": results,
                "alert_id": alert_record.id,
            },
            status=status.HTTP_200_OK,
        )
