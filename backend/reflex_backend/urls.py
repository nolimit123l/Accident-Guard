from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def healthcheck(_request):
    return JsonResponse({"status": "ok", "service": "swift-backend"})

urlpatterns = [
    path("", healthcheck, name="root_healthcheck"),
    path("health/", healthcheck, name="healthcheck"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("sensors.urls")),
]
