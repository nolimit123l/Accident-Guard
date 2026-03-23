import logging
import pandas as pd
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .sms_service import sms_service
from .ml_predictor import predict_risk, ANY_ML_LOADED, RF_LOADED, MLP_LOADED, CNN_LOADED, ANOMALY_LOADED

logger = logging.getLogger(__name__)

# Driving event detection thresholds (SI units: m/s²)
HARSH_BRAKING_THRESHOLD = -4.4
SUDDEN_ACCEL_THRESHOLD = 4.0
HARSH_TURN_THRESHOLD = 4.0
AGGRESSIVE_GYRO_THRESHOLD = 2.0
OVERSPEED_LIMIT = 80


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

        response_data = {
            "accident_rate": min(100, round(risk_score, 2)),
            "detected_events": detected_events,
            "status": "success",
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
        raw_phone_numbers = data.get('phone_numbers', [])

        phone_numbers = []
        for num in raw_phone_numbers:
            num_str = str(num).strip().replace(" ", "")
            if num_str:
                if not num_str.startswith('+'):
                    num_str = f"+91{num_str}"
                phone_numbers.append(num_str)

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

        if success_count == 0:
            return Response(
                {"status": "error", "message": "All SMS attempts failed", "results": results},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"status": "success", "message": f"Alerts sent to {success_count} contacts", "results": results},
            status=status.HTTP_200_OK,
        )
