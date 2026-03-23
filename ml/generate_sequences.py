"""
Generate time-series sequences for 1D CNN training.
Creates rolling windows of sensor data (accel + gyro) from the accident dataset.
"""
import numpy as np
import pandas as pd
import os

SEQ_LENGTH = 64  # Number of timesteps per sequence
SENSOR_COLS = ['accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z']
STRIDE = 16  # Step between sequences (lower = more overlap, more samples)


def generate_sequences_from_csv(csv_path='accident_data_synthetic.csv', output_dir='.'):
    """Build sequences from consecutive rows. Each sequence = 64 timesteps x 6 sensors."""
    print(f"Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    sensor_data = df[SENSOR_COLS].values.astype(np.float32)
    targets = df['accident_rate'].values.astype(np.float32)
    
    sequences = []
    sequence_targets = []
    
    for i in range(0, len(df) - SEQ_LENGTH, STRIDE):
        seq = sensor_data[i:i + SEQ_LENGTH]  # (64, 6)
        # Target: max risk in window (peak danger) or mean of last few steps
        tgt = np.max(targets[i:i + SEQ_LENGTH])
        sequences.append(seq)
        sequence_targets.append(tgt)
    
    X = np.array(sequences, dtype=np.float32)  # (N, 64, 6)
    y = np.array(sequence_targets, dtype=np.float32)
    
    # Normalize sensor data (per-channel normalization for stability)
    mean = X.mean(axis=(0, 1))
    std = X.std(axis=(0, 1))
    std[std < 1e-6] = 1.0
    X_norm = (X - mean) / std
    
    # Save
    out_X = os.path.join(output_dir, 'sensor_sequences.npz')
    np.savez(out_X, X=X_norm, y=y, mean=mean, std=std)
    
    print(f"Generated {len(sequences)} sequences of shape ({SEQ_LENGTH}, {len(SENSOR_COLS)})")
    print(f"Target range: [{y.min():.1f}, {y.max():.1f}]")
    print(f"Saved to {out_X}")
    return X_norm, y


if __name__ == "__main__":
    generate_sequences_from_csv()
