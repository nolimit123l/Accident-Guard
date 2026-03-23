import random
from .config import MODEL_CONFIG

def predict_risk(sensor_data):
    """
    Mock inference function.
    Returns a risk score between 0 and 100.
    """
    # In a real scenario, we would load the model and predict
    # model = load_model()
    # risk = model.predict(sensor_data)
    
    # For now, return random
    return random.uniform(0, 100)
