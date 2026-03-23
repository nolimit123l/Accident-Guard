"""
1D CNN model for accident risk prediction from sensor time-series.
Uses TensorFlow/Keras - processes rolling windows of accel/gyro data.
"""
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# TensorFlow - use lazy import for optional dependency
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

SEQ_LENGTH = 64
N_CHANNELS = 6
EPOCHS = 20
BATCH_SIZE = 64
VALIDATION_SPLIT = 0.15


def build_cnn_model(seq_len=SEQ_LENGTH, n_channels=N_CHANNELS):
    """Build 1D CNN for sensor sequence classification -> regression."""
    model = keras.Sequential([
        layers.Input(shape=(seq_len, n_channels)),
        layers.Conv1D(64, 8, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling1D(2),
        layers.Dropout(0.2),
        layers.Conv1D(32, 4, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling1D(2),
        layers.Dropout(0.2),
        layers.Conv1D(16, 2, activation='relu', padding='same'),
        layers.GlobalAveragePooling1D(),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(1)
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss='mse',
        metrics=['mae']
    )
    return model


def train_cnn():
    if not TF_AVAILABLE:
        print("TensorFlow not installed. Run: pip install tensorflow")
        return None

    # Load sequences
    npz_path = 'sensor_sequences.npz'
    if not os.path.exists(npz_path):
        print("Run generate_sequences.py first to create sensor_sequences.npz")
        return None

    data = np.load(npz_path)
    X = data['X']
    y = data['y']
    mean = data['mean']
    std = data['std']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = build_cnn_model()
    model.summary()

    print("\nTraining 1D CNN...")
    history = model.fit(
        X_train, y_train,
        validation_split=VALIDATION_SPLIT,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        verbose=1
    )

    # Evaluate
    y_pred = model.predict(X_test, verbose=0).flatten()
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    print(f"\nTest MAE: {mae:.2f}, RMSE: {rmse:.2f}, R²: {r2:.4f}")

    # Save model and normalization params
    model.save('cnn_accident_model.keras')
    np.savez('cnn_normalization.npz', mean=mean, std=std)
    print("Saved: cnn_accident_model.keras, cnn_normalization.npz")
    return model


if __name__ == "__main__":
    train_cnn()
