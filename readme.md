<div align="center">
  <img src="https://img.shields.io/badge/REFLEX-Accident%20Detection-red?style=for-the-badge&logo=car&logoColor=white" alt="REFLEX Logo"/>
  <h1>🚨 REFLEX - Smartphone Accident Detection System</h1>
  <p><strong>AI-Powered Real-time Vehicle Accident Detection for Indian Roads</strong></p>

  ![Status](https://img.shields.io/badge/Status-In%20Development-orange?style=flat-square)
  ![Personal Project](https://img.shields.io/badge/Type-Personal%20Project-blue?style=flat-square)
  ![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=flat-square)

  <!-- Technology Stack Badges -->
  ![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
  ![Django](https://img.shields.io/badge/Django-4.2+-092E20?style=flat-square&logo=django&logoColor=white)
  ![React Native](https://img.shields.io/badge/React%20Native-0.72+-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![SQLite](https://img.shields.io/badge/SQLite-3.40+-003B57?style=flat-square&logo=sqlite&logoColor=white)
  ![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=flat-square&logo=redis&logoColor=white)
  
  <!-- ML & Data Science -->
  ![scikit-learn](https://img.shields.io/badge/scikit--learn-Latest-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
  ![Pandas](https://img.shields.io/badge/Pandas-Latest-150458?style=flat-square&logo=pandas&logoColor=white)
  ![NumPy](https://img.shields.io/badge/NumPy-Latest-013243?style=flat-square&logo=numpy&logoColor=white)
  
  <!-- Development Tools -->
  ![Docker](https://img.shields.io/badge/Docker-Latest-2496ED?style=flat-square&logo=docker&logoColor=white)
  ![VS Code](https://img.shields.io/badge/VS%20Code-Editor-007ACC?style=flat-square&logo=visual-studio-code&logoColor=white)
  ![Git](https://img.shields.io/badge/Git-Version%20Control-F05032?style=flat-square&logo=git&logoColor=white)
  
  <!-- APIs & Services -->
  ![REST API](https://img.shields.io/badge/API-REST-02569B?style=flat-square&logo=rest&logoColor=white)
  ![Expo](https://img.shields.io/badge/Expo-Mobile%20Dev-000020?style=flat-square&logo=expo&logoColor=white)
  ![Celery](https://img.shields.io/badge/Celery-Task%20Queue-37B24D?style=flat-square&logo=celery&logoColor=white)
</div>

---

## 📋 Table of Contents

- [🎯 About The Project](#-about-the-project)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Built With](#️-built-with)
- [🚀 Getting Started](#-getting-started)
- [📱 Usage](#-usage)
- [🔧 Configuration](#-configuration)
- [📊 Dataset](#-dataset)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👥 Team](#-team)
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🎯 About The Project

**REFLEX** is an intelligent accident detection system specifically designed for Indian road conditions. Using smartphone sensors (accelerometer, gyroscope, GPS) and machine learning algorithms trained on MoRTH (Ministry of Road Transport and Highways) data patterns, the system provides real-time accident detection and automatic emergency response.

### Why REFLEX?

- **53 accidents occur every hour** in India (MoRTH, 2022)
- **19 deaths per hour** due to road accidents
- **Delayed emergency response** increases fatality rates by 30%
- **REFLEX reduces response time** from minutes to seconds

### 🎯 Problem Statement

Traditional accident detection systems rely on manual reporting or expensive infrastructure. REFLEX leverages ubiquitous smartphone sensors to create an affordable, scalable solution for accident detection and emergency response.

---

## ✨ Features

### 🔴 Core Features
- **Real-time Monitoring**: Continuous sensor data analysis at 200ms intervals
- **AI-Powered Detection**: Machine learning models trained on 50,000+ Indian accident scenarios
- **Instant Alerts**: Automatic SMS/Email notifications to emergency contacts
- **False Positive Handling**: Smart confirmation system to prevent unnecessary alerts
- **Offline Capability**: Works without constant internet connectivity

### 📊 Advanced Features
- **Risk Scoring**: Real-time accident probability calculation (0-100%)
- **Contextual Analysis**: Weather, traffic, and road type integration
- **Geographic Coverage**: Optimized for all Indian regions (North to South India)
- **Multi-language Support**: English, Hindi, and regional languages
- **Emergency Services Integration**: Direct connection to local authorities

### 🎛️ Dashboard Features
- **Live Risk Meter**: Visual representation of current accident probability
- **Sensor Visualization**: Real-time accelerometer, gyroscope, and GPS data
- **Trip History**: Detailed journey logs with risk analysis
- **Emergency Contacts Management**: Multiple contact configuration
- **Settings Customization**: Adjustable sensitivity and alert thresholds

---

## 🏗️ Architecture

### System Architecture
```text
REFLEX
├─ Real-time Risk Assessment
├─ User Interface
├─ Background Processing

├─ 🌐 Backend API (Django REST)
│ ├─ User Management
│ ├─ Sensor Data Processing
│ ├─ ML Model Inference
│ └─ Alert Management

├─ 🧠 Machine Learning Pipeline
│ ├─ Data Preprocessing
│ ├─ Feature Engineering
│ ├─ Model Training (Random Forest)
│ └─ Model Deployment

├─ 💾 Data Layer
│ ├─ SQLite (User & Incident Data)
│ ├─ Redis (Real-time Cache)
│ └─ Time-series DB (Sensor Data)

└─ 🚨 Alert System
├─ SMS Gateway (Twilio)
├─ Email Service
├─ Push Notifications
└─ Emergency Services API
```

---

## 🛠️ Built With

### Backend Technologies
- **[Django 4.2+](https://djangoproject.com/)** - Web framework
- **[Django REST Framework](https://www.django-rest-framework.org/)** - API development
- **[SQLite](https://sqlite.org/)** - Primary database
- **[Redis](https://redis.io/)** - Caching and task queue
- **[Celery](https://celeryproject.org/)** - Asynchronous task processing

### Mobile Technologies
- **[React Native 0.72+](https://reactnative.dev/)** - Cross-platform mobile app
- **[Expo](https://expo.dev/)** - Development platform
- **[React Navigation](https://reactnavigation.org/)** - Navigation library
- **[React Native Sensors](https://github.com/react-native-sensors/react-native-sensors)** - Sensor access

### Machine Learning
- **[scikit-learn](https://scikit-learn.org/)** - ML algorithms
- **[pandas](https://pandas.pydata.org/)** - Data manipulation
- **[NumPy](https://numpy.org/)** - Numerical computing
- **[MLflow](https://mlflow.org/)** - ML lifecycle management

### DevOps & Deployment
- **[Docker](https://docker.com/)** - Containerization
- **[Docker Compose](https://docs.docker.com/compose/)** - Multi-container orchestration
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD pipeline
- **[AWS/GCP](https://aws.amazon.com/)** - Cloud deployment

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- **Python 3.11+**
- **Node.js 18+**
- **SQLite 3.40+**
- **Redis 7+**
- **Git**

### Installation

1. Clone repository
```bash
git clone https://github.com/Omii1908/Reflex.git
cd reflex
```

2. Setup Backend (use conda)
```bash
## create & activate conda env (Python 3.11)
conda create -n reflex-backend python=3.11 -y
conda activate reflex-backend

## go to backend and install Python deps
cd backend
pip install -r requirements.txt

## copy env template and edit .env as needed
cp .env.example .env # Windows: copy .env.example .env

## run Django migrations and create admin
python manage.py migrate
python manage.py createsuperuser

## start dev server (accessible on localhost)
python manage.py runserver 0.0.0.0:8000
```

3. Setup Mobile App (Node / Expo)
```bash
# open a new terminal in repo root
cd mobile

# use Node 18+ (install via nvm or nodejs.org if needed)
# install JS deps
npm install
# or: yarn install

# start Expo
npx expo start

# run on emulator/device
npx expo run:android   # Android
npx expo run:ios       # macOS / iOS
```

4. Setup Machine Learning Pipeline (conda)
```bash
## option A: reuse backend env (skip if reusing)
conda create -n reflex-ml python=3.11 -y
conda activate reflex-ml

## install ML deps and train
cd ml
pip install -r requirements.txt
python train_model.py
```

Notes and tips
- To reuse a single Python env for backend + ML, create one env (e.g., reflex-env) and install both requirements files into it.
- Edit .env with your keys (OPENWEATHER_API_KEY, TWILIO_*, DB creds, etc.) before running.
- On Windows PowerShell, use Copy-Item to copy files or use Git Bash for cp.
- If using conda for Node, prefer installing Node via nvm or official installer for best Expo compatibility.

### Docker (recommended all-in-one)

```bash
# start services (backend, db, redis, ml workers, etc.)
docker-compose up -d

# view logs
docker-compose logs -f

# stop and remove containers
docker-compose down
```

---

## 📱 Usage

### Mobile App

1. **Registration & Setup**
   - Download and install the REFLEX app
   - Create account with phone number
   - Add emergency contacts (2-5 contacts recommended)
   - Set risk threshold (default: 25%)

2. **During Travel**
   - Keep app running in background
   - The system automatically monitors sensor data
   - Risk level displayed on dashboard
   - Automatic alerts sent when threshold exceeded

3. **Emergency Response**
   - High-risk event detected → Countdown timer (10 seconds)
   - User can cancel false alarm
   - If not cancelled → Automatic alerts sent
   - GPS location shared with emergency contacts

### API Usage

```python
# Send sensor data to TRIGGER API (replace URL and token)
import requests

url = "http://localhost:8000/api/v1/sensors/data/"
payload = {
    "weekday": "Mon",
    "time": "14:30",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "speed_kmph": 60,
    "accel_x": 0.15,
    "accel_y": 0.10,
    "accel_z": 9.85,
    "gyro_x": 0.02,
    "gyro_y": 0.01,
    "gyro_z": 0.01,
    "weather": "Clear",
    "traffic": "Moderate",
}
headers = {
    "Authorization": "Token your-api-token",
    "Content-Type": "application/json",
}

resp = requests.post(url, json=payload, headers=headers, timeout=10)
resp.raise_for_status()
data = resp.json()
print(f"Risk Score: {data.get('accident_rate', 'N/A')}%")
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Django
SECRET_KEY='your-super-secret-key-here'
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database (SQLite - no configuration needed, uses db.sqlite3 by default)
# For production, consider PostgreSQL or MySQL

# Redis
REDIS_URL=redis://localhost:6379/0

# External APIs
OPENWEATHER_API_KEY=your-openweather-key
GOOGLE_MAPS_API_KEY=your-google-maps-key

# SMS / Email
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Model Configuration

Place runtime-tunable ML parameters in `ml/config.py`. Use environment variables to override defaults in deployments.

```python
# ml/config.py
import os

MODEL_CONFIG = {
    "accident_threshold": float(os.getenv("ACCIDENT_THRESHOLD", "25.0")),   # Risk % threshold to trigger alerts
    "sensor_frequency": int(os.getenv("SENSOR_FREQUENCY_MS", "200")),       # Milliseconds between readings
    "batch_size": int(os.getenv("BATCH_SIZE", "100")),                     # Sensor data batch size for inference/training
    "model_retrain_interval": int(os.getenv("MODEL_RETRAIN_INTERVAL_DAYS", "7")),  # Days between retraining jobs
}
```

---

## 📊 Dataset

### MoRTH-Based Training Data

- **Size**: 50,000 synthetic records
- **Coverage**: All Indian regions (8°N to 32.8°N)
- **Features**: 17 sensor and contextual variables
- **Accident Rate**: 16.1% high-risk scenarios (>25%)

### Data Schema

| Column | Type | Description |
|--------|------|-------------|
| `weekday` | String | Day of week (Mon-Sun) |
| `time` | Time | Hour:minute (24h format) |
| `latitude` | Float | GPS latitude |
| `longitude` | Float | GPS longitude |
| `altitude_m` | Integer | Altitude in meters |
| `speed_kmph` | Integer | Vehicle speed |
| `accel_x/y/z` | Float | Accelerometer readings (m/s²) |
| `gyro_x/y/z` | Float | Gyroscope readings (rad/s) |
| `weather` | String | Weather condition |
| `traffic` | String | Traffic density |
| `road_class` | String | Road type |
| `region_type` | String | Urban/Rural classification |
| `accident_rate` | Float | Risk percentage (0-100%) |

---

## 🤝 Contributing

Contributions welcome.

- Small changes: fork → branch (git checkout -b feature/name) → run tests/linters → commit → open a PR to main.
- Large changes: open an issue first to discuss scope.
- Add tests and update docs when applicable.

Questions: use GitHub Issues/Discussions

### Development Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Code Style

- **Python**: Follow PEP 8, use `black` formatter
- **JavaScript**: Follow Airbnb style guide, use `prettier`
- **Documentation**: Update README and inline comments
- **Testing**: Write tests for new features

---

## 👥 Team

### Core Developers
- **[Om Prakash Kumar]** - *Full Stack Developer & ML Engineer* - [GitHub](https://github.com/Omii1908)

### Contributors
See the list of [contributors](https://github.com/Omii1908/Reflex/contributors) who participated in this project.

---

## 🙏 Acknowledgments

- **Ministry of Road Transport and Highways (MoRTH)** - For accident statistics and research data
- **Open Source Community** - For the amazing tools and libraries
- **React Native Community** - For sensor access libraries
- **Django Community** - For the robust web framework

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/Omii1908/Reflex/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Omii1908/Reflex/discussions)
- **Email**: omi844198@gmail.com
- **Website**: [www.reflexapp.in](https://reflexapp.in)

---

<div align="center">
  <p><strong>Made with ❤️ for Road Safety in India</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Save-Lives-red?style=for-the-badge" alt="Save Lives"/>
    <img src="https://img.shields.io/badge/Technology-For%20Good-green?style=for-the-badge" alt="Technology for Good"/>
  </p>
</div>