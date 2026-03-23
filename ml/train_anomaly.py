"""
Anomaly detection for unusual driving patterns using Isolation Forest.
Flags risky behaviors that don't match typical training distribution.
"""
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler

FEATURE_COLS = [
    'weekday_encoded', 'hour', 'latitude', 'longitude', 'altitude_m',
    'speed_kmph', 'accel_x', 'accel_y', 'accel_z',
    'gyro_x', 'gyro_y', 'gyro_z',
    'weather_encoded', 'traffic_encoded', 'road_class_encoded', 'region_type_encoded'
]


def train_anomaly_detector():
    """Train Isolation Forest on normal/low-risk samples. Anomalies = high-risk or unusual."""
    print("Loading dataset...")
    df = pd.read_csv('accident_data_synthetic.csv')

    le_weekday = LabelEncoder()
    le_weather = LabelEncoder()
    le_traffic = LabelEncoder()
    le_road = LabelEncoder()
    le_region = LabelEncoder()

    df['weekday_encoded'] = le_weekday.fit_transform(df['weekday'])
    df['weather_encoded'] = le_weather.fit_transform(df['weather'])
    df['traffic_encoded'] = le_traffic.fit_transform(df['traffic'])
    df['road_class_encoded'] = le_road.fit_transform(df['road_class'])
    df['region_type_encoded'] = le_region.fit_transform(df['region_type'])
    df['hour'] = df['time'].apply(lambda x: int(x.split(':')[0]))

    X = df[FEATURE_COLS].values

    # Use ALL data - IF will learn "normal" as majority; anomalies = outliers
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Contamination: fraction of outliers expected. 5% for driving anomalies
    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42, n_jobs=-1)
    iso.fit(X_scaled)

    # Anomaly score: negative = more anomalous (higher risk of being outlier)
    scores = iso.decision_function(X_scaled)
    preds = iso.predict(X_scaled)  # -1 = anomaly, 1 = normal

    # Convert to 0-100 "anomaly risk": higher = more unusual
    # decision_function: more negative = more anomalous
    score_min, score_max = scores.min(), scores.max()
    anomaly_risk = 100 * (1 - (scores - score_min) / (score_max - score_min + 1e-6))
    anomaly_risk = np.clip(anomaly_risk, 0, 100)

    print(f"Anomaly rate in train: {(preds == -1).mean()*100:.1f}%")
    print(f"Score range: [{scores.min():.3f}, {scores.max():.3f}]")

    joblib.dump(iso, 'anomaly_detector.pkl')
    joblib.dump(scaler, 'anomaly_scaler.pkl')
    joblib.dump(le_weekday, 'encoder_weekday.pkl')
    joblib.dump(le_weather, 'encoder_weather.pkl')
    joblib.dump(le_traffic, 'encoder_traffic.pkl')
    joblib.dump(le_road, 'encoder_road.pkl')
    joblib.dump(le_region, 'encoder_region.pkl')
    with open('feature_columns.txt', 'w') as f:
        f.write(','.join(FEATURE_COLS))

    print("Saved: anomaly_detector.pkl, anomaly_scaler.pkl")
    return iso


if __name__ == "__main__":
    train_anomaly_detector()
