"""
Neural network (MLP) for accident risk from tabular features.
Uses TensorFlow/Keras - same feature set as Random Forest, deep learning alternative.
"""
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

FEATURE_COLS = [
    'weekday_encoded', 'hour', 'latitude', 'longitude', 'altitude_m',
    'speed_kmph', 'accel_x', 'accel_y', 'accel_z',
    'gyro_x', 'gyro_y', 'gyro_z',
    'weather_encoded', 'traffic_encoded', 'road_class_encoded', 'region_type_encoded'
]
EPOCHS = 50
BATCH_SIZE = 64


def build_mlp_model(n_features):
    """Deep MLP for regression."""
    model = keras.Sequential([
        layers.Input(shape=(n_features,)),
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(1)
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss='mse',
        metrics=['mae']
    )
    return model


def train_mlp():
    if not TF_AVAILABLE:
        print("TensorFlow not installed. Run: pip install tensorflow")
        return None

    print("Loading dataset...")
    df = pd.read_csv('accident_data_synthetic.csv')

    # Use same encoders as RF - we need to fit them again for consistency
    from sklearn.preprocessing import LabelEncoder
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

    X = df[FEATURE_COLS].values.astype(np.float32)
    y = df['accident_rate'].values.astype(np.float32)

    # Scale features for neural network
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    model = build_mlp_model(X.shape[1])
    model.summary()

    print("\nTraining MLP...")
    model.fit(
        X_train, y_train,
        validation_split=0.15,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        verbose=1
    )

    y_pred = model.predict(X_test, verbose=0).flatten()
    print(f"\nTest MAE: {mean_absolute_error(y_test, y_pred):.2f}")
    print(f"Test R²: {r2_score(y_test, y_pred):.4f}")

    # Save model, scaler, encoders
    model.save('mlp_accident_model.keras')
    joblib.dump(scaler, 'mlp_scaler.pkl')
    joblib.dump(le_weekday, 'encoder_weekday.pkl')
    joblib.dump(le_weather, 'encoder_weather.pkl')
    joblib.dump(le_traffic, 'encoder_traffic.pkl')
    joblib.dump(le_road, 'encoder_road.pkl')
    joblib.dump(le_region, 'encoder_region.pkl')
    with open('feature_columns.txt', 'w') as f:
        f.write(','.join(FEATURE_COLS))

    print("Saved: mlp_accident_model.keras, mlp_scaler.pkl")
    return model


if __name__ == "__main__":
    train_mlp()
