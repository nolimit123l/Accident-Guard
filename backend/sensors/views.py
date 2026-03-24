import logging
from math import sqrt

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
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

GRAVITY_MS2 = 9.81
HARSH_BRAKING_THRESHOLD = -4.4
SUDDEN_ACCEL_THRESHOLD = 4.0
HARSH_TURN_THRESHOLD = 4.0
AGGRESSIVE_GYRO_THRESHOLD = 2.0
OVERSPEED_LIMIT = 80
IMPACT_BUMP_DELTA = 4.5
IMPACT_CRITICAL_DELTA = 10.0


def get_request_user(request):
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        return user
    return None


def parse_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_limit(raw_limit, default=50):
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = default
    return max(1, min(limit, 200))


def normalize_phone_numbers(raw_phone_numbers):
    normalized = []
    for number in raw_phone_numbers:
        number_str = str(number).strip().replace(" ", "")
        if not number_str:
            continue
        if not number_str.startswith("+"):
            number_str = f"+91{number_str}"
        if number_str not in normalized:
            normalized.append(number_str)
    return normalized


def normalize_acceleration_units(accel_x, accel_y, accel_z):
    magnitude = sqrt((accel_x * accel_x) + (accel_y * accel_y) + (accel_z * accel_z))
    if magnitude and magnitude < 4.0:
        return (
            accel_x * GRAVITY_MS2,
            accel_y * GRAVITY_MS2,
            accel_z * GRAVITY_MS2,
            "g",
        )
    return accel_x, accel_y, accel_z, "m_s2"


def risk_band_from_score(score):
    if score >= 80:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 25:
        return "guarded"
    return "low"


def derive_motion_state(risk_score, impact_delta, detected_events):
    if risk_score >= 75 or impact_delta >= IMPACT_CRITICAL_DELTA:
        return SensorReading.MOTION_STATE_ACCIDENT
    if risk_score >= 35 or impact_delta >= IMPACT_BUMP_DELTA or detected_events:
        return SensorReading.MOTION_STATE_BUMP
    return SensorReading.MOTION_STATE_NORMAL


def build_recommended_action(risk_score, motion_state, detected_events):
    if motion_state == SensorReading.MOTION_STATE_ACCIDENT or risk_score >= 80:
        return "Immediate stop. Check the rider and send SOS."
    if risk_score >= 55:
        return "High risk. Slow down and review surroundings."
    if detected_events:
        return "Caution. Reduce speed and stabilize the vehicle."
    return "Normal monitoring."


def calculate_confidence_score(has_ml_signal, model_breakdown, has_location, speed_kmph, detected_events, impact_delta):
    confidence = 58

    if has_location:
        confidence += 8
    if speed_kmph > 0:
        confidence += 6
    if has_ml_signal:
        confidence += 12
    if "random_forest" in model_breakdown:
        confidence += 6
    if "neural_network" in model_breakdown:
        confidence += 4
    if "cnn_1d" in model_breakdown:
        confidence += 6
    if impact_delta >= IMPACT_BUMP_DELTA:
        confidence += 5
    if detected_events:
        confidence += min(8, len(detected_events) * 2)

    return max(55, min(98, int(round(confidence))))


