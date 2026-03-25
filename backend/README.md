# Backend Setup

This backend is a Django REST API for the REFLEX accident detection app.

## Run Locally

```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
py -3.11 manage.py migrate
py -3.11 manage.py runserver 0.0.0.0:8000
```

## Main API Prefix

`/api/v1/`

## Core Endpoints

- `/api/v1/auth/register/`
- `/api/v1/auth/login/`
- `/api/v1/profile/`
- `/api/v1/contacts/`
- `/api/v1/sensors/data/`
- `/api/v1/sensors/send-alert/`
