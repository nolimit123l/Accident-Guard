from django.urls import path
from .views import TriggerAPI, SendSMSAlertAPI
from .regional_api import RegionalDataAPI

urlpatterns = [
    path('data/', TriggerAPI.as_view(), name='trigger_data'),
    path('send-alert/', SendSMSAlertAPI.as_view(), name='send_sms_alert'),
    path('regional-data/', RegionalDataAPI.as_view(), name='regional_data'),
]
