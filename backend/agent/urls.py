from django.urls import path
from .views import health, chat

urlpatterns = [
    path("health/", health),
    path("chat/", chat),
]