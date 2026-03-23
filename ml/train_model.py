import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os

def train_model():
    # Load dataset
    print("Loading dataset...")
    df = pd.read_csv('accident_data_synthetic.csv')
    
    print(f"Dataset shape: {df.shape}")
    print(f"\nColumns: {df.columns.tolist()}")
    
    # Prepare features
    # Encode categorical variables
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
    
    # Extract hour from time
    df['hour'] = df['time'].apply(lambda x: int(x.split(':')[0]))
    
    # Select features
    feature_columns = [
        'weekday_encoded', 'hour', 'latitude', 'longitude', 'altitude_m',
        'speed_kmph', 'accel_x', 'accel_y', 'accel_z',
        'gyro_x', 'gyro_y', 'gyro_z',
        'weather_encoded', 'traffic_encoded', 'road_class_encoded', 'region_type_encoded'
    ]
    
    X = df[feature_columns]
    y = df['accident_rate']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\nTraining set size: {X_train.shape[0]}")
    print(f"Test set size: {X_test.shape[0]}")
    
    # Train Random Forest model
    print("\nTraining Random Forest model...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    print("\nEvaluating model...")
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    train_mae = mean_absolute_error(y_train, y_pred_train)
    test_mae = mean_absolute_error(y_test, y_pred_test)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
    train_r2 = r2_score(y_train, y_pred_train)
    test_r2 = r2_score(y_test, y_pred_test)
    
    print(f"\nTraining Metrics:")
    print(f"  MAE: {train_mae:.2f}")
    print(f"  RMSE: {train_rmse:.2f}")
    print(f"  R²: {train_r2:.4f}")
    
    print(f"\nTest Metrics:")
    print(f"  MAE: {test_mae:.2f}")
    print(f"  RMSE: {test_rmse:.2f}")
    print(f"  R²: {test_r2:.4f}")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print(f"\nTop 10 Important Features:")
    print(feature_importance.head(10))
    
    # Save model and encoders
    print("\nSaving model and encoders...")
    joblib.dump(model, 'accident_model.pkl')
    joblib.dump(le_weekday, 'encoder_weekday.pkl')
    joblib.dump(le_weather, 'encoder_weather.pkl')
    joblib.dump(le_traffic, 'encoder_traffic.pkl')
    joblib.dump(le_road, 'encoder_road.pkl')
    joblib.dump(le_region, 'encoder_region.pkl')
    
    # Save feature columns for inference
    with open('feature_columns.txt', 'w') as f:
        f.write(','.join(feature_columns))
    
    print("\nModel training complete!")
    print("Saved files:")
    print("  - accident_model.pkl")
    print("  - encoder_*.pkl (5 files)")
    print("  - feature_columns.txt")
    
    return model

if __name__ == "__main__":
    model = train_model()
