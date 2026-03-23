"""
Master script to train all AI/ML models for the Reflex accident prediction system.
Run from the ml/ directory: python train_all.py
"""
import os
import sys

# Ensure we're in ml directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def main():
    print("=" * 60)
    print("Reflex AI/ML Pipeline - Training All Models")
    print("=" * 60)

    # 1. Generate sequence data for 1D CNN (if not exists)
    if not os.path.exists('sensor_sequences.npz'):
        print("\n[1/5] Generating sensor sequences for 1D CNN...")
        from generate_sequences import generate_sequences_from_csv
        generate_sequences_from_csv()
    else:
        print("\n[1/5] sensor_sequences.npz exists, skipping generation.")

    # 2. Random Forest (baseline)
    print("\n[2/5] Training Random Forest...")
    from train_model import train_model
    train_model()

    # 3. MLP neural network
    print("\n[3/5] Training MLP neural network...")
    from train_mlp import train_mlp
    train_mlp()

    # 4. Anomaly detection
    print("\n[4/5] Training anomaly detector (Isolation Forest)...")
    from train_anomaly import train_anomaly_detector
    train_anomaly_detector()

    # 5. 1D CNN
    print("\n[5/5] Training 1D CNN...")
    from train_cnn import train_cnn
    train_cnn()

    print("\n" + "=" * 60)
    print("All models trained successfully!")
    print("Artifacts in ml/: accident_model.pkl, mlp_*.keras, cnn_*.keras, anomaly_*.pkl")
    print("=" * 60)


if __name__ == "__main__":
    main()
