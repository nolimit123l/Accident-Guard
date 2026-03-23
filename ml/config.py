import os

MODEL_CONFIG = {
    "accident_threshold": float(os.getenv("ACCIDENT_THRESHOLD", "25.0")),
    "sensor_frequency": int(os.getenv("SENSOR_FREQUENCY_MS", "200")),
    "batch_size": int(os.getenv("BATCH_SIZE", "100")),
    "model_retrain_interval": int(os.getenv("MODEL_RETRAIN_INTERVAL_DAYS", "7")),
}
