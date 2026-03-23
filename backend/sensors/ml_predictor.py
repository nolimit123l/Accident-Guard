"""
Centralized AI/ML predictor for accident risk.
Supports ensemble of Random Forest, MLP, 1D CNN, and anomaly detection.
"""
import os
import logging
import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, '..', 'ml')

SENSOR_COLS = ['accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z']
SEQ_LENGTH = 64
FEATURE_COLS = [
    'weekday_encoded', 'hour', 'latitude', 'longitude', 'altitude_m',
    'speed_kmph', 'accel_x', 'accel_y', 'accel_z',
    'gyro_x', 'gyro_y', 'gyro_z',
    'weather_encoded', 'traffic_encoded', 'road_class_encoded', 'region_type_encoded'
]


def _load(path):
    p = os.path.join(ML_DIR, path)
    return joblib.load(p) if os.path.exists(p) else None


def _load_npz(path):
    p = os.path.join(ML_DIR, path)
    return np.load(p) if os.path.exists(p) else None


# Lazy-load TensorFlow models
_cnn_model = None
_mlp_model = None


def _get_cnn():
    global _cnn_model
    if _cnn_model is not None:
        return _cnn_model
    try:
        from tensorflow import keras
        p = os.path.join(ML_DIR, 'cnn_accident_model.keras')
        if os.path.exists(p):
            _cnn_model = keras.models.load_model(p)
            return _cnn_model
    except Exception as e:
        logger.debug(f"CNN model not available: {e}")
    return None


def _get_mlp():
    global _mlp_model
    if _mlp_model is not None:
        return _mlp_model
    try:
        from tensorflow import keras
        p = os.path.join(ML_DIR, 'mlp_accident_model.keras')
        if os.path.exists(p):
            _mlp_model = keras.models.load_model(p)
            return _mlp_model
    except Exception as e:
        logger.debug(f"MLP model not available: {e}")
    return None


# Load on module init
_rf_model = _load('accident_model.pkl')
_le_weekday = _load('encoder_weekday.pkl')
_le_weather = _load('encoder_weather.pkl')
_le_traffic = _load('encoder_traffic.pkl')
_le_road = _load('encoder_road.pkl')
_le_region = _load('encoder_region.pkl')
_mlp_scaler = _load('mlp_scaler.pkl')
_anomaly_detector = _load('anomaly_detector.pkl')
_anomaly_scaler = _load('anomaly_scaler.pkl')
_cnn_norm = _load_npz('cnn_normalization.npz')

RF_LOADED = _rf_model is not None and all([_le_weekday, _le_weather, _le_traffic, _le_road, _le_region])
MLP_LOADED = _get_mlp() is not None and _mlp_scaler is not None
CNN_LOADED = _get_cnn() is not None and _cnn_norm is not None
ANOMALY_LOADED = _anomaly_detector is not None and _anomaly_scaler is not None
ANY_ML_LOADED = RF_LOADED or MLP_LOADED or CNN_LOADED


def safe_encode(le, value):
    if le is None or value is None:
        return 0
    try:
        return le.transform([value])[0] if value in le.classes_ else 0
    except Exception:
        return 0


def build_tabular_features(data, now):
    """Build feature vector for RF/MLP/anomaly from request data."""
    weekday = data.get('weekday', now.strftime('%a'))
    hour = int(data.get('time', now.strftime('%H:%M')).split(':')[0])
    features = [
        safe_encode(_le_weekday, weekday),
        hour,
        float(data.get('latitude', 28.6139)),
        float(data.get('longitude', 77.2090)),
        int(data.get('altitude_m', 200)),
        float(data.get('speed_kmph', 0)),
        float(data.get('accel_x', 0)),
        float(data.get('accel_y', 0)),
        float(data.get('accel_z', 9.8)),
        float(data.get('gyro_x', 0)),
        float(data.get('gyro_y', 0)),
        float(data.get('gyro_z', 0)),
        safe_encode(_le_weather, data.get('weather', 'Clear')),
        safe_encode(_le_traffic, data.get('traffic', 'Moderate')),
        safe_encode(_le_road, data.get('road_class', 'Urban')),
        safe_encode(_le_region, data.get('region_type', 'Urban'))
    ]
    return np.array([features], dtype=np.float32)


def predict_risk(data, now, sensor_sequence=None):
    """
    Ensemble prediction: RF + MLP (and optionally CNN if sequence provided).
    Returns (risk_score, anomaly_score, model_breakdown).
    """
    risk_score = 0.0
    anomaly_score = 0.0
    breakdown = {}

    features = build_tabular_features(data, now)
    X_tabular = pd.DataFrame(features, columns=FEATURE_COLS)

    # Random Forest
    if RF_LOADED:
        try:
            rf_pred = _rf_model.predict(X_tabular)[0]
            risk_score += rf_pred
            breakdown['random_forest'] = float(rf_pred)
        except Exception as e:
            logger.warning(f"RF prediction failed: {e}")

    # MLP
    if MLP_LOADED:
        try:
            X_scaled = _mlp_scaler.transform(features)
            mlp_pred = _get_mlp().predict(X_scaled, verbose=0)[0][0]
            risk_score += mlp_pred
            breakdown['neural_network'] = float(mlp_pred)
        except Exception as e:
            logger.warning(f"MLP prediction failed: {e}")

    # Ensemble average for tabular models
    n_tabular = sum(1 for k in ['random_forest', 'neural_network'] if k in breakdown)
    if n_tabular > 0:
        risk_score = risk_score / n_tabular

    # 1D CNN (if sensor sequence provided)
    if sensor_sequence and CNN_LOADED:
        try:
            seq = np.array(sensor_sequence, dtype=np.float32)
            if seq.shape == (SEQ_LENGTH, len(SENSOR_COLS)):
                mean = _cnn_norm['mean']
                std = _cnn_norm['std']
                std[std < 1e-6] = 1.0
                seq_norm = (seq - mean) / std
                seq_batch = np.expand_dims(seq_norm, axis=0)
                cnn_pred = _get_cnn().predict(seq_batch, verbose=0)[0][0]
                breakdown['cnn_1d'] = float(cnn_pred)
                # Weighted blend: 0.6 tabular + 0.4 CNN for temporal awareness
                risk_score = 0.6 * risk_score + 0.4 * cnn_pred if n_tabular > 0 else cnn_pred
        except Exception as e:
            logger.warning(f"CNN prediction failed: {e}")

    # Anomaly detection
    if ANOMALY_LOADED:
        try:
            X_anom = _anomaly_scaler.transform(features)
            dec = _anomaly_detector.decision_function(X_anom)[0]
            # Convert to 0-100: more negative = more anomalous
            # Rough mapping: typical range [-0.1, 0.1] -> map to 0-100
            anomaly_score = max(0, min(100, 50 + dec * 200))  # scale heuristically
            breakdown['anomaly_score'] = round(anomaly_score, 2)
            # Slight boost to risk if highly anomalous
            if anomaly_score > 70:
                risk_score = min(100, risk_score + 10)
        except Exception as e:
            logger.warning(f"Anomaly detection failed: {e}")

    return risk_score, anomaly_score, breakdown