def calculate_rule_based_risk(accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, speed_kmph, timestamp_iso):
    detected_events = []
    trigger_reasons = []

    magnitude = sqrt((accel_x * accel_x) + (accel_y * accel_y) + (accel_z * accel_z))
    impact_delta = abs(magnitude - GRAVITY_MS2)
    max_angular_velocity = max(abs(gyro_x), abs(gyro_y), abs(gyro_z))
    score = 0.0

    if impact_delta >= IMPACT_CRITICAL_DELTA:
        detected_events.append(
            {"type": "Impact Spike", "severity": "critical", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Large impact detected")
        score += 45
    elif impact_delta >= IMPACT_BUMP_DELTA:
        detected_events.append(
            {"type": "Road Shock", "severity": "medium", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Sudden vertical shock detected")
        score += 18

    if accel_y < HARSH_BRAKING_THRESHOLD:
        detected_events.append(
            {"type": "Harsh Braking", "severity": "high", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Strong braking pattern")
        score += 20

    if accel_y > SUDDEN_ACCEL_THRESHOLD:
        detected_events.append(
            {"type": "Sudden Acceleration", "severity": "medium", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Rapid acceleration detected")
        score += 12

    if abs(accel_x) > HARSH_TURN_THRESHOLD:
        detected_events.append(
            {"type": "Harsh Turn", "severity": "high", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Sharp lateral movement")
        score += 18

    if max_angular_velocity > AGGRESSIVE_GYRO_THRESHOLD:
        detected_events.append(
            {"type": "Aggressive Rotation", "severity": "medium", "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Phone rotation exceeded safe range")
        score += 14

    if speed_kmph > OVERSPEED_LIMIT:
        severity = "high" if speed_kmph > OVERSPEED_LIMIT + 20 else "medium"
        detected_events.append(
            {"type": "Overspeed", "severity": severity, "timestamp": timestamp_iso}
        )
        trigger_reasons.append("Vehicle speed exceeded safe limit")
        score += 20 if severity == "high" else 12

    if speed_kmph > 50 and impact_delta >= IMPACT_BUMP_DELTA:
        trigger_reasons.append("Impact occurred while moving at speed")
        score += 12

    if len(detected_events) >= 3:
        score += 8

    unique_reasons = list(dict.fromkeys(trigger_reasons))
    return {
        "score": min(100.0, round(score, 2)),
        "detected_events": detected_events,
        "impact_delta": round(impact_delta, 2),
        "max_angular_velocity": round(max_angular_velocity, 2),
        "trigger_reasons": unique_reasons[:3],
    }


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
        now = timezone.localtime()
        now_iso = now.isoformat()

        speed_kmph = parse_float(data.get("speed_kmph"), 0.0)
        raw_accel_x = parse_float(data.get("accel_x"), 0.0)
        raw_accel_y = parse_float(data.get("accel_y"), 0.0)
        raw_accel_z = parse_float(data.get("accel_z"), GRAVITY_MS2)
        accel_x, accel_y, accel_z, accel_input_unit = normalize_acceleration_units(
            raw_accel_x,
            raw_accel_y,
            raw_accel_z,
        )
        gyro_x = parse_float(data.get("gyro_x"), 0.0)
        gyro_y = parse_float(data.get("gyro_y"), 0.0)
        gyro_z = parse_float(data.get("gyro_z"), 0.0)

        ml_risk_score = 0.0
        anomaly_score = 0.0
        model_breakdown = {}

        if ANY_ML_LOADED:
            try:
                ml_payload = dict(data)
                ml_payload.update(
                    {
                        "accel_x": accel_x,
                        "accel_y": accel_y,
                        "accel_z": accel_z,
                    }
                )
                sensor_sequence = data.get("sensor_sequence")
                ml_risk_score, anomaly_score, model_breakdown = predict_risk(
                    ml_payload,
                    now,
                    sensor_sequence,
                )
            except Exception as exc:
                logger.warning("ML prediction failed, using rule-based fallback: %s", exc)

        rule_result = calculate_rule_based_risk(
            accel_x,
            accel_y,
            accel_z,
            gyro_x,
            gyro_y,
            gyro_z,
            speed_kmph,
            now_iso,
        )
        rule_score = rule_result["score"]

        final_risk_score = rule_score
        has_ml_signal = bool(model_breakdown)
        if has_ml_signal:
            final_risk_score = (ml_risk_score * 0.65) + (rule_score * 0.35)

        if rule_result["impact_delta"] >= IMPACT_CRITICAL_DELTA and speed_kmph >= 30:
            final_risk_score = max(final_risk_score, 82)
        elif rule_result["impact_delta"] >= IMPACT_BUMP_DELTA and speed_kmph >= 15:
            final_risk_score = max(final_risk_score, 45)

        if len(rule_result["detected_events"]) >= 3:
            final_risk_score = min(100, final_risk_score + 5)

        final_risk_score = round(max(0, min(100, final_risk_score)), 2)
        risk_band = risk_band_from_score(final_risk_score)
        motion_state = derive_motion_state(
            final_risk_score,
            rule_result["impact_delta"],
            rule_result["detected_events"],
        )
        confidence_score = calculate_confidence_score(
            has_ml_signal,
            model_breakdown,
            has_location=bool(data.get("latitude") and data.get("longitude")),
            speed_kmph=speed_kmph,
            detected_events=rule_result["detected_events"],
            impact_delta=rule_result["impact_delta"],
        )
        recommended_action = build_recommended_action(
            final_risk_score,
            motion_state,
            rule_result["detected_events"],
        )

        user = get_request_user(request)
        prediction_breakdown = {
            **model_breakdown,
            "rule_score": round(rule_score, 2),
            "ml_score": round(ml_risk_score, 2) if has_ml_signal else None,
            "impact_delta": rule_result["impact_delta"],
            "risk_band": risk_band,
            "confidence_score": confidence_score,
            "input_acceleration_unit": accel_input_unit,
        }

        reading = SensorReading.objects.create(
            user=user,
            accel_x=accel_x,
            accel_y=accel_y,
            accel_z=accel_z,
            gyro_x=gyro_x,
            gyro_y=gyro_y,
            gyro_z=gyro_z,
            speed_kmph=speed_kmph,
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            risk_score=final_risk_score,
            anomaly_score=round(anomaly_score, 2),
            motion_state=motion_state,
            detected_events=rule_result["detected_events"],
            prediction_breakdown=prediction_breakdown,
            raw_payload={**dict(data), "normalized_acceleration_unit": accel_input_unit},
        )

        response_data = {
            "status": "success",
            "accident_rate": final_risk_score,
            "risk_band": risk_band,
            "confidence_score": confidence_score,
            "recommended_action": recommended_action,
            "motion_state": motion_state,
            "detected_events": rule_result["detected_events"],
            "trigger_reasons": rule_result["trigger_reasons"],
            "impact_delta": rule_result["impact_delta"],
            "max_angular_velocity": rule_result["max_angular_velocity"],
            "rule_score": round(rule_score, 2),
            "reading_id": reading.id,
        }

        if has_ml_signal:
            response_data["ai_models"] = {
                "random_forest": RF_LOADED,
                "neural_network": MLP_LOADED,
                "cnn_1d": CNN_LOADED,
                "anomaly_detection": ANOMALY_LOADED,
            }
            response_data["prediction_breakdown"] = prediction_breakdown
            response_data["ml_score"] = round(ml_risk_score, 2)

        if ANOMALY_LOADED:
            response_data["anomaly_score"] = round(anomaly_score, 2)

        return Response(response_data, status=status.HTTP_200_OK)


class SendSMSAlertAPI(APIView):
    def post(self, request):
        data = request.data
        user = get_request_user(request)
        phone_numbers = normalize_phone_numbers(data.get("phone_numbers", []))

        if not phone_numbers and user:
            phone_numbers = normalize_phone_numbers(
                user.emergency_contacts.values_list("phone_number", flat=True)
            )

        if not phone_numbers:
            return Response(
                {"status": "error", "message": "No valid phone numbers provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reading_id = data.get("reading_id")
        reading_queryset = SensorReading.objects.all()
        if user:
            reading_queryset = reading_queryset.filter(user=user)
        reading = reading_queryset.filter(id=reading_id).first() if reading_id else None

        risk_score = parse_float(
            data.get("risk_score"),
            default=reading.risk_score if reading else 0.0,
        )
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        if reading:
            latitude = latitude if latitude not in (None, "") else reading.latitude
            longitude = longitude if longitude not in (None, "") else reading.longitude
        location = (
            {"latitude": latitude, "longitude": longitude}
            if latitude not in (None, "") and longitude not in (None, "")
            else None
        )

        profile = getattr(user, "profile", None) if user else None
        sender_name = (
            data.get("sender_name")
            or (profile.emergency_message_name if profile and profile.emergency_message_name else "")
            or (profile.full_name if profile and profile.full_name else "")
            or (user.username if user else "Unknown User")
        )
        motion_state = data.get("motion_state") or (reading.motion_state if reading else "")
        risk_band = data.get("risk_band") or risk_band_from_score(risk_score)
        trigger_source = data.get("trigger_source", AlertRecord.TRIGGER_AUTOMATIC)
        detected_events = reading.detected_events if reading else []
        timestamp = timezone.localtime(reading.created_at) if reading else timezone.localtime()

        results = sms_service.send_bulk_alerts(
            phone_numbers,
            risk_score,
            location,
            sender_name=sender_name,
            risk_band=risk_band,
            motion_state=motion_state,
            trigger_source=trigger_source,
            detected_events=detected_events,
            timestamp=timestamp,
        )

        success_count = sum(1 for result in results if result["success"])
        failure_count = len(results) - success_count
        message_body = next(
            (result.get("message_body") for result in results if result.get("message_body")),
            sms_service.build_message_body(
                risk_score,
                location=location,
                sender_name=sender_name,
                risk_band=risk_band,
                motion_state=motion_state,
                trigger_source=trigger_source,
                detected_events=detected_events,
                timestamp=timestamp,
            ),
        )

        alert_record = AlertRecord.objects.create(
            user=user,
            sensor_reading=reading,
            trigger_source=trigger_source,
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
            latitude=latitude,
            longitude=longitude,
        )

        if success_count == 0:
            return Response(
                {
                    "status": "error",
                    "message": "All SMS attempts failed",
                    "message_body": message_body,
                    "results": results,
                    "alert_id": alert_record.id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "success",
                "message": f"Alerts sent to {success_count} contacts",
                "message_body": message_body,
                "results": results,
                "alert_id": alert_record.id,
            },
            status=status.HTTP_200_OK,
        )
