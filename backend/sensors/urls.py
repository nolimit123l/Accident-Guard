from django.urls import path

from .regional_api import RegionalDataAPI
from .views import (
    AlertRecordListAPI,
    EmergencyContactDetailAPI,
    EmergencyContactListCreateAPI,
    LoginAPI,
    LogoutAPI,
    ProfileAPI,
    RegisterAPI,
    SendSMSAlertAPI,
    SensorReadingListAPI,
    TriggerAPI,
)

urlpatterns = [
    path("auth/register/", RegisterAPI.as_view(), name="register"),
    path("auth/login/", LoginAPI.as_view(), name="login"),
    path("auth/logout/", LogoutAPI.as_view(), name="logout"),
    path("profile/", ProfileAPI.as_view(), name="profile"),
    path("contacts/", EmergencyContactListCreateAPI.as_view(), name="contact_list_create"),
    path("contacts/<int:contact_id>/", EmergencyContactDetailAPI.as_view(), name="contact_detail"),
    path("readings/", SensorReadingListAPI.as_view(), name="reading_list"),
    path("alerts/", AlertRecordListAPI.as_view(), name="alert_list"),
    path("sensors/data/", TriggerAPI.as_view(), name="trigger_data"),
    path("sensors/send-alert/", SendSMSAlertAPI.as_view(), name="send_sms_alert"),
    path("sensors/regional-data/", RegionalDataAPI.as_view(), name="regional_data"),
]
