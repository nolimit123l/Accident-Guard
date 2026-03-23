import pandas as pd
import numpy as np
import json

# Regional accident statistics based on MoRTH data patterns
# This creates a lookup database for accident history by region

def generate_regional_accident_data():
    """
    Generate regional accident statistics for major Indian cities/regions
    Based on MoRTH accident patterns
    """
    
    regions = [
        # Format: (lat_min, lat_max, lon_min, lon_max, city, state, accident_rate)
        # Northern India
        (28.4, 28.9, 76.8, 77.5, "Delhi", "Delhi", 45.2),
        (28.3, 28.8, 77.0, 77.4, "Gurgaon", "Haryana", 38.5),
        (26.7, 27.0, 75.6, 75.9, "Jaipur", "Rajasthan", 32.1),
        (30.6, 30.8, 76.6, 76.9, "Chandigarh", "Chandigarh", 28.4),
        
        # Western India
        (18.9, 19.3, 72.7, 73.0, "Mumbai", "Maharashtra", 52.3),
        (18.4, 18.7, 73.7, 74.0, "Pune", "Maharashtra", 41.7),
        (23.0, 23.2, 72.5, 72.7, "Ahmedabad", "Gujarat", 36.9),
        (21.1, 21.3, 79.0, 79.2, "Nagpur", "Maharashtra", 33.2),
        
        # Southern India
        (12.8, 13.1, 77.5, 77.7, "Bangalore", "Karnataka", 48.6),
        (13.0, 13.2, 80.1, 80.4, "Chennai", "Tamil Nadu", 44.3),
        (17.3, 17.5, 78.3, 78.6, "Hyderabad", "Telangana", 39.8),
        (11.0, 11.2, 76.9, 77.1, "Coimbatore", "Tamil Nadu", 31.5),
        
        # Eastern India
        (22.5, 22.7, 88.3, 88.5, "Kolkata", "West Bengal", 46.1),
        (25.5, 25.7, 85.1, 85.3, "Patna", "Bihar", 42.7),
        (20.2, 20.4, 85.8, 86.0, "Bhubaneswar", "Odisha", 29.3),
        
        # Central India
        (23.2, 23.4, 77.3, 77.5, "Bhopal", "Madhya Pradesh", 35.4),
        (21.2, 21.4, 81.6, 81.8, "Raipur", "Chhattisgarh", 30.8),
        
        # North-East India
        (26.1, 26.3, 91.7, 91.9, "Guwahati", "Assam", 27.6),
    ]
    
    # Create detailed accident data
    accident_data = []
    
    for lat_min, lat_max, lon_min, lon_max, city, state, base_rate in regions:
        # Calculate center point
        center_lat = (lat_min + lat_max) / 2
        center_lon = (lon_min + lon_max) / 2
        
        # Generate time-based patterns (peak hours have higher rates)
        for hour in range(24):
            # Peak hours: 7-10 AM and 5-9 PM
            time_multiplier = 1.0
            if 7 <= hour <= 10 or 17 <= hour <= 21:
                time_multiplier = 1.4
            elif 0 <= hour <= 5:
                time_multiplier = 0.6
            
            # Weather impact
            for weather in ['Clear', 'Rain', 'Fog']:
                weather_multiplier = 1.0
                if weather == 'Rain':
                    weather_multiplier = 1.5
                elif weather == 'Fog':
                    weather_multiplier = 1.8
                
                accident_rate = base_rate * time_multiplier * weather_multiplier
                
                accident_data.append({
                    'lat_min': lat_min,
                    'lat_max': lat_max,
                    'lon_min': lon_min,
                    'lon_max': lon_max,
                    'center_lat': center_lat,
                    'center_lon': center_lon,
                    'city': city,
                    'state': state,
                    'hour': hour,
                    'weather': weather,
                    'accident_rate': round(accident_rate, 2),
                    'total_accidents_yearly': int(accident_rate * 365),
                    'severity_high_pct': round(np.random.uniform(15, 35), 1),
                    'severity_medium_pct': round(np.random.uniform(40, 60), 1),
                })
    
    df = pd.DataFrame(accident_data)
    
    # Save to JSON for easy lookup
    df.to_json('regional_accident_data.json', orient='records', indent=2)
    
    # Also create a simplified lookup by region
    region_summary = []
    for lat_min, lat_max, lon_min, lon_max, city, state, base_rate in regions:
        region_summary.append({
            'lat_min': lat_min,
            'lat_max': lat_max,
            'lon_min': lon_min,
            'lon_max': lon_max,
            'city': city,
            'state': state,
            'avg_accident_rate': base_rate,
            'total_yearly_accidents': int(base_rate * 365),
            'risk_level': 'High' if base_rate > 40 else 'Medium' if base_rate > 30 else 'Low'
        })
    
    with open('region_summary.json', 'w') as f:
        json.dump(region_summary, f, indent=2)
    
    print(f"Generated {len(accident_data)} accident records")
    print(f"Covering {len(regions)} major regions")
    print("\nRegion Summary:")
    print(pd.DataFrame(region_summary)[['city', 'state', 'avg_accident_rate', 'risk_level']])
    
    return df

if __name__ == "__main__":
    df = generate_regional_accident_data()
