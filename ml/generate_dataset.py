import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

# Set seed for reproducibility
np.random.seed(42)
random.seed(42)

# Generate 50,000 records as per README
NUM_RECORDS = 50000

# Based on MoRTH data patterns for Indian roads
def generate_synthetic_dataset():
    data = []
    
    # Weekdays
    weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    # Time slots (peak hours have higher accident rates)
    # MoRTH data shows peaks at 6-9 AM, 5-8 PM
    
    # Indian geography bounds (8°N to 32.8°N as per README)
    lat_min, lat_max = 8.0, 32.8
    lon_min, lon_max = 68.0, 97.0
    
    # Weather conditions
    weather_conditions = ['Clear', 'Rain', 'Fog', 'Cloudy']
    weather_weights = [0.6, 0.2, 0.1, 0.1]  # Clear is most common
    
    # Traffic conditions
    traffic_conditions = ['Light', 'Moderate', 'Heavy']
    traffic_weights = [0.3, 0.5, 0.2]
    
    # Road classes
    road_classes = ['Highway', 'Urban', 'Rural']
    road_weights = [0.3, 0.4, 0.3]
    
    # Region types
    region_types = ['Urban', 'Rural']
    region_weights = [0.6, 0.4]
    
    for i in range(NUM_RECORDS):
        # Random weekday
        weekday = random.choice(weekdays)
        
        # Random time (24-hour format)
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        time_str = f"{hour:02d}:{minute:02d}"
        
        # Location
        latitude = np.random.uniform(lat_min, lat_max)
        longitude = np.random.uniform(lon_min, lon_max)
        altitude = int(np.random.uniform(0, 3000))  # meters
        
        # Speed (0-120 km/h, higher speeds = higher risk)
        speed = int(np.random.uniform(0, 120))
        
        # Accelerometer readings (m/s²)
        # Normal driving: ~0-2 m/s², sudden braking: >5 m/s²
        base_accel = np.random.uniform(0, 2)
        accel_x = np.random.normal(0, base_accel)
        accel_y = np.random.normal(0, base_accel)
        accel_z = np.random.normal(9.8, 0.5)  # Gravity component
        
        # Gyroscope readings (rad/s)
        # Normal: ~0-0.5, sharp turns: >1
        base_gyro = np.random.uniform(0, 0.5)
        gyro_x = np.random.normal(0, base_gyro)
        gyro_y = np.random.normal(0, base_gyro)
        gyro_z = np.random.normal(0, base_gyro)
        
        # Contextual factors
        weather = random.choices(weather_conditions, weather_weights)[0]
        traffic = random.choices(traffic_conditions, traffic_weights)[0]
        road_class = random.choices(road_classes, road_weights)[0]
        region_type = random.choices(region_types, region_weights)[0]
        
        # Calculate accident rate (0-100%)
        # Based on risk factors from MoRTH data
        risk = 0
        
        # Speed factor (higher speed = higher risk)
        if speed > 80:
            risk += 20
        elif speed > 60:
            risk += 10
        
        # Time factor (peak hours)
        if 6 <= hour <= 9 or 17 <= hour <= 20:
            risk += 15
        
        # Weather factor
        if weather == 'Rain':
            risk += 20
        elif weather == 'Fog':
            risk += 25
        
        # Traffic factor
        if traffic == 'Heavy':
            risk += 15
        
        # Sensor anomaly factor (sudden movements)
        if abs(accel_x) > 3 or abs(accel_y) > 3:
            risk += 25
        if abs(gyro_x) > 1 or abs(gyro_y) > 1 or abs(gyro_z) > 1:
            risk += 20
        
        # Road type factor
        if road_class == 'Highway' and speed > 100:
            risk += 10
        
        # Add some randomness
        risk += np.random.uniform(-10, 10)
        
        # Clamp to 0-100
        accident_rate = max(0, min(100, risk))
        
        # Create record
        record = {
            'weekday': weekday,
            'time': time_str,
            'latitude': round(latitude, 4),
            'longitude': round(longitude, 4),
            'altitude_m': altitude,
            'speed_kmph': speed,
            'accel_x': round(accel_x, 2),
            'accel_y': round(accel_y, 2),
            'accel_z': round(accel_z, 2),
            'gyro_x': round(gyro_x, 2),
            'gyro_y': round(gyro_y, 2),
            'gyro_z': round(gyro_z, 2),
            'weather': weather,
            'traffic': traffic,
            'road_class': road_class,
            'region_type': region_type,
            'accident_rate': round(accident_rate, 2)
        }
        
        data.append(record)
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Save to CSV
    df.to_csv('accident_data_synthetic.csv', index=False)
    
    # Print statistics
    print(f"Generated {NUM_RECORDS} records")
    print(f"\nAccident Rate Statistics:")
    print(f"Mean: {df['accident_rate'].mean():.2f}%")
    print(f"Median: {df['accident_rate'].median():.2f}%")
    print(f"High Risk (>25%): {(df['accident_rate'] > 25).sum()} ({(df['accident_rate'] > 25).sum()/NUM_RECORDS*100:.1f}%)")
    print(f"\nDataset saved to: accident_data_synthetic.csv")
    
    return df

if __name__ == "__main__":
    df = generate_synthetic_dataset()
    print("\nFirst 5 rows:")
    print(df.head())
